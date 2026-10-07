import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Bell, BookOpen, CalendarClock, CheckCircle2, ChevronRight, Clock,
  Droplets, MessageCircle, Package, Plus, Receipt, RotateCcw, TrendingUp, UserPlus, Wallet,
} from 'lucide-react';
import { BarChart, StackBar } from '../components/charts';
import RangeFilter, { initialRange } from '../components/RangeFilter';
import { Empty, ErrorBox, Icon, PendingText, Segmented, SkeletonCards, StatCard } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { fmtDate, fmtLongDate, money, today } from '../lib/format';
import { useApi } from '../lib/useApi';
import { messages, openWhatsApp } from '../lib/whatsapp';

const QUICK = [
  { to: '/entry?type=given', label: t('common.giveJar'), icon: Plus, primary: true },
  { to: '/entry?type=returned', label: t('common.returnJar'), icon: RotateCcw, tone: 'bg-sky-50 text-sky-700' },
  { to: '/payments/new', label: t('common.receivePayment'), icon: Wallet, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/bookings', label: t('book.quick'), icon: CalendarClock, tone: 'bg-violet-50 text-violet-700' },
  { to: '/customers/new', label: t('cust.add'), icon: UserPlus, tone: 'bg-slate-100 text-slate-700' },
];

/** % change; null when there is nothing to compare with. */
function pct(cur, prev) {
  const c = Number(cur) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t('dash.goodMorning') : h < 17 ? t('dash.goodAfternoon') : t('dash.goodEvening');
}

export default function Dashboard() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [range, setRange] = useState(initialRange('today'));
  const [chart, setChart] = useState('jars');
  const { data, loading, error, reload } = useApi('/dashboard', { from: range.from, to: range.to });

  const isToday = range.from === today() && range.to === today();
  const label = isToday ? t('dash.today') : range.preset === 'yesterday' ? t('dash.yesterday') : '';
  const p = data?.period;
  const prev = data?.previous;
  const s = data?.stock;
  const a = data?.attention;

  const spark = useMemo(() => {
    const rows = data?.series || [];
    const pick = (k) => rows.map((r) => r[k]);
    return { given: pick('given'), returned: pick('returned'), cash: pick('cash'), udhari: pick('udhari'), payments: pick('payments') };
  }, [data]);

  const sendSummary = () => {
    const d = data.today;
    openWhatsApp(null, messages.summary(settings, { date: today(), given: d.given, returned: d.returned, cash: d.cash, udhari: d.udhari, payments: d.payments, pending: d.pending }));
  };

  const attention = a
    ? [
        a.bookings_today.count > 0 && { to: '/bookings', icon: CalendarClock, tone: 'bg-violet-50 text-violet-700', text: t('book.todayBanner', { n: a.bookings_today.count, jars: a.bookings_today.jars }) },
        a.reminders_due > 0 && { to: '/notifications', icon: Bell, tone: 'bg-amber-50 text-amber-700', text: t('dash.remindersDue', { n: a.reminders_due }) },
        a.low_stock && { to: '/jars', icon: AlertTriangle, tone: 'bg-red-50 text-red-600', text: t('dash.lowStock', { n: s.available_jars }) },
        a.bookings_tomorrow.count > 0 && { to: '/bookings', icon: Clock, tone: 'bg-slate-100 text-slate-600', text: t('dash.bookingsTomorrow', { n: a.bookings_tomorrow.count, jars: a.bookings_tomorrow.jars }) },
      ].filter(Boolean)
    : [];

  const vs = t('dash.vsPrev');
  const chartLabels = (data?.series || []).map((r) => fmtDate(r.date).slice(0, 5));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{fmtLongDate()}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
            {greeting()}
            {settings.owner_name_mr ? `, ${settings.owner_name_mr}` : user?.name && user.name !== 'Shop Owner' ? `, ${user.name}` : ''} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">{t('dash.intro')}</p>
        </div>
        <button onClick={sendSummary} disabled={!data} className="btn-wa btn-sm hidden sm:inline-flex">
          <MessageCircle size={16} /> {t('dash.sendSummary')}
        </button>
      </div>

      {/* Quick actions — one tap each */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {QUICK.map((q, i) => (
          <Link
            key={q.to}
            to={q.to}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition active:scale-[.98] ${
              q.primary ? 'col-span-2 bg-brand-600 text-white shadow-soft hover:bg-brand-700 sm:col-span-1' : 'card card-hover !py-3 text-ink'
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${q.primary ? 'bg-white/15' : q.tone}`}>
              <q.icon size={19} />
            </span>
            <span className="leading-tight">{q.label}</span>
          </Link>
        ))}
        <button onClick={sendSummary} disabled={!data} className="btn-wa col-span-2 !py-3 sm:hidden">
          <MessageCircle size={18} /> {t('dash.sendSummary')}
        </button>
      </div>

      {/* Needs attention */}
      {data && (
        <section className="card !p-0">
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <h2 className="section-title">{t('dash.attention')}</h2>
            {attention.length === 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                <CheckCircle2 size={16} /> {t('dash.allClear')}
              </span>
            )}
          </div>
          {attention.length > 0 && (
            <div className="divide-y divide-line border-t border-line">
              {attention.map((it, i) => (
                <Link key={i} to={it.to} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${it.tone}`}>
                    <it.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{it.text}</span>
                  <ChevronRight size={18} className="text-slate-400" />
                </Link>
              ))}
            </div>
          )}
          {a?.top_pending?.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t('dash.owesMost')}</span>
                <Link to="/reports/pending" className="text-xs font-semibold text-brand-700 hover:underline">
                  {t('dash.viewAll')}
                </Link>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {a.top_pending.map((c) => (
                  <Link key={c.customer_id} to={`/customers/${c.customer_id}`} className="min-w-36 shrink-0 rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-line transition hover:ring-line-strong">
                    <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                    <PendingText amount={c.pending_amount} className="text-sm" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <RangeFilter value={range} onChange={setRange} />

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <SkeletonCards n={8} />}

      {data && (
        <>
          {/* KPIs */}
          <section className="space-y-3">
            <h2 className="section-title">
              {label ? t('dash.businessOf', { p: label }) : t('dash.businessPeriod')}
              {!isToday && (
                <span className="ml-2 normal-case tracking-normal text-slate-400">
                  {fmtDate(range.from)}
                  {range.to !== range.from && ` – ${fmtDate(range.to)}`}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t('dash.jarsGiven', { p: label }).trim()} value={p.given} icon={ArrowUpRight} tone="blue" delta={pct(p.given, prev.given)} deltaLabel={vs} spark={spark.given} to="/transactions" />
              <StatCard label={t('dash.jarsReturned', { p: label }).trim()} value={p.returned} icon={ArrowDownLeft} tone="purple" delta={pct(p.returned, prev.returned)} deltaLabel={vs} spark={spark.returned} to="/transactions" />
              <StatCard label={t('dash.cash', { p: label }).trim()} value={money(p.cash)} icon={Banknote} tone="green" delta={pct(p.cash, prev.cash)} deltaLabel={vs} spark={spark.cash} to="/reports/cash" />
              <StatCard label={t('dash.udhari', { p: label }).trim()} value={money(p.udhari)} icon={BookOpen} tone="amber" delta={pct(p.udhari, prev.udhari)} deltaInverse deltaLabel={vs} spark={spark.udhari} to="/reports/udhari" />
              <StatCard label={t('dash.paymentsReceived')} value={money(p.payments)} icon={Wallet} tone="green" delta={pct(p.payments, prev.payments)} deltaLabel={vs} spark={spark.payments} to="/payments" />
              <StatCard label={t('dash.netCash')} value={money(p.net_cash)} icon={TrendingUp} tone={p.net_cash >= 0 ? 'blue' : 'red'} delta={pct(p.net_cash, prev.net_cash)} deltaLabel={vs} sub={t('dash.netCashSub')} />
              <StatCard label={t('dash.expenses', { p: label }).trim()} value={money(p.expenses)} icon={Receipt} tone="slate" delta={pct(p.expenses, prev.expenses)} deltaInverse deltaLabel={vs} sub={t('dash.thisMonth', { amount: money(data.month_expenses) })} to="/expenses" />
              <StatCard label={t('common.totalPending')} value={money(p.pending)} icon={Clock} tone="red" sub={t('dash.pendingSub')} to="/reports/pending" />
            </div>
          </section>

          {/* Trend + stock */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="card lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">{t('dash.trend', { n: data.series.length })}</h2>
                  <p className="text-xs text-muted">{chart === 'jars' ? t('dash.trendJarsSub') : t('dash.trendCashSub')}</p>
                </div>
                <div className="w-48">
                  <Segmented
                    size="sm"
                    value={chart}
                    onChange={setChart}
                    options={[
                      { value: 'jars', label: t('dash.chartJars') },
                      { value: 'cash', label: t('dash.chartCash') },
                    ]}
                  />
                </div>
              </div>
              {chart === 'jars' ? (
                <BarChart
                  labels={chartLabels}
                  ariaLabel={t('dash.trend', { n: data.series.length })}
                  series={[
                    { name: t('dash.seriesGiven'), color: '#3b6ff6', values: spark.given },
                    { name: t('dash.seriesReturned'), color: '#a78bfa', values: spark.returned },
                  ]}
                />
              ) : (
                <BarChart
                  labels={chartLabels}
                  ariaLabel={t('dash.trend', { n: data.series.length })}
                  format={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${Math.round(v)}`)}
                  series={[
                    { name: t('dash.seriesCash'), color: '#10b981', values: spark.cash },
                    { name: t('dash.seriesUdhari'), color: '#f59e0b', values: spark.udhari },
                  ]}
                />
              )}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                {(chart === 'jars'
                  ? [[t('dash.seriesGiven'), '#3b6ff6'], [t('dash.seriesReturned'), '#a78bfa']]
                  : [[t('dash.seriesCash'), '#10b981'], [t('dash.seriesUdhari'), '#f59e0b']]
                ).map(([n, c]) => (
                  <span key={n} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {n}
                  </span>
                ))}
              </div>
            </section>

            <section className="card flex flex-col">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-ink">{t('dash.jarsNow')}</h2>
                  <p className="text-xs text-muted">{t('dash.stockSub', { n: s.total_jars })}</p>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Droplets size={18} />
                </span>
              </div>
              <div className="mb-4">
                <div className="text-3xl font-semibold tracking-tight text-ink tabular-nums">{s.available_jars}</div>
                <div className="text-sm text-muted">{t('dash.availableJars')}</div>
              </div>
              <StackBar
                total={Math.max(s.total_jars, 1)}
                segments={[
                  { label: t('dash.availableJars'), value: Math.max(0, s.available_jars), color: '#10b981' },
                  { label: t('dash.withCustomers'), value: s.customer_jars, color: '#3b6ff6' },
                  { label: t('dash.damaged'), value: s.damaged_jars, color: '#ef4444' },
                  { label: t('dash.lost'), value: s.lost_jars, color: '#94a3b8' },
                ]}
              />
              <Link to="/jars" className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-700 hover:underline">
                <Package size={15} /> {t('dash.manageJars')}
              </Link>
            </section>
          </div>

          {/* Customer-wise activity */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="section-title">{label ? t('dash.entriesOf', { p: label }) : t('dash.entriesPeriod')}</h2>
              <Link to="/transactions" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('dash.allEntries')} ›
              </Link>
            </div>
            {data.customers.length === 0 ? (
              <Empty icon={Droplets}>{t('dash.noEntries')}</Empty>
            ) : (
              <div className="card overflow-hidden !p-0">
                <div className="hidden grid-cols-[1.6fr_repeat(5,1fr)] gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
                  <span>{t('ledger.customer')}</span>
                  <span className="text-right">{t('ledger.given')}</span>
                  <span className="text-right">{t('ledger.returned')}</span>
                  <span className="text-right">{t('ledger.amount')}</span>
                  <span className="text-right">{t('ledger.paid')}</span>
                  <span className="text-right">{t('common.totalPending')}</span>
                </div>
                <div className="divide-y divide-line">
                  {data.customers.map((c) => (
                    <Link key={c.customer_id} to={`/customers/${c.customer_id}`} className="block px-4 py-3 transition hover:bg-surface-2 md:grid md:grid-cols-[1.6fr_repeat(5,1fr)] md:items-center md:gap-2">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{c.name.charAt(0).toUpperCase()}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{c.name}</div>
                          <div className="text-xs text-muted">
                            <Icon icon={Droplets} size={11} className="mr-0.5 inline" /> {t('dash.nowHolds')} {c.current_jars} {t('common.jarsWord')}
                          </div>
                        </div>
                      </div>
                      {/* phone: compact summary row */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-sm md:hidden">
                        <span className="text-muted">
                          ↑ <b className="text-ink">{c.given}</b> · ↓ <b className="text-ink">{c.returned}</b>
                        </span>
                        <span className="text-muted">
                          {money(c.amount)} · <span className="text-emerald-700">{money(c.paid + c.payments)}</span>
                        </span>
                        <PendingText amount={c.pending_amount} className="ml-auto" />
                      </div>
                      <span className="hidden text-right tabular-nums md:block">{c.given}</span>
                      <span className="hidden text-right tabular-nums md:block">{c.returned}</span>
                      <span className="hidden text-right tabular-nums md:block">{money(c.amount)}</span>
                      <span className="hidden text-right tabular-nums text-emerald-700 md:block">{money(c.paid + c.payments)}</span>
                      <span className="hidden text-right md:block">
                        <PendingText amount={c.pending_amount} />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
