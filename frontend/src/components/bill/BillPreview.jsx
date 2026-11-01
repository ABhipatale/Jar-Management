import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { inlineImage } from '../../lib/bill';
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

  const Bill = BILL_COMPONENTS[design];
  return (
    <div ref={box} className="bill-box overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-line" style={{ height: height || undefined }}>
      <div className="bill-sheet" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BILL_WIDTH[design] }}>
        <Bill ref={sheet} bill={bill} lang={lang} />
      </div>
    </div>
  );
}
