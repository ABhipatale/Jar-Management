import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { inlineImage, upiQr } from '../../lib/bill';
import { BILL_COMPONENTS, BILL_WIDTH } from './BillDesigns';

/**
 * Logo and payment QR as data URLs (so they end up inside the bill image):
 * a UPI QR with the exact amount when the shop has a UPI ID, else its uploaded QR photo.
 */
export function useBillImages(settings, logoUrl, due) {
  const [logo, setLogo] = useState(null);
  const [qr, setQr] = useState(null);
  useEffect(() => {
    let live = true;
    inlineImage(logoUrl).then((v) => live && setLogo(v));
    return () => { live = false; };
  }, [logoUrl]);
  useEffect(() => {
    let live = true;
    const s = settings || {};
    (s.upi_id ? upiQr(s.upi_id, s.business_name || '', due) : inlineImage(s.pay_qr_url)).then((v) => live && setQr(v));
    return () => { live = false; };
  }, [settings, due]);
  return { logo, qr };
}

/**
 * A bill at full size (for the image / print), shown scaled down to the available width.
 * sheetRef gets the full-size bill element (what billPdf() captures).
 */
export default function BillPreview({ design, bill, lang, qr, sheetRef }) {
  const box = useRef(null);
  const own = useRef(null);
  const sheet = sheetRef || own;
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !sheet.current) return;
      const s = Math.min(1, box.current.clientWidth / BILL_WIDTH[design]);
      setScale(s);
      setHeight(sheet.current.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (sheet.current) ro.observe(sheet.current);
    return () => ro.disconnect();
  }, [design, sheet]);

  const Bill = BILL_COMPONENTS[design];
  return (
    <div ref={box} className="bill-box overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-line" style={{ height: height || undefined }}>
      <div className="bill-sheet" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BILL_WIDTH[design] }}>
        <Bill ref={sheet} bill={bill} lang={lang} qr={qr} />
      </div>
    </div>
  );
}
