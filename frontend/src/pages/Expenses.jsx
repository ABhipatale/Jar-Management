import { useState } from 'react';
import { AlertTriangle, Banknote, Landmark, Plus, Receipt, Smartphone, Trash2, Wallet } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import RangeFilter, { initialRange } from '../components/RangeFilter';
import { Badge, Empty, ErrorBox, Field, Loader, PageHeader, Segmented } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate, money, num, today, uuid } from '../lib/format';
import { submit } from '../lib/outbox';
import { useApi } from '../lib/useApi';

export default function Expenses() {
  const { settings } = useSettings();
  const { toast, confirm } = useUi();
  const [range, setRange] = useState(initialRange('month'));
  const { data, loading, error, reload } = useApi('/expenses', { from: range.from, to: range.to });
  const types = (settings.expense_types || 'इतर').split(',').map((s) => s.trim()).filter(Boolean);

  const blank = () => ({ expense_date: today(), expense_type: types[0] || '', amount: '', payment_mode: 'cash', notes: '', client_uuid: uuid() });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!form.expense_type.trim()) return setFormError(t('exp.enterType'));
    if (!(num(form.amount) > 0)) return setFormError(t('exp.enterAmount'));
    setBusy(true);
    setFormError('');
    try {
      const res = await submit('/expenses', { ...form, amount: num(form.amount) }, t('exp.outbox', { amount: money(form.amount), type: form.expense_type }));
      toast(res.queued ? t('exp.queuedToast') : t('exp.savedOk'), res.queued ? 'info' : 'success');
      setForm(blank());
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (x) => {
    if (!(await confirm({ message: t('exp.confirmDelete', { type: x.expense_type, amount: money(x.amount) }) }))) return;
    try {
      await api.delete(`/expenses/${x.id}`);
      toast(t('exp.deleted'));
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('exp.title')} back />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={save} className="card space-y-4 lg:sticky lg:top-20">
          <h2 className="section-title flex items-center gap-2">
            <Plus size={15} /> {t('exp.addTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entry.date')}>
              <input type="date" className="input" value={form.expense_date} max={today()} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field label={t('exp.amount')}>
              <input
                className="input font-semibold tabular-nums"
                inputMode="decimal"
                value={form.amount}
                placeholder="0"
                onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })}
              />
            </Field>
          </div>
          <Field label={t('exp.type')}>
            <input className="input" list="expense-types" value={form.expense_type} onChange={(e) => setForm({ ...form, expense_type: e.target.value })} />
            <datalist id="expense-types">
              {types.map((ty) => (
                <option key={ty} value={ty} />
              ))}
            </datalist>
          </Field>
          <Segmented
            size="sm"
            value={form.payment_mode}
            onChange={(v) => setForm({ ...form, payment_mode: v })}
            options={[
              { value: 'cash', label: t('entry.modeCash'), icon: Banknote },
              { value: 'upi', label: 'UPI', icon: Smartphone },
              { value: 'bank', label: t('entry.modeBank'), icon: Landmark },
            ]}
          />
          <input className="input" placeholder={t('exp.notesPh')} aria-label={t('exp.notesPh')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
          {formError && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {formError}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {!busy && <Plus size={18} />}
            {busy ? t('entry.saving') : t('exp.save')}
          </button>
        </form>

        <div className="min-w-0 space-y-4">
          <RangeFilter value={range} onChange={setRange} />
          {error && <ErrorBox message={error} onRetry={reload} />}
          {loading && !data && <Loader />}
          {data && (
            <div className="card flex items-center gap-3 !p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                <Wallet size={20} />
              </span>
              <span className="flex-1 text-sm font-medium text-muted">{t('exp.total')}</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-ink">{money(data.total)}</span>
            </div>
          )}
          {data && data.data.length === 0 && <Empty icon={Receipt}>{t('exp.empty')}</Empty>}
          {data && data.data.length > 0 && (
            <div className="card divide-y divide-line overflow-hidden !p-0">
              {data.data.map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                    <Receipt size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink">{x.expense_type}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{fmtDate(x.expense_date)}</span>
                      <Badge kind={x.payment_mode}>{{ cash: t('entry.modeCash'), upi: 'UPI', bank: t('entry.modeBank') }[x.payment_mode] || x.payment_mode.toUpperCase()}</Badge>
                      {x.notes && <span className="truncate">{x.notes}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-ink">{money(x.amount)}</span>
                  <button className="icon-btn shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => remove(x)} aria-label={t('entry.delete')} title={t('entry.delete')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
