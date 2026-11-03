import { t } from '../../i18n';
import { BILL_DESIGNS } from '../../lib/bill';

/** A small pill switch: all options on one line, the chosen one filled. */
function Pills({ options, value, onChange, label, className = '' }) {
  return (
    <div className={`flex gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-line ${className}`} role="radiogroup" aria-label={label}>
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`min-w-0 flex-1 truncate whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors ${
            value === k ? 'bg-brand-700 text-white shadow-sm' : 'text-muted hover:bg-surface hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Bill design (3 pills in one row) and bill language, shared by the customer bill and the manual bill. */
export default function BillOptions({ design, setDesign, lang, setLang }) {
  return (
    <div className="space-y-3">
      <div>
        <span className="label">{t('bill.design')}</span>
        <Pills label={t('bill.design')} value={design} onChange={setDesign} options={BILL_DESIGNS.map((d) => [d, t(`bill.d.${d}`)])} />
      </div>
      <div>
        <span className="label">{t('bill.language')}</span>
        <Pills label={t('bill.language')} value={lang} onChange={setLang} options={[['mr', 'मराठी'], ['en', 'English']]} className="max-w-[16rem]" />
      </div>
    </div>
  );
}
