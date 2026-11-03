import { forwardRef } from 'react';
import { amountInWords } from '../../lib/bill';

// The three bill looks. Colours are fixed (not the app theme) so the bill looks the same in
// dark mode, in the WhatsApp image and on paper. Text is Marathi or English (lang prop).

const L = {
  mr: {
    bill: 'बिल', date: 'दिनांक', period: 'कालावधी', billTo: 'ग्राहक', mobile: 'मोबाईल', address: 'पत्ता',
    sr: 'क्र.', desc: 'तपशील', qty: 'नग', rate: 'दर', amount: 'रक्कम',
    jarGiven: 'पाण्याचे जार दिले', bottleGiven: 'बाटल्या दिल्या', jarReturned: 'रिकामे जार परत', bottleReturned: 'रिकाम्या बाटल्या परत',
    deposit: 'डिपॉझिट', noItems: 'या कालावधीत डिलिव्हरी नाही', payments: 'मिळालेले पेमेंट', payment: 'पेमेंट',
    prev: 'मागील बाकी', thisBill: 'या बिलाची रक्कम', paid: 'भरलेली रक्कम', total: 'एकूण बाकी', advance: 'आगाऊ जमा',
    inWords: 'अक्षरी', holding: 'आपल्याकडे सध्या', jars: 'जार', bottles: 'बाटल्या', depositHeld: 'डिपॉझिट जमा',
    thanks: 'धन्यवाद! आपल्या विश्वासाबद्दल आभार.', sign: 'सही / शिक्का', paidStamp: 'पूर्ण भरले',
    contact: 'संपर्क', returnNote: 'कृपया रिकामे जार वेळेवर परत करावे.', terms: 'सूचना', made: 'EasyJar द्वारे तयार',
    jarName: 'पाण्याचा जार', bottleName: 'बाटली', scanPay: 'QR स्कॅन करून पैसे भरा', totalRow: 'एकूण', returnedTotal: 'परत आलेले रिकामे जार', monthBill: 'या महिन्याचे बिल',
  },
  en: {
    bill: 'INVOICE', date: 'Date', period: 'Period', billTo: 'Bill To', mobile: 'Mobile', address: 'Address',
    sr: '#', desc: 'Description', qty: 'Qty', rate: 'Rate', amount: 'Amount',
    jarGiven: 'Water jars delivered', bottleGiven: 'Bottles delivered', jarReturned: 'Empty jars returned', bottleReturned: 'Empty bottles returned',
    deposit: 'Deposit', noItems: 'No deliveries in this period', payments: 'Payments received', payment: 'Payment',
    prev: 'Previous balance', thisBill: 'This bill', paid: 'Paid', total: 'Total due', advance: 'Advance (credit)',
    inWords: 'In words', holding: 'With you now', jars: 'jars', bottles: 'bottles', depositHeld: 'Deposit held',
    thanks: 'Thank you for your business!', sign: 'Signature', paidStamp: 'PAID',
    contact: 'Contact', returnNote: 'Please return empty jars on time.', terms: 'Note', made: 'Made with EasyJar',
    jarName: 'Water jar', bottleName: 'Bottle', scanPay: 'Scan to pay (UPI)', totalRow: 'Total', returnedTotal: 'Empty jars returned', monthBill: "This month's bill",
  },
};

const rs = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const period = (b) => (b.oneDay ? dmy(b.from) : `${dmy(b.from)} – ${dmy(b.billDate || b.to)}`);

function itemText(i, l) {
  const base = i.type === 'returned'
    ? (i.product === 'bottle' ? l.bottleReturned : l.jarReturned)
    : (i.product === 'bottle' ? l.bottleGiven : l.jarGiven);
  return i.deposit ? `${base} (${l.deposit} ${rs(i.deposit)})` : base;
}

/** The lines inside one day's row: what was delivered (qty × rate = amount) and what came back. */
function dayLines(d, l) {
  return [
    ...d.given.map((g) => ({
      name: `${g.label || (g.product === 'bottle' ? l.bottleName : l.jarName)}${g.deposit ? ` (${l.deposit} ${rs(g.deposit)})` : ''}`,
      qty: g.qty, rate: g.rate, amount: g.amount,
    })),
    ...d.returned.map((r) => ({ name: `↩ ${r.product === 'bottle' ? l.bottleReturned : l.jarReturned}`, qty: r.qty, ret: true })),
  ];
}

