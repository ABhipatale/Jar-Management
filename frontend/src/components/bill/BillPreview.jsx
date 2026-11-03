import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../../api/client';
import { inlineImage, upiQr } from '../../lib/bill';
import { BILL_COMPONENTS, BILL_WIDTH } from './BillDesigns';

/** The shop logo as a data URL, so it ends up inside the PDF. */
export function useBillLogo(logoUrl) {
  const [logo, setLogo] = useState(null);
  useEffect(() => {
    let live = true;
    inlineImage(logoUrl).then((v) => live && setLogo(v));
    return () => { live = false; };
  }, [logoUrl]);
  return logo;
}

/**
 * A bill at full size (for the image / print), shown scaled down to the available width.
 * sheetRef gets the full-size bill element (what billPdf() captures).
 */
export default function BillPreview({ design, bill, lang, sheetRef }) {
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

  // Pay-now QR: the shop's uploaded QR picture if there is one, else one made from the UPI ID.
  // Only while something is due; nothing at all when neither exists (the bill stays as it was).
  const [qr, setQr] = useState(null);
  const qrKey = `${bill.payQrUrl || ''}|${bill.upi ? bill.upi.id : ''}|${bill.closing > 0}`;
  useEffect(() => {
    let live = true;
    (async () => {
      let v = null;
      if (bill.payQrUrl && bill.closing > 0) v = (await inlineImage(bill.payQrUrl)) || bill.payQrUrl;
      else v = await upiQr(bill);
      if (live) setQr(v);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrKey]);

  // The shop's signature & stamp (only when uploaded in Settings): without it the bill is unchanged.
  const [stamp, setStamp] = useState(null);
  const hasStamp = !!bill.shop.hasStamp;
  useEffect(() => {
    let live = true;
    if (!hasStamp) setStamp(null);
    else api.get('/settings/stamp').then((r) => live && setStamp(r.data.stamp)).catch(() => live && setStamp(null));
    return () => { live = false; };
  }, [hasStamp]);

  const Bill = BILL_COMPONENTS[design];
  return (
    <div ref={box} className="bill-box overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-line" style={{ height: height || undefined }}>
      <div className="bill-sheet" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BILL_WIDTH[design] }}>
        <Bill ref={sheet} bill={{ ...bill, qr, stamp }} lang={lang} />
      </div>
    </div>
  );
}
