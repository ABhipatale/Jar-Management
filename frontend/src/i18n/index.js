// Two-language UI (Marathi default, English optional), chosen per phone in Settings.
//
//   import { t } from '../i18n';
//   t('entry.saved')                       -> text in the current language
//   t('entry.onlyAvailable', { n: 5 })     -> fills {n} in the text
//
// Text lives in one dictionary file per app area (shell / entry / reports), each shaped
// { mr: { key: 'मराठी' }, en: { key: 'English' } }. Changing language reloads the app,
// so t() can be a plain function used anywhere (components, api client, helpers).
import shell from './shell';
import entry from './entry';
import reports from './reports';

const STORAGE_KEY = 'rws_lang';
export const LANGS = { mr: 'मराठी', en: 'English' };

export function getLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'mr';
  } catch {
    return 'mr';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang === 'en' ? 'en' : 'mr');
  } catch {
    /* storage blocked: stays Marathi */
  }
  window.location.reload();
}

export const lang = getLang();

const parts = [shell, entry, reports];
const dict = Object.assign({}, ...parts.map((p) => p[lang] || {}));
const fallback = Object.assign({}, ...parts.map((p) => p.mr || {}));

export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  return s;
}

if (typeof document !== 'undefined') document.documentElement.lang = lang;

/** Same as t(), without a leading emoji — for labels that already show a Lucide icon. */
export function tx(key, vars) {
  return t(key, vars).replace(/^\s*\p{Extended_Pictographic}️?\s*/u, '');
}
