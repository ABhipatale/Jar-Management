import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, Inbox, Minus, Phone, Plus, RotateCw, X } from 'lucide-react';
import { t } from '../i18n';
import { businessName, businessPlace, money } from '../lib/format';
import { Sparkline } from './charts';

/* ────────────────────────────────────────────────────────────────────────────
   Shared UI building blocks. Design tokens live in src/index.css
   (bg-surface, ring-line, text-muted …). Icons: lucide-react only.
   ──────────────────────────────────────────────────────────────────────────── */

/** Renders a Lucide icon component, or an emoji/string (legacy). */
export function Icon({ icon: I, size = 18, className = '' }) {
  if (!I) return null;
  if (typeof I === 'string') return <span className={`leading-none ${className}`}>{I}</span>;
  return <I size={size} strokeWidth={2} className={className} aria-hidden="true" />;
}

export function PageHeader({ title, back, right, subtitle }) {
  const navigate = useNavigate();
  return (
    <div className="no-print mb-4 flex items-start gap-2">
      {back && (
        <button
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="icon-btn -ml-2 mt-0.5 shrink-0"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

const TONES = {
  blue: { icon: 'bg-brand-50 text-brand-700', spark: '#3b6ff6' },
  green: { icon: 'bg-emerald-50 text-emerald-700', spark: '#10b981' },
  red: { icon: 'bg-red-50 text-red-600', spark: '#ef4444' },
  amber: { icon: 'bg-amber-50 text-amber-700', spark: '#f59e0b' },
  slate: { icon: 'bg-slate-100 text-slate-600', spark: '#64748b' },
  purple: { icon: 'bg-violet-50 text-violet-700', spark: '#8b5cf6' },
};

/** Percentage change pill. `inverse`: a rise is bad (udhari, expenses). */
export function Delta({ value, inverse = false, className = '' }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : inverse ? !up : up;
  const cls = flat ? 'bg-slate-100 text-slate-600' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600';
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${cls} ${className}`}>
      {!flat && <Arrow size={13} strokeWidth={2.5} />}
      {flat ? '0%' : `${Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

/**
 * KPI card: label, big value, optional % change vs previous period and a sparkline.
 * icon: Lucide component (preferred) or emoji string.
 */
export function StatCard({ label, value, icon, tone = 'slate', sub, to, delta, deltaInverse, deltaLabel, spark }) {
  const tn = TONES[tone] || TONES.slate;
  const body = (
    <div className={`card flex h-full flex-col gap-2 !p-3.5 ${to ? 'card-hover' : ''}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tn.icon}`}>
            <Icon icon={icon} size={17} />
          </span>
        )}
        <span className="min-w-0 truncate text-[13px] font-medium text-muted">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[22px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</div>
          {(delta !== undefined || sub) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Delta value={delta} inverse={deltaInverse} />
              {delta !== undefined && delta !== null && deltaLabel && <span>{deltaLabel}</span>}
              {sub && <span className="truncate">{sub}</span>}
            </div>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} color={tn.spark} className="h-8 w-16 shrink-0" />}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

const BADGES = {
  cash: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  udhari: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  with_customer: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  returned: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  damaged: 'bg-red-50 text-red-700 ring-red-600/20',
  lost: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  given: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  upi: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  bank: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  advance: 'bg-teal-50 text-teal-700 ring-teal-600/20',
};

const BADGE_KINDS = ['cash', 'udhari', 'available', 'with_customer', 'returned', 'damaged', 'lost', 'given', 'active', 'inactive', 'upi', 'bank', 'advance'];
const badgeText = (kind) => (BADGE_KINDS.includes(kind) ? t(`ui.badge.${kind}`) : '');

export function Badge({ kind, children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGES[kind] || BADGES.inactive}`}>
      {children || badgeText(kind) || kind || ''}
    </span>
  );
}

/** Pending amount shown as Udhari (red) or Advance (green). */
export function PendingText({ amount, className = '' }) {
  const n = Number(amount) || 0;
  if (n > 0) return <span className={`font-semibold tabular-nums text-red-600 ${className}`}>{money(n)}</span>;
  if (n < 0) return <span className={`font-semibold tabular-nums text-emerald-700 ${className}`}>{t('ui.advAmount', { amount: money(-n) })}</span>;
  return <span className={`tabular-nums text-slate-400 ${className}`}>₹0</span>;
}

/**
 * Label + control. Use group for button groups/steppers/pickers: a <label> would
 * forward taps on its text to the first button inside (e.g. the "−" of a stepper).
 */
export function Field({ label, hint, children, className = '', group = false }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </Tag>
  );
}

/** Toggle buttons, e.g. [GIVE JAR] [RETURN JAR]. Options may pass activeClass for a coloured active state. */
export function Segmented({ value, onChange, options, size = 'lg' }) {
  return (
    <div
      className="grid gap-1 rounded-xl bg-slate-100 p-1 ring-1 ring-line"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-150 active:scale-[.98] ${
              size === 'lg' ? 'py-3 text-[15px]' : 'py-2 text-sm'
            } ${active ? o.activeClass || 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-slate-600 hover:text-ink'}`}
          >
            {o.icon && <Icon icon={o.icon} size={size === 'lg' ? 18 : 16} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Number box with −/+ buttons. `max` (optional) caps both the + button and typed values. */
export function Stepper({ value, onChange, min = 0, max }) {
  const n = Number(value) || 0;
  const hasMax = max !== undefined && max !== null;
  const atMax = hasMax && n >= max;
  return (
    <div className="flex items-stretch gap-2">
      <button type="button" className="btn-light w-14 !px-0" onClick={() => onChange(Math.max(min, n - 1))} aria-label={t('common.less')}>
        <Minus size={20} />
      </button>
      <input
        className="input text-center text-2xl font-semibold tabular-nums"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(hasMax && digits !== '' && Number(digits) > max ? String(max) : digits);
        }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" className="btn-light w-14 !px-0" disabled={atMax} onClick={() => onChange(hasMax ? Math.min(max, n + 1) : n + 1)} aria-label={t('common.more')}>
        <Plus size={20} />
      </button>
    </div>
  );
}

/* ── Loading / empty / error states ───────────────────────────────────────── */

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Default loading state: skeleton rows (keeps layout stable while data loads). */
export function Loader({ rows = 4, label = t('common.loading') }) {
  return (
    <div className="space-y-2.5" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 !py-3">
          <Skeleton className="h-10 w-10 !rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton grid for KPI cards. */
export function SkeletonCards({ n = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card space-y-3 !p-3.5">
          <Skeleton className="h-8 w-8 !rounded-lg" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Empty({ children = t('common.empty'), icon = Inbox, title, action }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-8 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon icon={icon} size={20} />
      </span>
      {title && <div className="mb-1 font-semibold text-ink">{title}</div>}
      <div className="max-w-xs text-sm text-muted">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4 text-red-700 ring-1 ring-red-200" role="alert">
      <AlertTriangle size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {onRetry && (
          <button className="btn-light btn-sm mt-3" onClick={onRetry}>
            <RotateCw size={14} /> {t('common.tryAgain')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Floating primary action above the bottom menu (phone) / bottom-right (desktop). */
export function Fab({ to, label, icon = Plus }) {
  return (
    <div className="fab-above-nav no-print pointer-events-none fixed inset-x-0 z-30 lg:inset-x-auto lg:right-8">
      <div className="mx-auto flex max-w-2xl justify-end px-4 lg:px-0">
        <Link
          to={to}
          className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-brand-600 pl-4 pr-5 text-[15px] font-semibold text-white shadow-pop ring-4 ring-app transition hover:bg-brand-700 active:scale-95"
        >
          <Icon icon={icon} size={20} /> {label}
        </Link>
      </div>
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on larger screens. Esc / backdrop closes. */
export function Modal({ title, description, onClose, children, size = 'md' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`max-h-[92vh] w-full ${size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md'} animate-sheet-in overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8 shadow-pop ring-1 ring-line sm:animate-pop-in sm:rounded-2xl sm:pb-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button className="icon-btn -mr-1.5 -mt-1 shrink-0" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Header printed on paper / PDF only. */
export function PrintHeader({ settings, title, subtitle }) {
  return (
    <div className="print-only mb-4 border-b pb-3">
      <div className="text-lg font-bold">{businessName(settings)}</div>
      <div className="text-sm text-slate-600">
        {[businessPlace(settings), settings?.business_mobile].filter(Boolean).join(' · ')}
      </div>
      <div className="mt-2 font-semibold">{title}</div>
      {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
    </div>
  );
}

/** Developer credit shown at the bottom of every screen. */
export function DevCredit({ className = '' }) {
  return (
    <div className={`no-print flex flex-col items-center gap-0.5 text-center text-xs text-slate-400 ${className}`}>
      <span>
        {t('common.devBy')} <span className="font-semibold text-slate-500">AB Technology Services</span>
      </span>
      <a href="tel:7666287015" className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-ink">
        <Phone size={12} /> 7666287015
      </a>
    </div>
  );
}
