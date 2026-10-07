import { useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, MessageCircle, Pencil, Search, Trash2, Wallet } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import EditEntryModal from '../components/EditEntryModal';
import RangeFilter, { initialRange } from '../components/RangeFilter';
import { Badge, Empty, ErrorBox, Fab, Loader, PageHeader } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate, money } from '../lib/format';
import { useApi, useDebounced } from '../lib/useApi';
import { messages, openWhatsApp } from '../lib/whatsapp';

export default function Payments() {
  const { settings } = useSettings();
  const { toast, confirm } = useUi();
  const [range, setRange] = useState(initialRange('month'));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);
  const [editId, setEditId] = useState(null);
  const { data, loading, error, reload } = useApi('/payments', { from: range.from, to: range.to, search: q, page });
  const list = data?.data || [];
  const total = list.reduce((s, p) => s + p.amount, 0);

  const remove = async (p) => {
    if (!(await confirm({ message: t('payments.confirmDelete', { name: p.customer_name, amount: money(p.amount) }) }))) return;
    try {
      await api.delete(`/payments/${p.id}`);
      toast(t('payments.deleted'));
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('payments.title')} subtitle={t('payments.subtitle')} />

      <div className="space-y-3">
        <RangeFilter
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
        />
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader />}

      {data && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">{t('payments.count', { n: data.total })}</h2>
          {data.last_page === 1 && list.length > 0 && (
            <span className="text-sm text-muted">
              {t('payments.total')} <b className="font-semibold tabular-nums text-emerald-700">{money(total)}</b>
            </span>
          )}
        </div>
      )}
      {data && list.length === 0 && <Empty icon={Wallet}>{t('payments.empty')}</Empty>}

      {list.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((p) => (
            <div key={p.id} className="card flex flex-col gap-3 !p-3.5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {(p.customer_name || '?').charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{p.customer_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{fmtDate(p.payment_date)}</span>
                    <Badge kind={p.payment_mode}>{{ cash: t('entry.modeCash'), upi: 'UPI', bank: t('entry.modeBank') }[p.payment_mode] || p.payment_mode.toUpperCase()}</Badge>
                    {p.is_advance && <Badge kind="advance">{t('entry.advance')}</Badge>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums text-emerald-700">{money(p.amount)}</div>
                  <div className="flex items-center justify-end gap-1 text-xs tabular-nums text-muted">
                    {money(p.previous_pending)} <ArrowRight size={11} /> {money(p.remaining_pending)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <button className="btn-wa btn-sm flex-1" onClick={() => openWhatsApp(p.customer_mobile, messages.payment(settings, p))}>
                  <MessageCircle size={16} /> {t('payments.receiptLbl')}
                </button>
                <button className="icon-btn ring-1 ring-line" onClick={() => setEditId(p.id)} aria-label={t('common.edit')} title={t('common.edit')}>
                  <Pencil size={16} />
                </button>
                <button className="icon-btn text-red-600 ring-1 ring-line hover:bg-red-50 hover:text-red-700" onClick={() => remove(p)} aria-label={t('entry.delete')} title={t('entry.delete')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.last_page > 1 && <Pager page={page} last={data.last_page} onChange={setPage} />}

      <Fab to="/payments/new" label={t('payments.receive')} />
      {editId && <EditEntryModal kind="payment" id={editId} onClose={() => setEditId(null)} onSaved={reload} />}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input !pl-10" type="search" placeholder={t('entry.searchPh')} aria-label={t('entry.searchPh')} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Pager({ page, last, onChange }) {
  return (
    <nav className="flex items-center justify-between gap-3 rounded-xl bg-surface p-1.5 shadow-soft ring-1 ring-line" aria-label={t('entry.pageOf', { page, last })}>
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} /> {t('entry.prevPage')}
      </button>
      <span className="text-sm font-medium tabular-nums text-muted">{t('entry.pageOf', { page, last })}</span>
      <button className="btn-ghost btn-sm" disabled={page >= last} onClick={() => onChange(page + 1)}>
        {t('entry.nextPage')} <ChevronRight size={16} />
      </button>
    </nav>
  );
}
