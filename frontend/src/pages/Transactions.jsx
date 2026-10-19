import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Droplets, Pencil, Search, StickyNote, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import EditEntryModal from '../components/EditEntryModal';
import RangeFilter, { initialRange } from '../components/RangeFilter';
import { Badge, Empty, ErrorBox, Fab, Loader, PageHeader } from '../components/ui';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate, money } from '../lib/format';
import { useApi, useDebounced } from '../lib/useApi';

/** Search jar entries by customer, date and type; delete with confirmation. */
export default function Transactions() {
  const { toast, confirm } = useUi();
  const [range, setRange] = useState(initialRange('week'));
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const [editId, setEditId] = useState(null);
  const { data, loading, error, reload } = useApi('/jar-transactions', { from: range.from, to: range.to, type: type || undefined, search: q, page });
  const list = data?.data || [];

  const remove = async (tx) => {
    const what = t(tx.transaction_type === 'given' ? 'tx.whatGiven' : 'tx.whatReturned', { n: tx.jar_quantity, name: tx.customer_name, date: fmtDate(tx.transaction_date) });
    if (!(await confirm({ message: t('tx.confirmDelete', { what }) }))) return;
    try {
      await api.delete(`/jar-transactions/${tx.id}`);
      toast(t('tx.deleted'));
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('tx.title')} back />

      <div className="space-y-3">
        <RangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input !pl-10"
              type="search"
              placeholder={t('entry.searchPh')}
              aria-label={t('entry.searchPh')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            {[
              ['', t('tx.all'), null],
              ['given', t('entry.given'), ArrowUpRight],
              ['returned', t('entry.returned'), ArrowDownLeft],
            ].map(([k, l, I]) => (
              <button
                key={k}
                className={`chip ${type === k ? 'chip-active' : ''}`}
                onClick={() => {
                  setType(k);
                  setPage(1);
                }}
              >
                {I && <I size={14} />}
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader />}
      {data && list.length === 0 && <Empty icon={Droplets}>{t('tx.empty')}</Empty>}

      {list.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((tx) => {
            const give = tx.transaction_type === 'given';
            return (
              <div key={tx.id} className="card flex flex-col gap-3 !p-4 shadow-soft ring-1 ring-line">
                <div className="flex items-start gap-3.5">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ring-1 ${give ? 'bg-brand-50 text-brand-700 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-sky-50 text-sky-700 ring-sky-500/15 dark:bg-sky-950/40 dark:text-sky-300'}`}>
                    {give ? <ArrowUpRight size={18} strokeWidth={2.5} /> : <ArrowDownLeft size={18} strokeWidth={2.5} />}
                  </span>
                  <Link to={`/customers/${tx.customer_id}`} className="min-w-0 flex-1 hover:underline">
                    <div className="truncate font-semibold text-ink">{tx.customer_name}</div>
                    <div className="mt-0.5 text-xs text-muted font-medium">{fmtDate(tx.transaction_date)}</div>
                  </Link>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums text-ink">{t('entry.jarsN', { n: tx.jar_quantity })}</div>
                    <Badge kind={tx.transaction_type} />
                  </div>
                </div>
                {give && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-surface-2/80 px-3.5 py-2.5 text-xs font-semibold">
                    <span className="tabular-nums text-ink">
                      {money(tx.amount)} <span className="text-muted font-normal">@ {money(tx.rate)}</span>
                    </span>
                    <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                      {t('entry.paid')} {money(tx.paid_amount + tx.advance_amount)}
                    </span>
                    <span className="ml-auto">
                      {tx.udhari_amount > 0 ? (
                        <Badge kind="udhari">
                          {t('entry.udhari')} {money(tx.udhari_amount)}
                        </Badge>
                      ) : (
                        <Badge kind="cash" />
                      )}
                    </span>
                  </div>
                )}
                {tx.notes && (
                  <p className="flex items-start gap-1.5 text-xs text-muted">
                    <StickyNote size={14} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{tx.notes}</span>
                  </p>
                )}
                <div className="flex justify-end gap-2 border-t border-line pt-3">
                  <button className="btn-light btn-sm font-semibold" onClick={() => setEditId(tx.id)}>
                    <Pencil size={15} /> {t('common.edit')}
                  </button>
                  <button className="btn-light btn-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => remove(tx)}>
                    <Trash2 size={15} /> {t('entry.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.last_page > 1 && (
        <nav className="flex items-center justify-between gap-3 rounded-xl bg-surface p-1.5 shadow-soft ring-1 ring-line" aria-label={t('entry.pageOf', { page, last: data.last_page })}>
          <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} /> {t('entry.prevPage')}
          </button>
          <span className="text-sm font-medium tabular-nums text-muted">{t('entry.pageOf', { page, last: data.last_page })}</span>
          <button className="btn-ghost btn-sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>
            {t('entry.nextPage')} <ChevronRight size={16} />
          </button>
        </nav>
      )}

      <Fab to="/entry" label={t('tx.newEntry')} />
      {editId && <EditEntryModal kind="jar" id={editId} onClose={() => setEditId(null)} onSaved={reload} />}
    </div>
  );
}
