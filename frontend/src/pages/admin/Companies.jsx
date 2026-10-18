import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, KeyRound, Plus, Search, Users, X } from 'lucide-react';
import { Empty, ErrorBox, PageHeader, SkeletonCards } from '../../components/ui';
import { t } from '../../i18n';
import { useApi, useDebounced } from '../../lib/useApi';
import { CompanyAvatar, PlanPill, StatusBadge } from './common';

const FILTERS = ['', 'active', 'suspended', 'expired'];

/** All companies: search, status filter, one card per company. */
export default function Companies() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useApi('/admin/companies', { search: q, status });
  // Counts on the filter chips come from the unfiltered list.
  const all = useApi('/admin/companies');
  const list = data?.data || [];

  const counts = useMemo(() => {
    const rows = all.data?.data || [];
    return {
      '': rows.length,
      active: rows.filter((c) => c.status === 'active').length,
      suspended: rows.filter((c) => c.status === 'suspended').length,
      expired: rows.filter((c) => c.expired).length,
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

      <div className="card flex flex-col gap-3 p-3! lg:flex-row lg:items-center">
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
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`chip ${status === f ? 'chip-active' : ''}`} onClick={() => setStatus(f)} aria-pressed={status === f}>
              {t(`adm.filter.${f || 'all'}`)}
              {all.data && (
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${status === f ? 'bg-white/20' : 'bg-surface-2 text-muted'}`}>{counts[f]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <SkeletonCards n={6} />
      ) : list.length === 0 ? (
        <Empty
          icon={Building2}
          action={!search && !status && <Link to="/admin/companies/new" className="btn-primary"><Plus size={18} /> {t('adm.newCompany')}</Link>}
        >
          {search || status ? t('adm.emptyFiltered') : t('adm.empty')}
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/admin/companies/${c.id}`}
                className={`card card-hover group flex h-full flex-col gap-3 ${c.status === 'suspended' ? 'opacity-75' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <CompanyAvatar company={c} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{c.name_mr || c.name}</div>
                    <div className="truncate text-sm text-muted">{c.owner?.name || `/${c.slug}`}</div>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge company={c} />
                  <PlanPill company={c} />
                  {c.plan && <span className="truncate text-xs text-muted">{c.plan}</span>}
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3 text-sm">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Users size={15} aria-hidden="true" />
                    <span className="font-semibold tabular-nums text-ink">{c.customers}</span> {t('adm.customers')}
                  </div>
                  <div className="flex items-center gap-1.5 text-muted">
                    <KeyRound size={15} aria-hidden="true" />
                    <span className="font-semibold tabular-nums text-ink">{c.users}</span> {t('adm.users')}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
