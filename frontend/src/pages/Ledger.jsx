import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarRange, Clock, Droplets, MessageCircle, Receipt, X } from 'lucide-react';
import ExportBar from '../components/ExportBar';
import EditEntryModal from '../components/EditEntryModal';
import LedgerTable from '../components/LedgerTable';
import { Empty, ErrorBox, Field, Loader, PageHeader, PendingText, PrintHeader, StatCard } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';
import { exportExcel } from '../lib/export';
import { businessName, fmtDate, money } from '../lib/format';
import { useApi } from '../lib/useApi';
import { ledgerText, openWhatsApp } from '../lib/whatsapp';

export default function Ledger() {
  const { id } = useParams();
  const { settings } = useSettings();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, loading, error, reload } = useApi(`/customers/${id}/ledger`, { from: from || undefined, to: to || undefined });
  const [editing, setEditing] = useState(null);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loader />;

  const c = data.customer;
  const rows = data.rows;
  const period = from || to ? `${from ? fmtDate(from) : t('ledger.start')} – ${to ? fmtDate(to) : t('ledger.today')}` : t('ledger.allEntries');

  const excel = () =>
    exportExcel(
      t('ledger.fileName', { name: c.name }),
      t('ledger.sheet'),
      [
        { label: t('ledger.date'), value: (r) => fmtDate(r.entry_date) },
        { label: t('ledger.type'), value: (r) => ({ given: t('ledger.typeGiven'), returned: t('ledger.typeReturned'), payment: t('ledger.typePayment') })[r.entry_type] || r.entry_type },
        { label: t('ledger.given'), key: 'jars_given' },
        { label: t('ledger.returned'), key: 'jars_returned' },
        { label: t('ledger.netJar'), key: 'net_jars' },
        { label: t('ledger.amount'), key: 'amount' },
        { label: t('ledger.paid'), key: 'paid' },
        { label: t('ledger.udhari'), key: 'udhari' },
        { label: t('ledger.balance'), key: 'balance' },
        { label: t('ledger.jarsWithCustomer'), key: 'jar_balance' },
      ],
      rows,
      [businessName(settings), t('ledger.excelTitle', { name: c.name, mobile: c.mobile }), period, t('ledger.excelSummary', { jars: c.current_jars, pending: c.pending_amount })]
    );

  return (
    <div className="space-y-5">
      <PageHeader title={t('ledger.title')} subtitle={`${c.name} · ${c.mobile}`} back />
      <PrintHeader settings={settings} title={t('ledger.printTitle', { name: c.name, mobile: c.mobile })} subtitle={period} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label={t('common.currentJars')} value={c.current_jars} icon={Droplets} tone="blue" />
        <StatCard label={t('common.totalPending')} value={<PendingText amount={c.pending_amount} />} icon={Clock} tone={c.pending_amount > 0 ? 'red' : 'green'} />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label={t('ledger.entriesCount')} value={rows.length} icon={Receipt} tone="slate" sub={period} />
        </div>
      </div>

      <section className="no-print card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <CalendarRange size={18} className="text-muted" aria-hidden="true" /> {t('ledger.period')}
          </h2>
          {(from || to) && (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
            >
              <X size={15} /> {t('ledger.clearDates')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:max-w-lg">
          <Field label={t('ledger.fromDate')}>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('ledger.toDate')}>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </section>

      <ExportBar
        onExcel={excel}
        extra={
          <button className="btn-wa btn-sm shrink-0" onClick={() => openWhatsApp(c.mobile, ledgerText(settings, c, rows))}>
            <MessageCircle size={16} /> {t('ledger.sendWhatsApp')}
          </button>
        }
      />

      <section className="card overflow-hidden !p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">{t('ledger.entries')}</h2>
            <p className="text-xs text-muted">{period}</p>
          </div>
          {from && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-surface-2 px-2 py-1 text-muted ring-1 ring-line">
                {t('ledger.openingBalance')} <b className="font-semibold tabular-nums text-ink">{money(data.opening.balance)}</b>
              </span>
              <span className="rounded-md bg-surface-2 px-2 py-1 text-muted ring-1 ring-line">
                {t('ledger.openingJars')} <b className="font-semibold tabular-nums text-ink">{data.opening.jar_balance}</b>
              </span>
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-4">
            <Loader />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <Empty icon={Receipt}>{t('ledger.noEntries')}</Empty>
          </div>
        ) : (
          <LedgerTable rows={rows} onEdit={setEditing} flush />
        )}
      </section>
      {editing && <EditEntryModal kind={editing.kind} id={editing.id} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
