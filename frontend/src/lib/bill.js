// Customer bills: the numbers (from the customer's statement), amount in words, and turning
// the rendered bill into a PDF for WhatsApp. The three designs live in
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

  // One row per day: several entries on the same day are merged (same product → summed).
  const dayMap = new Map();
  items.forEach((i) => {
    if (!dayMap.has(i.date)) dayMap.set(i.date, { date: i.date, given: [], returned: [], qty: 0, amount: 0 });
    const d = dayMap.get(i.date);
    const list = i.type === 'returned' ? d.returned : d.given;
    const line = list.find((x) => x.product === i.product);
    if (line) {
      line.qty += i.qty;
      line.amount += i.amount || 0;
      line.deposit += i.deposit || 0;
    } else {
      list.push({ product: i.product, qty: i.qty, amount: i.amount || 0, deposit: i.deposit || 0 });
    }
    if (i.type !== 'returned') {
      d.qty += i.qty;
      d.amount = r2(d.amount + (i.amount || 0));
    }
  });
  const days = [...dayMap.values()].map((d) => ({
    ...d,
    given: d.given.map((g) => ({ ...g, amount: r2(g.amount), rate: g.qty ? r2(g.amount / g.qty) : null })),
  }));
  const totalQty = days.reduce((s, d) => s + d.qty, 0);

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
      hasStamp: !!settings?.has_stamp,
    },
    customer: { name: c.name, mobile: c.mobile, address: c.address || '' },
    items,
    days,
    totalQty,
    // Only when a UPI ID is saved in Settings: the bill then shows a pay-now QR.
    upi: settings?.upi_id ? { id: settings.upi_id, name: settings?.business_name || b.name || '' } : null,
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

// ── UPI QR ──

/** UPI QR (data URL) for the amount due, or null when there is no UPI ID or nothing to pay. */
export async function upiQr(bill) {
  if (!bill?.upi?.id || !(bill.closing > 0)) return null;
  const q = new URLSearchParams({ pa: bill.upi.id, pn: bill.upi.name, am: bill.closing.toFixed(2), cu: 'INR' });
  try {
    const { toDataURL } = await import('qrcode');
    return await toDataURL(`upi://pay?${q.toString().replace(/\+/g, '%20')}`, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

// ── Images ──

/** Image URL → data URL, so the logo ends up inside the PDF. Null when it can't be read. */
export async function inlineImage(url) {
  if (!url || url.startsWith('data:')) return url || null;
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
 * The bill as a one-page PDF: the bill picture (sharp JPEG) on a page as wide as A4 and as
 * tall as the bill. Marathi text looks exactly as on screen (PDF font tools can't shape it).
 * Written by hand — a PDF with one image is a few objects, no library needed.
 */
export async function billPdf(node) {
  const { toCanvas } = await import('html-to-image');
  // Logo / stamp / QR must be fully decoded before the picture is taken, or they come out blank.
  await Promise.all([...node.querySelectorAll('img')].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  const opts = { pixelRatio: 2, backgroundColor: '#ffffff', skipFonts: true };
  await toCanvas(node, opts); // warm-up pass: browsers often drop images on the very first capture
  const canvas = await toCanvas(node, opts);
  const jpeg = new Uint8Array(await (await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92))).arrayBuffer());

  const W = 595.28; // A4 width in points
  const H = Math.round(((W * canvas.height) / canvas.width) * 100) / 100;
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let size = 0;
  const push = (x) => {
    const bytes = typeof x === 'string' ? enc.encode(x) : x;
    parts.push(bytes);
    size += bytes.length;
  };
  const obj = (n, body) => {
    offsets[n] = size;
    push(`${n} 0 obj\n`);
    body();
    push('\nendobj\n');
  };
  const draw = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;

  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream');
  });
  obj(5, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  const xref = size;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/**
 * Share a bill file (PDF) through the phone's share sheet (WhatsApp shows up there).
 * Returns 'shared', 'cancelled' or 'unsupported' (computer / phone without file sharing).
 */
export async function shareBillFile(blob, filename, text) {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}