/** One table cell holding one div per line, so a day with two products stays one row. */
function Stack({ d, l, pick, align }) {
  return dayLines(d, l).map((x, k) => (
    <div key={k} style={{ textAlign: align, color: x.ret ? '#64748b' : undefined, fontSize: x.ret ? 12.5 : undefined }}>{pick(x) ?? ' '}</div>
  ));
}

/** The shop's uploaded signature / stamp, above the signature line. Nothing when none is uploaded. */
function StampImg({ b, h = 64 }) {
  return b.stamp ? <img src={b.stamp} alt="" style={{ height: h, maxWidth: 170, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} /> : null;
}

/** Pay-now QR (only when the shop saved a UPI ID and something is due). */
function PayQr({ b, l, size = 104, color = '#0f172a' }) {
  if (!b.qr) return null;
  return (
    <div style={{ textAlign: 'center', flexShrink: 0, width: size + 16 }}>
      <img src={b.qr} alt="" style={{ width: size, height: size, display: 'block', margin: '0 auto' }} />
      <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 3, color }}>{l.scanPay}</div>
      <div style={{ fontSize: 10.5, color: '#64748b', wordBreak: 'break-all' }}>{b.upi.id}</div>
    </div>
  );
}

/** "How many jars are with you now" — the line customers look for first. */
function HoldingBox({ b, l, bg, border, color }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '10px 14px' }}>
      <div style={{ fontSize: 12.5, color, fontWeight: 700 }}>💧 {l.holding}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1.1 }}>{b.jars}</span>
        <span style={{ fontWeight: 700, marginRight: 8 }}>{l.jars}</span>
        {b.bottles > 0 && <span style={{ fontWeight: 700 }}>+ {b.bottles} {l.bottles}</span>}
      </div>
      {b.deposit > 0 && <div style={{ fontSize: 12.5, color: '#475569' }}>{l.depositHeld}: <b>{rs(b.deposit)}</b></div>}
    </div>
  );
}

function holdingText(b, l) {
  const parts = [`${b.jars} ${l.jars}`];
  if (b.bottles) parts.push(`${b.bottles} ${l.bottles}`);
  if (b.deposit > 0) parts.push(`${l.depositHeld} ${rs(b.deposit)}`);
  return parts.join(' · ');
}

// The phone's own fonts only (no web fonts): the WhatsApp image is drawn with exactly the
// fonts the preview used, so text never shifts or overlaps in the picture.
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Nirmala UI", "Helvetica Neue", Arial, sans-serif';

/* ───────────── 1. Modern Water ───────────── */

