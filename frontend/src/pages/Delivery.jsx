import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronRight, Droplets, IndianRupee, Moon, Play, Sun, Truck, Users } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { ErrorBox, PageHeader, SkeletonCards } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtLongDate, money } from '../lib/format';
import { features } from '../lib/products';
import { useApi } from '../lib/useApi';

/** Look of each route: sunrise for the morning, dusk for the evening. */
export const SESSION_LOOK = {
  morning: {
    icon: Sun,
    title: 'route.morning',
    bg: 'linear-gradient(135deg,#f59e0b 0%,#f97316 55%,#ef4444 120%)',
    solid: '#f97316',
    soft: 'bg-orange-50 text-orange-600 ring-orange-100',
  },
  evening: {
    icon: Moon,
    title: 'route.evening',
    bg: 'linear-gradient(135deg,#312e81 0%,#4f46e5 55%,#7c3aed 110%)',
    solid: '#4f46e5',
    soft: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  },
};

/** Status colours used everywhere on the delivery screens. */
export const STATUS_COLOR = { done: '#10b981', skipped: '#94a3b8', pending: '#e2e8f0', current: '#2563eb' };

/** Progress ring (SVG). */
export function Ring({ value, total, size = 64, stroke = 7, color = '#10b981', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = total ? Math.min(1, value / total) : 0;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200/80" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">{children}</span>
    </span>
  );
}

