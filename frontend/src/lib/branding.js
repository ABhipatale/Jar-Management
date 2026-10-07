import { useEffect, useState } from 'react';
import defaultLogo from '../assets/logo.png';
import api from '../api/client';
import { lang, t } from '../i18n';

/**
 * Name, logo and install icons of the company using this phone — or of the
 * platform before anyone has logged in. Saved on the phone so the app (and index.html's
 * splash, before React loads) starts with the right brand, even offline.
 *
 * The <link rel="manifest"> is pointed at the company's manifest, so "Install app" /
 * "Add to Home screen" uses the company's name and icon.
 */
const KEY = 'rws_branding';
const EVENT = 'rws:branding';

const DEFAULT = {
  company: null,
  // The product name, used until the server says which company (or the platform) this is.
  name: 'EasyJar',
  name_mr: 'EasyJar',
  short_name: 'EasyJar',
  logo_url: null,
  icons: {
    'icon-192': '/icons/icon-192.png',
    'icon-512': '/icons/icon-512.png',
    'maskable-512': '/icons/maskable-512.png',
    'apple-touch': '/icons/apple-touch-icon.png',
  },
  manifest_url: '/api/manifest.webmanifest',
};

export function getBranding() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULT;
  }
}

export function setBranding(b) {
  if (!b) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage blocked: applies for this visit only */
  }
  applyBranding(b);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: b }));
}

export function brandName(b = getBranding()) {
  return lang === 'mr' ? b.name_mr || b.name : b.name;
}

export function logoSrc(b = getBranding()) {
  return b.logo_url || defaultLogo;
}

function setHead(selector, create, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
}

const link = (rel) => () => Object.assign(document.createElement('link'), { rel });
const meta = (name) => () => Object.assign(document.createElement('meta'), { name });

/** Browser-tab icon: the company's own logo when it uploaded one, otherwise EasyJar's. */
function setFavicon(b) {
  const own = b.logo_url ? b.icons?.['icon-192'] : null;
  document.head.querySelectorAll('link[rel="icon"]').forEach((el) => {
    const easyJar = el.getAttribute('type') === 'image/png' ? '/favicon.png' : '/favicon.ico';
    const href = own || easyJar;
    if (el.getAttribute('href') !== href) el.setAttribute('href', href);
  });
}

/** Puts the company on the page: title, manifest, icons. (Colours are the app's own, the same for everyone.) */
export function applyBranding(b = getBranding()) {
  setFavicon(b);
  document.title = `${brandName(b)} – ${t('common.jarMgmt')}`;
  setHead('link[rel="manifest"]', link('manifest'), 'href', b.manifest_url);
  setHead('link[rel="apple-touch-icon"]', link('apple-touch-icon'), 'href', b.icons?.['apple-touch']);
  setHead('meta[name="apple-mobile-web-app-title"]', meta('apple-mobile-web-app-title'), 'content', b.short_name);
  setHead('meta[name="description"]', meta('description'), 'content', `${brandName(b)} – ${t('common.jarMgmt')}`);
}

/** Fresh branding from the server: the given company's, or the platform's. Keeps the saved copy offline. */
export async function refreshBranding(slug) {
  try {
    const { data } = await api.get(slug ? `/companies/${encodeURIComponent(slug)}/branding` : '/branding');
    setBranding(data);
    return data;
  } catch {
    return getBranding();
  }
}

/** Current branding; re-renders when it changes. */
export function useBranding() {
  const [b, setB] = useState(getBranding);
  useEffect(() => {
    const on = (e) => setB(e.detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return b;
}
