import { useEffect, useState } from 'react';
import { AlertTriangle, Droplets, Eye, EyeOff, KeyRound, Languages, LogIn, ShieldCheck, Smartphone, Users, Wallet } from 'lucide-react';
import { errorMessage, takeLogoutReason } from '../api/client';
import { DevCredit } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LANGS, lang, setLang, t } from '../i18n';
import { brandName, logoSrc, refreshBranding, useBranding } from '../lib/branding';

const YEAR = new Date().getFullYear();

const HIGHLIGHTS = [
  { icon: Droplets, key: 'login.feature.jars' },
  { icon: Users, key: 'login.feature.customers' },
  { icon: Wallet, key: 'login.feature.money' },
];

// Decorative bubbles in the hero: [size px, left %, top %, delay s].
const BUBBLES = [
  [90, -6, 8, 0],
  [34, 82, 14, 1.2],
  [16, 70, 52, 2.4],
  [56, 88, 62, 0.6],
  [22, 12, 70, 1.8],
  [12, 40, 22, 3],
];

/** Language switch on the coloured hero (glass style). */
function LangChips() {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-white/15 p-1 ring-1 ring-white/25 backdrop-blur-md" role="group" aria-label={t('login.language')}>
      <Languages size={15} className="mx-1.5 text-white/80" aria-hidden="true" />
      {Object.entries(LANGS).map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => code !== lang && setLang(code)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${code === lang ? 'bg-white shadow-sm' : 'text-white/85 hover:text-white'}`}
          // Always brand blue on the white pill (dark mode lightens text-brand-* for dark surfaces).
          style={code === lang ? { color: 'var(--brand)' } : undefined}
          aria-pressed={code === lang}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const branding = useBranding();
  const name = brandName(branding);
  const [form, setForm] = useState({ login: '', password: '', remember: true });
  // Shown when the app logged out because the company was suspended / expired.
  const [error, setError] = useState(() => takeLogoutReason() || '');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // An installed company app keeps showing its company; otherwise the platform's name.
  useEffect(() => {
    refreshBranding(branding.company);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex min-h-dvh flex-col bg-app lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Hero: brand on a water gradient (top on phones, left panel on desktop) ── */}
      <section className="login-hero pt-safe relative overflow-hidden text-white lg:flex lg:min-h-dvh lg:flex-col">
        {BUBBLES.map(([size, left, top, delay], i) => (
          <span
            key={i}
            className="login-bubble"
            style={{ width: size, height: size, left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
            aria-hidden="true"
          />
        ))}

        <div className="relative flex justify-end px-5 pt-4 lg:px-12 lg:pt-10">
          <LangChips />
        </div>

        <div className="relative flex flex-col items-center px-6 pb-16 pt-2 text-center lg:flex-1 lg:items-start lg:justify-center lg:px-12 lg:pb-12 lg:text-left xl:px-16">
          <div className="login-logo grid h-[72px] w-[72px] animate-pop-in place-items-center rounded-[22px] bg-white p-2 lg:h-20 lg:w-20 lg:rounded-3xl">
            <img src={logoSrc(branding)} alt="" className="h-full w-full rounded-2xl object-contain" />
          </div>
          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight drop-shadow-sm lg:mt-5 lg:text-4xl">{name}</h1>
          {name !== t('common.jarMgmt') && (
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-medium ring-1 ring-white/20 backdrop-blur-sm">
              <Droplets size={14} aria-hidden="true" /> {t('common.jarMgmt')}
            </span>
          )}

          {/* RO purifier filling water jars */}
          <img
            src="/illustration.svg"
            alt=""
            className="mt-5 w-full max-w-[320px] animate-fade-in drop-shadow-xl lg:mt-6 lg:max-w-[440px]"
            width="520"
            height="360"
          />

          {/* Desktop: the pitch */}
          <div className="mt-6 hidden max-w-lg lg:block">
            <h2 className="text-2xl font-semibold leading-snug tracking-tight">{t('login.brandTitle')}</h2>
            <p className="mt-2 text-white/80">{t('login.brandSub')}</p>
          </div>
          <p className="mt-auto hidden pt-10 text-xs text-white/60 lg:block">© {YEAR} {name}</p>
        </div>

        {/* Wave edge into the page (phones) */}
        <svg className="absolute inset-x-0 -bottom-px h-12 w-full fill-app lg:hidden" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,64 C240,120 480,0 720,40 C960,80 1200,120 1440,56 L1440,120 L0,120 Z" />
        </svg>
      </section>

      {/* ── Login card ── */}
      <main className="relative z-10 -mt-10 flex flex-1 flex-col px-4 pb-6 lg:mt-0 lg:items-center lg:justify-center lg:px-10">
        <div className="w-full animate-sheet-in lg:max-w-md">
          <form onSubmit={submit} className="rounded-3xl bg-surface p-6 shadow-pop ring-1 ring-line sm:p-8" noValidate>
            <h2 className="text-[22px] font-bold leading-tight tracking-tight text-ink">{t('login.welcome')} 👋</h2>
            <p className="mt-1 text-sm text-muted">{t('login.welcomeSub')}</p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="label">{t('login.emailOrMobile')}</span>
                <span className="relative block">
                  <Smartphone size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-600" aria-hidden="true" />
                  <input
                    className="input login-input"
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
                  <KeyRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-600" aria-hidden="true" />
                  <input
                    className="input login-input pr-12"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="icon-btn absolute right-1.5 top-1/2 -translate-y-1/2"
                    aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPw}
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              <label className="flex cursor-pointer select-none items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded accent-brand-600"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                />
                {t('login.remember')}
              </label>

              {error && (
                <div className="flex animate-fade-in items-start gap-2.5 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200" role="alert">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button className="btn btn-glow h-12 w-full rounded-xl text-base text-white" disabled={busy}>
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : (
                  <LogIn size={18} />
                )}
                {busy ? t('login.loggingIn') : t('login.login')}
              </button>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
              <ShieldCheck size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
              {t('login.secure')}
            </p>
          </form>

          {/* Phones: what the app does */}
          <ul className="mt-5 grid grid-cols-3 gap-2.5 lg:hidden">
            {HIGHLIGHTS.map((h) => (
              <li key={h.key} className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-2 py-3 text-center shadow-soft ring-1 ring-line">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <h.icon size={18} aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold leading-tight text-ink">{t(h.key)}</span>
              </li>
            ))}
          </ul>

          <DevCredit className="mt-8" />
        </div>
      </main>
    </div>
  );
}
