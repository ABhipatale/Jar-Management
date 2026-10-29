import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client';
import { AlertTriangle, ArrowRight, Droplets, MapPin, Phone, Save, User, UserPlus, Users } from 'lucide-react';
import ContactButton from '../components/ContactButton';
import { Field, Loader, PageHeader, Segmented } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { normalizeMobile } from '../lib/contacts';
import { num } from '../lib/format';
import { BOTTLE, JAR, defaultRate, features, productName } from '../lib/products';

/** Another EasyJar customer (this company only) with exactly this mobile, or null. */
async function findByMobile(mobile, exceptId) {
  if (!mobile) return null;
  const { data } = await api.get('/customers', { params: { search: mobile } });
  return data.data.find((c) => normalizeMobile(c.mobile) === mobile && c.id !== Number(exceptId)) || null;
}

/** Where to go after saving: ?return=/entry?type=given → /entry?type=given&customer=<id>. */
function returnTo(ret, id) {
  if (!ret || !ret.startsWith('/') || ret.startsWith('//')) return null;
  const u = new URL(ret, window.location.origin);
  u.searchParams.set('customer', id);
  return u.pathname + u.search;
}

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
  const { toast, confirm } = useUi();
  const [params] = useSearchParams();
  // "Add as new customer" from a contact picked elsewhere pre-fills name + mobile.
  const [form, setForm] = useState(() => ({ name: params.get('name') || '', mobile: params.get('mobile') || '', address: '', status: 'active' }));
  // What the customer takes and their special rates (only when bottles / deposit are switched on).
  const { settings } = useSettings();
  const feat = features(settings);
  const [items, setItems] = useState({ takes_jar: true, takes_bottle: false, jar_rate: '', bottle_rate: '', no_deposit: false });
  const [dup, setDup] = useState(null); // existing customer with the same mobile
  const [mismatch, setMismatch] = useState(false); // picked contact doesn't have the typed number
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/customers/${id}`)
      .then(({ data }) => {
        const c = data.data;
        setForm({ name: c.name, mobile: c.mobile, address: c.address || '', status: c.status });
        setItems({
          takes_jar: c.takes_jar !== false,
          takes_bottle: Boolean(c.takes_bottle),
          jar_rate: c.jar_rate ?? '',
          bottle_rate: c.bottle_rate ?? '',
          no_deposit: Boolean(c.no_deposit),
        });
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (k === 'mobile') { setMismatch(false); setDup(null); }
  };

  // Contact picked: fill name + mobile, unless the number already typed doesn't match it.
  const onContact = async ({ name, mobiles }) => {
    const typed = normalizeMobile(form.mobile);
    if (typed && !mobiles.includes(typed)) {
      setMismatch(true);
      return;
    }
    const mobile = typed || mobiles[0];
    setMismatch(false);
    setForm((f) => ({ ...f, name: name || f.name, mobile }));
    try {
      setDup(await findByMobile(mobile, id));
    } catch {
      setDup(null); // lookup is a convenience; saving still works
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(t('cust.enterName'));
    const digits = normalizeMobile(form.mobile);
    if (!digits) return setError(t('cust.enterMobile'));
    if (feat.bottles && !items.takes_jar && !items.takes_bottle) return setError(t('prod.pickOne'));
    const extra = {
      ...(feat.bottles && { takes_jar: items.takes_jar, takes_bottle: items.takes_bottle, bottle_rate: items.bottle_rate === '' ? null : num(items.bottle_rate) }),
      ...((feat.bottles || feat.deposit) && { jar_rate: items.jar_rate === '' ? null : num(items.jar_rate) }),
      ...(feat.deposit && { no_deposit: items.no_deposit }),
    };
    setBusy(true);
    setError('');
    try {
      // Never create a second customer with the same mobile by accident.
      const other = await findByMobile(digits, id).catch(() => null);
      if (other && !(await confirm({ title: t('contact.dupTitle'), message: t('contact.dupConfirm', { name: other.name, mobile: other.mobile }), confirmText: t('contact.dupSave'), danger: false }))) {
        setDup(other);
        return;
      }
      const body = { ...form, ...extra };
      const { data } = editing ? await api.put(`/customers/${id}`, body) : await api.post('/customers', body);
      toast(data.message || t('cust.saved'));
      navigate(returnTo(params.get('return'), data.data.id) || `/customers/${data.data.id}`, { replace: true });
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
          <span className="flex gap-2">
            <span className="min-w-0 flex-1">
              <WithIcon icon={Phone}>
                <input className="input pl-10 tabular-nums" type="tel" inputMode="numeric" value={form.mobile} onChange={set('mobile')} maxLength={16} aria-required="true" />
              </WithIcon>
            </span>
            <ContactButton onPick={onContact} className="h-auto self-stretch" />
          </span>
        </Field>
        {mismatch && (
          <div className="-mt-2 flex animate-fade-in items-start gap-2.5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200" role="alert">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{t('contact.mismatch', { mobile: form.mobile })}</span>
          </div>
        )}
        {dup && (
          <div className="-mt-2 flex animate-fade-in flex-wrap items-center gap-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200" role="status">
            <Users size={17} className="shrink-0" />
            <span className="min-w-0 flex-1">{t('contact.exists', { name: dup.name })}</span>
            <Link to={`/customers/${dup.id}`} className="btn-light btn-sm">
              {t('contact.openExisting')} <ArrowRight size={14} />
            </Link>
          </div>
        )}
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

      {(feat.bottles || feat.deposit) && (
        <section className="card space-y-4 sm:!p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
              <Droplets size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">{t('prod.custSection')}</h2>
              <p className="text-xs text-muted">{t('prod.custSectionSub')}</p>
            </div>
          </div>

          {(feat.bottles ? [JAR, BOTTLE] : [JAR]).map((p) => {
            const takes = p === JAR ? items.takes_jar : items.takes_bottle;
            const rateKey = `${p}_rate`;
            return (
              <div key={p} className={`grid grid-cols-[minmax(0,1fr)_9rem] items-end gap-3 rounded-lg p-3 ring-1 ring-inset ${takes ? 'ring-line' : 'bg-surface-2 ring-line'}`}>
                {feat.bottles ? (
                  <label className="flex cursor-pointer items-center gap-3 self-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-700"
                      checked={takes}
                      onChange={(e) => setItems({ ...items, [p === JAR ? 'takes_jar' : 'takes_bottle']: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-ink">{productName(p)}</span>
                  </label>
                ) : (
                  <span className="self-center text-sm font-medium text-ink">{productName(p)}</span>
                )}
                <Field label={t('prod.specialRate')}>
                  <input
                    className="input tabular-nums"
                    inputMode="decimal"
                    disabled={!takes}
                    value={items[rateKey]}
                    placeholder={t('prod.ratePh', { r: defaultRate(settings, p) || 0 })}
                    onChange={(e) => setItems({ ...items, [rateKey]: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                </Field>
              </div>
            );
          })}

          {feat.deposit && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3.5 py-3 ring-1 ring-line">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={items.no_deposit} onChange={(e) => setItems({ ...items, no_deposit: e.target.checked })} />
              <span className="text-sm font-medium text-ink">{t('prod.noDeposit')}</span>
            </label>
          )}
        </section>
      )}

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
