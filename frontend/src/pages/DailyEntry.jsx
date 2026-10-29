import { useEffect, useState } from 'react';
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
  Landmark,
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
import {
  BOTTLE, JAR, companyProducts, countText, customerProducts, depositHeldOf, depositRate, features, heldOf, productName, rateFor, suggestedDeposit, usesDeposit,
} from '../lib/products';
import { messages, openWhatsApp } from '../lib/whatsapp';

/** Jar or bottle wording of the entry screen's texts. */
const TXT = {
  [JAR]: {
    given: 'entry.howManyGiven', returned: 'entry.howManyReturned', rate: 'entry.rate',
    takeBackQ: 'entry.takeBackQ', takeBackHint: 'entry.takeBackHint', takeBackLabel: 'entry.takeBackLabel',
    noneToReturn: 'entry.noJarsToReturn', onlyWith: 'entry.onlyWithCustomer', noneAvailable: 'entry.noneAvailable', onlyAvailable: 'entry.onlyAvailable',
    word: 'entry.jarsWord', add: 'entry.addJars',
  },
  [BOTTLE]: {
    given: 'prod.bottleGiven', returned: 'prod.bottleReturned', rate: 'prod.bottleRate',
    takeBackQ: 'prod.bottleTakeBackQ', takeBackHint: 'prod.bottleTakeBackHint', takeBackLabel: 'prod.bottleTakeBackLabel',
    noneToReturn: 'prod.noBottlesToReturn', onlyWith: 'prod.onlyBottlesWithCustomer', noneAvailable: 'prod.noneBottlesAvailable', onlyAvailable: 'prod.onlyBottlesAvailable',
    word: 'prod.bottlesWord', add: 'prod.addBottles',
  },
};
const tx = (p, key, vars) => t(TXT[p][key], vars);
const byProduct = (jar, bottle) => ({ [JAR]: jar, [BOTTLE]: bottle });

