import { useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, HandCoins, Receipt, ShoppingBag, TrendingUp } from 'lucide-react';
import { BarChart } from '../../components/charts';
import ExportBar from '../../components/ExportBar';
import { Empty, ErrorBox, Loader, PageHeader, PrintHeader, SkeletonCards, StatCard } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { LOCALE, t } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { businessName, money } from '../../lib/format';
import { useApi } from '../../lib/useApi';

const short = (v) => (Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : `₹${Math.round(v)}`);
const monthName = (ym, style = 'long') =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString(LOCALE, { month: style });

export default function ProfitReport() {
  const { settings } = useSettings();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, loading, error, reload } = useApi('/reports/profit', { year });
  const tot = data?.total;
  // Months up to now (this year) or all twelve (past years); future months are always empty.
  const months = (data?.months || []).filter((m) => year < thisYear || Number(m.month.slice(5)) <= new Date().getMonth() + 1);
  const active = months.filter((m) => m.sales || m.expenses || m.collected);
  const maxType = Math.max(1, ...(data?.expense_types || []).map((e) => e.amount));

  const cols = [
    { label: t('rep.profit.col.month'), value: (r) => monthName(r.month) },
    { label: t('rep.profit.sales'), key: 'sales' },
    { label: t('rep.profit.expenses'), key: 'expenses' },
    { label: t('rep.profit.profit'), key: 'profit' },
    { label: t('rep.profit.collected'), key: 'collected' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('rep.profit.title')} subtitle={String(year)} back="/reports" />
      <PrintHeader settings={settings} title={t('rep.profit.title')} subtitle={String(year)} />

      <div className="no-print card flex items-center justify-between gap-3 !p-3">
        <button type="button" className="icon-btn" onClick={() => setYear((y) => y - 1)} aria-label={t('rep.profit.prevYear')}>
          <ChevronLeft size={18} />
        </button>
        <span className="text-lg font-semibold tabular-nums text-ink">{year}</span>
        <button type="button" className="icon-btn" disabled={year >= thisYear} onClick={() => setYear((y) => y + 1)} aria-label={t('rep.profit.nextYear')}>
          <ChevronRight size={18} />
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-5">
          <SkeletonCards n={4} />
          <Loader rows={3} />
        </div>
      )}

      {tot && (
        <>
          <ExportBar onExcel={() => exportExcel(`${t('rep.profit.file')}-${year}`, t('rep.profit.sheet'), cols, months, [businessName(settings), t('rep.profit.titleLine', { year })])} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={ShoppingBag} label={t('rep.profit.sales')} value={money(tot.sales)} tone="blue" />
            <StatCard icon={Receipt} label={t('rep.profit.expenses')} value={money(tot.expenses)} tone="red" />
            <StatCard icon={TrendingUp} label={t('rep.profit.profit')} value={money(tot.profit)} tone={tot.profit < 0 ? 'red' : 'green'} />
            <StatCard icon={HandCoins} label={t('rep.profit.collected')} value={money(tot.collected)} tone="purple" />
          </div>
          <p className="-mt-2 text-xs text-muted">{t('rep.profit.note')}</p>

          {active.length === 0 ? (
            <section className="card">
              <Empty icon={TrendingUp}>{t('rep.profit.empty')}</Empty>
            </section>
          ) : (
            <>
              <section className="card no-print">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="font-semibold text-ink">{t('rep.profit.chartTitle')}</h2>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <BarChart3 size={18} />
                  </span>
                </div>
                <BarChart
                  labels={months.map((m) => monthName(m.month, 'short'))}
                  ariaLabel={t('rep.profit.chartTitle')}
                  format={short}
                  series={[
                    { name: t('rep.profit.sales'), color: '#3b6ff6', values: months.map((m) => m.sales) },
                    { name: t('rep.profit.expenses'), color: '#ef4444', values: months.map((m) => m.expenses) },
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  {[
                    [t('rep.profit.sales'), '#3b6ff6'],
                    [t('rep.profit.expenses'), '#ef4444'],
                  ].map(([n, c]) => (
                    <span key={n} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {n}
                    </span>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2 className="mb-3 font-semibold text-ink">{t('rep.profit.monthWise')}</h2>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('rep.profit.col.month')}</th>
                        <th className="num">{t('rep.profit.sales')}</th>
                        <th className="num">{t('rep.profit.expenses')}</th>
                        <th className="num">{t('rep.profit.profit')}</th>
                        <th className="num">{t('rep.profit.collected')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...active].reverse().map((m) => (
                        <tr key={m.month}>
                          <td>{monthName(m.month)}</td>
                          <td className="num">{money(m.sales)}</td>
                          <td className="num text-red-600">{money(m.expenses)}</td>
                          <td className={`num font-semibold ${m.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(m.profit)}</td>
                          <td className="num">{money(m.collected)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td>{t('rep.profit.total')}</td>
                        <td className="num">{money(tot.sales)}</td>
                        <td className="num text-red-600">{money(tot.expenses)}</td>
                        <td className={`num ${tot.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(tot.profit)}</td>
                        <td className="num">{money(tot.collected)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {data.expense_types.length > 0 && (
                <section className="card">
                  <h2 className="mb-3 font-semibold text-ink">{t('rep.profit.byType')}</h2>
                  <ul className="space-y-3">
                    {data.expense_types.map((e) => (
                      <li key={e.type}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-ink">{e.type}</span>
                          <span className="shrink-0 font-semibold tabular-nums">{money(e.amount)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${(e.amount / maxType) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
