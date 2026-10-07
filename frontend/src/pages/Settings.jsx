import { useEffect, useRef, useState } from 'react';
import { ChevronRight, CreditCard, Droplets, ImagePlus, KeyRound, Languages, LogOut, MessageCircle, MessageSquareText, Palette, Save, Sparkles, Store, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { ThemeSwitch } from '../components/Layout';
import { Field, Loader, PageHeader, Segmented } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { LANGS, lang, setLang, t, tx } from '../i18n';
import { Link } from 'react-router-dom';
import { logoSrc } from '../lib/branding';
import { fmtDate } from '../lib/format';
import { DEFAULT_TEMPLATES, getWaApp, setWaApp } from '../lib/whatsapp';

const TEMPLATES = [
  ['wa_delivery', t('set.tplDelivery'), '{customer_name} {date} {jar_quantity} {rate} {amount} {paid} {udhari} {current_jars}'],
  ['wa_return', t('set.tplReturn'), '{customer_name} {date} {returned_jars} {current_jars}'],
  ['wa_payment', t('set.tplPayment'), '{customer_name} {date} {paid_amount} {previous_pending} {remaining_pending}'],
  ['wa_reminder', t('set.tplReminder'), '{customer_name} {pending_amount}'],
  ['wa_summary', t('set.tplSummary'), '{date} {given} {returned} {cash} {udhari} {payments} {pending}'],
];

/** Card with an icon + title header. */
function Section({ icon: I, tone = 'bg-brand-50 text-brand-700', title, hint, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className="card space-y-4" {...rest}>
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
          <I size={18} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Tag>
  );
}

export default function Settings() {
  const { setSettings } = useSettings();
  const { user, logout } = useAuth();
  const { toast } = useUi();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [waApp, setWaAppState] = useState(getWaApp);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInput = useRef(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setSettings(data);
      setForm(data);
    }).catch((e) => toast(errorMessage(e), 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t('set.title')} back />
        <Loader rows={4} label={t('set.loading')} />
      </div>
    );

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, jar_tracking: form.jar_tracking === '1' || form.jar_tracking === true, total_jars: parseInt(form.total_jars, 10) || 0 };
      const { data } = await api.put('/settings', payload);
      setSettings(data);
      setForm(data);
      toast(t('set.saved'));
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Logo is saved right away (not with the form): the server makes the app icons from it.
  const logo = async (file) => {
    setLogoBusy(true);
    try {
      let res;
      if (file) {
        const body = new FormData();
        body.append('logo', file);
        res = await api.post('/settings/logo', body);
      } else {
        res = await api.delete('/settings/logo');
      }
      setSettings(res.data);
      setForm((f) => ({ ...f, branding: res.data.branding }));
      toast(res.data.message);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLogoBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/me/password', pw);
      toast(data.message);
      setPw({ current_password: '', password: '', password_confirmation: '' });
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('set.title')} back />

      <h2 className="section-title">{t('set.secApp')}</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <Section icon={Languages} title={t('set.language')} hint={t('set.languageHint')}>
          <Segmented value={lang} onChange={(v) => v !== lang && setLang(v)} options={Object.entries(LANGS).map(([value, label]) => ({ value, label }))} />
        </Section>

        <Section icon={Palette} tone="bg-violet-50 text-violet-700" title={t('theme.title')} hint={t('set.appearanceHint')}>
          <ThemeSwitch />
        </Section>
      </div>

      <Section icon={MessageCircle} tone="bg-emerald-50 text-emerald-700" title={t('set.waApp')} hint={t('set.waAppHint')}>
        <Segmented
          size="sm"
          value={waApp}
          onChange={(v) => {
            setWaApp(v);
            setWaAppState(v);
            toast(t('set.waAppSaved'));
          }}
          options={[
            { value: 'business', label: t('set.waAppBusiness'), activeClass: 'bg-[#25D366] text-white ring-[#25D366]' },
            { value: 'normal', label: t('set.waAppNormal'), activeClass: 'bg-[#25D366] text-white ring-[#25D366]' },
          ]}
        />
      </Section>

      <form onSubmit={save} className="space-y-5">
        <h2 className="section-title pt-1">{t('set.secShop')}</h2>
        <Link to="/billing" className="card card-hover flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <CreditCard size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink">{t('bill.title')}</div>
            <div className="text-sm text-muted">
              {user?.company?.expires_at ? t('bill.activeTill', { date: fmtDate(user.company.expires_at) }) : t('bill.noPlan')}
            </div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-slate-400" />
        </Link>
        <Section icon={Sparkles} tone="bg-amber-50 text-amber-700" title={t('brand.title')} hint={t('brand.hint')}>
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={logoSrc(form.branding || {})}
              alt=""
              className="h-20 w-20 rounded-2xl bg-white object-contain ring-1 ring-line"
            />
            <div className="space-y-2">
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) logo(f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-light" onClick={() => logoInput.current?.click()} disabled={logoBusy}>
                  <ImagePlus size={16} /> {form.branding?.logo_url ? t('adm.changeLogo') : t('adm.uploadLogo')}
                </button>
                {form.branding?.logo_url && (
                  <button type="button" className="btn-light text-red-600" onClick={() => logo(null)} disabled={logoBusy}>
                    <Trash2 size={16} /> {t('adm.removeLogo')}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted">{t('adm.logoHint')}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('adm.f.shortName')} hint={t('adm.f.shortNameHint')}>
              <input className="input" value={form.short_name || ''} onChange={set('short_name')} maxLength={40} />
            </Field>
          </div>
          <p className="rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted ring-1 ring-line">{t('brand.installNote')}</p>
        </Section>

        <Section icon={Store} title={t('set.shop')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('set.businessName')}>
              <input className="input" value={form.business_name} onChange={set('business_name')} />
            </Field>
            <Field label={t('set.businessNameMr')}>
              <input className="input" value={form.business_name_mr} onChange={set('business_name_mr')} />
            </Field>
            <Field label={t('set.address')}>
              <input className="input" value={form.business_address} onChange={set('business_address')} />
            </Field>
            <Field label={t('set.placeMr')}>
              <input className="input" value={form.business_place_mr} onChange={set('business_place_mr')} />
            </Field>
            <Field label={t('set.businessMobile')}>
              <input className="input" type="tel" value={form.business_mobile || ''} onChange={set('business_mobile')} />
            </Field>
            <Field label={t('set.ownerName')} hint={t('set.contactHint')}>
              <input className="input" value={form.owner_name_mr || ''} onChange={set('owner_name_mr')} maxLength={120} />
            </Field>
          </div>
          <Field label={t('set.contactNumbers')} hint={t('set.contactNumbersHint')}>
            <input className="input" value={form.contact_numbers || ''} onChange={set('contact_numbers')} maxLength={200} />
          </Field>
        </Section>

        <Section icon={Droplets} tone="bg-sky-50 text-sky-700" title={t('set.jars')}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('set.totalJars')} hint={t('set.totalJarsHint')}>
              <input className="input" inputMode="numeric" value={form.total_jars} onChange={(e) => setForm({ ...form, total_jars: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label={t('set.defaultRate')}>
              <input className="input" inputMode="decimal" value={form.default_rate} onChange={set('default_rate')} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 px-3.5 py-3 ring-1 ring-line">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-700"
              checked={form.jar_tracking === '1' || form.jar_tracking === true}
              onChange={(e) => setForm({ ...form, jar_tracking: e.target.checked ? '1' : '0' })}
            />
            <span className="text-sm font-medium text-ink">{t('set.jarTracking')}</span>
          </label>
          <Field label={t('set.expenseTypes')} hint={t('set.expenseTypesHint')}>
            <input className="input" value={form.expense_types} onChange={set('expense_types')} />
          </Field>
        </Section>

        <Section icon={MessageSquareText} tone="bg-emerald-50 text-emerald-700" title={t('set.waMessages')} hint={t('set.waHint')}>
          <div className="space-y-4">
            {TEMPLATES.map(([key, label, vars]) => (
              <Field key={key} label={label} hint={t('set.values', { vars })}>
                <textarea className="input font-mono text-sm" rows={6} value={form[key] || ''} placeholder={DEFAULT_TEMPLATES[key]} onChange={set(key)} />
              </Field>
            ))}
          </div>
        </Section>

        <div className="sticky-above-nav sticky z-20">
          <div className="rounded-xl bg-surface/85 p-2 shadow-pop ring-1 ring-line backdrop-blur">
            <button className="btn-primary w-full py-3.5" disabled={busy}>
              <Save size={18} /> {busy ? t('entry.saving') : t('set.save')}
            </button>
          </div>
        </div>
      </form>

      <h2 className="section-title pt-1">{t('set.secAccount')}</h2>
      <Section as="form" onSubmit={changePassword} icon={KeyRound} tone="bg-amber-50 text-amber-700" title={t('set.changePassword')} hint={t('set.loggedInAs', { email: user?.email || '' })}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" type="password" placeholder={t('set.currentPassword')} autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <input className="input" type="password" placeholder={t('set.newPassword')} autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
          <input className="input" type="password" placeholder={t('set.repeatPassword')} autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} />
        </div>
        <button className="btn-light w-full sm:w-auto">
          <KeyRound size={16} /> {t('set.changePassword')}
        </button>
      </Section>

      <button className="btn-light w-full text-red-600" onClick={logout}>
        <LogOut size={18} /> {tx('set.logout')}
      </button>
    </div>
  );
}
