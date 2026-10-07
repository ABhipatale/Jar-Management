import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import { ErrorBox, Field, Loader, PageHeader, Segmented } from '../../components/ui';
import { useUi } from '../../context/UiContext';
import { t } from '../../i18n';
import { useApi } from '../../lib/useApi';

const EMPTY = {
  name: '', name_mr: '', short_name: '', slug: '', locale: 'mr', plan_id: '', expires_at: '',
  owner_name: '', owner_email: '', owner_mobile: '', owner_password: '',
};

/** Register a company (with its owner login) or edit an existing one. */
export default function CompanyForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useUi();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plans = useApi('/admin/plans').data?.data || [];

  useEffect(() => {
    if (!editing) return;
    api.get(`/admin/companies/${id}`).then(
      ({ data }) => {
        const c = data.data;
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])) });
        setLoading(false);
      },
      (err) => {
        setError(errorMessage(err));
        setLoading(false);
      }
    );
  }, [editing, id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const company = {
      name: form.name, name_mr: form.name_mr || null, short_name: form.short_name || null, slug: form.slug || null,
      locale: form.locale, plan_id: form.plan_id ? Number(form.plan_id) : null, expires_at: form.expires_at || null,
    };
    try {
      const { data } = editing
        ? await api.put(`/admin/companies/${id}`, company)
        : await api.post('/admin/companies', {
            ...company,
            owner_name: form.owner_name, owner_email: form.owner_email,
            owner_mobile: form.owner_mobile || null, owner_password: form.owner_password,
          });
      toast(data.message);
      navigate(`/admin/companies/${data.data.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={editing ? t('adm.editCompany') : t('adm.newCompany')} back={editing ? `/admin/companies/${id}` : '/admin'} />

      <section className="card space-y-4">
        <h2 className="font-semibold text-ink">{t('adm.section.company')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('adm.f.name')}>
            <input className="input" value={form.name} onChange={set('name')} required maxLength={120} />
          </Field>
          <Field label={t('adm.f.nameMr')}>
            <input className="input" value={form.name_mr} onChange={set('name_mr')} maxLength={120} />
          </Field>
          <Field label={t('adm.f.shortName')} hint={t('adm.f.shortNameHint')}>
            <input className="input" value={form.short_name} onChange={set('short_name')} maxLength={40} />
          </Field>
          <Field label={t('adm.f.slug')} hint={t('adm.f.slugHint')}>
            <input className="input" value={form.slug} onChange={set('slug')} maxLength={60} pattern="[A-Za-z0-9_-]*" autoCapitalize="none" />
          </Field>
        </div>
        <Field label={t('adm.f.locale')} group>
          <Segmented
            size="sm"
            value={form.locale}
            onChange={(v) => setForm((f) => ({ ...f, locale: v }))}
            options={[{ value: 'mr', label: 'मराठी' }, { value: 'en', label: 'English' }]}
          />
        </Field>
      </section>

      {!editing && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-ink">{t('adm.section.owner')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adm.f.ownerName')}>
              <input className="input" value={form.owner_name} onChange={set('owner_name')} required maxLength={120} />
            </Field>
            <Field label={t('adm.f.ownerMobile')}>
              <input className="input" value={form.owner_mobile} onChange={set('owner_mobile')} inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" />
            </Field>
            <Field label={t('adm.f.ownerEmail')}>
              <input className="input" type="email" value={form.owner_email} onChange={set('owner_email')} required autoCapitalize="none" />
            </Field>
            <Field label={t('adm.f.ownerPassword')}>
              <input className="input" type="text" value={form.owner_password} onChange={set('owner_password')} required minLength={6} autoComplete="new-password" />
            </Field>
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold text-ink">{t('adm.section.plan')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('adm.f.plan')}>
            <select className="input" value={form.plan_id} onChange={set('plan_id')}>
              <option value="">—</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ₹{p.price}/{p.interval === 'year' ? t('bill.year') : t('bill.month')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('adm.f.expires')} hint={t('adm.f.expiresHint')}>
            <input className="input" type="date" value={form.expires_at} onChange={set('expires_at')} />
          </Field>
        </div>
      </section>

      {error && <ErrorBox message={error} />}

      <button className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-8" disabled={busy}>
        <Save size={18} /> {editing ? t('adm.save') : t('adm.create')}
      </button>
    </form>
  );
}
