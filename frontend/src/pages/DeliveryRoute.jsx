import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, List, Route as RouteIcon, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, Minus, Navigation,
  PartyPopper, Phone, Play, Plus, RotateCcw, SkipForward, StickyNote, Truck, UserPlus, X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import Celebration from '../components/Celebration';
import CustomerPicker from '../components/CustomerPicker';
import EditEntryModal from '../components/EditEntryModal';
import RouteRoadView from '../components/RouteRoadView';
import { ErrorBox, Loader, Modal, PageHeader, Stepper } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { money } from '../lib/format';
import { features } from '../lib/products';
import { useApi } from '../lib/useApi';
import { openWhatsApp } from '../lib/whatsapp';
import { Ring, RoutesOff, Segments, SESSION_LOOK, STATUS_COLOR } from './Delivery';

const REASONS = ['not_home', 'postponed', 'not_needed', 'cancelled', 'other'];
const pad = (n) => String(n).padStart(2, '0');
const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
// List or road view of the whole route: the owner's choice, remembered on this phone.
const VIEW_KEY = 'rws_route_view';
const savedView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'road' ? 'road' : 'list';
  } catch {
    return 'list';
  }
};
const mapUrl = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address || s.name)}`;

/**
 * One route (morning / evening) of today, made for use on the road:
 *  - not started: today's due customers in order, one Start button;
 *  - started: the current customer in a big card (call, map, WhatsApp, jars, pending, note)
 *    with "Delivered" (the normal entry screen, then back here to the next customer), Skip
 *    with a reason, Previous / Next — and the whole route below as a timeline;
 *  - all done: the route summary.
 */
export default function DeliveryRoute() {
  const { session } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useUi();
  const look = SESSION_LOOK[session] || SESSION_LOOK.morning;
  const [route, setRoute] = useState(null);
  const { settings } = useSettings();
  const on = features(settings).routes;
  const { data, loading, error, reload } = useApi(on ? `/routes/${session}` : null);
  const [focus, setFocus] = useState(null); // stop id the owner picked; else the first pending
  const cardRef = useRef(null);
  // A customer tapped on the road, the list or the progress bar: open them in the big card
  // and scroll smoothly up to it (it sits above the whole route).
  const pick = (id) => {
    setFocus(id);
    setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  const [busy, setBusy] = useState(false);
  const [skipping, setSkipping] = useState(null);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(null); // stop ids while changing the order
  const [entry, setEntry] = useState(null); // jar entry opened from a delivered stop
  const [view, setView] = useState(savedView);
  const chooseView = (v) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked: choice lasts for this visit */
    }
  };

  // { kind: 'stop' | 'route', next?, delivered? } — kept in sessionStorage until it was shown,
  // so a re-render / remount while loading can't swallow it.
  const partyKey = `rws_route_party_${session}`;
  const [party, setPartyState] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(partyKey) || 'null');
    } catch {
      return null;
    }
  });
  const setParty = (p) => {
    setPartyState(p);
    try {
      if (p) sessionStorage.setItem(partyKey, JSON.stringify(p));
      else sessionStorage.removeItem(partyKey);
    } catch {
      /* storage blocked: shown for this render only */
    }
  };

  useEffect(() => {
    if (!data) return;
    setRoute(data);
    // Celebrate only what is NEW since this route was last seen on this phone: a delivery
    // (coming back from the entry screen) or the route just finished. Refresh = no repeat.
    if (!data.started) return;
    const key = `rws_route_seen_${session}_${data.date}`;
    const now = { done: data.totals.done, pending: data.totals.pending };
    let before = null;
    try {
      before = JSON.parse(sessionStorage.getItem(key) || 'null');
      sessionStorage.setItem(key, JSON.stringify(now));
    } catch {
      /* storage blocked: no celebrations, everything else works */
    }
    if (!before) return;
    if (before.pending > 0 && now.pending === 0 && data.totals.total > 0) {
      setParty({ kind: 'route', delivered: now.done });
    } else if (now.done > before.done) {
      setParty({ kind: 'stop', next: data.stops.find((x) => x.status === 'pending')?.name });
    }
  }, [data, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const stops = route?.stops || [];
  const totals = route?.totals;
  const current = useMemo(() => {
    const picked = stops.find((s) => s.id === focus);
    return picked || stops.find((s) => s.status === 'pending') || null;
  }, [stops, focus]);
  const idx = current ? stops.indexOf(current) : -1;

  // Every change answers with the whole route again.
  const act = async (fn, okMessage) => {
    setBusy(true);
    try {
      const { data: res } = await fn();
      setRoute(res);
      if (okMessage || res.message) toast(okMessage || res.message);
      return res;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const start = () => act(() => api.post(`/routes/${session}/start`));
  const skip = async (stop, reason) => {
    setSkipping(null);
    const res = await act(() => api.patch(`/route-stops/${stop.id}`, { status: 'skipped', skip_reason: reason }));
    if (res) setFocus(null); // on to the next pending customer
  };
  const unskip = (stop) => act(() => api.patch(`/route-stops/${stop.id}`, { status: 'pending' })).then((res) => res && setFocus(stop.id));
  const setQty = (stop, q) => q >= 1 && act(() => api.patch(`/route-stops/${stop.id}`, { quantity: q }));
  const remove = async (stop) => {
    if (!(await confirm({ message: t('route.removeConfirm', { name: stop.name }) }))) return;
    act(() => api.delete(`/route-stops/${stop.id}`));
  };
  const deliver = (stop) => {
    const back = `/delivery/${session}`;
    navigate(`/entry?type=given&customer=${stop.customer_id}&qty=${stop.quantity}&stop=${stop.id}&back=${encodeURIComponent(back)}`);
  };

  if (!on) return <RoutesOff />;
  if (error && !route) return <ErrorBox message={error} onRetry={reload} />;
  if (loading && !route) return <Loader rows={4} />;
  if (!route) return null;

  const Icon = look.icon;
  const resolved = totals.done + totals.skipped;
  const finished = route.started && totals.total > 0 && totals.pending === 0;
  // The big card: the current customer, or (also after the route is finished) the one picked.
  const live = route.started && current && (!finished || focus !== null);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <PageHeader title={t(look.title)} back="/delivery" />

      {/* Route header: progress ring, numbers and one segment per stop (tap to jump) */}
      <section className="card !p-4">
        <div className="flex items-center gap-3.5">
          <Ring value={resolved} total={totals.total} size={58} stroke={6} color={finished ? STATUS_COLOR.done : look.solid}>
            <Icon size={20} style={{ color: finished ? STATUS_COLOR.done : look.solid }} aria-hidden="true" />
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold tabular-nums leading-tight text-ink">
              {route.started ? t('route.doneOf', { done: resolved, total: totals.total }) : t('route.customersN', { n: totals.total })}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
              <span>💧 {t('route.jarsN', { n: totals.jars_planned })}</span>
              {totals.done > 0 && <span className="font-semibold text-emerald-700">{money(totals.cash)}</span>}
              {totals.skipped > 0 && <span>⏭ {totals.skipped}</span>}
            </div>
          </div>
        </div>
        {route.started && totals.total > 0 && (
          <Segments
            className="mt-3.5"
            statuses={stops.map((s) => s.status)}
            current={live ? idx : -1}
            onPick={(i) => pick(stops[i].id)}
          />
        )}
      </section>

      {/* Not started: the plan + Start */}
      {!route.started &&
        (stops.length > 0 ? (
          <section className="space-y-3">
            <button type="button" className="btn w-full py-4 text-lg text-white shadow-pop transition hover:brightness-105" style={{ background: look.bg }} disabled={busy} onClick={start}>
              <Play size={20} /> {t('route.start')}
            </button>
            <p className="px-1 text-center text-xs leading-relaxed text-muted">{t('route.previewHint')}</p>
          </section>
        ) : (
          <div className="card py-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-slate-400 ring-1 ring-line">
              <Truck size={26} />
            </span>
            <p className="mt-3 font-semibold text-ink">{t('route.noneDue')}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{t('route.noneDueHint')}</p>
          </div>
        ))}

      {finished && <Summary totals={totals} session={t(look.title)} />}

      {live && (
        <CurrentCard
          cardRef={cardRef}
          stop={current}
          number={idx + 1}
          total={stops.length}
          busy={busy}
          look={look}
          onDeliver={() => deliver(current)}
          onSkip={() => setSkipping(current)}
          onUnskip={() => unskip(current)}
          onQty={(q) => setQty(current, q)}
          onEntry={() => setEntry(current.jar_transaction_id)}
          onPrev={idx > 0 ? () => setFocus(stops[idx - 1].id) : null}
          onNext={idx < stops.length - 1 ? () => setFocus(stops[idx + 1].id) : null}
        />
      )}

      {/* Whole route */}
      {stops.length > 0 && (
        <section className="card !p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="font-semibold text-ink">{route.started ? t('route.overview') : t('route.preview')}</h2>
            {!ordering && (
              <div className="inline-flex rounded-lg bg-surface-2 p-0.5 ring-1 ring-line" role="radiogroup" aria-label={t('route.viewAs')}>
                {[
                  ['list', List, t('route.viewList')],
                  ['road', RouteIcon, t('route.viewRoad')],
                ].map(([v, I, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={view === v}
                    onClick={() => chooseView(v)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${view === v ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-muted hover:text-ink'}`}
                  >
                    <I size={14} /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {route.started && !ordering && (
            <div className="flex flex-wrap justify-end gap-1 border-b border-line px-3 py-1.5">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setAdding(true)}>
                  <UserPlus size={15} /> {t('route.addCustomer')}
                </button>
                {stops.length > 1 && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setOrdering(stops.map((s) => s.id))}>
                    <ArrowUpDown size={15} /> {t('route.reorder')}
                  </button>
                )}
            </div>
          )}
          {ordering ? (
            <Reorder
              stops={stops}
              ids={ordering}
              setIds={setOrdering}
              busy={busy}
              onCancel={() => setOrdering(null)}
              onSave={(keep) => act(() => api.post(`/routes/${session}/order`, { ids: ordering, permanent: keep })).then((r) => r && setOrdering(null))}
            />
          ) : view === 'road' ? (
            <div className="px-3 pb-4 pt-3">
              <RouteRoadView stops={stops} currentIndex={live ? idx : -1} onPick={route.started ? (i) => pick(stops[i].id) : null} />
            </div>
          ) : (
            <ol className="px-3 pb-1 pt-3">
              {stops.map((s, i) => (
                <TimelineStop
                  key={s.id ?? `p${s.customer_id}`}
                  stop={s}
                  number={i + 1}
                  last={i === stops.length - 1}
                  active={live && current?.id === s.id}
                  onPick={route.started ? () => pick(s.id) : null}
                  onRemove={route.started && s.status !== 'done' ? () => remove(s) : null}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      {route.started && stops.length === 0 && (
        <button type="button" className="btn-light w-full" onClick={() => setAdding(true)}>
          <UserPlus size={16} /> {t('route.addCustomer')}
        </button>
      )}

      {finished && (
        <Link to="/delivery" className="btn-light w-full">
          <ChevronLeft size={17} /> {t('route.backHome')}
        </Link>
      )}

      {skipping && (
        <Modal title={t('route.skipTitle', { name: skipping.name })} onClose={() => setSkipping(null)}>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-left text-base font-medium text-ink ring-1 ring-line transition hover:bg-surface-2 active:scale-[.99]" disabled={busy} onClick={() => skip(skipping, r)}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500">
                  <SkipForward size={15} />
                </span>
                {t(`route.reason.${r}`)}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {adding && (
        <AddCustomer
          busy={busy}
          onClose={() => setAdding(false)}
          onAdd={(customerId, qty) => act(() => api.post(`/routes/${session}/stops`, { customer_id: customerId, quantity: qty })).then((r) => r && setAdding(false))}
        />
      )}

      {entry && <EditEntryModal kind="jar" id={entry} onClose={() => setEntry(null)} onSaved={reload} />}

      {party && <Celebration kind={party.kind} next={party.next} delivered={party.delivered} onClose={() => setParty(null)} />}
    </div>
  );
}

/* ───────────── Current customer ───────────── */

function CurrentCard({ cardRef, stop: s, number, total, busy, look, onDeliver, onSkip, onUnskip, onQty, onEntry, onPrev, onNext }) {
  const done = s.status === 'done';
  const skipped = s.status === 'skipped';
  const owes = s.pending_amount > 0;

  return (
    <section ref={cardRef} className="scroll-mt-20 overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-line">
      {/* Stop bar: number, state, previous / next */}
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
        <button type="button" className="icon-btn h-8 w-8" disabled={!onPrev} onClick={onPrev || undefined} aria-label={t('route.prev')} title={t('route.prev')}>
          <ChevronLeft size={18} />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <span className={`rounded-full px-2.5 py-1 ${done ? 'bg-emerald-100 text-emerald-800' : skipped ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800'}`}>
            {done ? `✓ ${t('route.done')}` : skipped ? `⏭ ${t('route.skipped')}` : `● ${t('route.nowLabel')}`}
          </span>
          <span className="tabular-nums text-muted">{t('route.stop', { n: `${number} / ${total}` })}</span>
        </div>
        <button type="button" className="icon-btn h-8 w-8" disabled={!onNext} onClick={onNext || undefined} aria-label={t('route.next')} title={t('route.next')}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="p-4">
        {/* Who */}
        <div className="flex items-start gap-3.5">
          <span className="relative shrink-0">
            <span className="grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold text-white shadow-soft" style={{ background: done ? 'linear-gradient(135deg,#10b981,#059669)' : skipped ? '#94a3b8' : look.bg }}>
              {done ? <Check size={28} /> : initials(s.name)}
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-surface px-1 text-[11px] font-bold tabular-nums text-ink shadow-soft ring-1 ring-line">
              {pad(number)}
            </span>
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[22px] font-bold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">{s.name}</h2>
            {s.address && (
              <p className="mt-1 flex items-start gap-1 text-sm text-muted">
                <MapPin size={14} className="mt-0.5 shrink-0" /> <span className="[overflow-wrap:anywhere]">{s.address}</span>
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {s.overdue_days > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">{t('route.overdue', { n: s.overdue_days })}</span>}
              {s.added_manually && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">{t('route.manual')}</span>}
            </div>
          </div>
        </div>

        {/* Contact actions, like a phone contact card */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            [Phone, t('route.call'), { href: `tel:${s.mobile}` }, 'text-emerald-600'],
            [Navigation, t('route.map'), { href: mapUrl(s), target: '_blank', rel: 'noopener noreferrer' }, 'text-blue-600'],
            [MessageCircle, 'WhatsApp', { onClick: () => openWhatsApp(s.mobile, '') }, 'text-[#1fae55]'],
          ].map(([I, label, props, cls]) => {
            const Tag = props.href ? 'a' : 'button';
            return (
              <Tag key={label} {...props} {...(Tag === 'button' && { type: 'button' })} className="flex flex-col items-center gap-1 rounded-xl bg-surface-2 py-2.5 text-xs font-semibold text-ink ring-1 ring-line transition hover:bg-surface active:scale-[.97]">
                <I size={20} className={cls} />
                {label}
              </Tag>
            );
          })}
        </div>

        {/* Numbers */}
        <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-xl ring-1 ring-line">
          <div className="px-2 py-2.5 text-center">
            <div className="text-[11px] font-medium text-muted">{t('route.give')}</div>
            {done || skipped ? (
              <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{done ? s.delivered?.jars ?? s.quantity : s.quantity}</div>
            ) : (
              <div className="mt-1 flex items-center justify-center gap-1">
                <button type="button" className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink ring-1 ring-line disabled:opacity-40" disabled={busy || s.quantity <= 1} onClick={() => onQty(s.quantity - 1)} aria-label="−">
                  <Minus size={13} />
                </button>
                <span className="min-w-7 text-2xl font-bold tabular-nums text-ink">{s.quantity}</span>
                <button type="button" className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-ink ring-1 ring-line" disabled={busy} onClick={() => onQty(s.quantity + 1)} aria-label="+">
                  <Plus size={13} />
                </button>
              </div>
            )}
          </div>
          <div className="px-2 py-2.5 text-center">
            <div className="text-[11px] font-medium text-muted">{t('route.holds')}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{s.current_jars}</div>
          </div>
          <div className="px-2 py-2.5 text-center">
            <div className="text-[11px] font-medium text-muted">{t('route.due')}</div>
            <div className={`mt-1 truncate text-xl font-bold tabular-nums ${owes ? 'text-red-600' : 'text-emerald-600'}`}>{money(Math.max(s.pending_amount, 0))}</div>
          </div>
        </div>

        {s.note && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
            <StickyNote size={16} className="mt-0.5 shrink-0" /> {s.note}
          </p>
        )}

        {/* What to do */}
        <div className="mt-4 space-y-2">
          {done ? (
            <>
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-emerald-800 ring-1 ring-emerald-200">
                <Check size={19} />
                <span className="font-semibold">{t('route.gave', { n: s.delivered?.jars ?? '' })}</span>
                {s.done_at && <span className="text-xs text-emerald-700/80">· {s.done_at}</span>}
                {s.delivered && <span className="ml-auto font-bold tabular-nums">{money(s.delivered.amount)}</span>}
              </div>
              <button type="button" className="btn-light w-full" onClick={onEntry}>
                {t('route.viewEntry')}
              </button>
            </>
          ) : skipped ? (
            <>
              <div className="rounded-xl bg-slate-100 px-3.5 py-3 font-semibold text-slate-700">
                ⏭ {t(`route.reason.${s.skip_reason || 'other'}`)}
              </div>
              <button type="button" className="btn-light w-full" disabled={busy} onClick={onUnskip}>
                <RotateCcw size={16} /> {t('route.undoSkip')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn w-full py-4 text-lg text-white shadow-soft transition hover:brightness-105 active:scale-[.99]"
                style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)' }}
                disabled={busy}
                onClick={onDeliver}
              >
                <Check size={22} /> {t('route.deliver')}
              </button>
              <button type="button" className="btn-ghost w-full text-muted" disabled={busy} onClick={onSkip}>
                <SkipForward size={16} /> {t('route.skip')}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Timeline (whole route) ───────────── */

function TimelineStop({ stop: s, number, last, active, onPick, onRemove }) {
  const done = s.status === 'done';
  const skipped = s.status === 'skipped';
  const node = done
    ? 'bg-emerald-500 text-white'
    : active
      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
      : skipped
        ? 'bg-slate-200 text-slate-500'
        : 'bg-surface text-ink ring-2 ring-line-strong';
  const sub = done
    ? `${t('route.gave', { n: s.delivered?.jars ?? '' })}${s.delivered ? ` · ${money(s.delivered.amount)}` : ''}`
    : skipped
      ? t(`route.reason.${s.skip_reason || 'other'}`)
      : [t('route.jarsN', { n: s.quantity }), s.address].filter(Boolean).join(' · ');

  return (
    <li className="relative flex gap-3 pb-3">
      {!last && (
        <span
          className={`absolute left-[17px] top-9 bottom-0 w-[3px] -translate-x-1/2 rounded-full ${done ? 'bg-emerald-400' : 'bg-[repeating-linear-gradient(to_bottom,#cbd5e1_0_5px,transparent_5px_10px)]'}`}
          aria-hidden="true"
        />
      )}
      <span className={`relative z-[1] mt-0.5 grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${node}`}>
        {done ? <Check size={16} /> : skipped ? <SkipForward size={14} /> : pad(number)}
      </span>
      <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 transition ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-surface-2'}`}>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onPick || undefined} disabled={!onPick}>
          <span className={`block truncate text-[15px] font-semibold ${skipped ? 'text-slate-400 line-through' : 'text-ink'}`}>{s.name}</span>
          <span className={`block truncate text-xs ${done ? 'text-emerald-700' : 'text-muted'}`}>{sub}</span>
        </button>
        {s.overdue_days > 0 && !done && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t('route.overdue', { n: s.overdue_days })}</span>}
        {done && s.done_at && (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium tabular-nums text-muted">
            <Clock size={11} /> {s.done_at}
          </span>
        )}
        {onRemove && (
          <button type="button" className="icon-btn h-8 w-8 shrink-0 text-slate-400 hover:text-red-600" onClick={onRemove} aria-label={t('route.remove')} title={t('route.remove')}>
            <X size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

/* ───────────── Change order (↑ ↓, today only or kept) ───────────── */

function Reorder({ stops, ids, setIds, busy, onCancel, onSave }) {
  const [keep, setKeep] = useState(false);
  const byId = Object.fromEntries(stops.map((s) => [s.id, s]));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };
  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted">{t('route.reorderHint')}</p>
      <ol className="space-y-2">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-xl bg-surface px-2 py-2 ring-1 ring-line">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold tabular-nums">{pad(i + 1)}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{byId[id]?.name}</span>
            <button type="button" className="icon-btn h-9 w-9" disabled={i === 0} onClick={() => move(i, -1)} aria-label="↑">
              <ArrowUp size={17} />
            </button>
            <button type="button" className="icon-btn h-9 w-9" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="↓">
              <ArrowDown size={17} />
            </button>
          </li>
        ))}
      </ol>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm font-medium text-ink ring-1 ring-line">
        <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        {t('route.reorderKeep')}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-light" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => onSave(keep)}>
          {t('route.reorderSave')}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Add a customer to today's route ───────────── */

function AddCustomer({ busy, onClose, onAdd }) {
  const [customerId, setCustomerId] = useState('');
  const [qty, setQty] = useState(1);
  return (
    <Modal title={t('route.addTitle')} onClose={onClose}>
      <div className="min-h-72 space-y-4">
        <CustomerPicker value={customerId} onChange={(id) => setCustomerId(id || '')} />
        <div>
          <span className="label">{t('route.qtyToday')}</span>
          <Stepper value={qty} onChange={(v) => setQty(Math.max(1, Number(v) || 1))} min={1} />
        </div>
        <button type="button" className="btn-primary w-full py-3" disabled={!customerId || busy} onClick={() => onAdd(Number(customerId), qty)}>
          <UserPlus size={17} /> {t('route.addCustomer')}
        </button>
      </div>
    </Modal>
  );
}

/* ───────────── Route finished ───────────── */

function Summary({ totals: s, session }) {
  const tiles = [
    [t('route.done'), s.done, 'text-emerald-600'],
    [t('route.skipped'), s.skipped, 'text-slate-500'],
    [t('route.delivered'), s.jars_delivered + (s.bottles_delivered || 0), 'text-blue-600'],
    [t('route.empties'), s.empties, 'text-sky-600'],
    [t('route.cash'), money(s.cash), 'text-emerald-600'],
    [t('route.udhari'), money(s.udhari), 'text-amber-600'],
  ];
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-pop ring-1 ring-line">
      <div className="relative overflow-hidden px-5 py-7 text-center text-white" style={{ background: 'linear-gradient(135deg,#10b981 0%,#0d9488 60%,#0891b2 120%)' }}>
        <span className="pointer-events-none absolute -left-6 -top-8 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
        <span className="relative mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/20 ring-4 ring-white/15">
          <PartyPopper size={28} />
        </span>
        <h2 className="relative mt-3 text-2xl font-bold">{t('route.allDone')}</h2>
        <p className="relative text-sm text-white/90">{t('route.allDoneSub', { session })}</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
        {tiles.map(([label, value, cls]) => (
          <div key={label} className="bg-surface px-3 py-4 text-center">
            <div className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</div>
            <div className="mt-0.5 text-xs font-medium text-muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
