import { useEffect, useRef, useState } from 'react';
import { Download, Printer, Wallet } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import BillPreview, { useBillImages } from '../components/bill/BillPreview';
import { billPng, buildBill, downloadBlob } from '../lib/bill';

// What the customer sees from the WhatsApp link (no login): their bill, a UPI pay button,
// download and print. Text follows the bill's language, not the app's.
const TXT = {
  mr: { pay: 'UPI ने पैसे भरा', image: 'फोटो', print: 'PDF / प्रिंट', loading: 'बिल उघडत आहे…', gone: 'हे बिल उघडता आले नाही. लिंक जुनी झाली असेल — दुकानदाराकडून नवीन बिल मागवा.' },
  en: { pay: 'Pay with UPI', image: 'Image', print: 'PDF / Print', loading: 'Opening the bill…', gone: 'This bill could not be opened. The link may have expired — ask the shop for a new bill.' },
};

export default function PublicBill({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sheet = useRef(null);

  useEffect(() => {
    api
      .get(`/public/bills/${encodeURIComponent(token)}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e?.response?.status === 404 ? 'gone' : errorMessage(e)));
  }, [token]);

  const lang = data?.bill.lang === 'en' ? 'en' : 'mr';
  const tx = TXT[lang];
  const bill = data ? buildBill(data.ledger, data.shop, data.bill) : null;
  const { logo, qr } = useBillImages(data?.shop, bill?.shop.logo, bill?.closing ?? 0);

  useEffect(() => {
    if (bill) document.title = `${bill.no} – ${bill.shop.name}`;
  }, [bill?.no, bill?.shop.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return <p className="mx-auto max-w-md p-6 text-center text-muted">{error === 'gone' ? TXT.mr.gone + '\n\n' + TXT.en.gone : error}</p>;
  }
  if (!bill) return <p className="p-6 text-center text-muted">{TXT.mr.loading}</p>;

  const s = data.shop;
  const due = bill.closing;
  const upiLink = s.upi_id && due > 0
    ? `upi://pay?pa=${encodeURIComponent(s.upi_id)}&pn=${encodeURIComponent(s.business_name || '')}&am=${due.toFixed(2)}&cu=INR`
    : null;

  const download = async () => {
    setBusy(true);
    try {
      downloadBlob(await billPng(sheet.current), `${bill.no}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-100 px-3 py-4 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(upiLink || s.pay_url) && due > 0 && (
            <a href={upiLink || `${s.pay_url}?a=${due}`} className="btn-primary col-span-2 py-3 text-base sm:col-span-1">
              <Wallet size={18} /> {tx.pay} – ₹{due}
            </a>
          )}
          <button type="button" className="btn-light" disabled={busy} onClick={download}>
            <Download size={17} /> {tx.image}
          </button>
          <button type="button" className="btn-light" onClick={() => window.print()}>
            <Printer size={17} /> {tx.print}
          </button>
        </div>
        <BillPreview design={data.bill.design} bill={{ ...bill, shop: { ...bill.shop, logo } }} lang={lang} qr={qr} sheetRef={sheet} />
      </div>
    </div>
  );
}
