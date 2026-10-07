import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, CalendarDays, CalendarRange, ChevronRight, Clock, Droplets, Banknote, HandCoins, CalendarCheck } from 'lucide-react';
import CustomerPicker from '../../components/CustomerPicker';
import { Modal, PageHeader } from '../../components/ui';
import { t } from '../../i18n';

const REPORTS = [
  { to: '/reports/daily', icon: CalendarCheck, tone: 'bg-brand-50 text-brand-700', title: t('rep.daily.title'), sub: t('rep.daily.sub') },
  { to: '/reports/weekly', icon: CalendarRange, tone: 'bg-brand-50 text-brand-700', title: t('rep.weekly.title'), sub: t('rep.weekly.sub') },
  { to: '/reports/monthly', icon: CalendarDays, tone: 'bg-brand-50 text-brand-700', title: t('rep.monthly.title'), sub: t('rep.monthly.sub') },
  { ledger: true, icon: BookOpenText, tone: 'bg-violet-50 text-violet-700', title: t('rep.ledger.title'), sub: t('rep.ledger.sub') },
  { to: '/reports/jar-status', icon: Droplets, tone: 'bg-sky-50 text-sky-700', title: t('rep.jarStatus.cardTitle'), sub: t('rep.jarStatus.sub') },
  { to: '/reports/cash', icon: Banknote, tone: 'bg-emerald-50 text-emerald-700', title: t('rep.cash.title'), sub: t('rep.cash.sub') },
  { to: '/reports/udhari', icon: HandCoins, tone: 'bg-amber-50 text-amber-700', title: t('rep.udhari.title'), sub: t('rep.udhari.sub') },
  { to: '/reports/pending', icon: Clock, tone: 'bg-red-50 text-red-600', title: t('rep.pending.cardTitle'), sub: t('rep.pending.sub') },
];

export default function Reports() {
  const navigate = useNavigate();
  const [pickLedger, setPickLedger] = useState(false);

  return (
    <div>
      <PageHeader title={t('rep.title')} subtitle={t('rep.hubSub')} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const inner = (
            <>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${r.tone}`}>
                <r.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{r.title}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">{r.sub}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </>
          );
          const cls = 'card card-hover group flex w-full items-center gap-3 text-left active:scale-[.99]';
          return r.ledger ? (
            <button key={r.title} type="button" className={cls} onClick={() => setPickLedger(true)}>
              {inner}
            </button>
          ) : (
            <Link key={r.to} to={r.to} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>

      {pickLedger && (
        <Modal title={t('rep.chooseCustomer')} onClose={() => setPickLedger(false)}>
          <div className="min-h-80">
            <CustomerPicker includeInactive value="" onChange={(id) => id && navigate(`/customers/${id}/ledger`)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
