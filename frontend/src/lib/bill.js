// Customer bills: the numbers (from the customer's statement), amount in words, the UPI QR,
// and turning the rendered bill into a PNG for WhatsApp. The three designs live in
// components/bill/BillDesigns.jsx; the bill text is always mr or en (customer-facing).
import { brandName, getBranding, logoSrc } from './branding';

export const BILL_DESIGNS = ['classic', 'modern', 'simple'];

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Bill figures for a period, from GET /customers/:id/ledger?from&to.
 * closing = opening + Σ bill amounts − Σ money received (the same running balance as the statement).
 */
export function buildBill(ledger, settings, { from, to }) {
  const c = ledger.customer;
  const rows = ledger.rows || [];
  const opening = ledger.opening || {};
  const last = rows[rows.length - 1];

  const items = rows
    .filter((r) => r.entry_type !== 'payment')
    .map((r) => {
      const qty = r.entry_type === 'returned' ? r.jars_returned : r.jars_given;
      return {
        id: r.id,
        date: r.entry_date,
        type: r.entry_type, // given | returned
        product: r.product,
        qty,
        rate: r.entry_type === 'given' && qty ? r2(r.amount / qty) : null,
        amount: r.entry_type === 'given' ? r2(r.amount) : null,
        deposit: r2(r.deposit),
      };
    });
  const payments = rows
    .filter((r) => r.entry_type === 'payment')
    .map((r) => ({ id: r.id, date: r.entry_date, amount: r2(r.paid), mode: String(r.description || '').split(' - ')[0] }));

  const sales = r2(items.reduce((s, i) => s + (i.amount || 0), 0));
  const paid = r2(rows.reduce((s, r) => s + (Number(r.paid) || 0), 0));
  const prev = r2(opening.balance);
  const closing = last ? r2(last.balance) : prev;

  const b = getBranding();
  const contacts = String(settings?.contact_numbers || settings?.business_mobile || '')
    .split(/[,\n]/)
    .map((n) => n.trim())
    .filter(Boolean);

  return {
    no: billNo(c.id, from, to),
    from,
    to,
    oneDay: from === to,
    shop: {
      name: settings?.business_name_mr || settings?.business_name || brandName(b),
      nameEn: settings?.business_name || b.name,
      place: settings?.business_place_mr || '',
      address: settings?.business_address || '',
      contacts,
      owner: settings?.owner_name_mr || '',
      logo: logoSrc(settings?.branding || b),
      upi: settings?.upi_id || '',
      qrImage: settings?.pay_qr_url || '',
    },
    customer: { name: c.name, mobile: c.mobile, address: c.address || '' },
    items,
    payments,
    prev,
    sales,
    paid,
    closing,
    jars: last ? last.jar_balance : opening.jar_balance || 0,
    bottles: last ? last.bottle_balance : opening.bottle_balance || 0,
    deposit: r2(last ? last.deposit_balance : opening.deposit_balance),
  };
}

/**
 * A demo bill for the Settings preview: the shop's real name / logo / QR, a sample customer.
 * Built through buildBill() so it looks exactly like a real one.
 */
export function sampleBill(settings, lang = 'mr') {
  const d = (n) => `${new Date().toISOString().slice(0, 8)}${String(n).padStart(2, '0')}`;
  const from = d(1);
  const to = d(28);
  let balance = 200;
  let jars = 2;
  const rows = [];
  const add = (r) => {
    balance += (r.amount || 0) - (r.paid || 0);
    jars += (r.jars_given || 0) - (r.jars_returned || 0);
    rows.push({ id: rows.length + 1, product: 'jar', jars_given: 0, jars_returned: 0, amount: 0, paid: 0, deposit: 0, description: '', ...r, balance, jar_balance: jars, bottle_balance: 0, deposit_balance: 0 });
  };
  add({ entry_date: d(3), entry_type: 'given', jars_given: 4, amount: 120 });
  add({ entry_date: d(7), entry_type: 'returned', jars_returned: 3 });
  add({ entry_date: d(10), entry_type: 'given', jars_given: 5, amount: 150, paid: 100 });
  add({ entry_date: d(15), entry_type: 'payment', paid: 150, description: 'UPI' });
  add({ entry_date: d(18), entry_type: 'given', jars_given: 3, amount: 90 });
  add({ entry_date: d(24), entry_type: 'given', jars_given: 4, amount: 120 });
  const customer = lang === 'en'
    ? { id: 7, name: 'Rahul Patil', mobile: '9876543210', address: 'Shivaji Nagar' }
    : { id: 7, name: 'राहुल पाटील', mobile: '9876543210', address: 'शिवाजी नगर' };
  return buildBill({ customer, rows, opening: { balance: 200, jar_balance: 2 } }, settings, { from, to });
}

/** B-2610-045 (month bill) or B-261024-045 (one day): stable, so re-sending gives the same number. */
function billNo(customerId, from, to) {
  const ymd = (to || from || '').replace(/-/g, '').slice(2);
  const id = String(customerId).padStart(3, '0');
  return from === to ? `B-${ymd}-${id}` : `B-${ymd.slice(0, 4)}-${id}`;
}

// ── Amount in words (Indian system: crore / lakh / thousand / hundred) ──

