/**
 * Phone contacts via the Contact Picker API (Chrome on Android, incl. the installed PWA).
 * The user picks ONE contact in the phone's own picker; we only ever receive that contact's
 * name and numbers — never the whole address book. Nothing is sent to the server from here.
 */

export function contactsSupported() {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && typeof navigator.contacts?.select === 'function' && window.isSecureContext;
}

/**
 * Indian mobile number → 10 digits, or null if it isn't one.
 * Accepts +91 / 91 / 0 prefixes, spaces, hyphens, brackets: "+91 98220-01122" → "9822001122".
 */
export function normalizeMobile(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/**
 * Opens the phone's contact picker (must be called from a tap).
 * Resolves { name, mobiles: ['98…'] } (unique valid Indian mobiles, in contact order),
 * or null when the user cancels. Throws Error('unsupported') or the browser's error.
 */
export async function pickContact() {
  if (!contactsSupported()) throw new Error('unsupported');
  const [c] = await navigator.contacts.select(['name', 'tel'], { multiple: false });
  if (!c) return null; // cancelled
  const name = (c.name || []).map((n) => String(n).trim()).find(Boolean) || '';
  const mobiles = [...new Set((c.tel || []).map(normalizeMobile).filter(Boolean))];
  return { name, mobiles };
}
