import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Building2, CreditCard, History, LayoutDashboard, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { DevCredit } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { brandName, logoSrc, useBranding } from '../../lib/branding';
import { isDark, setTheme } from '../../lib/theme';

const NAV = [
  { to: '/admin', label: t('adm.dashboard'), icon: LayoutDashboard, end: true },
  { to: '/admin/companies', label: t('adm.companies'), icon: Building2 },
  { to: '/admin/plans', label: t('plans.title'), icon: CreditCard },
  { to: '/admin/audit', label: t('adm.audit'), icon: History },
];

function useDarkMode() {
  const [dark, setDark] = useState(isDark());
  useEffect(() => {
    const on = (e) => setDark(e.detail.dark);
    window.addEventListener('rws:theme', on);
    return () => window.removeEventListener('rws:theme', on);
  }, []);
  return [dark, () => setTheme(dark ? 'light' : 'dark')];
}

/** Super-admin panel shell: dark sidebar on desktop, top bar + tab chips on phones. */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const branding = useBranding();
  const [dark, toggleDark] = useDarkMode();
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh bg-app lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col text-white lg:flex" aria-label={t('adm.panel')}>
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <img src={logoSrc(branding)} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1 shadow-lg" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-semibold">{brandName(branding)}</div>
            <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
              <ShieldCheck size={11} aria-hidden="true" /> {t('adm.panel')}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="admin-nav-link">
              <span className="admin-nav-icon">
                <n.icon size={17} aria-hidden="true" />
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-sky-400 to-blue-600 text-sm font-bold">
              {initial}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{user?.name}</div>
              <div className="truncate text-xs text-white/55">{user?.email}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10"
              onClick={toggleDark}
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? t('adm.light') : t('adm.dark')}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 py-2 text-xs font-medium text-white/80 transition hover:bg-red-500/20 hover:text-white"
              onClick={logout}
            >
              <LogOut size={14} /> {t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      {/* Phone / tablet header */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <img src={logoSrc(branding)} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-semibold text-ink">{brandName(branding)}</div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <ShieldCheck size={12} aria-hidden="true" /> {t('adm.panel')}
            </div>
          </div>
          <button className="icon-btn" onClick={toggleDark} aria-label={dark ? t('adm.light') : t('adm.dark')}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-btn" onClick={logout} title={t('nav.logout')} aria-label={t('nav.logout')}>
            <LogOut size={18} />
          </button>
        </div>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5" aria-label={t('adm.panel')}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `chip ${isActive ? 'chip-active' : ''}`}>
              <n.icon size={15} aria-hidden="true" /> {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 lg:px-8 lg:py-8">
        <Outlet />
        <DevCredit className="mt-10" />
      </main>
    </div>
  );
}