const MR = (
  'शून्य एक दोन तीन चार पाच सहा सात आठ नऊ दहा अकरा बारा तेरा चौदा पंधरा सोळा सतरा अठरा एकोणीस वीस ' +
  'एकवीस बावीस तेवीस चोवीस पंचवीस सव्वीस सत्तावीस अठ्ठावीस एकोणतीस तीस एकतीस बत्तीस तेहेतीस चौतीस पस्तीस छत्तीस सदतीस अडतीस एकोणचाळीस चाळीस ' +
  'एक्केचाळीस बेचाळीस त्रेचाळीस चव्वेचाळीस पंचेचाळीस सेहेचाळीस सत्तेचाळीस अठ्ठेचाळीस एकोणपन्नास पन्नास ' +
  'एक्कावन्न बावन्न त्रेपन्न चोपन्न पंचावन्न छप्पन्न सत्तावन्न अठ्ठावन्न एकोणसाठ साठ ' +
  'एकसष्ट बासष्ट त्रेसष्ट चौसष्ट पासष्ट सहासष्ट सदुसष्ट अडुसष्ट एकोणसत्तर सत्तर ' +
  'एक्काहत्तर बाहत्तर त्र्याहत्तर चौऱ्याहत्तर पंच्याहत्तर शहात्तर सत्याहत्तर अठ्ठ्याहत्तर एकोणऐंशी ऐंशी ' +
  'एक्याऐंशी ब्याऐंशी त्र्याऐंशी चौऱ्याऐंशी पंच्याऐंशी शहाऐंशी सत्त्याऐंशी अठ्ठ्याऐंशी एकोणनव्वद नव्वद ' +
  'एक्याण्णव ब्याण्णव त्र्याण्णव चौऱ्याण्णव पंच्याण्णव शहाण्णव सत्त्याण्णव अठ्ठ्याण्णव नव्व्याण्णव'
).split(' ');

const EN_ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const en99 = (n) => (n < 20 ? EN_ONES[n] : EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : ''));

function indianWords(n, lang) {
  const two = lang === 'mr' ? (x) => MR[x] : en99;
  const unit = lang === 'mr'
    ? { crore: 'कोटी', lakh: 'लाख', thousand: 'हजार', hundred: 'शे' }
    : { crore: 'crore', lakh: 'lakh', thousand: 'thousand', hundred: 'hundred' };
  if (n === 0) return two(0);
  const parts = [];
  const push = (v, word) => v && parts.push(`${indianWords(v, lang)} ${word}`);
  push(Math.floor(n / 10000000), unit.crore);
  n %= 10000000;
  push(Math.floor(n / 100000), unit.lakh);
  n %= 100000;
  push(Math.floor(n / 1000), unit.thousand);
  n %= 1000;
  if (n >= 100) parts.push(lang === 'mr' ? `${MR[Math.floor(n / 100)]}${unit.hundred}` : `${EN_ONES[Math.floor(n / 100)]} ${unit.hundred}`);
  n %= 100;
  if (n) parts.push(two(n));
  return parts.join(' ');
}

/** "दोनशे वीस रुपये फक्त" / "Rupees two hundred twenty only". Paise are added when present. */
export function amountInWords(amount, lang = 'mr') {
  const v = Math.abs(r2(amount));
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  if (lang === 'mr') {
    return `${indianWords(rupees, 'mr')} रुपये${paise ? ` ${indianWords(paise, 'mr')} पैसे` : ''} फक्त`;
  }
  const w = `Rupees ${indianWords(rupees, 'en')}${paise ? ` and ${indianWords(paise, 'en')} paise` : ''} only`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ── QR + images ──

/** UPI QR (with the amount filled in) as a data URL, or null without a UPI ID. */
export async function upiQr(upi, payee, amount) {
  if (!upi) return null;
  const { toDataURL } = await import('qrcode');
  const am = amount > 0 ? `&am=${r2(amount).toFixed(2)}` : '';
  const uri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payee || '')}${am}&cu=INR`;
  return toDataURL(uri, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
}

/**
 * Image URL → small data URL (longest side ≤ maxSide px), so the logo / QR photo end up
 * inside the PNG. Big phone photos are shrunk: inside the bill image, phones often leave a
 * large picture blank. Null when it can't be read.
 */
export async function inlineImage(url, maxSide = 480) {
  if (!url || url.startsWith('data:')) return url || null;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const src = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(src);
    }
  } catch {
    return null;
  }
}

/**
 * The rendered bill as a PNG Blob (2× for sharp text on phones).
 * Waits until every picture (logo, QR) is decoded, then draws twice and keeps the second:
 * on phones the first drawing can leave pictures blank.
 */
export async function billPng(node) {
  const { toBlob } = await import('html-to-image');
  await Promise.all([...node.querySelectorAll('img')].map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
  // The bill uses the phone's own fonts, so nothing needs embedding (faster, works offline).
  const opts = { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true };
  await toBlob(node, opts).catch(() => null);
  return toBlob(node, opts);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Share the bill image through the phone's share sheet (WhatsApp shows up there).
 * Returns 'shared', 'cancelled' or 'unsupported' (computer / iPhone without file sharing).
 */
export async function shareBillImage(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}
