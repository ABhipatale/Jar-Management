import { useMemo, useState } from 'react';
import { CircleCheck, Clock, HandCoins, Users } from 'lucide-react';
import ExportBar from '../../components/ExportBar';
import RangeFilter, { initialRange } from '../../components/RangeFilter';
import { SortTh, useSort } from '../../components/table';
import { Empty, ErrorBox, Loader, PageHeader, PendingText, PrintHeader, SkeletonCards, StatCard } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { t } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { businessName, fmtDate, money } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/useApi';
import ReportFilters from './ReportFilters';

export default function UdhariReport() {
  const { settings } = useSettings();
  const [range, setRange] = useState(initialRange('month'));
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useApi('/reports/udhari', { from: range.from, to: range.to, customer_id: customerId || undefined, search: q || undefined });
  const s = data?.summary;
  const rows = useMemo(() => data?.customers || [], [data]);
  const sort = useSort(rows, null);
  const period = `${fmtDate(range.from)} – ${fmtDate(range.to)}`;

  const cols = [
    { label: t('rep.col.customer'), key: 'name' },
    { label: t('rep.col.mobile'), key: 'mobile' },
    { label: t('rep.udhari.given'), key: 'udhari' },
    { label: t('rep.udhari.col.recovered'), key: 'payments' },
    { label: t('rep.udhari.pendingNow'), key: 'pending_amount' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('rep.udhari.title')} subtitle={period} back="/reports" />
      <PrintHeader settings={settings} title={t('rep.udhari.title')} subtitle={period} />
      <ReportFilters customerId={customerId} onCustomer={setCustomerId} search={search} onSearch={setSearch}>
        <RangeFilter value={range} onChange={setRange} />
      </ReportFilters>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-5">
          <SkeletonCards n={3} />
          <Loader rows={3} />
        </div>
      )}
      {s && (
        <>
          <ExportBar onExcel={() => exportExcel(`${t('rep.udhari.file')}-${range.from}`, t('rep.udhari.sheet'), cols, rows, [businessName(settings), t('rep.udhari.titleLine', { period })])} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard icon={HandCoins} label={t('rep.udhari.given')} value={money(s.udhari)} tone="amber" />
            <StatCard icon={CircleCheck} label={t('rep.udhari.recovered')} value={money(s.payments)} tone="green" />
            <div className="col-span-2 lg:col-span-1">
              <StatCard icon={Clock} label={t('rep.udhari.pendingNow')} value={money(s.pending)} tone="red" />
            </div>
          </div>
          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <Users size={18} className="text-muted" /> {t('rep.period.customerWise')}
              </h2>
              {rows.length > 0 && <span className="text-sm text-muted">{t('rep.customersCount', { n: rows.length })}</span>}
            </div>
            {rows.length === 0 ? (
              <Empty icon={HandCoins}>{t('rep.udhari.empty')}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <SortTh k="name" sort={sort}>{t('rep.col.customer')}</SortTh>
                      <SortTh k="udhari" sort={sort} num>{t('rep.udhari.given')}</SortTh>
                      <SortTh k="payments" sort={sort} num>{t('rep.udhari.paidBack')}</SortTh>
                      <SortTh k="pending_amount" sort={sort} num>{t('rep.udhari.pendingNow')}</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sort.rows.map((r) => (
                      <tr key={r.customer_id}>
                        <td className="font-medium">{r.name}</td>
                        <td className="num text-amber-700">{money(r.udhari)}</td>
                        <td className="num text-emerald-700">{money(r.payments)}</td>
                        <td className="num"><PendingText amount={r.pending_amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
