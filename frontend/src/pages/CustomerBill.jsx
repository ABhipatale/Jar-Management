import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, MessageCircle, Printer } from 'lucide-react';
import BillOptions from '../components/bill/BillOptions';
import BillPreview, { useBillLogo } from '../components/bill/BillPreview';
import { ErrorBox, Loader, PageHeader } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { lang as appLang, t } from '../i18n';
import { BILL_DESIGNS, billFileName, billPdf, buildBill, downloadBlob, issueInvoice, nextPaint, peekInvoice, shareBillFile } from '../lib/bill';
import { addDays, monthStart, today } from '../lib/format';
import { useApi } from '../lib/useApi';
import { openWhatsApp } from '../lib/whatsapp';

const PERIODS = ['thisMonth', 'lastMonth', 'custom'];

function rangeOf(p) {
  if (p === 'lastMonth') {
    const end = addDays(monthStart(today()), -1);
    return { from: monthStart(end), to: end };
  }
  return { from: monthStart(today()), to: today() };
}

/** Business name in the bill's language (also the PDF's file name). */
const shopName = (b, lang) => (lang === 'en' ? b.shop.nameEn || b.shop.name : b.shop.name);

/** The text sent with the PDF: business name, the invoice number and its mobile number(s) from Settings. */
const shareText = (b, lang, no) => [shopName(b, lang), no && `🧾 ${no}`, ...b.shop.contacts.map((n) => `📞 ${n}`)].filter(Boolean).join('\n');

export default function CustomerBill() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const { toast } = useUi();

  // ?from=&to= (e.g. one day from the entry screen) wins over the month buttons.
  const given = params.get('from') ? { from: params.get('from'), to: params.get('to') || today() } : null;
  const [period, setPeriod] = useState(given ? 'custom' : 'thisMonth');
  const [range, setRange] = useState(given || rangeOf('thisMonth'));
  const [design, setDesign] = useState(BILL_DESIGNS.includes(settings?.bill_design) ? settings.bill_design : 'classic');
  const [lang, setLang] = useState(appLang === 'en' ? 'en' : 'mr');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useApi(`/customers/${id}/ledger`, range);
  const bill = data ? buildBill(data, settings, range) : null;

  // Invoice number: shown while previewing (the next one, nothing reserved); reserved when sent / saved / printed.
  const invKey = `${id}|${range.from}|${range.to}`;
  const [inv, setInv] = useState({ key: '', number: null });
  const invoiceNo = inv.key === invKey ? inv.number : null;
  useEffect(() => {
    let live = true;
    peekInvoice({ customer_id: Number(id), from: range.from, to: range.to })
      .then((number) => live && setInv({ key: invKey, number }))
      .catch(() => {});
    return () => { live = false; };
  }, [id, range.from, range.to, invKey]);

  /** Reserves the number and lets the bill redraw with it. null (with a message) when it can't be had, e.g. offline. */
  const ensureInvoice = async () => {
    try {
      const number = await issueInvoice({ customer_id: Number(id), from: range.from, to: range.to });
      setInv({ key: invKey, number });
      await nextPaint();
      return number;
    } catch {
      toast(t('bill.noInvoice'), 'error');
      return null;
    }
  };

  // Logo inside the PDF.
  const logo = useBillLogo(bill?.shop.logo);
  const sheet = useRef(null);

  const pickPeriod = (p) => {
    setPeriod(p);
    if (p !== 'custom') setRange(rangeOf(p));
  };


  const send = async () => {
    if (!sheet.current || !bill) return;
    setBusy(true);
    try {
      const no = await ensureInvoice();
      if (!no) return;
      const fileName = billFileName(shopName(bill, lang), no);
      const pdf = await billPdf(sheet.current);
      const text = shareText(bill, lang, no);
      const res = await shareBillFile(pdf, fileName, text);
      if (res === 'unsupported') {
        // Computer / phone without file sharing: save the PDF, open the chat with the text.
        downloadBlob(pdf, fileName);
        toast(t('bill.attachHint'), 'info');
        openWhatsApp(bill.customer.mobile, text);
      }
    } catch {
      toast(t('bill.imageFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!sheet.current || !bill) return;
    setBusy(true);
    try {
      const no = await ensureInvoice();
      if (!no) return;
      downloadBlob(await billPdf(sheet.current), billFileName(shopName(bill, lang), no));
    } catch {
      toast(t('bill.imageFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    if (await ensureInvoice()) window.print();
  };

  const shown = bill && { ...bill, invoiceNo, shop: { ...bill.shop, logo: logo || bill.shop.logo } }; // inlined copy once ready, else the plain URL

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="no-print">
        <PageHeader title={t('bill.title')} subtitle={bill?.customer.name} back />
      </div>

      <section className="no-print card space-y-3 !p-3.5">
        <div>
          <span className="label">{t('bill.period')}</span>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button key={p} type="button" className={`chip ${period === p ? 'chip-active' : ''}`} onClick={() => pickPeriod(p)}>
                {t(`bill.p.${p}`)}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" className="input" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
              <input type="date" className="input" value={range.to} min={range.from} max={today()} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
            </div>
          )}
        </div>
        <BillOptions design={design} setDesign={setDesign} lang={lang} setLang={setLang} />
      </section>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader rows={4} />}

      {shown && (
        <>
          <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" className="btn-wa col-span-2 py-3 text-base sm:col-span-1" disabled={busy} onClick={send}>
              <MessageCircle size={18} /> {busy ? t('bill.making') : t('bill.send')}
            </button>
            <button type="button" className="btn-light" disabled={busy} onClick={download}>
              <Download size={17} /> {t('bill.pdf')}
            </button>
            <button type="button" className="btn-light" onClick={print}>
              <Printer size={17} /> {t('bill.printOnly')}
            </button>
          </div>

          <BillPreview design={design} bill={shown} lang={lang} sheetRef={sheet} />
          <p className="no-print text-center text-xs text-muted">{t('bill.sendHint')}</p>
        </>
      )}
    </div>
  );
}
