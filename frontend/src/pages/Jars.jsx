import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, CircleCheck, CircleHelp, Droplets, House, Info, PackagePlus, Save, SearchCheck, UserRound, Wrench } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { StackBar } from '../components/charts';
import CustomerPicker from '../components/CustomerPicker';
import { Badge, ErrorBox, Field, Loader, Modal, PageHeader, StatCard, Stepper } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { today } from '../lib/format';
import { useApi } from '../lib/useApi';

const ACTIONS = {
  add: { title: t('jars.add'), icon: PackagePlus, btn: 'btn-primary', tint: 'bg-brand-50 text-brand-700' },
  damaged: { title: t('jars.damaged'), icon: AlertTriangle, btn: 'btn-danger', tint: 'bg-red-50 text-red-600' },
  lost: { title: t('jars.lost'), icon: CircleHelp, btn: 'btn-danger', tint: 'bg-amber-50 text-amber-700' },
  repaired: { title: t('jars.repaired'), icon: Wrench, btn: 'btn-primary', tint: 'bg-emerald-50 text-emerald-700' },
  found: { title: t('jars.found'), icon: SearchCheck, btn: 'btn-primary', tint: 'bg-sky-50 text-sky-700' },
};

const STATUSES = ['available', 'with_customer', 'returned', 'damaged', 'lost'];
const STATUS_LABELS = Object.fromEntries(STATUSES.map((st) => [st, t(`jars.st.${st}`)]));

