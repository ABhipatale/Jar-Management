import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { setUnauthorizedHandler, tokenStore } from '../api/client';

const AuthContext = createContext(null);

const USER_KEY = 'rws_user';

function cachedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

async function clearApiCache() {
  try {
    await caches?.delete('api-cache');
  } catch {
    /* no Cache API */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (tokenStore.get() ? cachedUser() : null));

  const clear = useCallback(() => {
    tokenStore.clear();
    try {
      localStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    clearApiCache();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
  }, [clear]);

  const login = async (loginId, password, remember) => {
    const { data } = await api.post('/login', { login: loginId, password, remember });
    tokenStore.set(data.token, remember);
    try {
      (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(data.user));
    } catch {
      /* ignore */
    }
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/logout');
    } catch {
      /* token may already be gone */
    }
    clear();
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
