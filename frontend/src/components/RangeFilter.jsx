import { CalendarRange } from 'lucide-react';
import { t } from '../i18n';
import { rangeFor, today } from '../lib/format';

const PRESETS = [
  { key: 'today', label: t('common.today') },
  { key: 'yesterday', label: t('common.yesterday') },
  { key: 'week', label: t('range.week') },
  { key: 'month', label: t('range.month') },
  { key: 'custom', label: t('range.custom'), icon: CalendarRange },
];

/** Today / Yesterday / This Week / This Month / Custom range. value = { preset, from, to } */
export default function RangeFilter({ value, onChange }) {
  const pick = (preset) => {
    if (preset === 'custom') onChange({ ...value, preset });
    else onChange({ preset, ...rangeFor(preset) });
  };

  return (
    <div className="no-print">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={value.preset === p.key}
            className={`chip ${value.preset === p.key ? 'chip-active' : ''}`}
            onClick={() => pick(p.key)}
          >
            {p.icon && <p.icon size={14} />}
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="mt-3 grid animate-fade-in grid-cols-2 gap-3 sm:max-w-md">
          <label className="block">
            <span className="label">{t('rep.range.from')}</span>
            <input type="date" className="input" value={value.from} max={today()} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">{t('rep.range.to')}</span>
            <input type="date" className="input" value={value.to} max={today()} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

export function initialRange(preset = 'today') {
  return { preset, ...rangeFor(preset) };
}
