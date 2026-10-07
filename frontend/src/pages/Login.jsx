import { useState } from 'react';
import { AlertTriangle, Droplets, Eye, EyeOff, KeyRound, Languages, LogIn, Smartphone, Users, Wallet } from 'lucide-react';
import banner from '../assets/banner.jpg';
import logo from '../assets/logo.png';
import { errorMessage } from '../api/client';
import { DevCredit } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LANGS, lang, setLang, t } from '../i18n';

const YEAR = new Date().getFullYear();

const HIGHLIGHTS = [
  { icon: Droplets, key: 'login.feature.jars' },
  { icon: Users, key: 'login.feature.customers' },
  { icon: Wallet, key: 'login.feature.money' },
];

function LangChips({ className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1 ring-1 ring-line ${className}`} role="group" aria-label={t('login.language')}>
      <Languages size={15} className="mx-1 text-muted" aria-hidden="true" />
      {Object.entries(LANGS).map(([code, name]) => (
        <button
          key={code}
          type="button"
          onClick={() => code !== lang && setLang(code)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            code === lang ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-muted hover:text-ink'
          }`}
          aria-pressed={code === lang}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: '', password: '', remember: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.login.trim()) return setError(t('login.enterLogin'));
    if (!form.password) return setError(t('login.enterPassword'));
    setBusy(true);
    setError('');
    try {
      await login(form.login.trim(), form.password, form.remember);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-app lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-10 text-white lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
          <div>
            <div className="text-lg font-semibold leading-tight">{t('common.businessName')}</div>
            <div className="text-sm text-white/70">{t('common.businessPlace')}</div>
          </div>
        </div>

        <div className="space-y-6">
          <img src={banner} alt={t('login.bannerAlt')} className="w-full rounded-xl object-cover shadow-pop ring-1 ring-white/15" />
          <div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">{t('login.brandTitle')}</h2>
            <p className="mt-2 max-w-md text-white/75">{t('login.brandSub')}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.key} className="flex items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium ring-1 ring-white/10">
                <h.icon size={17} className="shrink-0" />
                <span className="leading-tight">{t(h.key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60">© {YEAR} {t('common.businessName')}</p>
      </aside>

      {/* Form side */}
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface lg:max-w-none lg:items-center lg:justify-center lg:bg-app lg:px-8">
        <img src={banner} alt={t('login.bannerAlt')} className="w-full object-cover lg:hidden" />

        <div className="flex w-full flex-1 flex-col lg:max-w-105 lg:flex-none">
          <form
            onSubmit={submit}
            className="flex flex-1 flex-col gap-4 p-5 lg:flex-none lg:rounded-xl lg:bg-surface lg:p-8 lg:shadow-pop lg:ring-1 lg:ring-line"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
                  <span className="lg:hidden">{t('common.businessName')}</span>
                  <span className="hidden lg:inline">{t('login.welcome')}</span>
                </h1>
                <p className="mt-0.5 text-sm text-muted">{t('login.subtitle')}</p>
              </div>
              <LangChips className="shrink-0" />
            </div>

            <label className="block">
              <span className="label">{t('login.emailOrMobile')}</span>
              <span className="relative block">
                <Smartphone size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  className="input pl-10"
                  autoComplete="username"
                  inputMode="email"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                />
              </span>
            </label>
            <label className="block">
              <span className="label">{t('login.password')}</span>
              <span className="relative block">
                <KeyRound size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  className="input px-10"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="icon-btn absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
              <input type="checkbox" className="h-5 w-5 rounded accent-brand-600" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
              {t('login.remember')}
            </label>

            {error && (
              <div className="flex animate-fade-in items-start gap-2.5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200" role="alert">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button className="btn-primary mt-1 w-full py-3.5 text-base" disabled={busy}>
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              ) : (
                <LogIn size={18} />
              )}
              {busy ? t('login.loggingIn') : t('login.login')}
            </button>

            <DevCredit className="mt-auto pt-6 lg:hidden" />
          </form>
          <div className="mt-6 hidden lg:block">
            <DevCredit />
          </div>
        </div>
      </main>
    </div>
  );
}
