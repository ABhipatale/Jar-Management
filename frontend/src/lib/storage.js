// Company data kept on the phone (cached settings, offline outbox) is stored under a
// per-company key, so a phone used by two companies — or by the super admin "logging in
// as" a company — never shows or syncs one company's data under another's login.
// Per-phone preferences (language, theme, sidebar) stay shared and use plain keys.

const USER_KEY = 'rws_user';

/** The logged-in user as saved by AuthContext (null when logged out). */
export function savedUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function currentCompanyId() {
  return savedUser()?.company?.id ?? null;
}

/** `rws_outbox` → `rws_outbox:12` for company 12. */
export function companyKey(base) {
  const id = currentCompanyId();
  return id ? `${base}:${id}` : base;
}
