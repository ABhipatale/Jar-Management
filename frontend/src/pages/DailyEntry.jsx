import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  CalendarClock,
  CheckCircle2,
  CloudOff,
  Droplets,
  MessageCircle,
  NotebookPen,
  Plus,
  Receipt,
  RotateCcw,
  Store,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import api, { errorMessage } from '../api/client';
import CustomerPicker from '../components/CustomerPicker';
import { Field, Icon, PageHeader, Segmented, Stepper } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { useUi } from '../context/UiContext';
import { t } from '../i18n';
import { addDays, fmtDate, money, num, round2, today, uuid } from '../lib/format';
import { submit } from '../lib/outbox';
import { messages, openWhatsApp } from '../lib/whatsapp';

export default function DailyEntry() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const { toast, alert } = useUi();
  const navigate = useNavigate();

  // Problems are shown in a small popup. Stock problems offer a shortcut to add jars.
  const showProblem = async (message) => {
    const stock = /उपलब्ध|स्टॉकमध्ये जार नाहीत|available in the shop|No jars in stock/i.test(message);
    const goAddJars = await alert({
      title: stock ? t('entry.notEnoughJars') : t('entry.cannotSave'),
      icon: stock ? <Droplets size={22} className="text-amber-700" /> : <AlertTriangle size={22} className="text-amber-700" />,
      message,
      actionText: stock ? t('entry.addJars') : undefined,
    });
    if (goAddJars) navigate('/jars');
  };

  const [date, setDate] = useState(today());
  const [customerId, setCustomerId] = useState(params.get('customer') || '');
  const [customer, setCustomer] = useState(null);
  const [type, setType] = useState(params.get('type') === 'returned' ? 'returned' : 'given');
  const [qty, setQty] = useState(params.get('qty') || '1');
  // Delivery of an advance booking (closes the booking when saved).
  const [bookingId, setBookingId] = useState(params.get('booking') || null);
  const [rate, setRate] = useState(settings.default_rate || '');
  const [payType, setPayType] = useState('cash');
  const [paidInput, setPaidInput] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [clientUuid, setClientUuid] = useState(uuid);
  const [busy, setBusy] = useState(false);
  // GIVE only: follow-up reminder (0 = none). Default 15 days.
  const [reminderDays, setReminderDays] = useState(15);
  const [result, setResult] = useState(null);
  // GIVE only: empty jars the customer hands back at the same delivery (optional).
  const [takeBack, setTakeBack] = useState(false);
  const [retQty, setRetQty] = useState('');
  // Jars currently in the shop (null = unknown, e.g. offline). The server checks again on save.
  const [available, setAvailable] = useState(null);

  const loadStock = () =>
    api.get('/jars/summary').then((r) => setAvailable(r.data.available_jars)).catch(() => {});

  useEffect(() => {
    loadStock();
  }, []);

  // Quick-action links (?type=…) switch the type even when already on this screen.
  useEffect(() => {
    const ty = params.get('type');
    if (ty === 'given' || ty === 'returned') setType(ty);
    if (params.get('customer')) setCustomerId(params.get('customer'));
    if (params.get('qty')) setQty(params.get('qty'));
    setBookingId(params.get('booking') || null);
  }, [params]);

  useEffect(() => {
    if (!rate && settings.default_rate) setRate(settings.default_rate);
  }, [settings.default_rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = parseInt(qty, 10) || 0;
  const amount = type === 'given' ? round2(q * num(rate)) : 0;
  const paid = payType === 'cash' ? amount : Math.min(round2(num(paidInput)), amount);
  const udhari = round2(amount - paid);
  const jarsNow = customer?.current_jars ?? 0;
  const r = type === 'given' && takeBack ? parseInt(retQty, 10) || 0 : 0;
  // Empties come back before the full jars go out, so they also free up shop stock.
  const stockForGive = available === null ? null : available + r;
  const jarsAfter = type === 'given' ? jarsNow - r + q : jarsNow - q;

  const openTakeBack = () => {
    setTakeBack(true);
    setRetQty(String(Math.min(q, jarsNow)));
  };

  const problem = useMemo(() => {
    if (!customerId) return t('entry.selectCustomer');
    if (q < 1) return t('entry.qtyMin');
    if (type === 'given' && r > jarsNow) return jarsNow === 0 ? t('entry.noJarsToReturn') : t('entry.onlyWithCustomer', { n: jarsNow, q: r });
    if (type === 'given' && stockForGive !== null && q > stockForGive)
      return stockForGive <= 0 ? t('entry.noneAvailable') : t('entry.onlyAvailable', { n: stockForGive, q });
    if (type === 'returned' && q > jarsNow) return jarsNow === 0 ? t('entry.noJarsToReturn') : t('entry.onlyWithCustomer', { n: jarsNow, q });
    if (type === 'given' && num(paidInput) > amount && payType === 'udhari') return t('entry.paidTooMuch');
    return '';
  }, [customerId, q, r, type, jarsNow, stockForGive, paidInput, amount, payType]);

  const save = async (e) => {
    e.preventDefault();
    if (problem) return showProblem(problem);
    setBusy(true);
    const body = {
      client_uuid: clientUuid,
      customer_id: Number(customerId),
      transaction_date: date,
      transaction_type: type,
      jar_quantity: q,
      notes: notes || null,
      ...(type === 'given' && { rate: num(rate), payment_type: payType, paid_amount: paid, advance_amount: num(advance), return_quantity: r, reminder_days: reminderDays, booking_id: bookingId ? Number(bookingId) : undefined }),
    };
    try {
      const label = r > 0 ? t('entry.outboxGiveReturn', { q, r, name: customer?.name }) : t(type === 'given' ? 'entry.outboxGive' : 'entry.outboxReturn', { q, name: customer?.name });
      const res = await submit('/jar-transactions', body, label);
      if (res.queued) {
        toast(t('entry.queuedToast'), 'info');
        setResult({ queued: true, customer_name: customer?.name, transaction_type: type, jar_quantity: q, returned_quantity: r, reminder_days: type === 'given' ? reminderDays : 0, transaction_date: date });
      } else {
        toast(res.data.message || t('entry.savedOk'));
        setResult({ ...res.data.data, customer_name: customer?.name, customer_mobile: customer?.mobile, reminder_days: type === 'given' ? reminderDays : 0, booking_done: type === 'given' && Boolean(bookingId) });
        setBookingId(null);
        setCustomer((c) => c && { ...c, current_jars: res.data.data.current_jars, pending_amount: res.data.data.pending_amount });
        loadStock();
      }
    } catch (err) {
      showProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const newEntry = (keepCustomer) => {
    setResult(null);
    setQty('1');
    setPaidInput('');
    setAdvance('');
    setNotes('');
    setPayType('cash');
    setTakeBack(false);
    setRetQty('');
    setReminderDays(15);
    setClientUuid(uuid());
    if (!keepCustomer) {
      setCustomerId('');
      setCustomer(null);
    }
  };

  if (result) return <SavedCard result={result} settings={settings} onNew={newEntry} />;

  const isGive = type === 'given';
  const short = isGive && stockForGive !== null && q > stockForGive;

  return (
    <form onSubmit={save} className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('entry.title')} />

      {bookingId && isGive && (
        <Callout tone="violet" icon={CalendarClock}>
          {t('entry.bookingBanner')}
        </Callout>
      )}

      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'given', label: t('entry.giveLbl'), icon: ArrowUpRight, activeClass: 'bg-brand-600 text-white shadow-soft' },
          { value: 'returned', label: t('entry.returnLbl'), icon: ArrowDownLeft, activeClass: 'bg-sky-600 text-white shadow-soft' },
        ]}
      />

      <Section title={t('entry.secCustomer')} icon={Users}>
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Field group label={t('entry.customer')}>
            <CustomerPicker
              value={customerId}
              onChange={(id, c) => {
                setCustomerId(id || '');
                setCustomer(c);
              }}
            />
          </Field>
          <Field label={t('entry.date')}>
            <input type="date" className="input" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {customer && (
          <Field label={t('entry.mobile')}>
            <input className="input tabular-nums" value={customer.mobile} disabled />
          </Field>
        )}
        <Field group label={isGive ? t('entry.howManyGiven') : t('entry.howManyReturned')}>
          <Stepper value={qty} onChange={(v) => setQty(String(v))} min={1} max={type === 'returned' && customer && jarsNow > 0 ? jarsNow : undefined} />
        </Field>

        {isGive && customer && jarsNow > 0 && !takeBack && (
          <button
            type="button"
            onClick={openTakeBack}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2.5 text-left transition hover:border-sky-400 active:scale-[.99]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-sky-700 ring-1 ring-sky-200">
              <RotateCcw size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-sky-800">{t('entry.takeBackQ')}</span>
              <span className="block text-xs text-sky-700">{t('entry.takeBackHint', { n: jarsNow })}</span>
            </span>
            <Plus size={18} className="shrink-0 text-sky-700" />
          </button>
        )}
        {isGive && takeBack && (
          <div className="space-y-3 rounded-lg bg-sky-50 p-3 ring-1 ring-inset ring-sky-200">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800">
                <RotateCcw size={16} /> {t('entry.takeBackLabel')}
              </span>
              <button
                type="button"
                className="btn-ghost btn-sm !px-2 text-muted"
                onClick={() => {
                  setTakeBack(false);
                  setRetQty('');
                }}
              >
                <X size={14} /> {t('entry.takeBackRemove')}
              </button>
            </div>
            <Stepper value={retQty} onChange={(v) => setRetQty(String(v))} min={0} max={jarsNow} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="chip" onClick={() => setRetQty(String(Math.min(q, jarsNow)))}>
                {t('entry.takeBackSame', { n: Math.min(q, jarsNow) })}
              </button>
              <button type="button" className="chip" onClick={() => setRetQty(String(jarsNow))}>
                {t('entry.takeBackAll', { n: jarsNow })}
              </button>
            </div>
            <p className="text-xs text-sky-800">{t('entry.takeBackHint', { n: jarsNow })}</p>
          </div>
        )}

        {(customer || (isGive && stockForGive !== null)) && (
          <div className="space-y-2">
            {customer && (
              <Callout tone={jarsAfter < 0 ? 'red' : 'neutral'} icon={UserRound}>
                {t('entry.currentJars')} <b className="tabular-nums">{jarsNow}</b>
                <ArrowRight size={14} className="mx-1.5 inline opacity-60" />
                {t('entry.afterEntry')} <b className="tabular-nums">{jarsAfter}</b>
              </Callout>
            )}
            {isGive && stockForGive !== null && (
              <Callout tone={short ? 'red' : 'green'} icon={Store}>
                {t('entry.inShop')} <b className="tabular-nums">{stockForGive}</b> {t('entry.jarsWord')}
                {short && (
                  <Link to="/jars" className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                    <Plus size={14} /> {t('entry.addJars')}
                  </Link>
                )}
              </Callout>
            )}
          </div>
        )}
      </Section>

      {isGive && (
        <Section title={t('entry.secBilling')} icon={Receipt}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entry.rate')}>
              <input className="input tabular-nums" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field group label={t('entry.amount')}>
              <div className="input !bg-surface-2 font-semibold tabular-nums">{money(amount)}</div>
            </Field>
          </div>

          <Field group label={t('entry.payType')}>
            <Segmented
              size="sm"
              value={payType}
              onChange={setPayType}
              options={[
                { value: 'cash', label: t('entry.modeCash'), icon: Banknote, activeClass: 'bg-emerald-600 text-white shadow-soft' },
                { value: 'udhari', label: t('entry.udhari'), icon: NotebookPen, activeClass: 'bg-amber-500 text-white shadow-soft' },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('entry.paidAmount')} hint={payType === 'udhari' ? t('entry.partPaid') : t('entry.fullPaid')}>
              <input
                className="input tabular-nums"
                inputMode="decimal"
                disabled={payType === 'cash'}
                value={payType === 'cash' ? amount : paidInput}
                placeholder="0"
                onChange={(e) => setPaidInput(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </Field>
            <Field group label={t('entry.udhariAuto')}>
              <div className={`input font-semibold tabular-nums ${udhari > 0 ? '!border-amber-300 !bg-amber-50 text-amber-800' : '!bg-surface-2'}`}>{money(udhari)}</div>
            </Field>
          </div>

          <Field label={t('entry.advanceMoney')} hint={t('entry.advanceHint')}>
            <input className="input tabular-nums" inputMode="decimal" value={advance} placeholder="0" onChange={(e) => setAdvance(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
        </Section>
      )}

      {isGive && (
        <Section title={t('entry.secReminder')} icon={Bell}>
          <div className="flex flex-wrap gap-2">
            {[
              [0, t('entry.reminderNone')],
              [1, t('entry.reminder1')],
              [7, t('entry.reminder7')],
              [15, t('entry.reminder15')],
            ].map(([d, label]) => (
              <button key={d} type="button" className={`chip ${reminderDays === d ? 'chip-active' : ''}`} onClick={() => setReminderDays(d)}>
                {label}
              </button>
            ))}
          </div>
          {reminderDays > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <CalendarClock size={14} className="shrink-0" />
              {t('entry.reminderHint', { date: fmtDate(addDays(date, reminderDays)) })}
            </p>
          )}
        </Section>
      )}

      <Section title={t('entry.notes')} icon={NotebookPen}>
        <input className="input" aria-label={t('entry.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={t('entry.optional')} />
      </Section>

      <div className="no-print sticky-above-nav sticky z-20">
        <button className={`${isGive ? 'btn-primary' : 'btn bg-sky-600 text-white hover:bg-sky-700'} w-full py-4 text-base shadow-pop ring-4 ring-app`} disabled={busy}>
          {!busy && <CheckCircle2 size={20} />}
          {busy ? t('entry.saving') : r > 0 ? t('entry.saveGiveReturn', { q, r }) : t(isGive ? 'entry.saveGive' : 'entry.saveReturn', { q })}
        </button>
      </div>
    </form>
  );
}

const CALLOUT_TONES = {
  neutral: 'bg-surface-2 text-slate-700 ring-line',
  red: 'bg-red-50 text-red-700 ring-red-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
};

/** Subtle inline info line with an icon. */
function Callout({ tone = 'neutral', icon, children }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset ${CALLOUT_TONES[tone]}`}>
      <Icon icon={icon} size={16} className="mt-0.5 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

/** Form card with a small uppercase section title. */
function Section({ title, icon, children }) {
  return (
    <section className="card space-y-4">
      <h2 className="section-title flex items-center gap-2">
        <Icon icon={icon} size={15} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function SavedCard({ result, settings, onNew }) {
  const isGive = result.transaction_type === 'given';

  const sendWa = () => {
    const text = isGive ? messages.delivery(settings, result) : messages.returned(settings, result);
    openWhatsApp(result.customer_mobile, text);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card animate-pop-in overflow-hidden !p-0">
        <div className={`flex items-center gap-3 px-4 py-4 ${result.queued ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface ring-1 ${result.queued ? 'text-amber-700 ring-amber-200' : 'text-emerald-700 ring-emerald-200'}`}>
            {result.queued ? <CloudOff size={22} /> : <CheckCircle2 size={22} />}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">{result.queued ? t('entry.savedOnPhone') : t('entry.savedOk')}</h1>
            <p className="truncate text-sm text-muted">
              {result.customer_name} · {fmtDate(result.transaction_date)}
            </p>
            {result.queued && <p className="text-sm text-amber-800">{t('entry.willSync')}</p>}
          </div>
        </div>

        <dl className="divide-y divide-line px-4 text-sm">
          <Row label={t('entry.customer')} value={result.customer_name} />
          <Row label={isGive ? t('entry.given') : t('entry.returned')} value={t('entry.jarsN', { n: result.jar_quantity })} />
          {isGive && result.returned_quantity > 0 && <Row label={t('entry.takenBack')} value={t('entry.jarsN', { n: result.returned_quantity })} />}
          {result.booking_done && <Row label={t('book.title')} value={t('book.deliveredRow')} />}
          {isGive && result.reminder_days > 0 && (
            <Row
              label={t('entry.reminderRow')}
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Bell size={14} className="text-muted" /> {fmtDate(addDays(result.transaction_date, result.reminder_days))}
                </span>
              }
            />
          )}
          {!result.queued && isGive && (
            <>
              <Row label={t('entry.rateShort')} value={money(result.rate)} />
              <Row label={t('entry.total')} value={money(result.amount)} />
              <Row label={t('entry.paid')} value={<span className="text-emerald-700">{money(result.paid_amount + result.advance_amount)}</span>} />
              <Row label={t('entry.udhari')} value={<span className={result.udhari_amount > 0 ? 'text-amber-800' : ''}>{money(result.udhari_amount)}</span>} />
            </>
          )}
        </dl>

        {!result.queued && (
          <div className="grid grid-cols-2 gap-3 border-t border-line bg-surface-2 p-4">
            <Tile icon={Droplets} label={t('entry.currentJarsRow')} value={result.current_jars} />
            <Tile icon={Wallet} label={t('entry.totalPending')} value={money(result.pending_amount)} danger={result.pending_amount > 0} />
          </div>
        )}
      </div>

      {!result.queued && (
        <button className="btn-wa w-full py-3.5 text-base" onClick={sendWa}>
          <MessageCircle size={20} /> {t('entry.sendWaLbl')}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => onNew(false)}>
          <Plus size={18} /> {t('entry.newEntry')}
        </button>
        <button className="btn-light" onClick={() => onNew(true)}>
          <UserRound size={18} /> {t('entry.sameCustomer')}
        </button>
      </div>
      {!result.queued && (
        <Link to={`/payments/new?customer=${result.customer_id}`} className="btn-light w-full">
          <Wallet size={18} /> {t('entry.receivePayLbl')}
        </Link>
      )}
    </div>
  );
}

function Tile({ icon, label, value, danger }) {
  return (
    <div className="rounded-lg bg-surface p-3 ring-1 ring-line">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon icon={icon} size={14} /> {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${danger ? 'text-red-600' : 'text-ink'}`}>{value}</div>
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