const ModernBill = forwardRef(function ModernBill({ bill: b, lang }, ref) {
  const l = L[lang];
  const due = b.closing;
  const blue = '#1d4ed8';
  return (
    <div ref={ref} style={{ width: 794, background: '#fff', color: '#0f172a', fontFamily: FONT, fontSize: 14, lineHeight: 1.45 }}>
      {/* Header with a water wave */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 45%, #0ea5e9 100%)', color: '#fff', padding: '30px 36px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 76, height: 76, borderRadius: 20, background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgb(0 0 0 / .18)' }}>
            {b.shop.logo ? <img src={b.shop.logo} alt="" style={{ maxWidth: 62, maxHeight: 62, objectFit: 'contain' }} /> : <span style={{ fontSize: 34 }}>💧</span>}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{b.shop.name}</div>
            {(b.shop.place || b.shop.address) && <div style={{ opacity: 0.9, marginTop: 2 }}>{[b.shop.place, b.shop.address].filter(Boolean).join(', ')}</div>}
            {b.shop.contacts.length > 0 && <div style={{ opacity: 0.9, marginTop: 2 }}>📞 {b.shop.contacts.join(' · ')}</div>}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <div style={{ display: 'inline-block', background: 'rgb(255 255 255 / .18)', border: '1px solid rgb(255 255 255 / .4)', borderRadius: 999, padding: '4px 18px', fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>{l.bill}</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.95 }}>{l.date} <b>{dmy(b.billDate || b.to)}</b></div>
          </div>
        </div>
        <svg viewBox="0 0 794 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: -1, width: '100%', height: 40, display: 'block' }}>
          <path d="M0 22 C 120 2, 240 2, 360 20 S 600 40, 794 12 L794 40 L0 40 Z" fill="#ffffff" />
          <path d="M0 30 C 140 14, 260 16, 400 28 S 640 40, 794 24" fill="none" stroke="#bae6fd" strokeWidth="2" />
        </svg>
      </div>

      <div style={{ padding: '6px 36px 28px' }}>
        {/* Customer + period */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1, background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 14, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: blue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l.billTo}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{b.customer.name}</div>
            <div style={{ color: '#475569' }}>📱 {b.customer.mobile}{b.customer.address ? ` · ${b.customer.address}` : ''}</div>
          </div>
          <div style={{ width: 210, background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 14, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: blue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l.period}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{period(b)}</div>
          </div>
        </div>

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: 18, fontSize: 14 }}>
          <thead>
            <tr style={{ background: blue, color: '#fff' }}>
              {[l.date, l.desc, l.qty, l.rate, l.amount].map((h, i) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: i >= 2 ? 'right' : 'left', fontWeight: 600, borderTopLeftRadius: i === 0 ? 10 : 0, borderTopRightRadius: i === 4 ? 10 : 0 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.days.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>{l.noItems}</td></tr>
            )}
            {b.days.map((d, n) => (
              <tr key={d.date} style={{ background: n % 2 ? '#f8fafc' : '#fff', verticalAlign: 'top' }}>
                <td style={{ ...td, fontWeight: 700, color: blue, whiteSpace: 'nowrap' }}>{dmy(d.date).slice(0, 5)}</td>
                <td style={td}><Stack d={d} l={l} pick={(x) => x.name} /></td>
                <td style={td}><Stack d={d} l={l} align="right" pick={(x) => x.qty} /></td>
                <td style={td}><Stack d={d} l={l} align="right" pick={(x) => (x.rate == null ? null : rs(x.rate))} /></td>
                <td style={{ ...td, fontWeight: 600 }}><Stack d={d} l={l} align="right" pick={(x) => (x.amount == null ? null : rs(x.amount))} /></td>
              </tr>
            ))}
            {b.days.length > 0 && (
              <tr style={{ background: '#eff6ff', fontWeight: 700 }}>
                <td style={td} colSpan={2}>{l.totalRow}{b.totalReturned > 0 && <span style={{ fontWeight: 500, color: '#475569' }}> · ↩ {l.returnedTotal}: {b.totalReturned}</span>}</td>
                <td style={{ ...td, textAlign: 'right' }}>{b.totalQty}</td>
                <td style={td} />
                <td style={{ ...td, textAlign: 'right', color: blue }}>{rs(b.sales)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {b.payments.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#047857' }}>
            ✅ {l.payments}: {b.payments.map((p) => `${dmy(p.date).slice(0, 5)} ${p.mode} ${rs(p.amount)}`).join(' · ')}
          </div>
        )}

        {/* Holding + totals */}
        <div style={{ display: 'flex', gap: 16, marginTop: 18, alignItems: 'stretch' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {b.jars != null && <HoldingBox b={b} l={l} bg="#ecfeff" border="#a5f3fc" color="#0e7490" />}
            {b.qr && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: 14, padding: '10px 14px' }}>
                <PayQr b={b} l={l} color={blue} />
                <div style={{ fontSize: 13, color: '#334155' }}>
                  <div style={{ fontWeight: 700, color: blue, fontSize: 15 }}>{rs(due)}</div>
                  {due < 0 ? l.advance : l.total}
                </div>
              </div>
            )}
          </div>
          <div style={{ width: 320, alignSelf: 'flex-start', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <Row k={l.prev} v={rs(b.prev)} />
            <Row k={l.thisBill} v={`+ ${rs(b.sales)}`} />
            <Row k={l.paid} v={`− ${rs(b.paid)}`} color="#047857" />
            <div style={{ background: due > 0 ? 'linear-gradient(135deg,#1d4ed8,#0ea5e9)' : '#059669', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{due < 0 ? l.advance : l.total}</span>
              <span style={{ fontWeight: 800, fontSize: 24 }}>{rs(Math.abs(due))}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: '#334155' }}>
          <b>{l.inWords}:</b> {amountInWords(Math.max(due, 0), lang)}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 26 }}>
          <div>
            <div style={{ fontWeight: 700, color: blue, fontSize: 16 }}>🙏 {l.thanks}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l.returnNote}</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 170 }}>
            {due <= 0 && <div style={stamp}>{l.paidStamp}</div>}
            <StampImg b={b} />
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 4, fontSize: 12, color: '#475569' }}>{b.shop.owner || l.sign}</div>
          </div>
        </div>
      </div>
      <div style={{ height: 10, background: 'linear-gradient(90deg,#1e3a8a,#1d4ed8,#0ea5e9)' }} />
      <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', padding: '6px 0 10px' }}>{l.made}</div>
    </div>
  );
});

