import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, Droplets, MessageCircle, Phone, Wallet } from 'lucide-react';
import ExportBar from '../../components/ExportBar';
import { Empty, ErrorBox, Loader, PageHeader, PrintHeader } from '../../components/ui';
import { useSettings } from '../../context/SettingsContext';
import { t } from '../../i18n';
import { exportExcel } from '../../lib/export';
import { businessName, fmtDate, money, today } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/useApi';
import { messages, openWhatsApp } from '../../lib/whatsapp';
import ReportFilters from './ReportFilters';

/** कोणाकडून पैसे घ्यायचे आहेत? — customers with pending, biggest first. */
export default function PendingReport() {
  const { settings } = useSettings();
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);
  const { data, loading, error, reload } = useApi('/reports/pending', { customer_id: customerId || undefined, search: q || undefined });
  const rows = data?.customers || [];

  const cols = [
    { label: t('rep.col.customer'), key: 'name' },
    { label: t('rep.col.mobile'), key: 'mobile' },
    { label: t('rep.col.currentJars'), key: 'current_jars' },
    { label: t('rep.col.pending'), key: 'pending_amount' },
    { label: t('rep.pending.lastPayment'), value: (r) => (r.last_payment_date ? fmtDate(r.last_payment_date) : '') },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t('rep.pending.title')} subtitle={t('rep.pending.sub')} back="/reports" />
      <PrintHeader settings={settings} title={t('rep.pending.cardTitle')} subtitle={t('rep.asOn', { date: fmtDate(today()) })} />
      <ReportFilters customerId={customerId} onCustomer={setCustomerId} search={search} onSearch={setSearch} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader />}
      {data && (
        <>
          <ExportBar onExcel={() => exportExcel(`${t('rep.pending.file')}-${today()}`, t('rep.pending.sheet'), cols, rows, [businessName(settings), t('rep.pending.titleLine', { date: fmtDate(today()) }), t('rep.pending.totalLine', { total: data.total })])} />

          <div className="card flex items-center gap-3 !bg-red-50 !ring-red-200">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-100 text-red-600">
              <Clock size={20} />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-red-700">{t('rep.pending.totalPending', { n: rows.length })}</span>
            <span className="shrink-0 text-2xl font-semibold tracking-tight text-red-700 tabular-nums">{money(data.total)}</span>
          </div>

          {rows.length === 0 && (
            <Empty icon={CircleCheck}>{t('rep.pending.empty')}</Empty>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <div key={r.customer_id} className="card space-y-3 !py-3.5">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {(r.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <Link to={`/customers/${r.customer_id}`} className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink hover:text-brand-700">{r.name}</div>
                    <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                      <span className="tabular-nums">{r.mobile}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Droplets size={13} /> {t('rep.pending.jars', { n: r.current_jars })}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{t('rep.pending.lastPaymentLine', { date: r.last_payment_date ? fmtDate(r.last_payment_date) : t('rep.pending.never') })}</div>
                  </Link>
                  <div className="shrink-0 text-lg font-semibold tabular-nums text-red-600">{money(r.pending_amount)}</div>
                </div>
                <div className="no-print flex items-center gap-2 sm:pl-12">
                  <button className="btn-wa btn-sm h-9 min-w-0 flex-1 whitespace-nowrap" onClick={() => openWhatsApp(r.mobile, messages.reminder(settings, r))}>
                    <MessageCircle size={16} className="shrink-0" /> <span className="truncate">{t('rep.pending.remindBtn')}</span>
                  </button>
                  <Link to={`/payments/new?customer=${r.customer_id}`} className="btn-light btn-sm h-9 min-w-0 flex-1 whitespace-nowrap">
                    <Wallet size={16} className="shrink-0" /> <span className="truncate">{t('rep.pending.receiveBtn')}</span>
                  </Link>
                  {r.mobile && (
                    <a href={`tel:${r.mobile}`} className="btn-light btn-sm h-9 w-9 shrink-0 !px-0" aria-label={t('rep.call')}>
                      <Phone size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
