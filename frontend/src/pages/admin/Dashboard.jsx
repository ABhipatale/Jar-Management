import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Building2, CheckCircle2, Clock, IndianRupee, Phone, Plus, Receipt, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { BarChart } from '../../components/charts';
import { ErrorBox, Loader, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { LOCALE, t } from '../../i18n';
import { daysUntil, fmtDate, money } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { CompanyAvatar, PlanPill, StatusBadge } from './common';

const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(LOCALE, { month: 'short' });
const shortMoney = (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `₹${Math.round(v)}`);

/** Super-admin home: revenue, company health, plans ending soon, newest companies. */
export default function Dashboard() {
  const { user } = useAuth();
  const overview = useApi('/admin/overview');
  const companies = useApi('/admin/companies');
  const [dateLine] = useState(() => new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  const rows = useMemo(() => companies.data?.data || [], [companies.data]);
  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((c) => c.status === 'active' && !c.expired).length,
      expiring: rows.filter((c) => !c.expired && c.expires_at && daysUntil(c.expires_at) <= 7).length,
      expired: rows.filter((c) => c.expired).length,
    }),
    [rows]
  );
  const ending = useMemo(
    () => rows
      .filter((c) => c.status === 'active' && !c.expired && c.expires_at && daysUntil(c.expires_at) <= 7)
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at)),
    [rows]
  );
  const newest = useMemo(() => [...rows].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5), [rows]);

  const error = overview.error || companies.error;
  if (error) return <ErrorBox message={error} onRetry={() => { overview.reload(); companies.reload(); }} />;
  if (!overview.data || !companies.data) return <Loader />;

  const { revenue, customers, recent_payments: recent } = overview.data;
  const change = revenue.last_month > 0 ? ((revenue.this_month - revenue.last_month) / revenue.last_month) * 100 : null;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="admin-hero relative overflow-hidden rounded-2xl p-5 text-white shadow-pop sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{dateLine}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t('adm.hello', { name: user?.name?.split(' ')[0] || '' })}</h1>
            <p className="mt-1 text-sm text-white/80">{t('adm.heroSub')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/admin/companies/new" className="btn-on-hero btn-sm">
                <Plus size={16} /> {t('adm.newCompany')}
              </Link>
              <Link to="/admin/plans" className="btn-on-hero-ghost btn-sm">
                <Receipt size={16} /> {t('plans.title')}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-104">
            <div className="admin-glass p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <Wallet size={14} aria-hidden="true" /> {t('adm.rev.month')}
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl">{money(revenue.this_month)}</div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                {change !== null && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-white/15 px-1.5 py-0.5 font-semibold tabular-nums text-white">
                    {change >= 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}
                    {Math.abs(change).toFixed(0)}%
                  </span>
                )}
                {change !== null ? t('adm.rev.vsLast') : t('adm.rev.noLast')}
              </div>
            </div>
            <div className="admin-glass p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <IndianRupee size={14} aria-hidden="true" /> {t('adm.rev.total')}
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl">{money(revenue.total)}</div>
              <div className="mt-1 text-xs text-white/80">{t('adm.rev.payments', { n: revenue.payments })}</div>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('adm.stat.total')} value={stats.total} icon={Building2} tone="blue" to="/admin/companies" />
        <StatCard label={t('adm.stat.active')} value={stats.active} icon={CheckCircle2} tone="green" sub={stats.expired ? t('adm.stat.expiredN', { n: stats.expired }) : undefined} />
        <StatCard label={t('adm.stat.expiring')} value={stats.expiring} icon={Clock} tone="amber" />
        <StatCard label={t('adm.stat.customers')} value={customers} icon={Users} tone="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">{t('adm.rev.chart')}</h2>
              <p className="text-xs text-muted">{t('adm.rev.chartSub')}</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <TrendingUp size={18} aria-hidden="true" />
            </span>
          </div>
          <BarChart
            labels={revenue.months.map((m) => monthLabel(m.month))}
            series={[{ name: t('adm.rev.label'), color: 'var(--color-brand-600)', values: revenue.months.map((m) => m.amount) }]}
            format={shortMoney}
            height={200}
            ariaLabel={t('adm.rev.chart')}
          />
        </section>

        {/* Recent payments */}
        <section className="card p-0!">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold text-ink">{t('adm.rev.recent')}</h2>
            <Receipt size={17} className="text-muted" aria-hidden="true" />
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-2">
                <Wallet size={20} aria-hidden="true" />
              </span>
              {t('adm.rev.none')}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <IndianRupee size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {p.company ? (
                      <Link to={`/admin/companies/${p.company.id}`} className="block truncate text-sm font-medium text-ink hover:text-brand-700">
                        {p.company.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted">—</span>
                    )}
                    <div className="text-xs text-muted">{[p.plan, fmtDate(p.date)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-700">+{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plans ending soon: time to collect payment */}
        <section className="card p-0!">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <AlertTriangle size={17} className="text-amber-600" aria-hidden="true" /> {t('adm.endingSoon')}
            </h2>
            {ending.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{ending.length}</span>}
          </div>
          {ending.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted">
              <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" /> {t('adm.endingNone')}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {ending.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <CompanyAvatar company={c} size="h-9 w-9" text="text-sm" />
                  <Link to={`/admin/companies/${c.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{c.name_mr || c.name}</div>
                    <div className="text-xs text-muted">{fmtDate(c.expires_at)}</div>
                  </Link>
                  <PlanPill company={c} />
                  {c.owner?.mobile && (
                    <a href={`tel:${c.owner.mobile}`} className="icon-btn text-emerald-700" aria-label={c.owner.mobile} title={c.owner.mobile}>
                      <Phone size={16} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Newest companies */}
        <section className="card p-0!">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold text-ink">{t('adm.newest')}</h2>
            <Link to="/admin/companies" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              {t('adm.viewAll')} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {newest.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted">{t('adm.empty')}</div>
          ) : (
            <ul className="divide-y divide-line">
              {newest.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/companies/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                    <CompanyAvatar company={c} size="h-9 w-9" text="text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{c.name_mr || c.name}</div>
                      <div className="text-xs text-muted">
                        {t('adm.created')}: {fmtDate(c.created_at)} · {c.customers} {t('adm.customers')}
                      </div>
                    </div>
                    <StatusBadge company={c} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