/** One thin segment per stop, coloured by status (current = blue). Tapping is optional. */
export function Segments({ statuses, current = -1, onPick, className = '' }) {
  if (!statuses?.length) return null;
  return (
    <div className={`flex gap-[3px] ${className}`} role="presentation">
      {statuses.map((s, i) => (
        <button
          key={i}
          type="button"
          tabIndex={onPick ? 0 : -1}
          disabled={!onPick}
          onClick={onPick ? () => onPick(i) : undefined}
          className="h-1.5 min-w-0 flex-1 rounded-full transition-colors disabled:cursor-default"
          style={{ background: i === current ? STATUS_COLOR.current : STATUS_COLOR[s] || STATUS_COLOR.pending }}
          aria-label={onPick ? String(i + 1) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Routes are switched off for this company (or were just switched off): a clear message
 * instead of an error. Settings are refreshed, so the menu item goes away too.
 */
export function RoutesOff() {
  const { reload } = useSettings();
  useEffect(() => {
    reload?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title={t('route.title')} back="/" />
      <div className="card text-center">
        <Truck size={32} className="mx-auto text-slate-400" />
        <p className="mt-3 font-semibold text-ink">{t('route.offTitle')}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t('route.offHint')}</p>
      </div>
    </div>
  );
}

/**
 * Daily delivery home: the day at a glance (one progress ring, three numbers) and a card per
 * route with its progress, who is next and one button to start / continue.
 */
export default function Delivery() {
  const navigate = useNavigate();
  const { toast } = useUi();
  const { settings } = useSettings();
  const on = features(settings).routes;
  const { data, loading, error, reload } = useApi(on ? '/routes' : null);
  const [busy, setBusy] = useState(null);

  const open = async (session, s) => {
    if (s.started || s.total === 0) return navigate(`/delivery/${session}`);
    setBusy(session);
    try {
      await api.post(`/routes/${session}/start`);
      navigate(`/delivery/${session}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (!on) return <RoutesOff />;

  const m = data?.sessions.morning;
  const e = data?.sessions.evening;
  const day = data && {
    total: m.total + e.total,
    resolved: m.done + m.skipped + e.done + e.skipped,
    jars: m.jars_planned + e.jars_planned,
    cash: m.cash + e.cash,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('route.title')} subtitle={fmtLongDate()} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <SkeletonCards n={3} />}

      {data && (
        <>
          {/* The day at a glance */}
          <section className="card flex items-center gap-4 !p-4">
            <Ring value={day.resolved} total={day.total} size={76} stroke={8}>
              <span className="text-center leading-none">
                <span className="block text-lg font-bold tabular-nums text-ink">{day.total ? Math.round((day.resolved / day.total) * 100) : 0}%</span>
                <span className="text-[10px] font-medium text-muted">{t('route.done')}</span>
              </span>
            </Ring>
            <dl className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-line">
              {[
                [Users, t('route.customersWord'), day.total],
                [Droplets, t('route.jarsWord'), day.jars],
                [IndianRupee, t('route.cash'), money(day.cash)],
              ].map(([Icon, label, value]) => (
                <div key={label} className="min-w-0 px-2 text-center first:pl-0 last:pr-0">
                  <dt className="flex items-center justify-center gap-1 truncate text-[11px] font-medium text-muted">
                    <Icon size={12} aria-hidden="true" /> {label}
                  </dt>
                  <dd className="mt-1 truncate text-lg font-bold tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {['morning', 'evening'].map((session) => (
              <RouteCard key={session} session={session} s={data.sessions[session]} busy={busy === session} onOpen={() => open(session, data.sessions[session])} />
            ))}
          </div>

          {day.total === 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">{t('route.noneDueHint')}</p>
          )}
        </>
      )}
    </div>
  );
}

function RouteCard({ session, s, busy, onOpen }) {
  const look = SESSION_LOOK[session];
  const Icon = look.icon;
  const resolved = s.done + s.skipped;
  const finished = s.started && s.total > 0 && s.pending === 0;
  const label = s.total === 0 || finished ? t('route.view') : s.started ? t('route.continue') : t('route.start');

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-soft ring-1 ring-line">
      <div className="h-1.5" style={{ background: look.bg }} />
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft" style={{ background: look.bg }}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight text-ink">{t(look.title)}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {t('route.customersN', { n: s.total })} · 💧 {t('route.jarsN', { n: s.jars_planned })}
          </p>
        </div>
        <Ring value={resolved} total={s.total} size={52} stroke={6} color={finished ? STATUS_COLOR.done : look.solid}>
          {finished ? (
            <CheckCircle2 size={20} className="text-emerald-600" />
          ) : (
            <span className="text-xs font-bold tabular-nums text-ink">
              {resolved}/{s.total}
            </span>
          )}
        </Ring>
      </div>

      <div className="flex-1 space-y-3 px-4">
        <Segments statuses={s.statuses} />
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">✓ {s.done} {t('route.done')}</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{s.pending} {t('route.pending')}</span>
          {s.skipped > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{s.skipped} {t('route.skipped')}</span>}
          {s.done > 0 && <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-1 tabular-nums text-ink ring-1 ring-line">{money(s.cash)}</span>}
        </div>

        {s.next?.length > 0 && (
          <div className="rounded-xl bg-surface-2 p-2.5 ring-1 ring-line">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('route.upNext')}</div>
            <ol className="space-y-1">
              {s.next.map((name, i) => (
                <li key={name + i} className="flex items-center gap-2 text-sm">
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? 'text-white' : 'bg-surface text-muted ring-1 ring-line'}`} style={i === 0 ? { background: look.solid } : undefined}>
                    {i + 1}
                  </span>
                  <span className={`truncate ${i === 0 ? 'font-semibold text-ink' : 'text-muted'}`}>{name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          type="button"
          className="btn w-full py-3.5 text-base text-white shadow-soft transition hover:brightness-105 active:scale-[.99]"
          style={{ background: finished ? '#059669' : look.bg }}
          disabled={busy}
          onClick={onOpen}
        >
          {s.started || s.total === 0 ? <ArrowRight size={19} /> : <Play size={18} />} {label}
        </button>
      </div>
    </section>
  );
}

/** Home dashboard card: today's morning / evening progress, one tap to the delivery screen. */
export function DeliveryToday() {
  const { data } = useApi('/routes');
  if (!data) return null;
  return (
    <Link to="/delivery" className="card card-hover block !p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-orange-600">
            <Truck size={17} />
          </span>
          {t('route.dashTitle')}
        </h2>
        <ChevronRight size={18} className="text-slate-400" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {['morning', 'evening'].map((session) => {
          const s = data.sessions[session];
          const look = SESSION_LOOK[session];
          const Icon = look.icon;
          return (
            <div key={session} className="rounded-xl bg-surface-2 p-2.5 ring-1 ring-line">
              <div className="flex items-center justify-between gap-1 text-xs font-medium text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon size={13} style={{ color: look.solid }} /> {t(look.title)}
                </span>
                <span className="font-semibold tabular-nums text-ink">
                  {s.done + s.skipped}/{s.total}
                </span>
              </div>
              <Segments statuses={s.statuses} className="mt-2" />
              <div className="mt-1.5 text-xs text-muted">💧 {t('route.jarsN', { n: s.jars_planned })}</div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
