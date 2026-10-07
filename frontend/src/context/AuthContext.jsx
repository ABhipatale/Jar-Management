import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { setExpiredHandler, setUnauthorizedHandler, tokenStore } from '../api/client';
import { refreshBranding } from '../lib/branding';
import { companyKey, savedUser } from '../lib/storage';

const AuthContext = createContext(null);

const USER_KEY = 'rws_user';
// While the super admin is "logged in as" a company, their own session waits here.
const ADMIN_SESSION_KEY = 'rws_admin_session';

async function clearApiCache() {
  try {
    await caches?.delete('api-cache');
  } catch {
    /* no Cache API */
  }
}

function saveUser(user, remember) {
  try {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

function adminSession() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Company users see their company's brand; the super admin sees the platform's. */
function brandFor(user) {
  return refreshBranding(user?.company?.slug || null);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (tokenStore.get() ? savedUser() : null));

  const clear = useCallback(() => {
    // Cached settings of this company; its offline outbox stays (per-company key) and
    // syncs the next time someone of the same company logs in on this phone.
    try {
      localStorage.removeItem(companyKey('rws_settings'));
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    clearApiCache();
    setUser(null);
  }, []);

  /** Re-read role/company (plan end date, auto-pay) from the server. */
  const refreshMe = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const { data } = await api.get('/me');
      const remember = Boolean(localStorage.getItem(USER_KEY));
      saveUser(data.user, remember);
      setUser(data.user);
      brandFor(data.user);
    } catch {
      /* offline: keep the saved user */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    setExpiredHandler(refreshMe);
  }, [clear, refreshMe]);

  // Once per app start; a suspended company gets a 403 here, an expired one sees the plans.
  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const start = (token, nextUser, remember) => {
    tokenStore.set(token, remember);
    saveUser(nextUser, remember);
    setUser(nextUser);
    brandFor(nextUser);
  };

  const login = async (loginId, password, remember) => {
    const { data } = await api.post('/login', { login: loginId, password, remember });
    start(data.token, data.user, remember);
  };

  const logout = async () => {
    const admin = user?.impersonating ? adminSession() : null;
    try {
      await api.post('/logout');
    } catch {
      /* token may already be gone */
    }
    if (admin) return exitTo(admin);
    clear();
  };

  /** Super admin → act as a company's owner (support). */
  const impersonate = async (companyId) => {
    const { data } = await api.post(`/admin/companies/${companyId}/impersonate`);
    try {
      const remember = Boolean(localStorage.getItem(USER_KEY));
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token: tokenStore.get(), user, remember }));
    } catch {
      /* without storage the admin just logs in again afterwards */
    }
    await clearApiCache();
    start(data.token, data.user, false);
  };

  const exitTo = async (admin) => {
    try {
      localStorage.removeItem(companyKey('rws_settings'));
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignore */
    }
    await clearApiCache();
    start(admin.token, admin.user, Boolean(admin.remember));
  };

  /** Back to the super-admin panel (ends the company session). */
  const stopImpersonating = () => logout();

  return (
    <AuthContext.Provider value={{ user, login, logout, impersonate, stopImpersonating, refreshMe }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
