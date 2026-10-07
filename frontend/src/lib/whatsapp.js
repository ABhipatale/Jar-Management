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
    shop_name: settings?.business_name_mr || 'साई वॉटर सप्लायर्स',
    shop_place: settings?.business_place_mr || 'कोळेवाडी',
    owner_name: settings?.owner_name_mr || 'श्री. अतुल भागवत',
    contact_lines: String(settings?.contact_numbers || '9404349071, 8308285774')
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => `📱 ${n}`)
      .join('\n'),
  };
  return { ...base, footer: fillTemplate(DEFAULT_FOOTER, base) };
}

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

export const messages = {
  delivery(settings, t) {
    return fillTemplate(tpl(settings, 'wa_delivery'), {
      ...shopValues(settings),
      customer_name: t.customer_name,
      date: fmtDate(t.transaction_date || today()),
      jar_quantity: t.jar_quantity,
      rate: amt(t.rate),
      amount: amt(t.amount),
      paid: amt(Number(t.paid_amount) + Number(t.advance_amount || 0)),
      udhari: amt(t.udhari_amount),
      // pending_amount is the customer's total AFTER this entry (from the server).
      // Before it: total − today's udhari + advance paid today.
      previous_pending: pendingAmt(Number(t.pending_amount) - Number(t.udhari_amount || 0) + Number(t.advance_amount || 0)),
      advance_line: Number(t.advance_amount) > 0 ? `➖ आगाऊ जमा : ₹${amt(t.advance_amount)}\n` : '',
      total_pending: pendingAmt(t.pending_amount),
      current_jars: t.current_jars,
      return_line: t.returned_quantity > 0 ? `↩️ आपल्याकडून *${t.returned_quantity} रिकामे जार* परत घेतले.\n` : '',
    });
  },
  returned(settings, t) {
    return fillTemplate(tpl(settings, 'wa_return'), {
      ...shopValues(settings),
      customer_name: t.customer_name,
      date: fmtDate(t.transaction_date || today()),
      returned_jars: t.jar_quantity,
      current_jars: t.current_jars,
      total_pending: pendingAmt(t.pending_amount),
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
💧 जार : *{qty} पाण्याचे जार*
{notes_line}${LINE}

ठरलेल्या दिवशी आपल्याला जार पोहोचवले जातील.

{footer}`,
      {
        ...shopValues(settings),
        customer_name: b.customer_name,
        date: fmtDate(b.delivery_date),
        qty: b.jar_quantity,
        notes_line: b.notes ? `📝 ${b.notes}\n` : '',
      }
    );
  },
  reminder(settings, c) {
    return fillTemplate(tpl(settings, 'wa_reminder'), {
      ...shopValues(settings),
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

${shop.footer}`;
}
