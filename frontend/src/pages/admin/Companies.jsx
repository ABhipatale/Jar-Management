import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CheckCircle2, ChevronRight, Clock, PauseCircle, Plus, Search, X } from 'lucide-react';
import { Empty, ErrorBox, Loader, PageHeader, StatCard } from '../../components/ui';
import { t } from '../../i18n';
import { fmtDate } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/useApi';
import { StatusBadge } from './common';
import { daysLeft } from './dates';

const FILTERS = ['', 'active', 'suspended', 'expired'];

export default function Companies() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useApi('/admin/companies', { search: q, status });
  // Totals for the tiles come from the unfiltered list.
  const all = useApi('/admin/companies');
  const list = data?.data || [];

  const stats = useMemo(() => {
    const rows = all.data?.data || [];
    return {
      total: rows.length,
      active: rows.filter((c) => c.status === 'active' && !c.expired).length,
      suspended: rows.filter((c) => c.status === 'suspended').length,
      expiring: rows.filter((c) => !c.expired && c.expires_at && daysLeft(c.expires_at) <= 7).length,
    };
  }, [all.data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('adm.companies')}
        subtitle={data ? t('adm.count', { n: list.length }) : ''}
        right={
          <Link to="/admin/companies/new" className="btn-primary">
            <Plus size={18} /> <span className="hidden sm:inline">{t('adm.newCompany')}</span>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('adm.stat.total')} value={stats.total} icon={Building2} tone="blue" />
        <StatCard label={t('adm.stat.active')} value={stats.active} icon={CheckCircle2} tone="green" />
        <StatCard label={t('adm.stat.suspended')} value={stats.suspended} icon={PauseCircle} tone="slate" />
        <StatCard label={t('adm.stat.expiring')} value={stats.expiring} icon={Clock} tone="amber" />
      </div>

      <div className="lg:flex lg:items-center lg:gap-3">
        <div className="relative lg:w-80 lg:shrink-0">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="input pl-10 pr-10"
            type="search"
            placeholder={t('adm.searchPh')}
            aria-label={t('adm.searchPh')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="icon-btn absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setSearch('')} aria-label={t('picker.clear')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 lg:m-0 lg:p-0">
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`chip ${status === f ? 'chip-active' : ''}`} onClick={() => setStatus(f)} aria-pressed={status === f}>
              {t(`adm.filter.${f || 'all'}`)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loader />
      ) : list.length === 0 ? (
        <Empty
          icon={Building2}
          action={!search && !status && <Link to="/admin/companies/new" className="btn-primary"><Plus size={18} /> {t('adm.newCompany')}</Link>}
        >
          {search || status ? t('adm.emptyFiltered') : t('adm.empty')}
        </Empty>
      ) : (
        <ul className="card divide-y divide-line !p-0">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/companies/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-2">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {(c.name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-ink">{c.name_mr || c.name}</span>
                    <StatusBadge company={c} />
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted">
                    {[c.owner?.name, c.owner?.mobile || c.owner?.email, c.plan].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="hidden shrink-0 text-right text-sm sm:block">
                  <div className="tabular-nums text-ink">
                    {c.customers} <span className="text-muted">{t('adm.customers')}</span>
                  </div>
                  <div className={`text-xs ${c.expires_at && daysLeft(c.expires_at) <= 7 ? 'font-semibold text-amber-700' : 'text-muted'}`}>
                    {c.expires_at && daysLeft(c.expires_at) <= 7 && <AlertTriangle size={12} className="mr-1 inline" aria-hidden="true" />}
                    {t('adm.expires')}: {c.expires_at ? fmtDate(c.expires_at) : t('adm.noExpiry')}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