const td = { padding: '9px 12px', borderBottom: '1px solid #e2e8f0' };
const stamp = { display: 'inline-block', transform: 'rotate(-8deg)', border: '3px solid #059669', color: '#059669', borderRadius: 10, padding: '2px 14px', fontWeight: 800, fontSize: 18, marginBottom: 10 };

function Row({ k, v, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e2e8f0' }}>
      <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>{k}</span>
      <span style={{ fontWeight: 600, color: color || '#0f172a', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );
}

/* ───────────── 2. Classic bill book (default) ───────────── */

const ClassicBill = forwardRef(function ClassicBill({ bill: b, lang }, ref) {
  const l = L[lang];
  const red = '#c1121f';
  const gold = '#f5b301';
  const line = `1px solid ${gold}`;
  const due = b.closing;
  const blank = Math.max(0, 6 - b.days.length);
  const cell = { padding: '7px 10px', borderRight: line };
  return (
    <div ref={ref} style={{ width: 794, background: '#fff', color: '#1f2937', fontFamily: FONT, fontSize: 14, lineHeight: 1.45, position: 'relative', overflow: 'hidden' }}>
      {/* gold corner swoosh + INVOICE tab, like a printed bill book */}
      <svg viewBox="0 0 200 260" style={{ position: 'absolute', left: 0, top: 0, width: 150, height: 200 }}>
        <path d="M0 0 H120 C 70 30, 110 80, 60 120 C 20 150, 50 210, 0 260 Z" fill={gold} />
      </svg>
      <div style={{ position: 'absolute', right: 30, top: 22, background: gold, color: red, fontWeight: 800, padding: '4px 16px', fontSize: 16, letterSpacing: 1 }}>{l.bill}</div>

      <div style={{ padding: '34px 40px 0', textAlign: 'center', position: 'relative' }}>
        {b.shop.logo && <img src={b.shop.logo} alt="" style={{ height: 54, objectFit: 'contain', marginBottom: 4 }} />}
        <div style={{ fontSize: 30, fontWeight: 800, color: red, textTransform: 'uppercase', lineHeight: 1.15 }}>{b.shop.name}</div>
        {b.shop.place && <div style={{ fontStyle: 'italic', color: '#4b5563' }}>{b.shop.place}</div>}
        {b.shop.address && <div style={{ marginTop: 2 }}>{b.shop.address}</div>}
        {b.shop.contacts.length > 0 && <div>{l.contact}: {b.shop.contacts.join(', ')}</div>}
      </div>

      <div style={{ margin: '16px 40px 0', border: line, display: 'flex' }}>
        <div style={{ flex: 1, borderRight: line }}>
          <Line k={l.billTo} v={b.customer.name} bold line={line} />
          <Line k={l.address} v={b.customer.address || '—'} line={line} />
          <Line k={l.mobile} v={b.customer.mobile} />
        </div>
        <div style={{ width: 250 }}>
          <Line k={l.date} v={dmy(b.billDate || b.to)} bold line={line} />
          <Line k={l.period} v={period(b)} />
        </div>
      </div>

      <table style={{ width: 'calc(100% - 80px)', margin: '12px 40px 0', borderCollapse: 'collapse', border: line, fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: line }}>
            {[[l.date, 70], [l.desc], [l.qty, 60], [l.rate, 76], [l.amount, 100]].map(([h, w], i) => (
              <th key={h} style={{ ...cell, width: w, fontWeight: 700, textAlign: i >= 2 ? 'right' : 'left', borderRight: i === 4 ? 'none' : line }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.days.map((d) => (
            <tr key={d.date} style={{ verticalAlign: 'top' }}>
              <td style={{ ...cell, fontWeight: 700 }}>{dmy(d.date).slice(0, 5)}</td>
              <td style={cell}><Stack d={d} l={l} pick={(x) => x.name} /></td>
              <td style={cell}><Stack d={d} l={l} align="right" pick={(x) => x.qty} /></td>
              <td style={cell}><Stack d={d} l={l} align="right" pick={(x) => (x.rate == null ? null : rs(x.rate))} /></td>
              <td style={{ ...cell, borderRight: 'none' }}><Stack d={d} l={l} align="right" pick={(x) => (x.amount == null ? null : rs(x.amount))} /></td>
            </tr>
          ))}
          {Array.from({ length: blank }, (_, k) => (
            <tr key={`b${k}`} style={{ height: 30 }}>
              {[0, 1, 2, 3, 4].map((c) => <td key={c} style={{ ...cell, borderRight: c === 4 ? 'none' : line }} />)}
            </tr>
          ))}
          <tr style={{ borderTop: line, fontWeight: 700 }}>
            <td colSpan={2} style={{ ...cell, textAlign: 'right' }}>{b.totalReturned > 0 && <span style={{ fontWeight: 500, color: '#4b5563' }}>↩ {l.returnedTotal}: {b.totalReturned} · </span>}{l.totalRow}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{b.totalQty}</td>
            <td style={cell} />
            <td style={{ ...cell, textAlign: 'right', borderRight: 'none' }}>{rs(b.sales)}</td>
          </tr>
          <tr style={{ borderTop: line }}>
            <td colSpan={4} style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{l.thisBill}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700, borderRight: 'none' }}>{rs(b.sales)}</td>
          </tr>
          <tr style={{ borderTop: line }}>
            <td colSpan={4} style={{ ...cell, textAlign: 'right' }}>{l.prev}</td>
            <td style={{ ...cell, textAlign: 'right', borderRight: 'none' }}>{rs(b.prev)}</td>
          </tr>
          <tr style={{ borderTop: line }}>
            <td colSpan={4} style={{ ...cell, textAlign: 'right' }}>{l.paid}</td>
            <td style={{ ...cell, textAlign: 'right', borderRight: 'none' }}>− {rs(b.paid)}</td>
          </tr>
          <tr style={{ borderTop: line, background: '#fff8e1' }}>
            <td colSpan={4} style={{ ...cell, textAlign: 'right', fontWeight: 800, color: red, fontSize: 16 }}>{due < 0 ? l.advance : l.total}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 800, color: red, fontSize: 16, borderRight: 'none' }}>{rs(Math.abs(due))}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ margin: '0 40px', border: line, borderTop: 'none', padding: '7px 10px' }}>
        <b>{l.inWords}:</b> {amountInWords(Math.max(due, 0), lang)}
      </div>

      <div style={{ display: 'flex', gap: 16, margin: '14px 40px 0', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, fontSize: 13 }}>
          {b.jars != null && <div style={{ border: `2px solid ${gold}`, background: '#fffbeb', borderRadius: 6, padding: '6px 12px', marginBottom: 8, fontSize: 15 }}>
            💧 <b>{l.holding}: <span style={{ color: red, fontSize: 20 }}>{b.jars}</span> {l.jars}</b>
            {b.bottles > 0 && <b> + {b.bottles} {l.bottles}</b>}
            {b.deposit > 0 && <div style={{ fontSize: 12.5 }}>{l.depositHeld}: <b>{rs(b.deposit)}</b></div>}
          </div>}
          <b>{l.terms}:</b>
          <div>• {l.returnNote}</div>
          {b.payments.length > 0 && <div>• {l.payments}: {b.payments.map((p) => `${dmy(p.date).slice(0, 5)} ${rs(p.amount)}`).join(', ')}</div>}
        </div>
        <PayQr b={b} l={l} color={red} />
        <div style={{ textAlign: 'center', minWidth: 160 }}>
          {due <= 0 && <div style={stamp}>{l.paidStamp}</div>}
          {b.stamp ? <StampImg b={b} h={70} /> : <div style={{ height: 34 }} />}
          <div style={{ borderTop: '1px solid #6b7280', paddingTop: 4, fontSize: 13 }}>{b.shop.owner || l.sign}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 14, fontWeight: 600, color: red }}>{l.thanks}</div>
      <div style={{ height: 16, background: gold, marginTop: 12 }} />
    </div>
  );
});

