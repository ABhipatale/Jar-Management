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

/** Ask permission and register this phone. Throws Error('unsupported'|'denied'|'server'|'nosw'). */
export async function enablePush() {
  if (!pushSupported()) throw new Error('unsupported');
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
  const sub = await currentSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Tell the header bell to refresh its count. */
export function refreshBell() {
  window.dispatchEvent(new Event('rws:notifications'));
}
