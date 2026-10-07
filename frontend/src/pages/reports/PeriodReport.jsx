import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  Droplets,
  HandCoins,
  MessageCircle,
  PackageX,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import ExportBar from '../../components/ExportBar';
import { SortTh, useSort } from '../../components/table';
import { Empty, ErrorBox, Loader, PageHeader, PendingText, PrintHeader, SkeletonCards, StatCard } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { lang, t, tx } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { addDays, fmtDate, money, today } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/useApi';
import { messages, openWhatsApp } from '../../lib/whatsapp';
import ReportFilters from './ReportFilters';

const TITLES = { daily: t('rep.daily.title'), weekly: t('rep.weekly.title'), monthly: t('rep.monthly.title') };

/** Daily / Weekly / Monthly report: totals + customer-wise table. */
export default function PeriodReport({ kind }) {
  const { settings } = useSettings();
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);

  const params = { customer_id: customerId || undefined, search: q || undefined, ...(kind === 'monthly' ? { month } : { date }) };
  const { data, loading, error, reload } = useApi(`/reports/${kind}`, params);
  const s = data?.summary;
  const rows = useMemo(() => data?.customers || [], [data]);
  const period = data ? (data.from === data.to ? fmtDate(data.from) : `${fmtDate(data.from)} – ${fmtDate(data.to)}`) : '';

  // Table-only helper column so "paid" (paid at entry + later payments) can be sorted.
  const tableRows = useMemo(() => rows.map((r) => ({ ...r, paid_total: r.paid + r.payments })), [rows]);
  const sort = useSort(tableRows, null);

  const excel = () =>
    exportExcel(
      `${TITLES[kind].replace(' ', '-')}-${data.from}`,
      TITLES[kind],
      [
        { label: t('rep.col.customer'), key: 'name' },
        { label: t('rep.col.mobile'), key: 'mobile' },
        { label: t('rep.col.given'), key: 'given' },
        { label: t('rep.col.returned'), key: 'returned' },
        { label: t('rep.col.currentJars'), key: 'current_jars' },
        { label: t('rep.col.amount'), key: 'amount' },
        { label: t('rep.col.paid'), key: 'paid' },
        { label: t('rep.col.udhari'), key: 'udhari' },
        { label: t('rep.col.payments'), key: 'payments' },
        { label: t('rep.col.pending'), key: 'pending_amount' },
      ],
      rows,
      [
        lang === 'en' ? settings.business_name || 'Sai Water Suppliers' : settings.business_name_mr || 'साई वॉटर सप्लायर्स',
        `${TITLES[kind]}: ${period}`,
        t('rep.period.excelSummary', { given: s.given, returned: s.returned, sales: s.sales, cash: s.cash, udhari: s.udhari, payments: s.payments, pending: s.pending }),
      ]
    );

  const step = (dir) => setDate(addDays(date, dir * (kind === 'weekly' ? 7 : 1)));

  return (
    <div className="space-y-5">
      <PageHeader title={TITLES[kind]} subtitle={period} back="/reports" />
      <PrintHeader settings={settings} title={TITLES[kind]} subtitle={period} />

      <ReportFilters customerId={customerId} onCustomer={setCustomerId} search={search} onSearch={setSearch}>
        {kind === 'monthly' ? (
          <input type="month" className="input" value={month} max={today().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
        ) : (
          <div className="flex gap-2">
            <button type="button" className="btn-light w-12 shrink-0 !px-0" onClick={() => step(-1)} aria-label={t('rep.prev')}>
              <ChevronLeft size={18} />
            </button>
            <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
            <button type="button" className="btn-light w-12 shrink-0 !px-0" onClick={() => step(1)} disabled={date >= today()} aria-label={t('rep.next')}>
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </ReportFilters>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="space-y-5">
          <SkeletonCards n={8} />
          <Loader rows={3} />
        </div>
      )}

      {s && (
        <>
          <ExportBar
            onExcel={excel}
            extra={
              kind === 'daily' && !customerId ? (
                <button
                  className="btn-wa btn-sm shrink-0"
                  onClick={() => openWhatsApp(null, messages.summary(settings, { date: data.from, given: s.given, returned: s.returned, cash: s.cash, udhari: s.udhari, payments: s.payments, pending: s.pending }))}
                >
                  <MessageCircle size={16} /> {tx('rep.period.waSummary')}
                </button>
              ) : null
            }
          />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={ArrowUpRight} label={kind === 'monthly' ? t('rep.period.jarsDelivered') : t('rep.period.jarsGiven')} value={s.given} tone="blue" />
            <StatCard icon={ArrowDownLeft} label={t('rep.period.jarsReturned')} value={s.returned} tone="purple" />
            {kind === 'daily' ? (
              <StatCard icon={Droplets} label={t('rep.period.netJarsGiven')} value={s.net_jars} tone="slate" />
            ) : (
              <StatCard icon={ShoppingCart} label={t('rep.period.totalSales')} value={money(s.sales)} tone="slate" />
            )}
            <StatCard icon={Banknote} label={kind === 'monthly' ? t('rep.period.cashReceived') : t('rep.period.cashCollection')} value={money(s.cash)} tone="green" />
            <StatCard icon={HandCoins} label={t('rep.period.udhari')} value={money(s.udhari)} tone="amber" />
            <StatCard icon={Wallet} label={t('rep.period.paymentsReceived')} value={money(s.payments)} tone="green" sub={t('rep.period.paymentsSub', { upi: money(s.payments_upi), bank: money(s.payments_bank) })} />
            <StatCard icon={Clock} label={kind === 'monthly' ? t('rep.period.pendingPayments') : t('rep.period.pendingAmount')} value={money(s.pending)} tone="red" sub={t('rep.period.pendingSub')} />
            {kind === 'daily' && <StatCard icon={ShoppingCart} label={t('rep.period.totalSales')} value={money(s.sales)} tone="slate" />}
            {kind === 'weekly' && <StatCard icon={Receipt} label={t('rep.period.expenses')} value={money(s.expenses)} tone="slate" />}
            {kind === 'monthly' && (
              <>
                <StatCard icon={AlertTriangle} label={t('rep.period.damagedJars')} value={s.damaged} tone="red" />
                <StatCard icon={PackageX} label={t('rep.period.lostJars')} value={s.lost} tone="amber" />
                <StatCard icon={Receipt} label={t('rep.period.expenses')} value={money(s.expenses)} tone="slate" />
                <StatCard icon={PiggyBank} label={t('rep.period.netCash')} value={money(s.net_cash)} tone="green" />
              </>
            )}
          </div>

          <section className="card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <Users size={18} className="text-muted" /> {t('rep.period.customerWise')}
              </h2>
              {rows.length > 0 && <span className="text-sm text-muted">{t('rep.customersCount', { n: rows.length })}</span>}
            </div>
            {rows.length === 0 ? (
              <Empty icon={Users}>{t('rep.period.empty')}</Empty>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <SortTh k="name" sort={sort}>{t('rep.col.customer')}</SortTh>
                      <SortTh k="given" sort={sort} num>{t('rep.col.given')}</SortTh>
                      <SortTh k="returned" sort={sort} num>{t('rep.col.returned')}</SortTh>
                      <SortTh k="current_jars" sort={sort} num>{t('rep.col.currentJars')}</SortTh>
                      <SortTh k="amount" sort={sort} num>{t('rep.col.amount')}</SortTh>
                      <SortTh k="paid_total" sort={sort} num>{t('rep.col.paid')}</SortTh>
                      <SortTh k="udhari" sort={sort} num>{t('rep.col.udhari')}</SortTh>
                      <SortTh k="pending_amount" sort={sort} num>{t('rep.col.pending')}</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {sort.rows.map((r) => (
                      <tr key={r.customer_id}>
                        <td className="font-medium">{r.name}</td>
                        <td className="num">{r.given}</td>
                        <td className="num">{r.returned}</td>
                        <td className="num font-semibold">{r.current_jars}</td>
                        <td className="num">{money(r.amount)}</td>
                        <td className="num text-emerald-700">{money(r.paid_total)}</td>
                        <td className="num text-amber-700">{money(r.udhari)}</td>
                        <td className="num"><PendingText amount={r.pending_amount} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-2 font-semibold">
                      <td className="!border-b-0">{t('rep.total')}</td>
                      <td className="num !border-b-0">{rows.reduce((a, r) => a + r.given, 0)}</td>
                      <td className="num !border-b-0">{rows.reduce((a, r) => a + r.returned, 0)}</td>
                      <td className="num !border-b-0">{rows.reduce((a, r) => a + r.current_jars, 0)}</td>
                      <td className="num !border-b-0">{money(rows.reduce((a, r) => a + r.amount, 0))}</td>
                      <td className="num !border-b-0">{money(rows.reduce((a, r) => a + r.paid + r.payments, 0))}</td>
                      <td className="num !border-b-0">{money(rows.reduce((a, r) => a + r.udhari, 0))}</td>
                      <td className="!border-b-0" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
