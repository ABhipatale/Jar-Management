import { brandName } from './branding';
import { fmtDate, today } from './format';

// Default WhatsApp templates (customer-facing, always Marathi). The shop can edit them in
// Settings. WhatsApp formatting: *bold*, _italic_. {footer} is the shared closing block
// (thanks, home-delivery line, shop name, contact numbers, owner) — it is added at the end
// automatically if a custom template leaves it out.
const LINE = '━━━━━━━━━━━━━━';

export const DEFAULT_FOOTER = `${LINE}
धन्यवाद 🙏
🚚 _आपल्या आवश्यकतेनुसार आपणास घरपोच जार सेवा दिली जाईल._

💧 *{shop_name}*, {shop_place}
✨ शुद्ध पाणी... निरोगी जीवन...!

📞 *संपर्क*
{contact_lines}
👤 {owner_name}`;

export const DEFAULT_TEMPLATES = {
  wa_delivery: `🙏 *नमस्कार {customer_name}*,

💧 आज दिनांक *{date}* रोजी आपल्याला *{jar_quantity} पाण्याचे जार* देण्यात आले आहेत.
{return_line}
🧾 *बिल तपशील*
${LINE}
▫️ जार दर : ₹{rate}
▫️ एकूण रक्कम : *₹{amount}*
✅ भरलेली रक्कम : ₹{paid}
📒 आजची उधारी : ₹{udhari}
${LINE}

💰 *उधारी हिशोब*
${LINE}
▫️ मागील बाकी : ₹{previous_pending}
➕ आजची उधारी : ₹{udhari}
{advance_line}🔴 *एकूण बाकी : ₹{total_pending}*
${LINE}

💧 सध्या आपल्याकडे एकूण *{current_jars} जार* आहेत.

{footer}`,
  wa_return: `🙏 *नमस्कार {customer_name}*,

↩️ आज दिनांक *{date}* रोजी *{returned_jars} पाण्याचे जार* परत मिळाले.

💧 सध्या आपल्याकडे एकूण *{current_jars} जार* आहेत.
💰 एकूण बाकी : *₹{total_pending}*

{footer}`,
  wa_payment: `🙏 *नमस्कार {customer_name}*,

✅ आपले *₹{paid_amount}* पेमेंट आज दिनांक *{date}* रोजी प्राप्त झाले आहे.

🧾 *पेमेंट पावती*
${LINE}
▫️ मागील बाकी : ₹{previous_pending}
✅ भरलेली रक्कम : *₹{paid_amount}*
📒 शिल्लक बाकी : *₹{remaining_pending}*

{footer}`,
  wa_reminder: `🙏 *नमस्कार {customer_name}*,

🔔 आपल्या खात्यावर *₹{pending_amount}* रक्कम बाकी आहे.

कृपया सोयीने आपली बाकी रक्कम जमा करावी. 🙏

{footer}`,
  wa_summary: `💧 *{shop_name}*, {shop_place}

📊 *आजचा व्यवहार*
📅 दिनांक: *{date}*
${LINE}
📤 आज दिलेले जार : *{given}*
📥 आज परत आलेले जार : *{returned}*

💵 आजची Cash Collection : *₹{cash}*
📒 आजची Udhari : ₹{udhari}
✅ आज मिळालेले Payment : ₹{payments}

⏳ एकूण Pending : *₹{pending}*

{footer}`,
};

function amt(v) {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** "250" for money owed; "0 (आगाऊ जमा ₹50)" when the customer has paid in advance. */
function pendingAmt(v) {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n < 0 ? `0 (आगाऊ जमा ₹${amt(-n)})` : amt(n);
}

export function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    values[key] !== undefined && values[key] !== null ? String(values[key]) : m
  );
}

function shopValues(settings) {
  const base = {
    shop_name: settings?.business_name_mr || settings?.business_name || brandName(),
    shop_place: settings?.business_place_mr || '',
    owner_name: settings?.owner_name_mr || '',
    contact_lines: String(settings?.contact_numbers || '')
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => `📱 ${n}`)
      .join('\n'),
  };
  return { ...base, footer: footerFor(base) };
}

/** The closing block, leaving out place / contacts / owner when the company has not set them. */
function footerFor(base) {
  let text = DEFAULT_FOOTER;
  if (!base.shop_place) text = text.replace(', {shop_place}', '');
  if (!base.contact_lines) text = text.replace('\n\n📞 *संपर्क*\n{contact_lines}', '');
  if (!base.owner_name) text = text.replace('\n👤 {owner_name}', '');
  return fillTemplate(text, base);
}