export default function Jars() {
  const { settings } = useSettings();
  const { toast } = useUi();
  const tracking = settings.jar_tracking === '1' || settings.jar_tracking === true;
  const [statusFilter, setStatusFilter] = useState('');
  const { data, loading, error, reload } = useApi('/jars', { status: statusFilter || undefined });
  const [action, setAction] = useState(null);
  const [qty, setQty] = useState('1');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [editJar, setEditJar] = useState(null);

  const s = data?.summary;

  const runAction = async () => {
    const n = parseInt(qty, 10) || 0;
    if (n < 1) return toast(t('entry.qtyMin'), 'error');
    setBusy(true);
    try {
      const res = action === 'add' ? await api.post('/jars', { quantity: n }) : await api.post('/jars/adjust', { action, quantity: n, date });
      toast(res.data.message);
      setAction(null);
      setQty('1');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveJar = async () => {
    setBusy(true);
    try {
      await api.put(`/jars/${editJar.id}`, { status: editJar.status, customer_id: editJar.customer_id || null });
      toast(t('jars.updated'));
      setEditJar(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('jars.title')} subtitle={t('jars.subtitle')} />

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && loading && <Loader />}

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="col-span-2 lg:col-span-4">
              <StatCard label={t('jars.availableLabel')} value={s.available_jars} icon={CircleCheck} tone="green" sub={t('jars.availableSub')} />
            </div>
            <StatCard label={t('jars.totalJars')} value={s.total_jars} icon={Droplets} tone="slate" />
            <StatCard label={t('jars.withCustomers')} value={s.customer_jars} icon={House} tone="blue" to="/reports/jar-status" />
            <StatCard label={t('jars.damagedStat')} value={s.damaged_jars} icon={AlertTriangle} tone="red" />
            <StatCard label={t('jars.lostStat')} value={s.lost_jars} icon={CircleHelp} tone="amber" />
          </div>

          {s.total_jars === 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              <Info size={18} className="mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                {t('jars.startHint1')} <b className="font-semibold">{t('jars.add')}</b> {t('jars.startHint2')}
              </p>
            </div>
          )}

          {s.total_jars > 0 && (
            <section className="card">
              <h2 className="section-title mb-3">{t('jars.stockMix')}</h2>
              <StackBar
                total={Math.max(s.total_jars, 1)}
                segments={[
                  { label: t('jars.st.available'), value: Math.max(0, s.available_jars), color: '#10b981' },
                  { label: t('jars.withCustomers'), value: s.customer_jars, color: '#3b6ff6' },
                  { label: t('jars.damagedStat'), value: s.damaged_jars, color: '#ef4444' },
                  { label: t('jars.lostStat'), value: s.lost_jars, color: '#94a3b8' },
                ]}
              />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="section-title">{t('jars.actions')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(ACTIONS).map(([k, a]) => (
                <button
                  key={k}
                  className={`card card-hover flex items-center gap-3 !p-3 text-left text-sm font-medium active:scale-[.98] ${
                    k === 'add' ? 'col-span-2 !bg-brand-600 !text-white !ring-brand-600 sm:col-span-3 lg:col-span-1' : 'text-ink'
                  }`}
                  onClick={() => setAction(k)}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${k === 'add' ? 'bg-white/15 text-white' : a.tint}`}>
                    <a.icon size={17} />
                  </span>
                  <span className="min-w-0 leading-snug">{a.title}</span>
                </button>
              ))}
            </div>
          </section>

          <Link to="/reports/jar-status" className="card card-hover flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              <House size={18} />
            </span>
            <span className="flex-1 font-medium text-ink">{t('jars.whoHasLbl')}</span>
            <ChevronRight size={18} className="text-muted" />
          </Link>

          {tracking ? (
            <section className="card space-y-3">
              <h2 className="font-semibold text-ink">{t('jars.numbers')}</h2>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
                {['', ...STATUSES].map((st) => (
                  <button key={st} className={`chip ${statusFilter === st ? 'chip-active' : ''}`} onClick={() => setStatusFilter(st)}>
                    {st ? STATUS_LABELS[st] : t('jars.all')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {data.jars.data.map((j) => (
                  <button
                    key={j.id}
                    className="flex flex-col items-start gap-1.5 rounded-lg bg-surface-2 p-2.5 text-left ring-1 ring-inset ring-line transition hover:ring-line-strong active:scale-[.98]"
                    onClick={() => setEditJar({ ...j })}
                  >
                    <span className="font-mono text-sm font-semibold text-ink">{j.jar_number}</span>
                    <Badge kind={j.status} />
                    {j.customer_name && (
                      <span className="flex w-full min-w-0 items-center gap-1 text-xs text-muted">
                        <UserRound size={12} className="shrink-0" />
                        <span className="truncate">{j.customer_name}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {data.jars.last_page > 1 && <p className="text-xs text-muted">{t('jars.showingFirst', { n: data.jars.data.length, total: data.jars.total })}</p>}
            </section>
          ) : (
            <p className="text-center text-sm text-muted">
              {t('jars.countHint1')}{' '}
              <Link to="/settings" className="font-semibold text-brand-700 hover:underline">
                {t('jars.countHintLink')}
              </Link>{' '}
              {t('jars.countHint2')}
            </p>
          )}
        </>
      )}

      {action && (
        <Modal title={ACTIONS[action].title} onClose={() => setAction(null)}>
          <div className="space-y-4">
            <Field group label={t('jars.howMany')}>
              <Stepper value={qty} onChange={(v) => setQty(String(v))} min={1} />
            </Field>
            {action !== 'add' && (
              <Field label={t('entry.date')}>
                <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </Field>
            )}
            <button className={`${ACTIONS[action].btn} w-full`} disabled={busy} onClick={runAction}>
              {!busy && <Save size={18} />}
              {busy ? t('entry.saving') : t('entry.save')}
            </button>
          </div>
        </Modal>
      )}

      {editJar && (
        <Modal title={editJar.jar_number} onClose={() => setEditJar(null)}>
          <div className="space-y-4">
            <Field group label={t('jars.status')}>
              <select className="input" value={editJar.status} onChange={(e) => setEditJar({ ...editJar, status: e.target.value })}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </Field>
            {editJar.status === 'with_customer' && (
              <Field group label={t('entry.customer')}>
                <CustomerPicker value={editJar.customer_id || ''} onChange={(id) => setEditJar((j) => ({ ...j, customer_id: id }))} />
              </Field>
            )}
            <button className="btn-primary w-full" disabled={busy} onClick={saveJar}>
              {!busy && <Save size={18} />}
              {busy ? t('entry.saving') : t('entry.save')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