function Line({ k, v, bold, line }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: line || 'none' }}>
      <span style={{ color: '#4b5563', whiteSpace: 'nowrap' }}>{k} :</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{v}</span>
    </div>
  );
}

/* ───────────── 3. Simple receipt ───────────── */

const SimpleBill = forwardRef(function SimpleBill({ bill: b, lang }, ref) {
  const l = L[lang];
  const due = b.closing;
  const dash = { borderTop: '1px dashed #9ca3af', margin: '10px 0' };
  const kv = { display: 'flex', justifyContent: 'space-between', gap: 8 };
  return (
    <div ref={ref} style={{ width: 384, background: '#fff', color: '#111827', fontFamily: FONT, fontSize: 14, lineHeight: 1.45, padding: '20px 18px' }}>
      <div style={{ textAlign: 'center' }}>
        {b.shop.logo && <img src={b.shop.logo} alt="" style={{ height: 44, objectFit: 'contain' }} />}
        <div style={{ fontWeight: 800, fontSize: 19 }}>{b.shop.name}</div>
        {b.shop.place && <div style={{ fontSize: 12 }}>{b.shop.place}</div>}
        {b.shop.contacts.length > 0 && <div style={{ fontSize: 12 }}>📞 {b.shop.contacts.join(', ')}</div>}
        <div style={{ marginTop: 6, fontWeight: 700, letterSpacing: 2 }}>— {l.bill} —</div>
      </div>
      <div style={dash} />
      <div style={kv}><span>{l.date}</span><span>{dmy(b.billDate || b.to)}</span></div>
      {!b.oneDay && <div style={kv}><span>{l.period}</span><span>{period(b)}</span></div>}
      <div style={kv}><span>{l.billTo}</span><b style={{ textAlign: 'right' }}>{b.customer.name}</b></div>
      <div style={dash} />
      {b.days.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280' }}>{l.noItems}</div>}
      {b.days.map((d) => (
        <div key={d.date} style={{ marginBottom: 7 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{dmy(d.date).slice(0, 5)}</div>
          {dayLines(d, l).map((x, k) => (
            <div key={k} style={{ ...kv, fontSize: 13, color: x.ret ? '#6b7280' : '#374151', paddingLeft: 8 }}>
              <span>{x.ret ? `${x.name}: ${x.qty}` : `${x.name}: ${x.qty} × ${rs(x.rate)}`}</span>
              <b>{x.ret ? '' : rs(x.amount)}</b>
            </div>
          ))}
        </div>
      ))}
      {b.days.length > 0 && <div style={{ ...kv, fontWeight: 700, borderTop: '1px solid #d1d5db', paddingTop: 4 }}><span>{l.totalRow}: {b.totalQty}</span><span>{rs(b.sales)}</span></div>}
      {b.totalReturned > 0 && <div style={{ fontSize: 12.5, color: '#4b5563' }}>↩ {l.returnedTotal}: {b.totalReturned}</div>}
      <div style={dash} />
      <div style={kv}><span>{l.prev}</span><span>{rs(b.prev)}</span></div>
      <div style={kv}><span>{l.thisBill}</span><span>+ {rs(b.sales)}</span></div>
      <div style={kv}><span>{l.paid}</span><span>− {rs(b.paid)}</span></div>
      <div style={{ ...dash, borderTopStyle: 'solid', borderTopColor: '#111827' }} />
      <div style={{ ...kv, fontSize: 18, fontWeight: 800 }}><span>{due < 0 ? l.advance : l.total}</span><span>{rs(Math.abs(due))}</span></div>
      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{amountInWords(Math.max(due, 0), lang)}</div>
      <div style={dash} />
      {b.jars != null && (
        <div style={{ border: '1px solid #111827', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 12 }}>💧 {l.holding}</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{holdingText(b, l)}</div>
        </div>
      )}
      {b.qr && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <PayQr b={b} l={l} size={120} />
        </div>
      )}
      {b.stamp && (
        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <StampImg b={b} h={56} />
          <div style={{ borderTop: '1px solid #9ca3af', margin: '0 auto', width: 150, paddingTop: 2, fontSize: 11, color: '#4b5563' }}>{b.shop.owner || l.sign}</div>
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 600 }}>{l.thanks}</div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{l.made}</div>
    </div>
  );
});

export const BILL_COMPONENTS = { modern: ModernBill, classic: ClassicBill, simple: SimpleBill };
/** Natural width of each design, for scaling the preview to the phone. */
export const BILL_WIDTH = { modern: 794, classic: 794, simple: 384 };
