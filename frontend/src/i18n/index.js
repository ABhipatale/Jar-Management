// UI languages: Marathi (default) and English everywhere; Hindi as a third choice in Settings
// (the login screen offers only Marathi / English). Chosen per phone.
//
//   import { t } from '../i18n';
//   t('entry.saved')                       -> text in the current language
//   t('entry.onlyAvailable', { n: 5 })     -> fills {n} in the text
//
// Text lives in one dictionary file per app area (shell / entry / reports / admin), each shaped
// { mr: { key: 'मराठी' }, en: { key: 'English' } }; Hindi is in ./hi/<area>.json (key → text).
// A missing Hindi text falls back to Marathi. Changing language reloads the app,
// so t() can be a plain function used anywhere (components, api client, helpers).
import shell from './shell';
import entry from './entry';
import reports from './reports';
import admin from './admin';
import products from './products';
import hiShell from './hi/shell.json';
import hiEntry from './hi/entry.json';
import hiReports from './hi/reports.json';
import hiAdmin from './hi/admin.json';
import hiProducts from './hi/products.json';

const STORAGE_KEY = 'rws_lang';
/** All languages (Settings). */
export const LANGS = { mr: 'मराठी', hi: 'हिंदी', en: 'English' };
/** Languages offered on the login screen. */
export const LOGIN_LANGS = { mr: 'मराठी', en: 'English' };

const known = (l) => (l in LANGS ? l : 'mr');

export function getLang() {
  try {
    return known(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'mr';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, known(lang));
  } catch {
    /* storage blocked: stays Marathi */
  }
  window.location.reload();
}

export const lang = getLang();
/** Devanagari UI (Marathi or Hindi): use the Marathi version of names entered by the business. */
export const isDeva = lang !== 'en';
/** Locale for dates/numbers (Latin digits in Marathi/Hindi, like the rest of the app). */
export const LOCALE = { mr: 'mr-IN-u-nu-latn', hi: 'hi-IN-u-nu-latn', en: 'en-IN' }[lang];

const parts = [shell, entry, reports, admin, products];
const HINDI = [hiShell, hiEntry, hiReports, hiAdmin, hiProducts];
// Empty Hindi strings count as missing (fall back to Marathi).
const dict = lang === 'hi'
  ? Object.fromEntries(HINDI.flatMap((h) => Object.entries(h)).filter(([, v]) => v))
  : Object.assign({}, ...parts.map((p) => p[lang] || {}));
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
