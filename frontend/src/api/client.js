import axios from 'axios';
import { lang, t } from '../i18n';

const TOKEN_KEY = 'rws_token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token, remember) {
    try {
      this.clear();
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
    } catch {
      /* storage blocked – session will just not persist */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

const api = axios.create({
  // On Vercel the API is served from the same domain under /api (see root vercel.json), so
  // VITE_API_URL stays unset. Set it only when the API runs elsewhere, e.g. local `php artisan serve`.
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
  headers: { Accept: 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  // Server answers (validation / messages) in the app's language.
  config.headers['X-Locale'] = lang;
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Vercel's proxy drops Authorization before it reaches the Laravel container; the API also reads this.
    config.headers['X-Auth-Token'] = token;
  }
  return config;
});

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// The company's plan ran out while the app was open: switch to the plans screen.
let onExpired = () => {};
export function setExpiredHandler(fn) {
  onExpired = fn;
}

// 403 with one of these codes = the company was suspended / expired or the user disabled
// while logged in: log out and show the reason on the login screen.
const BLOCKED = ['company_suspended', 'user_inactive', 'no_company'];
const REASON_KEY = 'rws_logout_reason';

export function takeLogoutReason() {
  try {
    const r = sessionStorage.getItem(REASON_KEY);
    sessionStorage.removeItem(REASON_KEY);
    return r;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.endsWith('/login')) {
      onUnauthorized();
    }
    if (err.response?.status === 403 && BLOCKED.includes(err.response.data?.code)) {
      try {
        sessionStorage.setItem(REASON_KEY, err.response.data.message || '');
      } catch {
        /* ignore */
      }
      onUnauthorized();
    }
    if (err.response?.status === 403 && err.response.data?.code === 'company_expired') {
      onExpired();
    }
    return Promise.reject(err);
  }
);

export const GENERIC_ERROR = t('err.generic');

/** True when the request failed because we could not reach the server at all. */
export function isNetworkError(err) {
  return !err?.response && (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED' || !navigator.onLine);
}

/** Turn any API error into one short, human message. Never shows stack traces. */
export function errorMessage(err) {
  if (isNetworkError(err)) return t('err.network');
  const data = err?.response?.data;
  if (err?.response?.status === 422 && data) {
    if (data.errors) {
      const first = Object.values(data.errors)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (data.message) return data.message;
  }
  if (err?.response?.status < 500 && data?.message) return data.message;
  return GENERIC_ERROR;
}

export default api;
