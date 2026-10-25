import { useState } from 'react';
import { BadgeCheck, CalendarClock, CheckCircle2, CreditCard, Crown, Phone, Sparkles } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { ErrorBox, Loader, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useUi } from '../context/UiContext';
import { lang, t } from '../i18n';
import { daysUntil, fmtDate, money } from '../lib/format';
import { payWithRazorpay } from '../lib/razorpay';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../lib/support';
import { useApi } from '../lib/useApi';

const planName = (p) => (lang === 'mr' ? p.name_mr || p.name : p.name);
// Description in the app's language, falling back to the other one.
const planDesc = (p) => (lang === 'mr' ? p.description_mr || p.description : p.description || p.description_mr);

/** Colourful "choose plan" button: press-down + a ripple from where it was tapped. */
function PlanButton({ yearly, onClick, disabled, children }) {
  const [ripples, setRipples] = useState([]);
  const tap = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((list) => [...list, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((list) => list.filter((x) => x.id !== id)), 700);
    onClick();
  };
  return (
    <button type="button" className={`plan-btn mt-5 ${yearly ? 'plan-btn-year' : 'plan-btn-month'}`} onClick={tap} disabled={disabled}>
      {ripples.map((r) => (
        <span key={r.id} className="plan-ripple" style={{ left: r.x, top: r.y }} aria-hidden="true" />
      ))}
      {children}
    </button>
  );
}

/**
 * Plans + one-time Razorpay payment (each payment adds a month/year). `locked`: the company's plan has ended and this is the only
 * screen it can use until someone pays.
 */
export default function Billing({ locked = false }) {
  const { refreshMe } = useAuth();
  const { toast } = useUi();
  const { data, loading, error, reload } = useApi('/billing');
  const [busy, setBusy] = useState(null);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading && !data) return <Loader />;

  const { company, plans, payments, enabled } = data;
  const monthly = plans.find((p) => p.interval === 'month');
  // Red only when a plan really ended (a new, not-yet-paid company gets a friendly card).
  const ended = company.expired && !company.awaiting_payment;
  const left = company.expires_at ? daysUntil(company.expires_at) : null;

  const buy = async (plan) => {
    setBusy(plan.id);
    try {
      const { data: order } = await api.post('/billing/order', { plan_id: plan.id });
      const paid = await payWithRazorpay(order);
      if (!paid) return; // popup closed
      const { data: res } = await api.post('/billing/verify', paid);
      toast(res.message);
      await refreshMe(); // an expired company opens the app again
      reload();
    } catch (err) {
      toast(err?.response ? errorMessage(err) : t('bill.failed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {!locked && <PageHeader title={t('bill.title')} back />}

      {/* Current status */}
      <div className={`card flex items-start gap-3 ${ended ? 'ring-red-200' : ''}`}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ended ? 'bg-red-50 text-red-600' : company.awaiting_payment ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {ended ? <CalendarClock size={20} /> : company.awaiting_payment ? <Sparkles size={20} /> : <BadgeCheck size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">
            {company.awaiting_payment
              ? t('bill.noPlan')
              : company.expired
              ? t('bill.expiredOn', { date: fmtDate(company.expires_at) })
              : company.expires_at
                ? t('bill.activeTill', { date: fmtDate(company.expires_at) })
                : t('bill.noPlan')}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {company.plan && <span>{t('adm.plan')}: {company.plan} · </span>}
            {!company.expired && left !== null && t('plan.daysLeft', { days: left })}
            {company.expired && t('bill.choosePlan')}
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <Sparkles size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{t('bill.soon')}</div>
            <a href={`tel:${SUPPORT_PHONE}`} className="mt-1 inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
              <Phone size={14} /> {t('bill.callSupport', { phone: SUPPORT_PHONE_DISPLAY })}
            </a>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const yearly = p.interval === 'year';
          const save = yearly && monthly ? monthly.price * 12 - p.price : 0;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-2xl bg-surface p-5 shadow-soft ring-1 ${yearly ? 'ring-2 ring-brand-500' : 'ring-line'}`}
            >
              {yearly && save > 0 && (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-soft">
                  <Crown size={13} /> {t('bill.bestValue')}
                </span>
              )}
              <div className="text-sm font-semibold uppercase tracking-wide text-muted">{planName(p)}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-ink">{money(p.price)}</span>
                <span className="text-sm text-muted">/ {yearly ? t('bill.year') : t('bill.month')}</span>
              </div>
              {yearly && monthly && <div className="mt-1 text-sm text-muted">{t('bill.perMonth', { amount: money(Math.round(p.price / 12)) })}</div>}
              {save > 0 && <div className="mt-2 text-sm font-semibold text-emerald-700">{t('bill.save', { amount: money(save) })}</div>}
              {planDesc(p) && <p className="mt-3 text-sm leading-relaxed text-muted">{planDesc(p)}</p>}
              <ul className="mt-4 space-y-1.5 text-sm text-ink">
                {['bill.f1', 'bill.f2', 'bill.f3'].map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> {t(k, { interval: yearly ? t('bill.year') : t('bill.month') })}
                  </li>
                ))}
              </ul>
              <PlanButton yearly={yearly} onClick={() => buy(p)} disabled={!enabled || busy !== null}>
                {busy === p.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : yearly ? (
                  <Crown size={18} />
                ) : (
                  <CreditCard size={18} />
                )}
                {t('bill.choose')}
              </PlanButton>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted">{t('bill.autoNote')}</p>

      {/* History */}
      {payments.length > 0 && (
        <section className="card !p-0">
          <h2 className="border-b border-line px-4 py-3 font-semibold text-ink">{t('bill.history')}</h2>
          <ul className="divide-y divide-line">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-ink">{p.plan}</div>
                  <div className="text-xs text-muted">
                    {fmtDate(p.date)} · {t('bill.validTill', { date: fmtDate(p.period_end) })}
                  </div>
                </div>
                <div className="font-semibold tabular-nums text-ink">{money(p.amount)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
