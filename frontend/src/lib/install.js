// "Install app" (PWA). The browser's beforeinstallprompt can fire before React is ready (and
// before login), so it is caught here the moment this file is imported (main.jsx) and kept
// until the sidebar button asks for it. Chrome / Edge / Samsung Internet (Android + desktop)
// give a native prompt; iPhone / iPad Safari have none, so the button shows the manual steps.
import { useSyncExternalStore } from 'react';

let deferred = null; // the saved beforeinstallprompt event
let justInstalled = false; // installed during this visit
const subs = new Set();
const installedCbs = new Set();

const standalone = () =>
  Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: window-controls-overlay)').matches || window.navigator.standalone === true);

/** iPhone / iPod / iPad (iPadOS reports itself as a Mac, but has a touch screen). */
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const compute = () => ({ installed: standalone() || justInstalled, canPrompt: Boolean(deferred), ios: isIos() });
let snap = compute();

function update() {
  snap = compute();
  subs.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no browser mini-bar: our own button decides when to ask
    deferred = e;
    update();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    justInstalled = true;
    update();
    installedCbs.forEach((fn) => fn());
  });
  // Opened as an installed app (or leaving it): the button follows.
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', update);
}

const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

/** { installed, canPrompt (native prompt ready), ios (needs the manual steps) } */
export const useInstall = () => useSyncExternalStore(subscribe, () => snap);

/** Runs fn once the app has been installed (appinstalled). Returns an unsubscribe function. */
export function onInstalled(fn) {
  installedCbs.add(fn);
  return () => installedCbs.delete(fn);
}

/** Opens the browser's install dialog. Resolves 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred;
  deferred = null; // a saved prompt can be used only once
  update();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}
