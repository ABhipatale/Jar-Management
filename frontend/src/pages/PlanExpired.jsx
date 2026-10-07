import { CalendarX2, LogOut } from 'lucide-react';
import { DevCredit } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { brandName, logoSrc, useBranding } from '../lib/branding';
import Billing from './Billing';

/** The company's plan has ended: every user sees only this until someone pays. */
export default function PlanExpired() {
  const { user, logout, stopImpersonating } = useAuth();
  const branding = useBranding();

  return (
    <div className="min-h-dvh bg-app">
      <header className="pt-safe border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <img src={logoSrc(branding)} alt="" className="h-9 w-8 shrink-0 rounded-md object-contain" />
          <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{brandName(branding)}</div>
          <button
            className="btn-light btn-sm"
            onClick={user?.impersonating ? stopImpersonating : logout}
          >
            <LogOut size={16} /> {user?.impersonating ? t('imp.exit') : t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <CalendarX2 size={28} />
          </span>
          <h1 className="mt-3 text-[22px] font-bold tracking-tight text-ink">{t('bill.lockedTitle')}</h1>
          <p className="mt-1 max-w-md text-sm text-muted">{t('bill.lockedSub')}</p>
        </div>
        <Billing locked />
        <DevCredit className="pt-6" />
      </main>
    </div>
  );
}
