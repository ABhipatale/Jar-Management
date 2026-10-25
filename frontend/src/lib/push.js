import api from '../api/client';

/**
 * Phone notifications (Web Push). Works on Android Chrome and installed apps; on iPhone
 * only after "Add to Home Screen" (iOS 16.4+). The service worker shows the notification
 * (public/push-sw.js).
 */
export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyToBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Service worker registration, or null if none within a few seconds (e.g. dev mode). */
async function registration() {
  if (!pushSupported()) return null;
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
  return Promise.race([ready, timeout]);
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

// Notifications are ON by default. These per-phone flags only remember the user's own choices.
const OFF_KEY = 'rws_push_off'; // the user turned notifications off on this phone
const LATER_KEY = 'rws_push_later'; // "later" on the prompt: ask again after this time (ms)
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

/** Ask permission and register this phone. Throws Error('unsupported'|'denied'|'server'|'nosw'). */
export async function enablePush() {
  if (!pushSupported()) throw new Error('unsupported');
  store.set(OFF_KEY, null);
  store.set(LATER_KEY, null);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');

  const { data } = await api.get('/push/key');
  if (!data.enabled || !data.publicKey) throw new Error('server');

  const reg = await registration();
  if (!reg) throw new Error('nosw');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) });
  await api.post('/push/subscribe', sub.toJSON());
  return sub;
}

export async function disablePush() {
  store.set(OFF_KEY, '1');
  const sub = await currentSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * Called after login. Already allowed on this phone → (re)register silently, no question.
 * Returns true when the app should show the one-tap "turn on notifications" prompt.
 * (Browsers only allow the permission question after a tap on iPhone, so we can't ask by ourselves.)
 */
export async function autoPush() {
  if (!pushSupported() || store.get(OFF_KEY)) return false;
  if (Notification.permission === 'granted') {
    try { await enablePush(); } catch { /* server without keys / no service worker: stay quiet */ }
    return false;
  }
  if (Notification.permission === 'denied') return false;
  const later = Number(store.get(LATER_KEY) || 0);
  return Date.now() >= later;
}

/** "Later" on the prompt: ask again in 3 days. */
export function pushLater() {
  store.set(LATER_KEY, String(Date.now() + 3 * 24 * 3600 * 1000));
}

/** Tell the header bell to refresh its count. */
export function refreshBell() {
  window.dispatchEvent(new Event('rws:notifications'));
}
