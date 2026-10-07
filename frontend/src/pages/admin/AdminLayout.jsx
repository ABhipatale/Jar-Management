import { NavLink, Outlet } from 'react-router-dom';
import { Building2, CreditCard, History, LogOut, ShieldCheck } from 'lucide-react';
import { DevCredit } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { brandName, logoSrc, useBranding } from '../../lib/branding';

const NAV = [
  { to: '/admin', label: t('adm.companies'), icon: Building2, end: true },
  { to: '/admin/plans', label: t('plans.title'), icon: CreditCard },
  { to: '/admin/audit', label: t('adm.audit'), icon: History },
];

/** Super-admin panel shell: platform brand, two sections, logout. */
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const branding = useBranding();

  return (
    <div className="min-h-dvh bg-app">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:h-16 lg:px-8">
          <img src={logoSrc(branding)} alt="" className="h-9 w-8 shrink-0 rounded-md object-contain" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[15px] font-semibold text-ink">{brandName(branding)}</div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <ShieldCheck size={12} aria-hidden="true" /> {t('adm.panel')}
            </div>
          </div>
          <nav className="hidden items-center gap-1 sm:flex" aria-label={t('adm.panel')}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `chip ${isActive ? 'chip-active' : ''}`}>
                <n.icon size={15} aria-hidden="true" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <span className="hidden max-w-40 truncate text-sm text-muted md:inline">{user?.email}</span>
          <button className="icon-btn" onClick={logout} title={t('nav.logout')} aria-label={t('nav.logout')}>
            <LogOut size={18} />
          </button>
        </div>
        <nav className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5 sm:hidden" aria-label={t('adm.panel')}>
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
