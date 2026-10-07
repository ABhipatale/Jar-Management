import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, ImagePlus, KeyRound, LogIn, Mail, Pause, Pencil, Phone, Play, Trash2, Users } from 'lucide-react';
import api, { errorMessage } from '../../api/client';
import defaultLogo from '../../assets/logo.png';
import { ErrorBox, Field, Loader, Modal, PageHeader, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { t } from '../../i18n';
import { fmtDate, today } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { StatusBadge } from './common';

function addMonths(iso, months) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { impersonate } = useAuth();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload, setData } = useApi(`/admin/companies/${id}`);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const fileRef = useRef(null);
  const c = data?.data;

  const run = async (fn) => {
    setBusy(true);
    try {
      const { data: res } = await fn();
      if (res?.data) setData({ data: res.data });
      if (res?.message) toast(res.message);
      return res;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !c) return <Loader />;

  const name = c.name_mr || c.name;

  const toggle = async () => {
    if (c.status === 'active') {
      const ok = await confirm({ message: t('adm.suspendConfirm', { name }), confirmText: t('adm.suspend'), danger: true });
      if (ok) run(() => api.post(`/admin/companies/${id}/suspend`));
    } else {
      run(() => api.post(`/admin/companies/${id}/activate`));
    }
  };

  // Extends from the current end date (or today if already over / never set).
  const extend = (months) => {
    const from = c.expires_at && c.expires_at > today() ? c.expires_at : today();
    run(() => api.put(`/admin/companies/${id}`, { expires_at: addMonths(from, months) }));
  };

  const uploadLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const body = new FormData();
    body.append('logo', file);
    run(() => api.post(`/admin/companies/${id}/logo`, body));
  };

  const remove = async () => {
    const ok = await confirm({ message: t('adm.deleteConfirm', { name }), confirmText: t('adm.delete'), danger: true });
    if (!ok) return;
    if (await run(() => api.delete(`/admin/companies/${id}`))) navigate('/admin', { replace: true });
  };

  const loginAs = async () => {
    setBusy(true);
    try {
      await impersonate(c.id);
      navigate('/', { replace: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={name}
        subtitle={c.name_mr ? c.name : `/${c.slug}`}
        back="/admin"
        right={
          <Link to={`/admin/companies/${id}/edit`} className="btn-light">
            <Pencil size={16} /> <span className="hidden sm:inline">{t('adm.editCompany')}</span>
          </Link>
        }
      />

      <div className="card flex flex-wrap items-center gap-4">
        <img
          src={c.branding?.logo_url || defaultLogo}
          alt=""
          className="h-16 w-16 rounded-xl bg-white object-contain ring-1 ring-line"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge company={c} />
            {c.plan && <span className="text-sm text-muted">{t('adm.plan')}: {c.plan}</span>}
          </div>
          <div className="text-sm text-muted">
            {t('adm.expires')}: <span className="font-medium text-ink">{c.expires_at ? fmtDate(c.expires_at) : t('adm.noExpiry')}</span>
            {' · '}
            {t('adm.created')}: {fmtDate(c.created_at)}
          </div>
        </div>
        <button className="btn-primary" onClick={loginAs} disabled={busy || c.status !== 'active' || c.expired}>
          <LogIn size={18} /> {t('adm.loginAs')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('adm.customers')} value={c.customers} icon={Users} tone="blue" />
        <StatCard label={t('adm.entries')} value={c.jar_entries} icon={CalendarPlus} tone="green" />
        <StatCard label={t('adm.users')} value={c.users} icon={KeyRound} tone="purple" />
        <StatCard label={t('adm.lastActivity')} value={c.last_activity_at ? fmtDate(c.last_activity_at.slice(0, 10)) : t('adm.never')} icon={CalendarPlus} tone="slate" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold text-ink">{t('adm.owner')}</h2>
          {c.owner && (
            <div className="space-y-1.5 text-sm">
              <div className="font-medium text-ink">{c.owner.name}</div>
              <a href={`mailto:${c.owner.email}`} className="flex items-center gap-2 text-muted hover:text-ink">
                <Mail size={15} /> {c.owner.email}
              </a>
              {c.owner.mobile && (
                <a href={`tel:${c.owner.mobile}`} className="flex items-center gap-2 text-muted hover:text-ink">
                  <Phone size={15} /> {c.owner.mobile}
                </a>
              )}
            </div>
          )}
          <button className="btn-light" onClick={() => setPwOpen(true)} disabled={busy}>
            <KeyRound size={16} /> {t('adm.resetPassword')}
          </button>
          <p className="text-xs text-muted">{t('adm.loginAsHint')}</p>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-ink">{t('adm.section.plan')}</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn-light" onClick={() => extend(1)} disabled={busy}>
              <CalendarPlus size={16} /> {t('adm.extendMonth')}
            </button>
            <button className="btn-light" onClick={() => extend(12)} disabled={busy}>
              <CalendarPlus size={16} /> {t('adm.extendYear')}
            </button>
          </div>
          <button className={c.status === 'active' ? 'btn-light text-red-600' : 'btn-primary'} onClick={toggle} disabled={busy}>
            {c.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
            {c.status === 'active' ? t('adm.suspend') : t('adm.activate')}
          </button>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-ink">{t('adm.logo')}</h2>
          <p className="text-sm text-muted">{t('adm.logoHint')}</p>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={uploadLogo} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-light" onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus size={16} /> {c.branding?.logo_url ? t('adm.changeLogo') : t('adm.uploadLogo')}
            </button>
            {c.branding?.logo_url && (
              <button className="btn-light text-red-600" onClick={() => run(() => api.delete(`/admin/companies/${id}/logo`))} disabled={busy}>
                <Trash2 size={16} /> {t('adm.removeLogo')}
              </button>
            )}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold text-red-600">{t('adm.delete')}</h2>
          <p className="text-sm text-muted">{t('adm.deleteConfirm', { name })}</p>
          <button className="btn-light text-red-600" onClick={remove} disabled={busy}>
            <Trash2 size={16} /> {t('adm.delete')}
          </button>
        </section>
      </div>

      {c.payments?.length > 0 && (
        <section className="card !p-0">
          <h2 className="border-b border-line px-4 py-3 font-semibold text-ink">{t('bill.history')}</h2>
          <ul className="divide-y divide-line">
            {c.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{p.plan}</div>
                  <div className="truncate text-xs text-muted">
                    {fmtDate(p.date)} · {t('bill.validTill', { date: fmtDate(p.period_end) })} · {p.razorpay_payment_id}
                  </div>
                </div>
                <div className="font-semibold tabular-nums text-ink">₹{p.amount}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pwOpen && <ResetPassword id={id} onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ResetPassword({ id, onClose }) {
  const { toast } = useUi();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/companies/${id}/owner-password`, { password });
      toast(data.message);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={t('adm.resetPassword')} description={t('adm.resetHint')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('adm.newPassword')}>
          <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus autoComplete="new-password" />
        </Field>
        {error && <ErrorBox message={error} />}
        <button className="btn-primary w-full" disabled={busy}>
          <KeyRound size={16} /> {t('adm.save')}
        </button>
      </form>
    </Modal>
  );
}
