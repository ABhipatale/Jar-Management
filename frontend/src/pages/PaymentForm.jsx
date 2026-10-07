import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, Banknote, CheckCircle2, CloudOff, Landmark, List, MessageCircle, PiggyBank, Plus, Smartphone, Wallet } from 'lucide-react';
import { errorMessage } from '../api/client';
import CustomerPicker from '../components/CustomerPicker';
import { Field, Icon, PageHeader, Segmented } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { fmtDate, money, num, round2, today, uuid } from '../lib/format';
import { submit } from '../lib/outbox';
import { messages, openWhatsApp } from '../lib/whatsapp';

export default function PaymentForm() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const { toast } = useUi();

  const [customerId, setCustomerId] = useState(params.get('customer') || '');
  const [customer, setCustomer] = useState(null);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [isAdvance, setIsAdvance] = useState(false);
  const [notes, setNotes] = useState('');
  const [clientUuid, setClientUuid] = useState(uuid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const previous = round2(customer?.pending_amount ?? 0);
  const paid = round2(num(amount));
  const remaining = round2(previous - paid);
  const overPaying = paid > Math.max(previous, 0);

  const save = async (e) => {
    e.preventDefault();
    if (!customerId) return setError(t('entry.selectCustomer'));
    if (!(paid > 0)) return setError(t('pay.enterAmount'));
    if (overPaying && !isAdvance) return setError(t('pay.overPending', { amount: money(Math.max(previous, 0)) }));
    setBusy(true);
    setError('');
    try {
      const res = await submit(
        '/payments',
        { client_uuid: clientUuid, customer_id: Number(customerId), payment_date: date, amount: paid, payment_mode: mode, is_advance: isAdvance, notes: notes || null },
        t('pay.outbox', { amount: money(paid), name: customer?.name })
      );
      if (res.queued) {
        toast(t('pay.queuedToast'), 'info');
        setResult({ queued: true, customer_name: customer?.name, amount: paid });
      } else {
        toast(res.data.message || t('pay.receivedOk'));
        setResult(res.data.data);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card animate-pop-in overflow-hidden !p-0">
          <div className={`flex items-center gap-3 px-4 py-4 ${result.queued ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface ring-1 ${result.queued ? 'text-amber-700 ring-amber-200' : 'text-emerald-700 ring-emerald-200'}`}>
              {result.queued ? <CloudOff size={22} /> : <CheckCircle2 size={22} />}
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-ink">{result.queued ? t('pay.savedOnPhone') : t('pay.receivedOk')}</h1>
              <p className="truncate text-sm text-muted">{result.customer_name}</p>
            </div>
            <div className="ml-auto text-right text-xl font-semibold tabular-nums text-emerald-700">{money(result.amount)}</div>
          </div>
          <dl className="divide-y divide-line px-4 text-sm">
            <Row label={t('entry.customer')} value={result.customer_name} />
            {!result.queued && <Row label={t('entry.date')} value={fmtDate(result.payment_date)} />}
            <Row label={t('entry.paid')} value={<span className="text-emerald-700">{money(result.amount)}</span>} />
          </dl>
          {!result.queued && (
            <div className="grid grid-cols-2 gap-3 border-t border-line bg-surface-2 p-4">
              <Tile icon={Wallet} label={t('pay.previousPending')} value={money(result.previous_pending)} />
              <Tile icon={PiggyBank} label={t('pay.remainingPending')} value={money(result.remaining_pending)} tone={result.remaining_pending > 0 ? 'red' : 'green'} />
            </div>
          )}
        </div>
        {!result.queued && (
          <button className="btn-wa w-full py-3.5 text-base" onClick={() => openWhatsApp(result.customer_mobile, messages.payment(settings, result))}>
            <MessageCircle size={20} /> {t('pay.sendReceiptLbl')}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-primary"
            onClick={() => {
              setResult(null);
              setAmount('');
              setNotes('');
              setIsAdvance(false);
              setCustomerId('');
              setCustomer(null);
              setClientUuid(uuid());
            }}
          >
            <Plus size={18} /> {t('pay.newPayment')}
          </button>
          <Link to="/payments" className="btn-light">
            <List size={18} /> {t('pay.allPayments')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('pay.title')} subtitle={t('pay.subtitle')} back />

      <section className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Field group label={t('entry.customer')}>
            <CustomerPicker
              value={customerId}
              includeInactive
              onChange={(id, c) => {
                setCustomerId(id || '');
                setCustomer(c);
              }}
            />
          </Field>
          <Field label={t('pay.date')}>
            <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile
            icon={Wallet}
            label={t('pay.previousPending')}
            value={previous < 0 ? t('pay.advanceAmt', { amount: money(-previous) }) : money(previous)}
            tone={previous > 0 ? 'red' : previous < 0 ? 'green' : 'neutral'}
          />
          <Tile
            icon={PiggyBank}
            label={t('pay.remainingPending')}
            value={remaining < 0 ? t('pay.advanceAmt', { amount: money(-remaining) }) : money(remaining)}
            tone={remaining > 0 ? 'amber' : 'green'}
          />
        </div>
      </section>

      <section className="card space-y-4">
        <Field label={t('pay.paidAmount')}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-xl font-semibold text-muted">₹</span>
            <input
              className="input !pl-9 text-2xl font-semibold tabular-nums"
              inputMode="decimal"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </div>
        </Field>
        {previous > 0 && (
          <button type="button" className="chip" onClick={() => setAmount(String(previous))}>
            <ArrowDownLeft size={14} /> {t('pay.fullPending', { amount: money(previous) })}
          </button>
        )}
        <Field group label={t('pay.mode')}>
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'cash', label: t('entry.modeCash'), icon: Banknote },
              { value: 'upi', label: 'UPI', icon: Smartphone },
              { value: 'bank', label: t('entry.modeBank'), icon: Landmark },
            ]}
          />
        </Field>
        {overPaying && paid > 0 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-800 ring-1 ring-inset ring-teal-600/20">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-700" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
            <span className="leading-relaxed">
              <b className="font-semibold">{t('pay.advancePayment')}</b> {t('pay.advanceNote', { amount: money(paid - Math.max(previous, 0)) })}
            </span>
          </label>
        )}
        <Field label={t('entry.notes')}>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={t('entry.optional')} />
        </Field>
      </section>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-200" role="alert">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="no-print sticky-above-nav sticky z-20">
        <button className="btn w-full bg-emerald-600 py-4 text-base text-white shadow-pop ring-4 ring-app hover:bg-emerald-700" disabled={busy}>
          {!busy && <CheckCircle2 size={20} />}
          {busy ? t('entry.saving') : t('pay.save', { amount: paid > 0 ? money(paid) : '' }).trim()}
        </button>
      </div>
    </form>
  );
}

const TILE_TONES = {
  neutral: 'text-ink',
  red: 'text-red-600',
  amber: 'text-amber-800',
  green: 'text-emerald-700',
};

function Tile({ icon, label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3 ring-1 ring-inset ring-line">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon icon={icon} size={14} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-1 truncate text-lg font-semibold tabular-nums ${TILE_TONES[tone]}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
