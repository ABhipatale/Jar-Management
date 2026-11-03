import { useEffect, useRef, useState } from 'react';
import { Download, MessageCircle, Plus, Printer, Trash2 } from 'lucide-react';
import BillOptions from '../components/bill/BillOptions';
import BillPreview, { useBillLogo } from '../components/bill/BillPreview';
import { Field, PageHeader } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { lang as appLang, t } from '../i18n';
import { BILL_DESIGNS, billPdf, buildManualBill, downloadBlob, shareBillFile } from '../lib/bill';
import { addDays, monthStart, today } from '../lib/format';
import { openWhatsApp } from '../lib/whatsapp';

const DRAFT_KEY = 'rws_manual_bill';

let seq = 0;
const newRow = (rate) => ({ id: ++seq, date: today(), text: '', qty: '', ret: '', rate });
const rupees = (v) => `₹${(Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-IN')}`;

const emptyForm = () => ({ name: '', mobile: '', address: '', billDate: today(), from: monthStart(today()), to: today(), prev: '', paid: '', jars: '' });

/** The unsent bill is kept on the phone, so switching apps (or iPhone reloading the tab) loses nothing. */
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
}

/** A titled card. Defined here, not inside ManualBill, so typing never remounts it (the keyboard would close). */
function Card({ title, children }) {
  return (
    <section className="no-print card space-y-3.5 !p-4">
      <h2 className="font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ManualBill() {
  const { settings } = useSettings();
  const { toast, confirm } = useUi();
  const defaultRate = String(settings?.default_rate || '');
  const draft = useRef(loadDraft()).current;

  const [form, setForm] = useState(draft?.form || emptyForm);
  const [rows, setRows] = useState(() => (draft?.rows?.length ? draft.rows.map((r) => ({ ...r, id: ++seq })) : [newRow(defaultRate)]));
  const [design, setDesign] = useState(draft?.design || (BILL_DESIGNS.includes(settings?.bill_design) ? settings.bill_design : 'classic'));
  const [lang, setLang] = useState(draft?.lang || (appLang === 'en' ? 'en' : 'mr'));
  const [busy, setBusy] = useState(false);
  const sheet = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, rows, design, lang }));
    } catch {
      /* private mode / storage full: the bill still works, it just isn't remembered */
    }
  }, [form, rows, design, lang]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const money = (k) => (e) => setForm({ ...form, [k]: e.target.value.replace(/[^\d.]/g, '') });
  const setRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  // A new line starts on the previous line's date and rate: owners usually enter one customer's month in a row.
  const addRow = () => setRows((rs) => [...rs, { ...newRow(rs[rs.length - 1]?.rate ?? defaultRate), date: rs[rs.length - 1]?.date || today() }]);
  const delRow = (id) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const rawBill = buildManualBill({ ...form, rows }, settings);
  const logo = useBillLogo(rawBill.shop.logo);
  const bill = { ...rawBill, shop: { ...rawBill.shop, logo: logo || rawBill.shop.logo } };
  const ready = rawBill.customer.name !== '' && rawBill.days.length > 0;

  const shopName = lang === 'en' ? bill.shop.nameEn || bill.shop.name : bill.shop.name;
  const fileName = `${shopName.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'bill'}.pdf`;
  const shareText = [shopName, ...bill.shop.contacts.map((n) => `📞 ${n}`)].join('\n');

  const guard = () => {
    if (ready && sheet.current) return true;
    toast(t('mb.need'), 'error');
    return false;
  };

  const send = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      const pdf = await billPdf(sheet.current);
      const res = await shareBillFile(pdf, fileName, shareText);
      if (res === 'unsupported') {
        downloadBlob(pdf, fileName);
        toast(t('bill.attachHint'), 'info');
        openWhatsApp(bill.customer.mobile, shareText);
      }
    } catch {
      toast(t('bill.imageFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!guard()) return;
    setBusy(true);
    try {
      downloadBlob(await billPdf(sheet.current), fileName);
    } catch {
      toast(t('bill.imageFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!(await confirm({ message: t('mb.clearConfirm'), confirmText: t('mb.clear'), danger: true }))) return;
    setForm(emptyForm());
    setRows([newRow(defaultRate)]);
  };

  const pickMonth = (last) => {
    if (last) {
      const end = addDays(monthStart(today()), -1);
      setForm({ ...form, from: monthStart(end), to: end, billDate: end });
    } else {
      setForm({ ...form, from: monthStart(today()), to: today(), billDate: today() });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print">
        <PageHeader title={t('mb.title')} subtitle={t('mb.sub')} right={<button type="button" className="btn-light btn-sm" onClick={clearAll}><Trash2 size={15} /> {t('mb.clear')}</button>} />
      </div>

      <Card title={t('mb.customer')}>
        <Field label={t('mb.name')}>
          <input className="input" value={form.name} onChange={set('name')} maxLength={120} autoComplete="off" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
          <Field label={t('mb.mobile')}>
            <input className="input tabular-nums" type="tel" inputMode="numeric" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/[^\d+ ]/g, '') })} maxLength={16} />
          </Field>
          <Field label={t('mb.address')}>
            <input className="input" value={form.address} onChange={set('address')} maxLength={200} autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card title={t('mb.dates')}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={() => pickMonth(false)}>{t('bill.p.thisMonth')}</button>
          <button type="button" className="chip" onClick={() => pickMonth(true)}>{t('bill.p.lastMonth')}</button>
        </div>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <Field label={t('mb.from')}>
            <input type="date" className="input" value={form.from} max={form.to} onChange={(e) => e.target.value && setForm({ ...form, from: e.target.value })} />
          </Field>
          <Field label={t('mb.to')}>
            <input type="date" className="input" value={form.to} min={form.from} onChange={(e) => e.target.value && setForm({ ...form, to: e.target.value })} />
          </Field>
        </div>
        <Field label={t('mb.billDate')}>
          <input type="date" className="input" value={form.billDate} onChange={(e) => e.target.value && setForm({ ...form, billDate: e.target.value })} />
        </Field>
      </Card>

      <Card title={t('mb.items')}>
        {rows.map((r, n) => {
          const amount = (parseInt(r.qty, 10) || 0) * (Number(r.rate) || 0);
          return (
            <div key={r.id} className="space-y-3 rounded-xl bg-surface-2 p-3 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">{t('mb.line', { n: n + 1 })}</span>
                {rows.length > 1 && (
                  <button type="button" className="icon-btn !h-8 !w-8 text-red-600" onClick={() => delRow(r.id)} aria-label={t('mb.removeLine')}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <Field label={t('mb.date')}>
                <input type="date" className="input" value={r.date} onChange={(e) => e.target.value && setRow(r.id, { date: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                <Field label={t('mb.qty')}>
                  <input className="input tabular-nums" inputMode="numeric" value={r.qty} placeholder="0" onChange={(e) => setRow(r.id, { qty: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label={t('mb.ret')}>
                  <input className="input tabular-nums" inputMode="numeric" value={r.ret ?? ''} placeholder="0" onChange={(e) => setRow(r.id, { ret: e.target.value.replace(/\D/g, '') })} />
                </Field>
              </div>
              <Field label={t('mb.detail')}>
                <input className="input" value={r.text} placeholder={t('mb.detailPh')} onChange={(e) => setRow(r.id, { text: e.target.value })} maxLength={80} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {[t('mb.chipJar'), t('mb.chipBottle')].map((c) => (
                  <button key={c} type="button" className={`chip ${r.text === c ? 'chip-active' : ''}`} onClick={() => setRow(r.id, { text: c })}>{c}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 items-end gap-3 [&>*]:min-w-0">
                <Field label={t('mb.rate')}>
                  <input className="input tabular-nums" inputMode="decimal" value={r.rate} placeholder="0" onChange={(e) => setRow(r.id, { rate: e.target.value.replace(/[^\d.]/g, '') })} />
                </Field>
                <div className="rounded-lg bg-surface px-3 py-2 text-right ring-1 ring-line">
                  <div className="text-xs text-muted">{t('mb.amount')}</div>
                  <div className="text-lg font-bold tabular-nums text-ink">{rupees(amount)}</div>
                </div>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn-light w-full py-3" onClick={addRow}>
          <Plus size={18} /> {t('mb.addLine')}
        </button>
      </Card>

      <Card title={t('mb.extra')}>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <Field label={t('mb.prev')}>
            <input className="input tabular-nums" inputMode="decimal" value={form.prev} placeholder="0" onChange={money('prev')} />
          </Field>
          <Field label={t('mb.paid')}>
            <input className="input tabular-nums" inputMode="decimal" value={form.paid} placeholder="0" onChange={money('paid')} />
          </Field>
        </div>
        <Field label={t('mb.jars')}>
          <input className="input tabular-nums" inputMode="numeric" value={form.jars} placeholder="—" onChange={(e) => setForm({ ...form, jars: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </Card>

      <section className="no-print card !p-0 overflow-hidden">
        <div className="space-y-1.5 p-4 text-[15px]">
          <div className="flex justify-between"><span className="text-muted">{t('mb.totalQty')}</span><b className="tabular-nums">{bill.totalQty}</b></div>
          {bill.totalReturned > 0 && <div className="flex justify-between"><span className="text-muted">{t('mb.totalRet')}</span><b className="tabular-nums">{bill.totalReturned}</b></div>}
          <div className="flex justify-between"><span className="text-muted">{t('mb.thisBill')}</span><b className="tabular-nums">{rupees(bill.sales)}</b></div>
          <div className="flex justify-between"><span className="text-muted">{t('mb.prev')}</span><b className="tabular-nums">{rupees(bill.prev)}</b></div>
          <div className="flex justify-between"><span className="text-muted">{t('mb.paid')}</span><b className="tabular-nums text-emerald-700">− {rupees(bill.paid)}</b></div>
        </div>
        <div className="flex items-center justify-between bg-brand-700 px-4 py-3.5 text-white">
          <span className="font-semibold">{bill.closing < 0 ? t('mb.advance') : t('mb.due')}</span>
          <span className="text-2xl font-extrabold tabular-nums">{rupees(Math.abs(bill.closing))}</span>
        </div>
      </section>

      <Card title={t('mb.look')}>
        <BillOptions design={design} setDesign={setDesign} lang={lang} setLang={setLang} />
      </Card>

      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" className="btn-wa col-span-2 py-3 text-base sm:col-span-1" disabled={busy} onClick={send}>
          <MessageCircle size={18} /> {busy ? t('bill.making') : t('bill.send')}
        </button>
        <button type="button" className="btn-light" disabled={busy} onClick={download}>
          <Download size={17} /> {t('bill.pdf')}
        </button>
        <button type="button" className="btn-light" onClick={() => (guard() ? window.print() : null)}>
          <Printer size={17} /> {t('bill.printOnly')}
        </button>
      </div>

      <BillPreview design={design} bill={bill} lang={lang} sheetRef={sheet} />
      <p className="no-print text-center text-xs text-muted">{t('mb.draftNote')}</p>
    </div>
  );
}