export default function DailyEntry() {
  const [params] = useSearchParams();
  const { settings } = useSettings();
  const { toast, alert } = useUi();
  const navigate = useNavigate();
  const feat = features(settings);

  // Problems are shown in a small popup. Stock problems offer a shortcut to add jars.
  const showProblem = async (message) => {
    const stock = /उपलब्ध|स्टॉकमध्ये (जार|बाटल्या) नाहीत|available in the shop|No (jars|bottles) in stock/i.test(message);
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
  // Per product (jar / bottle). With bottles off only the jar values are used.
  const [qty, setQty] = useState(() => byProduct(params.get('qty') || '1', params.get('bqty') || '0'));
  // Delivery of an advance booking (closes the booking when saved).
  const [bookingId, setBookingId] = useState(params.get('booking') || null);
  const [rates, setRates] = useState(() => byProduct(String(settings.default_rate || ''), String(settings.bottle_rate || '')));
  const [payType, setPayType] = useState('cash');
  const [paidInput, setPaidInput] = useState('');
  const [advance, setAdvance] = useState('');
  const [notes, setNotes] = useState('');
  const [clientUuid, setClientUuid] = useState(uuid);
  const [busy, setBusy] = useState(false);
  // GIVE only: follow-up reminder (0 = none). Default 15 days.
  const [reminderDays, setReminderDays] = useState(15);
  const [result, setResult] = useState(null);
  // GIVE only: empties the customer hands back at the same delivery (optional).
  const [takeBack, setTakeBack] = useState(() => byProduct(false, false));
  const [ret, setRet] = useState(() => byProduct('', ''));
  // Deposit typed by hand (null = use the suggested amount).
  const [dep, setDep] = useState(() => byProduct(null, null));
  // Items added just for this entry ("+ Bottle", or a booking with bottles) though the
  // customer isn't set up for them.
  const bookingBottles = parseInt(params.get('bqty'), 10) || 0;
  const [extra, setExtra] = useState(() => (bookingBottles > 0 ? [BOTTLE] : []));
  // Items currently in the shop (null = unknown, e.g. offline). The server checks again on save.
  const [stock, setStock] = useState(() => byProduct(null, null));

  const loadStock = () =>
    api
      .get('/jars/summary')
      .then((r) => {
        const all = r.data.by_product || { [JAR]: r.data };
        setStock(byProduct(all[JAR]?.available_jars ?? null, all[BOTTLE]?.available_jars ?? null));
      })
      .catch(() => {});

  useEffect(() => {
    loadStock();
  }, []);

  // Quick-action links (?type=…) switch the type even when already on this screen.
  useEffect(() => {
    const ty = params.get('type');
    if (ty === 'given' || ty === 'returned') setType(ty);
    if (params.get('customer')) setCustomerId(params.get('customer'));
    if (params.get('qty')) setQty((q) => ({ ...q, [JAR]: params.get('qty') }));
    if (params.get('bqty')) {
      setQty((q) => ({ ...q, [BOTTLE]: params.get('bqty') }));
      setExtra((x) => (x.includes(BOTTLE) ? x : [...x, BOTTLE]));
    }
    setBookingId(params.get('booking') || null);
  }, [params]);

  useEffect(() => {
    setRates((r) => ({
      [JAR]: r[JAR] || String(settings.default_rate || ''),
      [BOTTLE]: r[BOTTLE] || String(settings.bottle_rate || ''),
    }));
  }, [settings.default_rate, settings.bottle_rate]);

  // A customer was chosen: their special rates, and 1 of the only item they take.
  // The picker also re-sends the same customer silently with fresh balances: keep what was typed.
  const pickCustomer = (id, c, opts) => {
    if (opts?.silent && c && customer?.id === c.id) {
      setCustomer(c);
      return;
    }
    setCustomerId(id || '');
    setCustomer(c);
    setDep(byProduct(null, null));
    // A booking's bottles stay on the delivery even if the customer doesn't usually take bottles.
    setExtra(bookingId && bookingBottles > 0 ? [BOTTLE] : []);
    if (!c) return;
    setRates(byProduct(rateFor(c, settings, JAR), rateFor(c, settings, BOTTLE)));
    const theirs = customerProducts(c, settings);
    // Booking deliveries keep the booked quantities.
    if (theirs.length === 1 && !bookingId) setQty((q) => ({ ...q, [theirs[0]]: q[theirs[0]] && q[theirs[0]] !== '0' ? q[theirs[0]] : '1' }));
  };

  const isGive = type === 'given';
  const theirs = customerProducts(customer, settings);
  const sold = companyProducts(settings);
  const items = sold.filter((p) => theirs.includes(p) || extra.includes(p));
  // Items the company sells that this customer doesn't usually take: offered as "+ Bottle".
  const addable = customer ? sold.filter((p) => !items.includes(p)) : [];
  const single = items.length === 1;
  const legacy = !feat.bottles && !feat.deposit; // exactly the old screen and request
  const withDeposit = Boolean(customer) && usesDeposit(settings, customer);

  const nOf = (p) => parseInt(qty[p], 10) || 0;
  const rOf = (p) => (isGive && takeBack[p] ? parseInt(ret[p], 10) || 0 : 0);
  const heldNow = (p) => heldOf(customer, p);
  const heldAfter = (p) => (isGive ? heldNow(p) - rOf(p) + nOf(p) : heldNow(p) - nOf(p));
  // Empties come back before the full ones go out, so they also free up shop stock.
  const stockFor = (p) => (stock[p] === null || stock[p] === undefined ? null : stock[p] + rOf(p));
  const lineAmount = (p) => (isGive ? round2(nOf(p) * num(rates[p])) : 0);
  const depOf = (p) =>
    dep[p] !== null ? dep[p] : String(suggestedDeposit({ settings, customer, product: p, heldAfter: heldAfter(p), isGive }));

  const totalQty = items.reduce((s, p) => s + nOf(p), 0);
  const amount = round2(items.reduce((s, p) => s + lineAmount(p), 0));
  const paid = payType === 'cash' ? amount : Math.min(round2(num(paidInput)), amount);
  const udhari = round2(amount - paid);
  const depositTotal = withDeposit ? round2(items.reduce((s, p) => s + num(depOf(p)), 0)) : 0;
  const q = nOf(JAR);
  const r = rOf(JAR);
  const itemsText = items.filter((p) => nOf(p) > 0).map((p) => countText(p, nOf(p))).join(t('prod.and'));

  const openTakeBack = (p) => {
    setTakeBack((tb) => ({ ...tb, [p]: true }));
    setRet((rt) => ({ ...rt, [p]: String(Math.min(nOf(p), heldNow(p))) }));
  };
  const closeTakeBack = (p) => {
    setTakeBack((tb) => ({ ...tb, [p]: false }));
    setRet((rt) => ({ ...rt, [p]: '' }));
  };

  const problem = (() => {
    if (!customerId) return t('entry.selectCustomer');
    if (totalQty < 1) return single && items[0] === JAR ? t('entry.qtyMin') : t('prod.qtyMin');
    for (const p of items) {
      const held = heldNow(p);
      if (isGive && rOf(p) > held) return held === 0 ? tx(p, 'noneToReturn') : tx(p, 'onlyWith', { n: held, q: rOf(p) });
      const s = stockFor(p);
      if (isGive && nOf(p) > 0 && s !== null && nOf(p) > s) return s <= 0 ? tx(p, 'noneAvailable') : tx(p, 'onlyAvailable', { n: s, q: nOf(p) });
      if (!isGive && nOf(p) > held) return held === 0 ? tx(p, 'noneToReturn') : tx(p, 'onlyWith', { n: held, q: nOf(p) });
      if (!isGive && withDeposit && num(depOf(p)) > depositHeldOf(customer, p) + 0.004) return t('prod.depositTooMuch', { n: depositHeldOf(customer, p) });
    }
    if (isGive && num(paidInput) > amount && payType === 'udhari') return t('entry.paidTooMuch');
    return '';
  })();

  const save = async (e) => {
    e.preventDefault();
    if (problem) return showProblem(problem);
    setBusy(true);
    const billing = isGive && { payment_type: payType, paid_amount: paid, advance_amount: num(advance), reminder_days: reminderDays, booking_id: bookingId ? Number(bookingId) : undefined };
    const body = legacy
      ? {
          client_uuid: clientUuid,
          customer_id: Number(customerId),
          transaction_date: date,
          transaction_type: type,
          jar_quantity: q,
          notes: notes || null,
          ...(isGive && { rate: num(rates[JAR]), return_quantity: r, ...billing }),
        }
      : {
          client_uuid: clientUuid,
          customer_id: Number(customerId),
          transaction_date: date,
          transaction_type: type,
          notes: notes || null,
          lines: items.map((p) => ({
            product: p,
            quantity: nOf(p),
            ...(isGive && { rate: num(rates[p]), return_quantity: rOf(p) }),
            ...(withDeposit && { deposit_amount: num(depOf(p)) }),
          })),
          ...billing,
        };
    try {
      const label = legacy
        ? r > 0 ? t('entry.outboxGiveReturn', { q, r, name: customer?.name }) : t(isGive ? 'entry.outboxGive' : 'entry.outboxReturn', { q, name: customer?.name })
        : `${t(isGive ? 'entry.giveLbl' : 'entry.returnLbl')}: ${itemsText} – ${customer?.name}`;
      const res = await submit('/jar-transactions', body, label);
      if (res.queued) {
        toast(t('entry.queuedToast'), 'info');
        setResult({
          queued: true, customer_name: customer?.name, transaction_type: type, jar_quantity: q, returned_quantity: r,
          reminder_days: isGive ? reminderDays : 0, transaction_date: date,
          lines: legacy ? undefined : items.filter((p) => nOf(p) > 0).map((p) => ({ product: p, jar_quantity: nOf(p) })),
        });
      } else {
        toast(res.data.message || t('entry.savedOk'));
        setResult({
          ...res.data.data,
          customer_name: customer?.name,
          customer_mobile: customer?.mobile,
          reminder_days: isGive ? reminderDays : 0,
          booking_done: isGive && Boolean(bookingId),
          // Empties taken back per product (for the WhatsApp message); the server reports jars only.
          ...(!legacy && isGive && { taken_back: Object.fromEntries(items.map((p) => [p, rOf(p)])) }),
        });
        setBookingId(null);
        const d = res.data.data;
        setCustomer((c) => c && { ...c, current_jars: d.current_jars, current_bottles: d.current_bottles ?? c.current_bottles, pending_amount: d.pending_amount });
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
    const theirs = customerProducts(keepCustomer ? customer : null, settings);
    setQty(theirs.length === 1 ? { ...byProduct('0', '0'), [theirs[0]]: '1' } : byProduct('1', '0'));
    setPaidInput('');
    setAdvance('');
    setNotes('');
    setPayType('cash');
    setTakeBack(byProduct(false, false));
    setRet(byProduct('', ''));
    setDep(byProduct(null, null));
    setExtra([]);
    setReminderDays(15);
    setClientUuid(uuid());
    if (!keepCustomer) {
      setCustomerId('');
      setCustomer(null);
    }
    // The saved customer's deposit changed: refresh it before the next entry.
    if (keepCustomer && customerId && withDeposit) {
      api.get(`/customers/${customerId}`).then((res) => setCustomer(res.data.data)).catch(() => {});
    }
  };

  if (result) return <SavedCard result={result} settings={settings} onNew={newEntry} />;

  const anyShort = isGive && items.some((p) => stockFor(p) !== null && nOf(p) > stockFor(p));
  const anyAfterNegative = items.some((p) => heldAfter(p) < 0);
  const saveLabel = legacy || (single && items[0] === JAR)
    ? r > 0 ? t('entry.saveGiveReturn', { q, r }) : t(isGive ? 'entry.saveGive' : 'entry.saveReturn', { q })
    : t('prod.saveEntry', { items: itemsText || '0' });

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
        onChange={(v) => {
          setType(v);
          setDep(byProduct(null, null));
        }}
        options={[
          { value: 'given', label: t('entry.giveLbl'), icon: ArrowUpRight, activeClass: 'bg-brand-600 text-white shadow-soft' },
          { value: 'returned', label: t('entry.returnLbl'), icon: ArrowDownLeft, activeClass: 'bg-sky-600 text-white shadow-soft' },
        ]}
      />

      <Section title={t('entry.secCustomer')} icon={Users}>
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <Field group label={t('entry.customer')}>
            <CustomerPicker value={customerId} onChange={pickCustomer} />
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

        {items.map((p) => (
          <ProductQty
            key={p}
            product={p}
            framed={!single}
            isGive={isGive}
            customer={customer}
            held={heldNow(p)}
            qty={qty[p]}
            onQty={(v) => setQty((s) => ({ ...s, [p]: String(v) }))}
            min={single ? 1 : 0}
            takeBack={takeBack[p]}
            ret={ret[p]}
            onRet={(v) => setRet((s) => ({ ...s, [p]: String(v) }))}
            onOpenTakeBack={() => openTakeBack(p)}
            onCloseTakeBack={() => closeTakeBack(p)}
            onRemove={
              extra.includes(p)
                ? () => {
                    setExtra((x) => x.filter((e) => e !== p));
                    setQty((s) => ({ ...s, [p]: '0' }));
                    closeTakeBack(p);
                  }
                : undefined
            }
          />
        ))}

        {addable.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setExtra((x) => [...x, p]);
              setQty((s) => ({ ...s, [p]: '1' }));
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 py-2.5 text-left transition hover:border-brand-400 active:scale-[.99]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-brand-700 ring-1 ring-line">
              <Plus size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{t('prod.addToEntry', { item: productName(p) })}</span>
              <span className="block text-xs text-muted">{t('prod.addToEntryHint')}</span>
            </span>
          </button>
        ))}

        {(customer || (isGive && items.some((p) => stockFor(p) !== null))) && (
          <div className="space-y-2">
            {customer && (
              <Callout tone={anyAfterNegative ? 'red' : 'neutral'} icon={UserRound}>
                {single && items[0] === JAR ? (
                  <>
                    {t('entry.currentJars')} <b className="tabular-nums">{heldNow(JAR)}</b>
                    <ArrowRight size={14} className="mx-1.5 inline opacity-60" />
                    {t('entry.afterEntry')} <b className="tabular-nums">{heldAfter(JAR)}</b>
                  </>
                ) : (
                  items.map((p) => (
                    <span key={p} className="block">
                      {productName(p)}: <b className="tabular-nums">{heldNow(p)}</b>
                      <ArrowRight size={14} className="mx-1.5 inline opacity-60" />
                      <b className="tabular-nums">{heldAfter(p)}</b>
                    </span>
                  ))
                )}
                {feat.deposit && (
                  <span className="block">
                    {t('prod.depositHeld')}: <b className="tabular-nums">{money(customer.deposit_held ?? 0)}</b>
                  </span>
                )}
              </Callout>
            )}
            {isGive && items.some((p) => stockFor(p) !== null) && (
              <Callout tone={anyShort ? 'red' : 'green'} icon={Store}>
                {t('entry.inShop')}{' '}
                {items
                  .filter((p) => stockFor(p) !== null)
                  .map((p, i) => (
                    <span key={p}>
                      {i > 0 && ' · '}
                      <b className="tabular-nums">{stockFor(p)}</b> {tx(p, 'word')}
                    </span>
                  ))}
                {anyShort && (
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
          {items.map((p) => (
            <div key={p} className="grid grid-cols-2 gap-3">
              <Field label={tx(p, 'rate')}>
                <input
                  className="input tabular-nums"
                  inputMode="decimal"
                  value={rates[p]}
                  onChange={(e) => setRates((s) => ({ ...s, [p]: e.target.value.replace(/[^\d.]/g, '') }))}
                />
              </Field>
              <Field group label={single ? t('entry.amount') : `${t('entry.amount')} · ${countText(p, nOf(p))}`}>
                <div className="input !bg-surface-2 font-semibold tabular-nums">{money(single ? amount : lineAmount(p))}</div>
              </Field>
            </div>
          ))}
          {!single && (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5 ring-1 ring-inset ring-brand-600/10">
              <span className="text-sm font-medium text-brand-800">{t('entry.total')}</span>
              <span className="text-lg font-semibold tabular-nums text-ink">{money(amount)}</span>
            </div>
          )}

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

          {feat.deposit && customer && (
            <div className="space-y-3 rounded-lg bg-violet-50/60 p-3 ring-1 ring-inset ring-violet-600/15">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                <Landmark size={16} /> {t('prod.depositSec')}
              </div>
              {withDeposit ? (
                <>
                  {items.map((p) => (
                    <DepositField key={p} p={p} single={single} isGive customer={customer} settings={settings} value={depOf(p)} onChange={(v) => setDep((s) => ({ ...s, [p]: v }))} />
                  ))}
                  <p className="text-xs text-violet-800/80">{t('prod.depositNote')}</p>
                </>
              ) : (
                <p className="text-sm text-muted">{t('prod.noDepositCustomer')}</p>
              )}
            </div>
          )}

          {feat.deposit && withDeposit && depositTotal > 0 && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2.5 ring-1 ring-inset ring-emerald-600/15">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-emerald-900">{t('prod.collectToday')}</span>
                <span className="text-lg font-semibold tabular-nums text-ink">{money(round2(paid + num(advance) + depositTotal))}</span>
              </div>
              <p className="text-xs text-emerald-800">
                {t('prod.collectTodayHint', { paid: money(round2(paid + num(advance))), deposit: money(depositTotal) })}
              </p>
            </div>
          )}
        </Section>
      )}

      {!isGive && feat.deposit && customer && (
        <Section title={t('prod.depositSec')} icon={Landmark}>
          {withDeposit ? (
            <>
              {items.map((p) => (
                <DepositField key={p} p={p} single={single} isGive={false} customer={customer} settings={settings} value={depOf(p)} onChange={(v) => setDep((s) => ({ ...s, [p]: v }))} />
              ))}
              <p className="text-xs text-muted">{t('prod.depositNote')}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t('prod.noDepositCustomer')}</p>
          )}
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
          {busy ? t('entry.saving') : saveLabel}
        </button>
      </div>
    </form>
  );
}

/** Deposit taken (give) or refunded (return) for one product, pre-filled with the suggestion. */
function DepositField({ p, single, isGive, customer, settings, value, onChange }) {
  return (
    <Field
      label={`${t(isGive ? 'prod.depositTaken' : 'prod.depositRefund')}${single ? '' : ` · ${productName(p)}`}`}
      hint={t('prod.depositHint', { held: depositHeldOf(customer, p), rate: depositRate(settings, p) })}
    >
      <input className="input tabular-nums" inputMode="decimal" value={value} placeholder="0" onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} />
    </Field>
  );
}

/** "How many given / returned" for one product, with the optional empties-taken-back box. */
function ProductQty({ product: p, framed, isGive, customer, held, qty, onQty, min, takeBack, ret, onRet, onOpenTakeBack, onCloseTakeBack, onRemove }) {
  const n = parseInt(qty, 10) || 0;
  return (
    <div className={framed ? 'space-y-3 rounded-lg p-3 ring-1 ring-inset ring-line' : 'space-y-4'}>
      <Field
        group
        label={
          onRemove ? (
            <span className="flex items-center justify-between gap-2">
              {tx(p, isGive ? 'given' : 'returned')}
              <button type="button" className="btn-ghost btn-sm !px-2 text-muted" onClick={onRemove}>
                <X size={14} /> {t('prod.removeFromEntry')}
              </button>
            </span>
          ) : (
            tx(p, isGive ? 'given' : 'returned')
          )
        }
      >
        <Stepper value={qty} onChange={onQty} min={min} max={!isGive && customer && held > 0 ? held : undefined} />
      </Field>

      {isGive && customer && held > 0 && !takeBack && (
        <button
          type="button"
          onClick={onOpenTakeBack}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2.5 text-left transition hover:border-sky-400 active:scale-[.99]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-sky-700 ring-1 ring-sky-200">
            <RotateCcw size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-sky-800">{tx(p, 'takeBackQ')}</span>
            <span className="block text-xs text-sky-700">{tx(p, 'takeBackHint', { n: held })}</span>
          </span>
          <Plus size={18} className="shrink-0 text-sky-700" />
        </button>
      )}
      {isGive && takeBack && (
        <div className="space-y-3 rounded-lg bg-sky-50 p-3 ring-1 ring-inset ring-sky-200">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800">
              <RotateCcw size={16} /> {tx(p, 'takeBackLabel')}
            </span>
            <button type="button" className="btn-ghost btn-sm !px-2 text-muted" onClick={onCloseTakeBack}>
              <X size={14} /> {t('entry.takeBackRemove')}
            </button>
          </div>
          <Stepper value={ret} onChange={onRet} min={0} max={held} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="chip" onClick={() => onRet(String(Math.min(n, held)))}>
              {t('entry.takeBackSame', { n: Math.min(n, held) })}
            </button>
            <button type="button" className="chip" onClick={() => onRet(String(held))}>
              {t('entry.takeBackAll', { n: held })}
            </button>
          </div>
          <p className="text-xs text-sky-800">{tx(p, 'takeBackHint', { n: held })}</p>
        </div>
      )}
    </div>
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
  const feat = features(settings);
  // Jar-only entries (and old app data) have no lines: one jar line.
  const lines = result.lines?.length ? result.lines : [{ product: result.product || JAR, jar_quantity: result.jar_quantity, rate: result.rate }];
  const multi = lines.length > 1 || lines[0].product === BOTTLE;
  const total = (k, fallback) => (result[k] !== undefined ? result[k] : fallback);

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
          {multi ? (
            lines.map((l) => (
              <Row
                key={l.product}
                label={`${isGive ? t('entry.given') : t('entry.returned')} · ${productName(l.product)}`}
                value={!result.queued && isGive ? `${countText(l.product, l.jar_quantity)} × ${money(l.rate)}` : countText(l.product, l.jar_quantity)}
              />
            ))
          ) : (
            <Row label={isGive ? t('entry.given') : t('entry.returned')} value={t('entry.jarsN', { n: result.jar_quantity })} />
          )}
          {isGive && result.taken_back
            ? Object.entries(result.taken_back)
                .filter(([, n]) => n > 0)
                .map(([p, n]) => <Row key={p} label={t('entry.takenBack')} value={countText(p, n)} />)
            : isGive && result.returned_quantity > 0 && <Row label={t('entry.takenBack')} value={t('entry.jarsN', { n: result.returned_quantity })} />}
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
              {!multi && <Row label={t('entry.rateShort')} value={money(result.rate)} />}
              <Row label={t('entry.total')} value={money(total('total_amount', result.amount))} />
              <Row label={t('entry.paid')} value={<span className="text-emerald-700">{money(total('total_paid', result.paid_amount + result.advance_amount))}</span>} />
              <Row
                label={t('entry.udhari')}
                value={<span className={total('total_udhari', result.udhari_amount) > 0 ? 'text-amber-800' : ''}>{money(total('total_udhari', result.udhari_amount))}</span>}
              />
            </>
          )}
          {!result.queued && feat.deposit && result.total_deposit > 0 && (
            <Row label={t(isGive ? 'prod.depositTaken' : 'prod.depositRefund')} value={money(result.total_deposit)} />
          )}
        </dl>

        {!result.queued && (
          <div className="grid grid-cols-2 gap-3 border-t border-line bg-surface-2 p-4">
            <Tile icon={Droplets} label={t('entry.currentJarsRow')} value={result.current_jars} />
            {feat.bottles && <Tile icon={Droplets} label={t('prod.currentBottlesRow')} value={result.current_bottles ?? 0} />}
            <Tile icon={Wallet} label={t('entry.totalPending')} value={money(result.pending_amount)} danger={result.pending_amount > 0} />
            {feat.deposit && <Tile icon={Landmark} label={t('prod.depositHeld')} value={money(result.deposit_held ?? 0)} />}
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
