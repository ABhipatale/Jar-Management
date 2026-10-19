import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, MessageCircle, Pencil, Phone, Plus, StickyNote, Truck, User, X, XCircle } from 'lucide-react';
import api, { errorMessage } from '../api/client';
import CustomerPicker from '../components/CustomerPicker';
import { Empty, ErrorBox, Field, Loader, Modal, PageHeader, Stepper } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { addDays, fmtDate, fmtLongDate, today } from '../lib/format';
import { refreshBell } from '../lib/push';
import { useApi } from '../lib/useApi';
import { messages, openWhatsApp } from '../lib/whatsapp';

/**
 * Advance jar bookings: "10 jars on 08-10-2026".
 * The owner gets a phone notification the night before (~8 PM) and that morning (~7 AM).
 * "Deliver" opens the normal Give Jar screen pre-filled; saving it closes the booking.
 */
export default function Bookings() {
  const { settings } = useSettings();
  const { toast, confirm, alert } = useUi();
  const { data, loading, error, reload } = useApi('/bookings');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const tomorrow = addDays(today(), 1);
  const groups = groupByDate(data?.open || []);

  const cancel = async (b) => {
    if (!(await confirm({ message: t('book.cancelConfirm', { name: b.customer_name, n: b.jar_quantity, date: fmtDate(b.delivery_date) }), confirmText: t('book.cancelYes') }))) return;
    try {
      await api.post(`/bookings/${b.id}/cancel`);
      toast(t('book.cancelled'));
      reload();
      refreshBell();
    } catch (err) {
      alert({ message: errorMessage(err) });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('book.title')}
        subtitle={t('book.subtitle')}
        back
        right={
          <button className="btn-primary btn-sm hidden sm:inline-flex" onClick={() => setShowForm(true)}>
            <Plus size={16} /> {t('book.ui.new')}
          </button>
        }
      />

      <button className="btn-primary w-full py-3.5 sm:hidden" onClick={() => setShowForm(true)}>
        <Plus size={20} /> {t('book.ui.new')}
      </button>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Loader />}

      {data && data.open.length === 0 && (
        <Empty
          icon={CalendarClock}
          title={t('book.none')}
          action={
            <button className="btn-light btn-sm" onClick={() => setShowForm(true)}>
              <Plus size={16} /> {t('book.ui.new')}
            </button>
          }
        >
          {t('book.ui.emptyHint')}
        </Empty>
      )}

      {groups.map(([date, items]) => {
        const late = date < today();
        const isToday = date === today();
        const label = late ? t('book.ui.overdue') : isToday ? t('book.today') : date === tomorrow ? t('book.tomorrow') : fmtLongDate(date);
        const jars = items.reduce((s, b) => s + b.jar_quantity, 0);
        return (
          <section key={date} className="space-y-3">
            <h2 className={`section-title flex items-center justify-between gap-2 ${late ? '!text-red-600' : isToday ? '!text-amber-700' : ''}`}>
              <span className="flex min-w-0 items-center gap-1.5">
                {late ? <AlertTriangle size={15} /> : <CalendarDays size={15} />}
                <span className="truncate">
                  {label} {!late && !isToday && date !== tomorrow ? '' : `· ${fmtDate(date)}`}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-muted ring-1 ring-line tabular-nums">
                {t('book.dayTotal', { n: items.length, jars })}
              </span>
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((b) => (
                <div key={b.id} className={`card !py-4 shadow-soft ring-1 ${late ? '!ring-red-400/50 bg-red-50/15 dark:bg-red-950/20' : isToday ? '!ring-amber-400/50 bg-amber-50/15 dark:bg-amber-950/20' : 'ring-line'}`}>
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-500/15 dark:bg-brand-500/15 dark:text-brand-300">
                      {(b.customer_name || '?').charAt(0).toUpperCase()}
                    </span>
                    <Link to={`/customers/${b.customer_id}`} className="min-w-0 flex-1">
                      <div className="truncate font-bold text-ink hover:text-brand-700 dark:hover:text-brand-400">{b.customer_name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <CalendarClock size={12} /> {fmtDate(b.delivery_date)}
                        </span>
                        {b.customer_mobile && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 tabular-nums font-medium">
                              <Phone size={12} /> {b.customer_mobile}
                            </span>
                          </>
                        )}
                      </div>
                      {b.notes && (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-surface-2/60 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                          <StickyNote size={13} className="mt-0.5 shrink-0 text-slate-400" /> <span className="min-w-0">{b.notes}</span>
                        </div>
                      )}
                    </Link>
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-bold leading-none tracking-tight text-brand-700 dark:text-brand-400 tabular-nums">{b.jar_quantity}</div>
                      <div className="mt-1 text-xs font-semibold text-muted">{t('book.jars')}</div>
                    </div>
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
                    <button className="btn-light btn-sm text-red-600 font-semibold hover:!bg-red-50 dark:hover:!bg-red-950/30" onClick={() => cancel(b)}>
                      <X size={15} /> {t('book.ui.cancel')}
                    </button>
                    <button className="icon-btn" onClick={() => setEditing(b)} aria-label={t('book.edit')} title={t('book.edit')}>
                      <Pencil size={17} />
                    </button>
                    <button className="btn-wa btn-sm !px-2.5" onClick={() => openWhatsApp(b.customer_mobile, messages.booking(settings, b))} aria-label="WhatsApp" title="WhatsApp">
                      <MessageCircle size={16} />
                    </button>
                    {date <= today() && (
                      <Link to={`/entry?type=given&customer=${b.customer_id}&qty=${b.jar_quantity}&booking=${b.id}`} className="btn-primary btn-sm font-semibold shadow-xs">
                        <Truck size={16} /> {t('book.ui.deliver')}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {data && data.closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">{t('book.closed')}</h2>
          <div className="card divide-y divide-line overflow-hidden !p-0 shadow-soft ring-1 ring-line">
            {data.closed.map((b) => (
              <div key={b.id} className="flex items-center gap-3.5 px-4.5 py-3 transition-colors hover:bg-surface-2/60">
                <span className={`grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl ${b.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-surface-2 text-slate-500'}`}>
                  {b.status === 'delivered' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{b.customer_name}</span>
                  <span className="block text-xs text-muted tabular-nums">
                    {b.jar_quantity} {t('book.jars')} · {fmtDate(b.delivery_date)}
                  </span>
                </span>
                <span className={`shrink-0 text-xs font-bold ${b.status === 'delivered' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {b.status === 'delivered' ? t('book.ui.delivered') : t('book.cancelledLabel')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(showForm || editing) && (
        <BookingForm
          booking={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={(saved, isNew) => {
            setShowForm(false);
            setEditing(null);
            reload();
            refreshBell();
            if (isNew) {
              confirm({ title: t('book.savedTitle'), message: t('book.sendConfirmQ'), confirmText: t('book.sendWa'), danger: false }).then((yes) => {
                if (yes) openWhatsApp(saved.customer_mobile, messages.booking(settings, saved));
              });
            }
          }}
        />
      )}
    </div>
  );
}

function groupByDate(list) {
  const map = new Map();
  for (const b of list) {
    const key = b.delivery_date < today() ? '0000-overdue' : b.delivery_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k === '0000-overdue' ? v[0].delivery_date : k, v]);
}

function BookingForm({ booking, onClose, onSaved }) {
  const { alert } = useUi();
  const editing = Boolean(booking);
  const [customerId, setCustomerId] = useState(booking?.customer_id || '');
  const [customer, setCustomer] = useState(null);
  const [date, setDate] = useState(booking?.delivery_date || addDays(today(), 1));
  const [qty, setQty] = useState(String(booking?.jar_quantity || 10));
  const [notes, setNotes] = useState(booking?.notes || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing && !customerId) return alert({ message: t('book.selectCustomer') });
    if (!(parseInt(qty, 10) > 0)) return alert({ message: t('book.qtyMin') });
    setBusy(true);
    try {
      const body = { delivery_date: date, jar_quantity: parseInt(qty, 10), notes: notes || null };
      const { data } = editing ? await api.put(`/bookings/${booking.id}`, body) : await api.post('/bookings', { ...body, customer_id: Number(customerId) });
      const saved = { ...booking, ...data.data, customer_name: editing ? booking.customer_name : customer?.name, customer_mobile: editing ? booking.customer_mobile : customer?.mobile };
      onSaved(saved, !editing);
    } catch (err) {
      alert({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? t('book.editTitle') : t('book.ui.new')} onClose={onClose}>
      <div className="space-y-4">
        {editing ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 font-semibold text-ink ring-1 ring-line">
            <User size={17} className="text-muted" /> {booking.customer_name}
          </div>
        ) : (
          <Field group label={t('book.customer')}>
            <CustomerPicker value={customerId} onChange={(id, c) => { setCustomerId(id || ''); setCustomer(c); }} />
          </Field>
        )}
        <Field label={t('book.date')} hint={t('book.dateHint')}>
          <input type="date" className="input" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field group label={t('book.qty')}>
          <Stepper value={qty} onChange={(v) => setQty(String(v))} min={1} />
        </Field>
        <Field label={t('book.notes')}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={t('book.notesPh')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-light" onClick={onClose}>{t('book.close')}</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            <CalendarClock size={18} /> {busy ? t('book.saving') : t('book.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
