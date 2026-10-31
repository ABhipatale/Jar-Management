import { useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, MessageCircle, Printer, Share2 } from 'lucide-react';
import api from '../api/client';
import BillPreview, { useBillImages } from '../components/bill/BillPreview';
import { ErrorBox, Loader, PageHeader } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { lang as appLang, t } from '../i18n';
import { BILL_DESIGNS, billPng, buildBill, downloadBlob, shareBillImage } from '../lib/bill';
import { addDays, monthStart, today } from '../lib/format';
import { useApi } from '../lib/useApi';
import { openWhatsApp, openWhatsAppLater } from '../lib/whatsapp';

const PERIODS = ['thisMonth', 'lastMonth', 'custom'];

function rangeOf(p) {
  if (p === 'lastMonth') {
    const end = addDays(monthStart(today()), -1);
    return { from: monthStart(end), to: end };
  }
  return { from: monthStart(today()), to: today() };
}

/**
 * WhatsApp text (customer-facing, so in the bill's language). With `link` it carries the
 * "view your bill" page; otherwise it goes with the bill photo and has the pay link.
 */
function shareText(b, lang, payUrl, link) {
  const amt = `₹${Math.max(b.closing, 0)}`;
  const extra = link
    ? (lang === 'en' ? `\n📄 View / download your bill:\n${link}` : `\n📄 बिल पाहा / डाउनलोड करा:\n${link}`)
    : (payUrl && b.closing > 0 ? `\n💳 ${payUrl}?a=${b.closing}` : '');
  return lang === 'en'
    ? `🙏 Hello ${b.customer.name},\nHere is your bill ${b.no}.\nTotal due: *${amt}*${extra}\n\n${b.shop.nameEn || b.shop.name}`
    : `🙏 नमस्कार ${b.customer.name},\nआपले बिल ${b.no} पाठवत आहोत.\nएकूण बाकी: *${amt}*${extra}\n\n💧 ${b.shop.name}`;
}

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

  // Logo / QR inside the image; UPI QR with the exact amount due.
  const { logo, qr } = useBillImages(settings, bill?.shop.logo, bill?.closing ?? 0);
  const sheet = useRef(null);

  const pickPeriod = (p) => {
    setPeriod(p);
    if (p !== 'custom') setRange(rangeOf(p));
  };

  const fileName = bill ? `${bill.no}-${bill.customer.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.png` : 'bill.png';

  // Straight to this customer's chat: the message with a link to their bill (WhatsApp lets
  // an app choose the person only for text, never for a file).
  const sendLink = async () => {
    if (!bill) return;
    setBusy(true);
    try {
      await openWhatsAppLater(bill.customer.mobile, async () => {
        const { data: res } = await api.post(`/customers/${id}/bill-link`, { ...range, lang, design });
        return shareText(bill, lang, settings?.pay_url, `${window.location.origin}/b/${res.token}`);
      });
    } catch {
      toast(t('bill.linkFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // The bill picture through the phone's share menu (the person is picked inside WhatsApp).
  const sharePhoto = async () => {
    if (!sheet.current || !bill) return;
    setBusy(true);
    try {
      const png = await billPng(sheet.current);
      const text = shareText(bill, lang, settings?.pay_url);
      const res = await shareBillImage(png, fileName, text);
      if (res === 'unsupported') {
        // Computer / iPhone without file sharing: save the image, open the chat with the text.
        downloadBlob(png, fileName);
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
    if (!sheet.current) return;
    setBusy(true);
    try {
      downloadBlob(await billPng(sheet.current), fileName);
    } catch {
      toast(t('bill.imageFail'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const shown = bill && { ...bill, shop: { ...bill.shop, logo } };

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
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <span className="label">{t('bill.design')}</span>
            <div className="flex flex-wrap gap-2">
              {BILL_DESIGNS.map((d) => (
                <button key={d} type="button" className={`chip ${design === d ? 'chip-active' : ''}`} onClick={() => setDesign(d)}>
                  {t(`bill.d.${d}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">{t('bill.language')}</span>
            <div className="flex gap-2">
              {[['mr', 'मराठी'], ['en', 'English']].map(([k, n]) => (
                <button key={k} type="button" className={`chip ${lang === k ? 'chip-active' : ''}`} onClick={() => setLang(k)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader rows={4} />}

      {shown && (
        <>
          <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" className="btn-wa col-span-2 py-3 text-base sm:col-span-3" disabled={busy} onClick={sendLink}>
              <MessageCircle size={18} /> {busy ? t('bill.making') : t('bill.sendTo', { name: bill.customer.name })}
            </button>
            <button type="button" className="btn-light col-span-2 sm:col-span-1" disabled={busy} onClick={sharePhoto}>
              <Share2 size={17} /> {t('bill.sharePhoto')}
            </button>
            <button type="button" className="btn-light" disabled={busy} onClick={download}>
              <Download size={17} /> {t('bill.image')}
            </button>
            <button type="button" className="btn-light" onClick={() => window.print()}>
              <Printer size={17} /> {t('bill.print')}
            </button>
          </div>

          <BillPreview design={design} bill={shown} lang={lang} qr={qr} sheetRef={sheet} />
          <p className="no-print text-center text-xs text-muted">{t('bill.sendHint')}</p>
        </>
      )}
    </div>
  );
}
