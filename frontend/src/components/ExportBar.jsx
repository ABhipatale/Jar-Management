import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { printPage } from '../lib/export';
import { businessName } from '../lib/format';

/** Excel / PDF / Print buttons (+ optional extra, e.g. WhatsApp). */
export default function ExportBar({ onExcel, extra, landscape = false }) {
  const { toast } = useUi();
  const { settings } = useSettings();
  const print = () => printPage({ landscape, footer: businessName(settings) });
  return (
    <div className="no-print no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {onExcel && (
        <button className="btn-light btn-sm shrink-0" onClick={onExcel}>
          <FileSpreadsheet size={16} className="text-emerald-700" /> Excel
        </button>
      )}
      <button
        className="btn-light btn-sm shrink-0"
        onClick={() => {
          toast(t('export.pdfHint'), 'info');
          setTimeout(print, 400);
        }}
      >
        <FileText size={16} className="text-red-600" /> PDF
      </button>
      <button className="btn-light btn-sm shrink-0" onClick={print}>
        <Printer size={16} className="text-muted" /> {t('export.print')}
      </button>
      {extra}
    </div>
  );
}
