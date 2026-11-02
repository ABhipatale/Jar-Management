import { StickyNote, Truck } from 'lucide-react';
import { t } from '../i18n';
import { Field, Stepper } from './ui';

/** Empty schedule: on no route (what every existing customer has). */
export const ROUTE_DEFAULTS = {
  route_morning: false,
  route_evening: false,
  morning_qty: 1,
  evening_qty: 1,
  schedule_type: 'daily',
  schedule_every: 2,
  schedule_days: [],
  delivery_note: '',
};

/** Customer (API) → form values. */
export const routeFromCustomer = (c) => ({
  route_morning: Boolean(c.route_morning),
  route_evening: Boolean(c.route_evening),
  morning_qty: c.morning_qty || 1,
  evening_qty: c.evening_qty || 1,
  schedule_type: c.schedule_type || 'daily',
  schedule_every: c.schedule_every || 2,
  schedule_days: String(c.schedule_days || '').split(',').map(Number).filter(Boolean),
  delivery_note: c.delivery_note || '',
});

/** Form values → API fields. */
export const routeToApi = (r) => ({
  route_morning: r.route_morning,
  route_evening: r.route_evening,
  morning_qty: Math.max(1, Number(r.morning_qty) || 1),
  evening_qty: Math.max(1, Number(r.evening_qty) || 1),
  schedule_type: r.schedule_type,
  schedule_every: Math.min(60, Math.max(2, Number(r.schedule_every) || 2)),
  schedule_days: r.schedule_type === 'weekdays' ? [...r.schedule_days].sort().join(',') : null,
  delivery_note: r.delivery_note.trim() || null,
});

/** Problem to show before saving, or ''. */
export const routeProblem = (r) =>
  (r.route_morning || r.route_evening) && r.schedule_type === 'weekdays' && r.schedule_days.length === 0 ? t('route.pickDay') : '';

const FREQ = ['daily', 'every', 'weekdays', 'booked'];

/**
 * Customer form section "Daily delivery": morning and/or evening (each with its own jars),
 * how often, and a note for whoever delivers. Shown only when routes are switched on.
 */
export default function DeliveryScheduleFields({ value: r, onChange }) {
  const set = (patch) => onChange({ ...r, ...patch });
  const days = t('route.days').split(',');
  const on = r.route_morning || r.route_evening;

  return (
    <section className="card space-y-4 sm:!p-6">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600">
          <Truck size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{t('route.custSection')}</h2>
          <p className="text-xs text-muted">{t('route.custSectionSub')}</p>
        </div>
      </div>

      {/* Morning / evening, each with its own jars */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['route_morning', 'morning_qty', t('route.custMorning'), 'bg-amber-50 ring-amber-300'],
          ['route_evening', 'evening_qty', t('route.custEvening'), 'bg-indigo-50 ring-indigo-300'],
        ].map(([key, qtyKey, label, activeCls]) => (
          <div key={key} className={`rounded-xl p-3 ring-1 transition ${r[key] ? activeCls : 'bg-surface-2 ring-line'}`}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={r[key]} onChange={(e) => set({ [key]: e.target.checked })} />
              <span className="text-base font-semibold text-ink">{label}</span>
            </label>
            {r[key] && (
              <div className="mt-3">
                <span className="label">{t('route.custQty')}</span>
                <Stepper value={r[qtyKey]} min={1} onChange={(v) => set({ [qtyKey]: Math.max(1, Number(v) || 1) })} />
              </div>
            )}
          </div>
        ))}
      </div>

      {!on && <p className="text-xs text-muted">{t('route.noRouteHint')}</p>}

      {on && (
        <>
          <Field group label={t('route.freq')}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FREQ.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set({ schedule_type: f })}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${
                    r.schedule_type === f ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-ink ring-line hover:bg-surface-2'
                  }`}
                >
                  {t(`route.freq.${f}`)}
                </button>
              ))}
            </div>
          </Field>

          {r.schedule_type === 'every' && (
            <Field group label={t('route.everyLabel')} hint={t('route.everyHint')}>
              <div className="flex items-center gap-3">
                <Stepper value={r.schedule_every} min={2} max={60} onChange={(v) => set({ schedule_every: Math.max(2, Number(v) || 2) })} />
                <span className="text-sm font-medium text-ink">{t('route.everyN', { n: r.schedule_every })}</span>
              </div>
            </Field>
          )}

          {r.schedule_type === 'weekdays' && (
            <Field group label={t('route.freq.weekdays')}>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d, i) => {
                  const n = i + 1;
                  const picked = r.schedule_days.includes(n);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => set({ schedule_days: picked ? r.schedule_days.filter((x) => x !== n) : [...r.schedule_days, n] })}
                      className={`rounded-lg py-2.5 text-sm font-semibold ring-1 transition ${picked ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-ink ring-line'}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {r.schedule_type === 'booked' && <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted ring-1 ring-line">{t('route.bookedHint')}</p>}

          <Field label={t('route.deliveryNote')}>
            <span className="relative block">
              <StickyNote size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
              <input className="input pl-10" value={r.delivery_note} maxLength={255} placeholder={t('route.deliveryNotePh')} onChange={(e) => set({ delivery_note: e.target.value })} />
            </span>
          </Field>
        </>
      )}
    </section>
  );
}
