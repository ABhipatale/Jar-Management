import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Droplets, Package, PackageCheck, Users } from 'lucide-react';
import { StackBar } from '../../components/charts';
import ExportBar from '../../components/ExportBar';
import { SortTh, useSort } from '../../components/table';
import { Empty, ErrorBox, Loader, PageHeader, PendingText, PrintHeader, SkeletonCards, StatCard } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { t } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { businessName, fmtDate, today } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/useApi';
import ReportFilters from './ReportFilters';

/** कोणाकडे किती जार आहेत? */
export default function JarStatusReport() {
  const { settings } = useSettings();
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useApi('/reports/jar-status', { customer_id: customerId || undefined, search: q || undefined });
  const s = data?.summary;
  const rows = useMemo(() => data?.customers || [], [data]);
  const sort = useSort(rows, null);

  return (
    <div className="space-y-5">
      <PageHeader title={t('rep.jarStatus.title')} subtitle={t('rep.jarStatus.sub')} back="/reports" />
      <PrintHeader settings={settings} title={t('rep.jarStatus.cardTitle')} subtitle={t('rep.asOn', { date: fmtDate(today()) })} />
      <ReportFilters customerId={customerId} onCustomer={setCustomerId} search={search} onSearch={setSearch} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-5">
          <SkeletonCards n={4} />
          <Loader rows={3} />
        </div>
      )}
      {s && (
        <>
          <ExportBar
            onExcel={() =>
              exportExcel(
                `${t('rep.jarStatus.file')}-${today()}`,
                t('rep.jarStatus.sheet'),
                [
                  { label: t('rep.col.customer'), key: 'name' },
                  { label: t('rep.col.mobile'), key: 'mobile' },
                  { label: t('rep.jarStatus.col.withCustomer'), key: 'current_jars' },
                  { label: t('rep.col.pending'), key: 'pending_amount' },
                ],
                rows,
                [
                  businessName(settings),
                  t('rep.jarStatus.titleLine', { date: fmtDate(today()) }),
                  t('rep.jarStatus.summaryLine', { total: s.total_jars, available: s.available_jars, customers: s.customer_jars, damaged: s.damaged_jars, lost: s.lost_jars }),
                ]
              )
            }
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={PackageCheck} label={t('rep.jarStatus.available')} value={s.available_jars} tone="green" />
            <StatCard icon={Users} label={t('rep.jarStatus.withCustomers')} value={s.customer_jars} tone="blue" />
            <StatCard icon={Package} label={t('rep.jarStatus.total')} value={s.total_jars} tone="slate" />
            <StatCard icon={AlertTriangle} label={t('rep.jarStatus.damagedLost')} value={`${s.damaged_jars} / ${s.lost_jars}`} tone="red" />
          </div>

          <section className="card">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{t('rep.jarStatus.stockTitle')}</h2>
                <p className="text-xs text-muted">{t('rep.asOn', { date: fmtDate(today()) })}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Droplets size={18} />
              </span>
            </div>
            <StackBar
              total={Math.max(s.total_jars, 1)}
              segments={[
                { label: t('rep.jarStatus.available'), value: Math.max(0, s.available_jars), color: '#10b981' },
                { label: t('rep.jarStatus.withCustomers'), value: s.customer_jars, color: '#3b6ff6' },
                { label: t('rep.jarStatus.damaged'), value: s.damaged_jars, color: '#ef4444' },
                { label: t('rep.jarStatus.lost'), value: s.lost_jars, color: '#94a3b8' },
              ]}
            />
          </section>

          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <Users size={18} className="text-muted" /> {t('rep.jarStatus.customerList')}
              </h2>
              {rows.length > 0 && <span className="text-sm text-muted">{t('rep.customersCount', { n: rows.length })}</span>}
            </div>
            {rows.length === 0 ? (
              <Empty icon={Droplets}>{t('rep.jarStatus.empty')}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <SortTh k="name" sort={sort}>{t('rep.col.customer')}</SortTh>
                      <th>{t('rep.col.mobile')}</th>
                      <SortTh k="current_jars" sort={sort} num>{t('rep.col.jars')}</SortTh>
                      <SortTh k="pending_amount" sort={sort} num>{t('rep.col.pending')}</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sort.rows.map((r) => (
                      <tr key={r.customer_id}>
                        <td className="font-medium">
                          <Link to={`/customers/${r.customer_id}`} className="hover:text-brand-700 hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="text-muted tabular-nums">{r.mobile}</td>
                        <td className="num text-base font-semibold text-brand-700">{r.current_jars}</td>
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
