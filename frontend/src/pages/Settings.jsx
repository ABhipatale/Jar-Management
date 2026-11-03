import { useEffect, useRef, useState } from 'react';
import { BILL_DESIGNS, sampleBill } from '../lib/bill';
import { ChevronRight, CreditCard, Droplets, ExternalLink, FileText, ImagePlus, KeyRound, Landmark, Languages, LogOut, MessageCircle, MessageSquareText, Palette, QrCode, Save, Sparkles, Stamp, Store, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import { ThemeSwitch } from '../components/Layout';
import { Field, Loader, MiniSpin, Modal, PageHeader, Segmented, UploadOverlay } from '../components/ui';
import BillPreview, { useBillLogo } from '../components/bill/BillPreview';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { LANGS, lang, setLang, t, tx } from '../i18n';
import { Link } from 'react-router-dom';
import { logoSrc } from '../lib/branding';
import { fmtDate } from '../lib/format';
import { features } from '../lib/products';
import { DEFAULT_TEMPLATES, getWaApp, setWaApp } from '../lib/whatsapp';

const TEMPLATES = [
  ['wa_delivery', t('set.tplDelivery'), '{customer_name} {date} {jar_quantity} {rate} {amount} {paid} {udhari} {current_jars}'],
  ['wa_return', t('set.tplReturn'), '{customer_name} {date} {returned_jars} {current_jars}'],
  ['wa_payment', t('set.tplPayment'), '{customer_name} {date} {paid_amount} {previous_pending} {remaining_pending}'],
  ['wa_reminder', t('set.tplReminder'), '{customer_name} {pending_amount}'],
  ['wa_summary', t('set.tplSummary'), '{date} {given} {returned} {cash} {udhari} {payments} {pending}'],
];

/** Card with an icon + title header. */
/** Full preview of a bill design with sample data (Settings). */
function BillDesignPreview({ design, settings, chosen, onUse, onClose }) {
  const billLang = lang === 'en' ? 'en' : 'mr';
  const bill = sampleBill(settings, billLang);
  const logo = useBillLogo(bill.shop.logo);
  return (
    <Modal title={t(`bill.d.${design}`)} description={t('bill.sampleNote')} onClose={onClose} size="lg">
      <div className="space-y-4">
        <BillPreview design={design} bill={{ ...bill, shop: { ...bill.shop, logo } }} lang={billLang} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-light" onClick={onClose}>{t('common.close')}</button>
          <button type="button" className="btn-primary" onClick={onUse} disabled={chosen}>
            {chosen ? t('bill.inUse') : t('bill.useThis')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Tiny drawing of each bill design for the Settings picker (fixed colours, like the bill). */
function BillThumb({ design }) {
  const lines = (n, c = '#cbd5e1') => Array.from({ length: n }, (_, i) => <div key={i} style={{ height: 3, background: c, borderRadius: 2, margin: '3px 6px', width: `${80 - i * 12}%` }} />);
  if (design === 'simple') {
    return (
      <div className="h-24 w-16 shrink-0 self-center rounded bg-white py-2 shadow-soft ring-1 ring-slate-200">
        <div style={{ height: 4, background: '#111827', margin: '0 14px 4px', borderRadius: 2 }} />
        <div style={{ borderTop: '1px dashed #9ca3af', margin: '4px 4px' }} />
        {lines(4, '#9ca3af')}
        <div style={{ borderTop: '1px dashed #9ca3af', margin: '4px 4px' }} />
        <div style={{ height: 5, background: '#111827', margin: '3px 6px', borderRadius: 2 }} />
      </div>
    );
  }
  const modern = design === 'modern';
  return (
    <div className="h-24 w-20 shrink-0 overflow-hidden rounded bg-white shadow-soft ring-1 ring-slate-200 sm:h-28 sm:w-full">
      <div style={{ height: 22, background: modern ? 'linear-gradient(135deg,#1e3a8a,#0ea5e9)' : '#fff', borderBottom: modern ? 0 : '3px solid #f5b301', position: 'relative' }}>
        {!modern && <div style={{ height: 6, width: '50%', background: '#c1121f', margin: '8px auto 0', borderRadius: 2 }} />}
      </div>
      {lines(2)}
      <div style={{ margin: '4px 6px', height: 26, border: `1px solid ${modern ? '#dbeafe' : '#f5b301'}`, borderRadius: modern ? 4 : 0, background: modern ? '#f0f7ff' : '#fff' }} />
      <div style={{ margin: '0 6px 0 auto', width: '45%', height: 8, background: modern ? '#1d4ed8' : '#fff8e1', border: modern ? 0 : '1px solid #f5b301', borderRadius: modern ? 3 : 0 }} />
    </div>
  );
}

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
  const [qrBusy, setQrBusy] = useState(false);
  const [billPreview, setBillPreview] = useState(null); // design shown in the preview popup
  const qrInput = useRef(null);
  const [stampBusy, setStampBusy] = useState(false);
  const [stampPic, setStampPic] = useState(null); // data URL of the saved stamp, for the small preview here
  const stampInput = useRef(null);

  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      setSettings(data);
      setForm(data);
      if (data.has_stamp) api.get('/settings/stamp').then((r) => setStampPic(r.data.stamp)).catch(() => {});
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
  const feat = features(form);

  // Choosing a bill design saves just that, straight away (other unsaved edits stay in the form).
  const chooseBillDesign = async (d) => {
    try {
      const { data } = await api.put('/settings', { bill_design: d });
      setSettings(data);
      setForm((f) => ({ ...f, bill_design: d }));
      setBillPreview(null);
      toast(t('bill.designSaved'));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, jar_tracking: form.jar_tracking === '1' || form.jar_tracking === true, total_jars: parseInt(form.total_jars, 10) || 0 };
      // Bottle / deposit fields only when the super admin switched them on (else not sent).
      if (feat.bottles) payload.total_bottles = parseInt(form.total_bottles, 10) || 0;
      else delete payload.total_bottles;
      if (!feat.bottles) delete payload.bottle_rate;
      if (!feat.deposit) {
        delete payload.jar_deposit;
        delete payload.bottle_deposit;
      }
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

  // Payment QR is saved right away too; the server stores a clean copy of the picture.
  const payQr = async (file) => {
    setQrBusy(true);
    try {
      let res;
      if (file) {
        const body = new FormData();
        body.append('qr', file);
        res = await api.post('/settings/pay-qr', body);
      } else {
        res = await api.delete('/settings/pay-qr');
      }
      setSettings(res.data);
      setForm((f) => ({ ...f, pay_qr_url: res.data.pay_qr_url, pay_url: res.data.pay_url }));
      toast(res.data.message);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setQrBusy(false);
    }
  };

  // Signature & stamp for the bills: saved right away, like the logo and QR.
  const stamp = async (file) => {
    setStampBusy(true);
    try {
      let res;
      if (file) {
        const body = new FormData();
        body.append('stamp', file);
        res = await api.post('/settings/stamp', body);
        setStampPic((await api.get('/settings/stamp')).data.stamp);
      } else {
        res = await api.delete('/settings/stamp');
        setStampPic(null);
      }
      setSettings(res.data);
      setForm((f) => ({ ...f, has_stamp: res.data.has_stamp }));
      toast(res.data.message);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setStampBusy(false);
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
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
              <img src={logoSrc(form.branding || {})} alt="" className="h-full w-full object-contain" />
              <UploadOverlay busy={logoBusy} />
            </div>
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
                  {logoBusy ? <MiniSpin /> : <ImagePlus size={16} />} {logoBusy ? t('common.uploading') : form.branding?.logo_url ? t('adm.changeLogo') : t('adm.uploadLogo')}
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

        <Section icon={QrCode} tone="bg-violet-50 text-violet-700" title={t('set.payQr')} hint={t('set.payQrHint')}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative grid h-32 w-32 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-line">
              <UploadOverlay busy={qrBusy} />
              {form.pay_qr_url ? (
                <img src={form.pay_qr_url} alt={t('set.payQr')} className="h-full w-full object-contain" />
              ) : (
                <QrCode size={40} className="text-slate-300" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={qrInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) payQr(f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-light" onClick={() => qrInput.current?.click()} disabled={qrBusy}>
                  {qrBusy ? <MiniSpin /> : <ImagePlus size={16} />} {qrBusy ? t('common.uploading') : form.pay_qr_url ? t('set.payQrChange') : t('set.payQrUpload')}
                </button>
                {form.pay_qr_url && (
                  <button type="button" className="btn-light text-red-600" onClick={() => payQr(null)} disabled={qrBusy}>
                    <Trash2 size={16} /> {t('set.payQrRemove')}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted">{t('set.payQrPhotoHint')}</p>
              {form.pay_url && (
                <a href={`${form.pay_url}?a=100`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                  <ExternalLink size={15} /> {t('set.payQrPreview')}
                </a>
              )}
            </div>
          </div>
          <Field label={t('set.upiId')} hint={t('set.upiIdHint')}>
            <input className="input" value={form.upi_id || ''} onChange={set('upi_id')} maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="9876543210@ybl" />
          </Field>
        </Section>

        <Section icon={Stamp} tone="bg-violet-50 text-violet-700" title={t('set.stamp')} hint={t('set.stampHint')}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative grid h-28 w-40 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white ring-1 ring-line">
              <UploadOverlay busy={stampBusy} />
              {form.has_stamp && stampPic ? (
                <img src={stampPic} alt={t('set.stamp')} className="h-full w-full object-contain" />
              ) : (
                <Stamp size={40} className="text-slate-300" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={stampInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) stamp(f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-light" onClick={() => stampInput.current?.click()} disabled={stampBusy}>
                  {stampBusy ? <MiniSpin /> : <ImagePlus size={16} />} {stampBusy ? t('common.uploading') : form.has_stamp ? t('set.stampChange') : t('set.stampUpload')}
                </button>
                {form.has_stamp && (
                  <button type="button" className="btn-light text-red-600" onClick={() => stamp(null)} disabled={stampBusy}>
                    <Trash2 size={16} /> {t('set.stampRemove')}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted">{t('set.stampPhotoHint')}</p>
            </div>
          </div>
        </Section>

        <Section icon={FileText} tone="bg-violet-50 text-violet-700" title={t('bill.settingsTitle')} hint={t('bill.settingsHint')}>
          <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup">
            {BILL_DESIGNS.map((d) => {
              const on = (form.bill_design || 'classic') === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setBillPreview(d)}
                  className={`flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition sm:flex-col sm:items-stretch ${on ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-surface ring-line hover:bg-surface-2'}`}
                >
                  <BillThumb design={d} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{t(`bill.d.${d}`)}</span>
                    <span className="block text-xs text-muted">{t(`bill.dd.${d}`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="-mt-1 text-xs text-muted">👁 {t('bill.tapPreview')}</p>
          {billPreview && (
            <BillDesignPreview
              design={billPreview}
              settings={form}
              chosen={(form.bill_design || 'classic') === billPreview}
              onUse={() => chooseBillDesign(billPreview)}
              onClose={() => setBillPreview(null)}
            />
          )}
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

        {(feat.bottles || feat.deposit) && (
          <Section icon={Landmark} tone="bg-sky-50 text-sky-700" title={t('prod.settingsSec')} hint={t('prod.settingsHint')}>
            {feat.bottles && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('prod.totalBottles')} hint={t('set.totalJarsHint')}>
                  <input className="input" inputMode="numeric" value={form.total_bottles ?? 0} onChange={(e) => setForm({ ...form, total_bottles: e.target.value.replace(/\D/g, '') })} />
                </Field>
                <Field label={t('prod.bottleDefaultRate')}>
                  <input className="input" inputMode="decimal" value={form.bottle_rate ?? ''} onChange={set('bottle_rate')} />
                </Field>
              </div>
            )}
            {feat.deposit && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('prod.jarDeposit')}>
                  <input className="input" inputMode="decimal" value={form.jar_deposit ?? ''} onChange={set('jar_deposit')} />
                </Field>
                {feat.bottles && (
                  <Field label={t('prod.bottleDeposit')}>
                    <input className="input" inputMode="decimal" value={form.bottle_deposit ?? ''} onChange={set('bottle_deposit')} />
                  </Field>
                )}
              </div>
            )}
            {feat.deposit && <p className="text-xs text-muted">{t('prod.depositNote')}</p>}
          </Section>
        )}

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
