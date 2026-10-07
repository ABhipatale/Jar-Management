import { useState } from 'react';
import { Banknote, BarChart3, CalendarDays, PiggyBank, Receipt, Smartphone } from 'lucide-react';
import { BarChart } from '../../components/charts';
import ExportBar from '../../components/ExportBar';
import RangeFilter, { initialRange } from '../../components/RangeFilter';
import { SortTh, useSort } from '../../components/table';
import { Empty, ErrorBox, Loader, PageHeader, PrintHeader, SkeletonCards, StatCard } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { t } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { businessName, fmtDate, money } from '../../lib/format';
import { useApi } from '../../lib/useApi';

const short = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${Math.round(v)}`);

export default function CashReport() {
  const { settings } = useSettings();
  const [range, setRange] = useState(initialRange('month'));
  const { data, loading, error, reload } = useApi('/reports/cash', { from: range.from, to: range.to });
  const s = data?.summary;
  const days = data?.days;
  const sort = useSort(days, null);
  const period = `${fmtDate(range.from)} – ${fmtDate(range.to)}`;

  const cols = [
    { label: t('rep.cash.col.date'), value: (r) => fmtDate(r.date) },
    { label: t('rep.cash.col.entryCash'), key: 'entry_cash' },
    { label: t('rep.cash.col.paymentsCash'), key: 'payments_cash' },
    { label: t('rep.cash.col.totalCash'), key: 'cash' },
    { label: 'UPI', key: 'upi' },
    { label: t('rep.cash.col.bank'), key: 'bank' },
    { label: t('rep.cash.col.expenses'), key: 'expenses' },
    { label: t('rep.cash.col.netCash'), key: 'net_cash' },
  ];

  // Chart in date order (oldest → newest), independent of the table sort.
  const chartDays = days ? [...days].sort((a, b) => (a.date < b.date ? -1 : 1)) : [];

  return (
    <div className="space-y-5">
      <PageHeader title={t('rep.cash.title')} subtitle={period} back="/reports" />
      <PrintHeader settings={settings} title={t('rep.cash.title')} subtitle={period} />
      <div className="no-print card !p-3 sm:!p-4">
        <RangeFilter value={range} onChange={setRange} />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-5">
          <SkeletonCards n={4} />
          <Loader rows={3} />
        </div>
      )}
      {s && (
        <>
          <ExportBar onExcel={() => exportExcel(`${t('rep.cash.file')}-${range.from}`, t('rep.cash.sheet'), cols, data.days, [businessName(settings), t('rep.cash.titleLine', { period })])} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Banknote} label={t('rep.cash.cashCollection')} value={money(s.cash)} tone="green" />
            <StatCard icon={Smartphone} label={t('rep.cash.upiBank')} value={money(s.payments_upi + s.payments_bank)} tone="purple" />
            <StatCard icon={Receipt} label={t('rep.cash.expenses')} value={money(s.expenses)} tone="red" />
            <StatCard icon={PiggyBank} label={t('rep.cash.netCash')} value={money(s.net_cash)} tone="blue" />
          </div>

          {chartDays.length > 1 && (
            <section className="card no-print">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">{t('rep.cash.chartTitle')}</h2>
                  <p className="text-xs text-muted">{period}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <BarChart3 size={18} />
                </span>
              </div>
              <BarChart
                labels={chartDays.map((d) => `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`)}
                ariaLabel={t('rep.cash.chartTitle')}
                format={short}
                series={[
                  { name: t('rep.cash.col.totalCash'), color: '#10b981', values: chartDays.map((d) => Number(d.cash) || 0) },
                  { name: t('rep.cash.col.expenses'), color: '#ef4444', values: chartDays.map((d) => Number(d.expenses) || 0) },
                ]}
              />
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                {[
                  [t('rep.cash.col.totalCash'), '#10b981'],
                  [t('rep.cash.col.expenses'), '#ef4444'],
                ].map(([n, c]) => (
                  <span key={n} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <CalendarDays size={18} className="text-muted" /> {t('rep.cash.dayWise')}
            </h2>
            {data.days.length === 0 ? (
              <Empty icon={Banknote}>{t('rep.cash.empty')}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <SortTh k="date" sort={sort}>{t('rep.cash.col.date')}</SortTh>
                      <SortTh k="entry_cash" sort={sort} num>{t('rep.cash.col.entryCash')}</SortTh>
                      <SortTh k="payments_cash" sort={sort} num>{t('rep.cash.col.paymentsCash')}</SortTh>
                      <SortTh k="cash" sort={sort} num>{t('rep.cash.col.totalCash')}</SortTh>
                      <SortTh k="upi" sort={sort} num>UPI</SortTh>
                      <SortTh k="bank" sort={sort} num>{t('rep.cash.col.bank')}</SortTh>
                      <SortTh k="expenses" sort={sort} num>{t('rep.cash.col.expenses')}</SortTh>
                      <SortTh k="net_cash" sort={sort} num>{t('rep.cash.col.netCash')}</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sort.rows.map((d) => (
                      <tr key={d.date}>
                        <td>{fmtDate(d.date)}</td>
                        <td className="num">{money(d.entry_cash)}</td>
                        <td className="num">{money(d.payments_cash)}</td>
                        <td className="num font-semibold text-emerald-700">{money(d.cash)}</td>
                        <td className="num">{money(d.upi)}</td>
                        <td className="num">{money(d.bank)}</td>
                        <td className="num text-red-600">{money(d.expenses)}</td>
                        <td className="num font-semibold">{money(d.net_cash)}</td>
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
