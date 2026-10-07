import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import { AlertTriangle, MapPin, Phone, Save, User, UserPlus } from 'lucide-react';
import { Field, Loader, PageHeader, Segmented } from '../components/ui';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';

/** Label with a red required marker (existing labels end with " *"). */
const req = (key) => (
  <>
    {t(key).replace(/\s*\*\s*$/, '')} <span className="text-red-600" aria-hidden="true">*</span>
  </>
);

/** Input with a leading Lucide icon. */
function WithIcon({ icon: I, children }) {
  return (
    <span className="relative block">
      <I size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
      {children}
    </span>
  );
}

export default function CustomerForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useUi();
  const [form, setForm] = useState({ name: '', mobile: '', address: '', status: 'active' });
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/customers/${id}`)
      .then(({ data }) => setForm({ name: data.data.name, mobile: data.data.mobile, address: data.data.address || '', status: data.data.status }))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t('cust.enterName'));
    const digits = form.mobile.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError(t('cust.enterMobile'));
    setBusy(true);
    setError('');
    try {
      const { data } = editing ? await api.put(`/customers/${id}`, form) : await api.post('/customers', form);
      toast(data.message || t('cust.saved'));
      navigate(`/customers/${data.data.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={editing ? t('cust.editTitle') : t('cust.add')} subtitle={editing ? form.name : t('cust.formSub')} back />

      <section className="card space-y-4 sm:!p-6">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-[15px] font-semibold text-brand-700">
            {form.name.trim() ? form.name.trim().charAt(0).toUpperCase() : <UserPlus size={18} />}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">{t('cust.detailsTitle')}</h2>
            <p className="text-xs text-muted">{t('cust.requiredNote')}</p>
          </div>
        </div>

        <Field label={req('cust.name')} hint={t('cust.nameHint')}>
          <WithIcon icon={User}>
            <input className="input pl-10" value={form.name} onChange={set('name')} autoFocus={!editing} maxLength={120} aria-required="true" />
          </WithIcon>
        </Field>
        <Field label={req('cust.mobile')} hint={t('cust.mobileHint')}>
          <WithIcon icon={Phone}>
            <input className="input pl-10 tabular-nums" type="tel" inputMode="numeric" value={form.mobile} onChange={set('mobile')} maxLength={14} aria-required="true" />
          </WithIcon>
        </Field>
        <Field label={t('cust.address')} hint={t('cust.addressHint')}>
          <WithIcon icon={MapPin}>
            <textarea className="input pl-10" rows={2} value={form.address} onChange={set('address')} maxLength={500} />
          </WithIcon>
        </Field>
        {editing && (
          <Field group label={t('cust.status')} hint={t('cust.statusHint')}>
            <Segmented
              size="sm"
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: 'active', label: t('cust.active'), activeClass: 'bg-emerald-600 text-white ring-emerald-600' },
                { value: 'inactive', label: t('cust.inactive'), activeClass: 'bg-slate-600 text-white ring-slate-600' },
              ]}
            />
          </Field>
        )}
      </section>

      {error && (
        <div className="flex animate-fade-in items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200" role="alert">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-light sm:w-auto" onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </button>
        <button className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-6 sm:py-2.5" disabled={busy}>
          <Save size={18} /> {busy ? t('common.saving') : editing ? t('cust.saveChanges') : t('cust.add')}
        </button>
      </div>
    </form>
  );
}
