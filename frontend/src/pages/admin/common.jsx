import { CalendarClock, Infinity as Forever } from 'lucide-react';
import { Badge } from '../../components/ui';
import { t } from '../../i18n';
import { daysUntil } from '../../lib/format';

export function StatusBadge({ company }) {
  if (company.status === 'suspended') return <Badge kind="inactive">{t('adm.status.suspended')}</Badge>;
  if (company.expired) return <Badge kind="damaged">{t('adm.status.expired')}</Badge>;
  return <Badge kind="active">{t('adm.status.active')}</Badge>;
}

// A stable colour per company name, so the same company always looks the same.
const GRADIENTS = [
  'from-sky-500 to-blue-700',
  'from-violet-500 to-indigo-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-700',
  'from-cyan-500 to-sky-700',
];

function hash(s) {
  let h = 0;
  for (const ch of s || '') h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

/** Company logo, or its first letter on a coloured tile. */
export function CompanyAvatar({ company, size = 'h-11 w-11', text = 'text-base' }) {
  if (company.logo_url || company.branding?.logo_url) {
    return (
      <img
        src={company.logo_url || company.branding.logo_url}
        alt=""
        className={`${size} shrink-0 rounded-xl bg-white object-contain p-0.5 ring-1 ring-line`}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={`${size} ${text} grid shrink-0 place-items-center rounded-xl bg-linear-to-br font-bold text-white shadow-soft ${GRADIENTS[hash(company.name) % GRADIENTS.length]}`}
      aria-hidden="true"
    >
      {(company.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** Days left on the plan as a coloured pill: green, amber (≤ 7 days) or red (ended). */
export function PlanPill({ company }) {
  if (!company.expires_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <Forever size={13} aria-hidden="true" /> {t('adm.noExpiry')}
      </span>
    );
  }
  const days = daysUntil(company.expires_at);
  const cls = days < 1 ? 'bg-red-50 text-red-700' : days <= 7 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${cls}`}>
      <CalendarClock size={13} aria-hidden="true" />
      {days < 1 ? t('adm.status.expired') : t('plan.daysLeft', { days })}
    </span>
  );
}