/**
 * "Pay here" lines for udhari messages, when the shop has set up a payment QR / UPI ID in
 * Settings: a link to the public pay page with the pending amount. Empty otherwise.
 */
function payBlock(settings, amount) {
  const a = Math.round((Number(amount) || 0) * 100) / 100;
  if (!settings?.pay_url || a <= 0) return '';
  return `💳 *पेमेंटसाठी QR / UPI*\n${settings.pay_url}?a=${a}\n\n`;
}

/** Puts {pay_block} just before the closing {footer}. */
const withPay = (text, block) => (block ? text.replace('{footer}', '{pay_block}{footer}') : text);

/** Template text for a message; makes sure the closing {footer} block is always there. */
function tpl(settings, key) {
  const text = settings?.[key] || DEFAULT_TEMPLATES[key];
  return text.includes('{footer}') ? text : `${text.trimEnd()}\n\n{footer}`;
}

/** Indian mobile → wa.me international format (91XXXXXXXXXX). */
export function waNumber(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

// Which WhatsApp app this phone should use: 'business' (WhatsApp Business first, normal
// WhatsApp if Business isn't installed) or 'normal'. Saved per phone, like the language.
const WA_APP_KEY = 'rws_wa_app';
const ANDROID_PACKAGES = { business: 'com.whatsapp.w4b', normal: 'com.whatsapp' };

export function getWaApp() {
  try {
    return localStorage.getItem(WA_APP_KEY) === 'normal' ? 'normal' : 'business';
  } catch {
    return 'business';
  }
}

export function setWaApp(app) {
  try {
    localStorage.setItem(WA_APP_KEY, app === 'normal' ? 'normal' : 'business');
  } catch {
    /* storage blocked: default (business) is used */
  }
}

/**
 * Open WhatsApp with a ready message. With no mobile, WhatsApp asks whom to send to.
 *
 * Android: an intent link names the exact app (WhatsApp Business or normal WhatsApp).
 * If that app isn't installed, Chrome follows the fallback wa.me link, which opens
 * whichever WhatsApp the phone has. iPhone/computer: wa.me only — the system decides
 * the app there, a web page cannot choose.
 */
export function openWhatsApp(mobile, text) {
  const n = mobile ? waNumber(mobile) : '';
  const waMe = `https://wa.me/${n}?text=${encodeURIComponent(text)}`;

  if (/Android/i.test(navigator.userAgent)) {
    const query = (n ? `phone=${n}&` : '') + `text=${encodeURIComponent(text)}`;
    const intent =
      `intent://send?${query}#Intent;scheme=whatsapp;package=${ANDROID_PACKAGES[getWaApp()]};` +
      `S.browser_fallback_url=${encodeURIComponent(waMe)};end`;
    window.location.href = intent;
    return;
  }

  window.open(waMe, '_blank', 'noopener');
}

// Entries with 20 L bottles (company has bottles switched on) use these built-in texts:
// the shop's own jar templates only know {jar_quantity}. Jar-only entries are unchanged.
const MULTI_DELIVERY = `🙏 *नमस्कार {customer_name}*,

💧 आज दिनांक *{date}* रोजी आपल्याला *{items}* देण्यात आले आहेत.
{return_line}
🧾 *बिल तपशील*
${LINE}
{item_lines}
▫️ एकूण रक्कम : *₹{amount}*
✅ भरलेली रक्कम : ₹{paid}
📒 आजची उधारी : ₹{udhari}
${LINE}

💰 *उधारी हिशोब*
${LINE}
▫️ मागील बाकी : ₹{previous_pending}
➕ आजची उधारी : ₹{udhari}
{advance_line}🔴 *एकूण बाकी : ₹{total_pending}*
${LINE}

💧 सध्या आपल्याकडे एकूण *{holding}* आहेत.

{footer}`;

const MULTI_RETURN = `🙏 *नमस्कार {customer_name}*,

↩️ आज दिनांक *{date}* रोजी *{items}* परत मिळाले.

💧 सध्या आपल्याकडे एकूण *{holding}* आहेत.
💰 एकूण बाकी : *₹{total_pending}*

{footer}`;

const itemMr = (product, n) => (product === 'bottle' ? `${n} बाटल्या (20 लि.)` : `${n} जार`);

/** Product rows of a saved entry (old entries / jar-only: one jar row). */
const entryLines = (t) => (t.lines?.length ? t.lines : [{ product: t.product || 'jar', jar_quantity: t.jar_quantity, rate: t.rate, amount: t.amount }]);
const hasBottles = (t) => entryLines(t).some((l) => l.product === 'bottle');
const holdingMr = (t) => `${t.current_jars ?? 0} जार व ${t.current_bottles ?? 0} बाटल्या`;
/** Entry total when the server sent one (several product rows), else the row's own value. */
const total = (t, key, fallback) => Number(t[key] !== undefined ? t[key] : fallback) || 0;

/** "🔒 डिपॉझिट …" line before the footer when deposit was taken or refunded in this entry. */
function withDeposit(text, t, refund) {
  const d = Number(t.total_deposit ?? t.deposit_amount) || 0;
  if (d <= 0) return text;
  const line = refund
    ? `🔓 डिपॉझिट परत दिले : ₹${amt(d)} (आता जमा ₹${amt(t.deposit_held)})\n\n`
    : `🔒 डिपॉझिट जमा : ₹${amt(d)} (एकूण जमा ₹${amt(t.deposit_held)})\n\n`;
  return text.replace('{footer}', `${line}{footer}`);
}

export const messages = {
  delivery(settings, t) {
    const multi = hasBottles(t);
    const udhari = total(t, 'total_udhari', t.udhari_amount);
    const advance = Number(t.advance_amount || 0);
    // Udhari given in this entry → add the payment QR link (for the customer's total due).
    const pay = udhari > 0 ? payBlock(settings, t.pending_amount) : '';
    // Empties taken back: per product when the app sent them, else the jar count.
    const back = t.taken_back ? Object.entries(t.taken_back).filter(([, n]) => n > 0) : t.returned_quantity > 0 ? [['jar', t.returned_quantity]] : [];
    const lines = entryLines(t);
    const template = multi ? MULTI_DELIVERY : tpl(settings, 'wa_delivery');
    return fillTemplate(withDeposit(withPay(template, pay), t, false), {
      ...shopValues(settings),
      pay_block: pay,
      customer_name: t.customer_name,
      date: fmtDate(t.transaction_date || today()),
      jar_quantity: t.jar_quantity,
      rate: amt(t.rate),
      amount: amt(total(t, 'total_amount', t.amount)),
      paid: amt(total(t, 'total_paid', Number(t.paid_amount) + advance)),
      udhari: amt(udhari),
      // pending_amount is the customer's total AFTER this entry (from the server).
      // Before it: total − today's udhari + advance paid today.
      previous_pending: pendingAmt(Number(t.pending_amount) - udhari + advance),
      advance_line: advance > 0 ? `➖ आगाऊ जमा : ₹${amt(advance)}\n` : '',
      total_pending: pendingAmt(t.pending_amount),
      current_jars: t.current_jars,
      return_line: back.length ? `↩️ आपल्याकडून *${back.map(([p, n]) => itemMr(p, n)).join(' व ')} रिकामे* परत घेतले.\n` : '',
      items: lines.map((l) => itemMr(l.product, l.jar_quantity)).join(' व '),
      item_lines: lines
        .map((l) => `▫️ ${l.product === 'bottle' ? 'बाटली (20 लि.)' : 'जार'} : ${l.jar_quantity} × ₹${amt(l.rate)} = ₹${amt(l.amount ?? l.jar_quantity * l.rate)}`)
        .join('\n'),
      holding: holdingMr(t),
    });
  },
  returned(settings, t) {
    const template = hasBottles(t) ? MULTI_RETURN : tpl(settings, 'wa_return');
    return fillTemplate(withDeposit(template, t, true), {
      ...shopValues(settings),
      customer_name: t.customer_name,
      date: fmtDate(t.transaction_date || today()),
      returned_jars: t.jar_quantity,
      current_jars: t.current_jars,
      total_pending: pendingAmt(t.pending_amount),
      items: entryLines(t).map((l) => itemMr(l.product, l.jar_quantity)).join(' व '),
      holding: holdingMr(t),
    });
  },
  payment(settings, p) {
    return fillTemplate(tpl(settings, 'wa_payment'), {
      ...shopValues(settings),
      customer_name: p.customer_name,
      date: fmtDate(p.payment_date || today()),
      paid_amount: amt(p.amount),
      previous_pending: amt(p.previous_pending),
      remaining_pending: amt(p.remaining_pending),
    });
  },
  booking(settings, b) {
    return fillTemplate(
      `🙏 *नमस्कार {customer_name}*,

📅 आपली बुकिंग नोंदवली आहे.
${LINE}
🗓️ डिलिव्हरी दिनांक : *{date}*
{items_lines}{notes_line}${LINE}

ठरलेल्या दिवशी आपल्याला जार पोहोचवले जातील.

{footer}`,
      {
        ...shopValues(settings),
        customer_name: b.customer_name,
        date: fmtDate(b.delivery_date),
        // Jar line as before; a bottles line only when the booking has bottles.
        items_lines:
          (b.jar_quantity > 0 || !(b.bottle_quantity > 0) ? `💧 जार : *${b.jar_quantity} पाण्याचे जार*\n` : '') +
          (b.bottle_quantity > 0 ? `💧 बाटली : *${b.bottle_quantity} बाटल्या (20 लि.)*\n` : ''),
        notes_line: b.notes ? `📝 ${b.notes}\n` : '',
      }
    );
  },
  reminder(settings, c) {
    const pay = payBlock(settings, c.pending_amount);
    return fillTemplate(withPay(tpl(settings, 'wa_reminder'), pay), {
      ...shopValues(settings),
      pay_block: pay,
      customer_name: c.name,
      pending_amount: amt(c.pending_amount),
    });
  },
  summary(settings, s) {
    return fillTemplate(tpl(settings, 'wa_summary'), {
      ...shopValues(settings),
      date: fmtDate(s.date || today()),
      given: s.given,
      returned: s.returned,
      cash: amt(s.cash),
      udhari: amt(s.udhari),
      payments: amt(s.payments),
      pending: amt(s.pending),
    });
  },
};

/** Plain-text ledger for sharing a statement on WhatsApp. */
export function ledgerText(settings, customer, rows) {
  const shop = shopValues(settings);
  const lines = rows.slice(-15).map((r) => {
    if (r.entry_type === 'payment') return `✅ ${fmtDate(r.entry_date)} | जमा ₹${amt(r.paid)} | बाकी ₹${amt(r.balance)}`;
    if (r.entry_type === 'returned') return `↩️ ${fmtDate(r.entry_date)} | परत ${r.jars_returned} जार | जार ${r.jar_balance}`;
    return `💧 ${fmtDate(r.entry_date)} | दिले ${r.jars_given} जार | ₹${amt(r.amount)} | भरले ₹${amt(r.paid)} | बाकी ₹${amt(r.balance)}`;
  });
  return `🙏 *नमस्कार ${customer.name}*,

📒 *आपला हिशोब*
${LINE}
${lines.join('\n')}
${LINE}

💧 सध्या आपल्याकडे जार : *${customer.current_jars}*
💰 एकूण बाकी : *₹${amt(customer.pending_amount)}*

${payBlock(settings, customer.pending_amount)}${shop.footer}`;
}

/**
 * Like openWhatsApp, but the text is loaded first (e.g. today's summary from the API).
 * Outside Android the tab is opened right away, inside the click, so the browser doesn't block it.
 */
export async function openWhatsAppLater(mobile, getText) {
  const android = /Android/i.test(navigator.userAgent);
  const tab = android ? null : window.open('', '_blank');
  try {
    const text = await getText();
    if (!tab) return openWhatsApp(mobile, text);
    tab.opener = null;
    tab.location.href = `https://wa.me/${mobile ? waNumber(mobile) : ''}?text=${encodeURIComponent(text)}`;
  } catch (err) {
    tab?.close();
    throw err;
  }
}

// Festival / offer / notice messages for the broadcast screen (customer-facing, Marathi).
// ___ marks the blanks the shop fills in; {customer_name} is filled per customer.
export const BROADCAST_TEMPLATES = {
  festival: `🙏 *नमस्कार {customer_name}*,

🪔 आपणास व आपल्या परिवारास *___ च्या हार्दिक शुभेच्छा!* 🎉

आपल्या विश्वासाबद्दल मनःपूर्वक आभार. 💧

{footer}`,
  offer: `🙏 *नमस्कार {customer_name}*,

🎁 *खास ऑफर!*
${LINE}
▫️ ___
▫️ ऑफर दिनांक *___* पर्यंत.
${LINE}

ऑर्डरसाठी आम्हाला कॉल / WhatsApp करा. 📞

{footer}`,
  holiday: `🙏 *नमस्कार {customer_name}*,

📢 *सूचना*
दिनांक *___* रोजी आमची जार सेवा बंद राहील.
कृपया आदल्या दिवशीच आवश्यक जार मागवून घ्यावे. 🙏

{footer}`,
  price: `🙏 *नमस्कार {customer_name}*,

📢 *दर बदलाची सूचना*
दिनांक *___* पासून जारचा नवीन दर *₹___* असेल.

आपल्या सहकार्याबद्दल धन्यवाद. 🙏

{footer}`,
  custom: `🙏 *नमस्कार {customer_name}*,



{footer}`,
};

/** A broadcast message for one customer (or, with no name, for a group / broadcast list). */
export function broadcastText(settings, template, customerName) {
  const text = template.includes('{footer}') ? template : `${template.trimEnd()}\n\n{footer}`;
  return fillTemplate(text, { ...shopValues(settings), customer_name: customerName || 'ग्राहक' });
}
