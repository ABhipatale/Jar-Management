import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Droplets, Phone, Search, UserPlus, Users, X } from 'lucide-react';
import { Badge, Empty, ErrorBox, Fab, Loader, PageHeader, PendingText } from '../components/ui';
import { t } from '../i18n';
import { useApi, useDebounced } from '../lib/useApi';

const FILTERS = [
  { key: '', label: t('cust.filter.all') },
  { key: 'active', label: t('cust.filter.active') },
  { key: 'pending', label: t('cust.filter.pending') },
  { key: 'jars', label: t('cust.filter.jars') },
  { key: 'inactive', label: t('cust.filter.inactive') },
];

const COLS = 'lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_9rem_1.5rem] lg:items-center lg:gap-4';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const q = useDebounced(search);
  const params = { search: q };
  if (filter === 'active' || filter === 'inactive') params.status = filter;
  if (filter === 'pending' || filter === 'jars') params.filter = filter;
  const { data, loading, error, reload } = useApi('/customers', params);
  const list = data?.data || [];
  const narrowed = Boolean(search.trim() || filter);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('cust.title')}
        subtitle={data ? t('cust.count', { n: list.length }) : ''}
      />

      {/* Search + filters (sticky under the header on phone) */}
      <div className="sticky top-14 z-20 -mx-4 -mt-4 border-b border-line bg-app/90 px-4 pb-3 pt-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-0 lg:flex lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative lg:w-80 lg:shrink-0">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="input pl-10 pr-10"
            type="search"
            placeholder={t('cust.searchPh')}
            aria-label={t('cust.searchPh')}
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
            <button key={f.key} type="button" className={`chip ${filter === f.key ? 'chip-active' : ''}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader rows={6} />}
      {data && list.length === 0 && (
        <Empty
          icon={narrowed ? Search : Users}
          title={narrowed ? t('cust.noMatchTitle') : t('cust.emptyTitle')}
          action={
            narrowed ? (
              <button
                type="button"
                className="btn-light btn-sm"
                onClick={() => {
                  setSearch('');
                  setFilter('');
                }}
              >
                <X size={15} /> {t('cust.clearFilters')}
              </button>
            ) : (
              <Link to="/customers/new" className="btn-primary btn-sm">
                <UserPlus size={16} /> {t('cust.add')}
              </Link>
            )
          }
        >
          {narrowed ? t('cust.none') : t('cust.emptyText')}
        </Empty>
      )}

      {list.length > 0 && (
        <div className={`card overflow-hidden !p-0 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <div className={`hidden border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted ${COLS}`}>
            <span>{t('ledger.customer')}</span>
            <span>{t('cust.colMobile')}</span>
            <span className="text-right">{t('common.currentJars')}</span>
            <span className="text-right">{t('common.totalPending')}</span>
            <span />
          </div>
          <div className="divide-y divide-line">
            {list.map((c) => (
              <Link key={c.id} to={`/customers/${c.id}`} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 active:bg-surface-2 ${COLS}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${
                      c.status === 'inactive' ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700'
                    }`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{c.name}</span>
                      {c.status === 'inactive' && <Badge kind="inactive" />}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted lg:hidden">
                      <Phone size={12} aria-hidden="true" /> <span className="tabular-nums">{c.mobile}</span>
                    </div>
                  </div>
                </div>
                <span className="hidden text-sm tabular-nums text-muted lg:block">{c.mobile}</span>
                {/* phone: jars + pending stacked on the right */}
                <div className="shrink-0 text-right text-sm lg:hidden">
                  <div className="inline-flex items-center gap-1 text-muted">
                    <Droplets size={13} className="text-brand-600" aria-hidden="true" />
                    <span className="font-semibold tabular-nums text-ink">{c.current_jars}</span> {t('common.jarsWord')}
                  </div>
                  <div>
                    <PendingText amount={c.pending_amount} />
                  </div>
                </div>
                <span className="hidden text-right tabular-nums lg:block">
                  <span className="font-semibold text-ink">{c.current_jars}</span> <span className="text-muted">{t('common.jarsWord')}</span>
                </span>
                <span className="hidden text-right lg:block">
                  <PendingText amount={c.pending_amount} />
                </span>
                <ChevronRight size={18} className="hidden shrink-0 text-slate-400 lg:block" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <Fab to="/customers/new" label={t('cust.add')} />
    </div>
  );
}
