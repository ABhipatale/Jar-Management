import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, BellRing, CalendarClock, CheckCircle2, ChevronRight, Droplets, History, MessageCircle, Phone, Smartphone, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { Empty, ErrorBox, Loader, PageHeader, PendingText } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate } from '../lib/format';
import { currentSubscription, disablePush, enablePush, pushSupported, refreshBell } from '../lib/push';
import { useApi } from '../lib/useApi';
import { messages, openWhatsApp } from '../lib/whatsapp';

/** All jar reminders: due today/overdue, upcoming and recently completed. */
export default function Notifications() {
  const { settings } = useSettings();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useApi('/notifications');
  const [pushOn, setPushOn] = useState(null); // null = checking
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentSubscription().then((s) => setPushOn(Boolean(s)));
  }, []);

  // Opening this screen marks today's reminders as seen.
  useEffect(() => {
    if (data?.due?.length) api.post('/notifications/read').then(refreshBell).catch(() => {});
  }, [data]);

  const turnOn = async () => {
    setBusy(true);
    try {
      await enablePush();
      setPushOn(true);
      toast(t('notif.pushOnToast'));
    } catch (err) {
      const key = { unsupported: 'notif.errUnsupported', denied: 'notif.errDenied', nosw: 'notif.errNoSw', server: 'notif.errServer' }[err.message];
      toast(key ? t(key) : errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    await disablePush();
    setPushOn(false);
    toast(t('notif.pushOffToast'), 'info');
  };

  const done = async (r) => {
    try {
      await api.post(`/notifications/${r.id}/done`);
      toast(t('notif.doneToast'));
      reload();
      refreshBell();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const remove = async (r) => {
    if (!(await confirm({ message: t('notif.deleteConfirm', { name: r.customer_name, date: fmtDate(r.remind_on) }) }))) return;
    try {
      await api.delete(`/notifications/${r.id}`);
      reload();
      refreshBell();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const sendWa = (r) => {
    const c = { name: r.customer_name, pending_amount: r.pending_amount };
    openWhatsApp(r.customer_mobile, r.pending_amount > 0 ? messages.reminder(settings, c) : `नमस्कार ${r.customer_name},\n\n`);
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('notif.title')} back />

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Phone notification switch */}
        <div className={`card ${pushOn ? '!bg-emerald-50 !ring-emerald-200' : '!bg-sky-50 !ring-sky-200'}`}>
          {!pushSupported() ? (
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <BellOff size={18} />
              </span>
              <p className="pt-1.5 text-sm text-slate-700">{t('notif.unsupportedHint')}</p>
            </div>
          ) : pushOn ? (
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <BellRing size={18} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-emerald-800">{t('notif.ui.pushIsOn')}</span>
              <button className="btn-light btn-sm shrink-0" onClick={turnOff}>
                <BellOff size={15} /> {t('notif.turnOff')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
                  <Smartphone size={18} />
                </span>
                <p className="text-sm text-slate-700">{t('notif.pushHint')}</p>
              </div>
              <button className="btn-primary w-full" disabled={busy || pushOn === null} onClick={turnOn}>
                <Bell size={18} /> {busy ? t('notif.turningOn') : t('notif.ui.turnOn')}
              </button>
            </div>
          )}
        </div>

        <Link to="/bookings" className="card card-hover group flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <CalendarClock size={18} />
          </span>
          <span className="min-w-0 flex-1 font-semibold text-ink">{t('book.seeAll')}</span>
          <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader />}

      {data && (
        <>
          <Section title={t('notif.due')} count={data.due.length} tone="amber">
            {data.due.length === 0 ? (
              <div className="lg:col-span-2"><Empty icon={CheckCircle2}>{t('notif.noneDue')}</Empty></div>
            ) : (
              data.due.map((r) => (
                <ReminderCard key={r.id} r={r} highlight>
                  <button className="btn-wa btn-sm" onClick={() => sendWa(r)}>
                    <MessageCircle size={16} /> WhatsApp
                  </button>
                  <a className="btn-light btn-sm !px-2.5" href={`tel:${r.customer_mobile}`} aria-label={t('rep.call')}>
                    <Phone size={16} />
                  </a>
                  <button className="btn-primary btn-sm" onClick={() => done(r)}>
                    <CheckCircle2 size={16} /> {t('notif.ui.markDone')}
                  </button>
                </ReminderCard>
              ))
            )}
          </Section>

          <Section title={t('notif.upcoming')} count={data.upcoming.length}>
            {data.upcoming.length === 0 ? (
              <div className="lg:col-span-2"><Empty icon={CalendarClock}>{t('notif.noneUpcoming')}</Empty></div>
            ) : (
              data.upcoming.map((r) => (
                <ReminderCard key={r.id} r={r}>
                  <button className="icon-btn text-red-600 hover:text-red-700" onClick={() => remove(r)} aria-label={t('notif.delete')} title={t('notif.delete')}>
                    <Trash2 size={17} />
                  </button>
                </ReminderCard>
              ))
            )}
          </Section>

          {data.done.length > 0 && (
            <Section title={t('notif.done')} count={data.done.length} icon={History}>
              {data.done.map((r) => (
                <ReminderCard key={r.id} r={r} muted />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, tone, icon: I, children }) {
  const pill = tone === 'amber' && count > 0 ? 'bg-amber-50 text-amber-700 ring-amber-600/25' : 'bg-slate-100 text-slate-600 ring-slate-500/20';
  return (
    <section className="space-y-3">
      <h2 className="section-title flex items-center gap-2">
        {I && <I size={15} />}
        {title}
        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold normal-case tabular-nums ring-1 ring-inset ${pill}`}>{count}</span>
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function ReminderCard({ r, highlight, muted, children }) {
  return (
    <div className={`card !py-3.5 ${highlight ? '!ring-amber-300' : ''} ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
          {(r.customer_name || '?').charAt(0).toUpperCase()}
          {highlight && !r.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />}
        </span>
        <Link to={`/customers/${r.customer_id}`} className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink hover:text-brand-700">{r.customer_name}</div>
          <div className="text-xs text-muted">
            {t('notif.daysLabel', { n: r.days })} · {t('notif.givenLine', { date: fmtDate(r.given_on), n: r.jar_quantity })}
          </div>
        </Link>
        <div className="shrink-0 space-y-0.5 text-right text-sm">
          <div className={`inline-flex items-center gap-1 font-semibold tabular-nums ${highlight ? 'text-amber-700' : 'text-ink'}`}>
            <Bell size={13} /> {fmtDate(r.remind_on)}
          </div>
          <div className="flex items-center justify-end gap-1 text-muted">
            <Droplets size={13} /> <span className="tabular-nums">{r.current_jars}</span> · <PendingText amount={r.pending_amount} />
          </div>
        </div>
      </div>
      {r.auto_done && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 size={13} /> {t('notif.ui.autoDone')}
        </p>
      )}
      {children && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line pt-3">{children}</div>}
    </div>
  );
}
