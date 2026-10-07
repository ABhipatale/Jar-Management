import api, { isNetworkError, errorMessage } from '../api/client';
import { companyKey } from './storage';

/**
 * Offline outbox for jar entries, payments and expenses.
 *
 * Every save carries a client_uuid generated once when the form is opened.
 * The server stores that uuid with a UNIQUE index and returns the existing
 * record if it sees the same uuid again — so a save that is retried, or synced
 * later from this outbox, can never create a duplicate transaction.
 */
// One outbox per company: an entry saved offline is only ever sent with that company's login.
const key = () => companyKey('rws_outbox');
const listeners = new Set();
let syncing = false;

// Before multi-company the outbox had one shared key. Saves waiting there came from the
// only company of that time, so they move to the first company that logs in on this phone.
function adoptLegacy() {
  const k = key();
  const legacy = localStorage.getItem('rws_outbox');
  if (k === 'rws_outbox' || !legacy) return;
  const mine = JSON.parse(localStorage.getItem(k) || '[]');
  const ids = new Set(mine.map((i) => i.id));
  localStorage.setItem(k, JSON.stringify([...mine, ...JSON.parse(legacy).filter((i) => !ids.has(i.id))]));
  localStorage.removeItem('rws_outbox');
}

function read() {
  try {
    adoptLegacy();
    return JSON.parse(localStorage.getItem(key()) || '[]');
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(key(), JSON.stringify(items));
  } catch {
    /* storage full / blocked */
  }
  listeners.forEach((fn) => fn(items));
}

export function outboxItems() {
  return read();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function discard(id) {
  write(read().filter((i) => i.id !== id));
}

/**
 * POST now; if there is no internet, keep it in the outbox.
 * Resolves to { data } on success or { queued: true } when stored offline.
 * Validation/server errors are thrown so the form can show them.
 */
export async function submit(url, body, label) {
  try {
    const res = await api.post(url, body);
    return { data: res.data };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const items = read();
    if (!items.some((i) => i.body.client_uuid === body.client_uuid)) {
      items.push({ id: body.client_uuid, url, body, label, createdAt: new Date().toISOString() });
      write(items);
    }
    return { queued: true };
  }
}

/** Send queued items in order. Returns number synced. */
export async function syncOutbox() {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let done = 0;
  try {
    for (const item of read()) {
      if (item.error) continue;
      try {
        await api.post(item.url, item.body);
        write(read().filter((i) => i.id !== item.id));
        done++;
      } catch (err) {
        if (isNetworkError(err) || err.response?.status >= 500 || err.response?.status === 401) break;
        // Rejected by the server (e.g. return > jars held). Keep it so the owner can see and discard it.
        write(read().map((i) => (i.id === item.id ? { ...i, error: errorMessage(err) } : i)));
      }
    }
  } finally {
    syncing = false;
  }
  return done;
}
