import { useState } from 'react';
import { AlertTriangle, CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import { Badge, Empty, ErrorBox, Field, Loader, Modal, PageHeader, Segmented } from '../../components/ui';
import { useUi } from '../../context/UiContext';
import { t } from '../../i18n';
import { money } from '../../lib/format';
import { useApi } from '../../lib/useApi';

const EMPTY = { name: '', name_mr: '', price: '', interval: 'month', description: '', is_active: true, sort_order: 0 };

/** Super admin: the plans companies can buy (add, change, hide, delete). */
export default function Plans() {
  const { data, loading, error, reload } = useApi('/admin/plans');
  const { toast, confirm } = useUi();
  const [editing, setEditing] = useState(null); // plan object, or EMPTY for a new one

  const remove = async (p) => {
    if (!(await confirm({ message: t('plans.deleteConfirm', { name: p.name }), confirmText: t('plans.delete'), danger: true }))) return;
    try {
      const { data: res } = await api.delete(`/admin/plans/${p.id}`);
      toast(res.message);
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading && !data) return <Loader />;
  const plans = data.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('plans.title')}
        subtitle={t('plans.sub')}
        right={
          <button className="btn-primary" onClick={() => setEditing(EMPTY)}>
            <Plus size={18} /> <span className="hidden sm:inline">{t('plans.add')}</span>
          </button>
        }
      />

      {!data.payments_enabled && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{t('plans.noKeys')}</span>
        </div>
      )}

      {plans.length === 0 ? (
        <Empty icon={CreditCard}>{t('plans.empty')}</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className={`card flex flex-col gap-2 ${p.is_active ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{p.name}</div>
                  {p.name_mr && <div className="truncate text-sm text-muted">{p.name_mr}</div>}
                </div>
                {p.is_active ? <Badge kind="active">{t('plans.active')}</Badge> : <Badge kind="inactive">{t('plans.hidden')}</Badge>}
              </div>
              <div className="text-2xl font-bold tracking-tight text-ink">
                {money(p.price)} <span className="text-sm font-medium text-muted">/ {p.interval === 'year' ? t('bill.year') : t('bill.month')}</span>
              </div>
              {p.description && <p className="text-sm text-muted">{p.description}</p>}
              <div className="text-xs text-muted">{t('plans.companies', { n: p.companies })}</div>
              <div className="mt-auto flex gap-2 pt-2">
                <button className="btn-light btn-sm flex-1" onClick={() => setEditing(p)}>
                  <Pencil size={14} /> {t('plans.edit')}
                </button>
                <button className="btn-light btn-sm text-red-600" onClick={() => remove(p)} aria-label={t('plans.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">{t('plans.priceNote')}</p>

      {editing && (
        <PlanForm
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            toast(msg);
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PlanForm({ plan, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, ...plan, name_mr: plan.name_mr || '', description: plan.description || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: form.name, name_mr: form.name_mr || null, price: Number(form.price), interval: form.interval,
      description: form.description || null, is_active: Boolean(form.is_active), sort_order: Number(form.sort_order) || 0,
    };
    try {
      const { data } = plan.id ? await api.put(`/admin/plans/${plan.id}`, body) : await api.post('/admin/plans', body);
      onSaved(data.message);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={plan.id ? t('plans.edit') : t('plans.add')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('plans.name')}>
            <input className="input" value={form.name} onChange={set('name')} required maxLength={60} />
          </Field>
          <Field label={t('plans.nameMr')}>
            <input className="input" value={form.name_mr} onChange={set('name_mr')} maxLength={60} />
          </Field>
          <Field label={t('plans.price')}>
            <input className="input" type="number" min="1" step="1" inputMode="numeric" value={form.price} onChange={set('price')} required />
          </Field>
          <Field label={t('plans.order')}>
            <input className="input" type="number" min="0" value={form.sort_order} onChange={set('sort_order')} />
          </Field>
        </div>
        <Field label={t('plans.interval')} group>
          <Segmented
            size="sm"
            value={form.interval}
            onChange={(v) => setForm((f) => ({ ...f, interval: v }))}
            options={[{ value: 'month', label: t('plans.monthly') }, { value: 'year', label: t('plans.yearly') }]}
          />
        </Field>
        <Field label={t('plans.description')}>
          <textarea className="input min-h-20" value={form.description} onChange={set('description')} maxLength={500} />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
          <input type="checkbox" className="h-5 w-5 rounded accent-brand-600" checked={Boolean(form.is_active)} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          {t('plans.showToCompanies')}
        </label>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>
          {t('adm.save')}
        </button>
      </form>
    </Modal>
  );
}
