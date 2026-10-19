import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bell, BookOpen, CalendarDays, ChevronRight, Droplets, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Trash2, Wallet,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import EditEntryModal from '../components/EditEntryModal';
import LedgerTable from '../components/LedgerTable';
import { Badge, Empty, ErrorBox, Loader, PageHeader } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate, money } from '../lib/format';
import { useApi } from '../lib/useApi';
import { messages, openWhatsApp } from '../lib/whatsapp';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { toast, confirm } = useUi();
  const { data, loading, error, reload } = useApi(`/customers/${id}/ledger`);
  const [editing, setEditing] = useState(null);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <Loader />;

  const c = data.customer;
  const rows = [...data.rows].reverse().slice(0, 50);

  const remove = async () => {
    if (!(await confirm({ message: t('cust.deleteConfirm', { name: c.name }) }))) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast(t('cust.deleted'));
      navigate('/customers', { replace: true });
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const actions = [
    { label: t('common.giveJar'), icon: Plus, to: `/entry?type=given&customer=${c.id}`, cls: 'btn-glow text-white shadow-[0_8px_20px_-6px_rgb(29_69_216/0.4)]', iconCls: 'bg-white/18 text-white' },
    { label: t('common.returnJar'), icon: RotateCcw, to: `/entry?type=returned&customer=${c.id}`, cls: 'card card-hover text-ink ring-1 ring-line/80', iconCls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
    { label: t('common.receivePayment'), icon: Wallet, to: `/payments/new?customer=${c.id}`, cls: 'card card-hover text-ink ring-1 ring-line/80', iconCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { label: t('cust.viewLedger'), icon: BookOpen, to: `/customers/${c.id}/ledger`, cls: 'card card-hover text-ink ring-1 ring-line/80', iconCls: 'bg-surface-2 text-slate-700 dark:text-slate-300' },
  ];

  const owes = c.pending_amount > 0;
  const advance = c.pending_amount < 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={c.name}
        subtitle={t('cust.profileSub')}
        back="/customers"
        right={
          <Link to={`/customers/${c.id}/edit`} className="btn-light btn-sm">
            <Pencil size={15} /> {t('common.edit')}
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Left: profile + actions */}
        <div className="space-y-5">
          <section className="card space-y-4 shadow-soft ring-1 ring-line">
            <div className="flex items-start gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-lg font-bold text-brand-700 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300">
                {c.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-lg font-bold leading-tight text-ink">{c.name}</h2>
                  <Badge kind={c.status} />
                </div>
                <div className="mt-1.5 space-y-1 text-sm text-muted">
                  <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 tabular-nums font-medium hover:text-ink">
                    <Phone size={14} className="shrink-0" aria-hidden="true" /> {c.mobile}
                  </a>
                  {c.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> <span className="min-w-0">{c.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs">
                    <CalendarDays size={13} className="shrink-0" aria-hidden="true" /> {t('cust.since', { date: fmtDate(c.created_at) })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-brand-50/80 p-3.5 ring-1 ring-inset ring-brand-500/15 dark:bg-brand-950/40 dark:ring-brand-500/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  <Droplets size={14} aria-hidden="true" /> {t('common.currentJars')}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">{c.current_jars}</div>
              </div>
              <div className={`rounded-2xl p-3.5 ring-1 ring-inset ${owes ? 'bg-red-50/80 ring-red-500/15 dark:bg-red-950/40 dark:ring-red-900/40' : 'bg-emerald-50/80 ring-emerald-500/15 dark:bg-emerald-950/40 dark:ring-emerald-900/40'}`}>
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${owes ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  <Wallet size={14} aria-hidden="true" /> {advance ? t('cust.advance') : t('cust.pendingAmount')}
                </div>
                <div className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${owes ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {money(Math.abs(c.pending_amount))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a href={`tel:${c.mobile}`} className="btn-light btn-sm !py-2.5 font-semibold">
                <Phone size={16} /> {t('cust.call')}
              </a>
              <button className="btn-wa btn-sm !py-2.5 font-semibold" onClick={() => openWhatsApp(c.mobile, `नमस्कार ${c.name},\n\n`)}>
                <MessageCircle size={16} /> WhatsApp
              </button>
              {owes && (
                <button
                  className="btn btn-sm col-span-2 bg-amber-50 !py-2.5 font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/25 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"
                  onClick={() => openWhatsApp(c.mobile, messages.reminder(settings, c))}
                >
                  <Bell size={16} /> {t('cust.sendReminder', { amount: money(c.pending_amount) })}
                </button>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="section-title">{t('cust.quickActions')}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {actions.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[14.5px] font-semibold transition-all duration-150 active:scale-[.98] ${a.cls}`}
                >
                  <span className={`grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl transition-transform duration-150 group-hover:scale-105 ${a.iconCls}`}>
                    <a.icon size={18} />
                  </span>
                  <span className="leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <div className="hidden lg:block">
            <button className="btn-ghost btn-sm w-full !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/30" onClick={remove}>
              <Trash2 size={16} /> {t('cust.delete')}
            </button>
          </div>
        </div>

        {/* Right: history */}
        <section className="card min-w-0 overflow-hidden !p-0">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">{t('cust.history')}</h2>
              <p className="text-xs text-muted">{t('cust.historySub')}</p>
            </div>
            <Link to={`/customers/${c.id}/ledger`} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700 hover:underline">
              {t('cust.fullLedger')} <ChevronRight size={16} />
            </Link>
          </div>
          {rows.length === 0 ? (
            <div className="p-4">
              <Empty icon={BookOpen}>{t('cust.noEntries')}</Empty>
            </div>
          ) : (
            <LedgerTable rows={rows} onEdit={setEditing} flush />
          )}
        </section>
      </div>

      <div className="lg:hidden">
        <button className="btn-ghost btn-sm w-full !text-red-600 hover:!bg-red-50" onClick={remove}>
          <Trash2 size={16} /> {t('cust.delete')}
        </button>
      </div>
      {editing && <EditEntryModal kind={editing.kind} id={editing.id} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
