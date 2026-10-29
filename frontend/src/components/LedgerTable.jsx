import { Pencil } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';
import { fmtDate, money } from '../lib/format';
import { BOTTLE, features } from '../lib/products';
import { Badge } from './ui';

const dash = <span className="text-slate-400">–</span>;

/**
 * Date | Given | Returned | Net Jar | Amount | Paid | Udhari | Balance | Jars [| Bottles] [| Deposit]
 * Bottle rows carry a "bottle" tag; the Bottles / Deposit columns show only when the company uses them.
 * flush: the table runs edge-to-edge inside a `.card !p-0` (no outer gutter, no last-row border).
 */
export default function LedgerTable({ rows, onEdit, flush = false }) {
  const { settings } = useSettings();
  const feat = features(settings);
  return (
    <div
      className={
        flush
          ? 'overflow-x-auto [&_tbody_tr:last-child_td]:border-b-0 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th]:rounded-none [&_th:first-child]:pl-4 [&_th:last-child]:pr-4'
          : 'table-wrap'
      }
    >
      <table className="tbl">
        <thead>
          <tr>
            <th>{t('ledger.date')}</th>
            <th className="num">{t('ledger.given')}</th>
            <th className="num">{t('ledger.returned')}</th>
            <th className="num">{t('ledger.netJar')}</th>
            <th className="num">{t('ledger.amount')}</th>
            <th className="num">{t('ledger.paid')}</th>
            <th className="num">{t('ledger.udhari')}</th>
            <th className="num">{t('ledger.balance')}</th>
            <th className="num">{t('ledger.jars')}</th>
            {feat.bottles && <th className="num">{t('prod.ledgerBottles')}</th>}
            {feat.deposit && <th className="num">{t('prod.ledgerDeposit')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.entry_type === 'payment' ? 'bg-emerald-50/40' : ''}>
              <td>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      type="button"
                      className="icon-btn no-print -my-1 -ml-1.5 h-7 w-7"
                      onClick={() => onEdit(r.payment_id ? { kind: 'payment', id: r.payment_id } : { kind: 'jar', id: r.jar_transaction_id })}
                      aria-label={t('edit.button')}
                      title={t('edit.button')}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <span className="tabular-nums">{fmtDate(r.entry_date)}</span>
                  {r.entry_type === 'payment' && <Badge kind="cash">{t('ledger.payment')}</Badge>}
                  {r.product === BOTTLE && r.entry_type !== 'payment' && (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20">{t('prod.bottle')}</span>
                  )}
                </div>
              </td>
              <td className="num">{r.jars_given || dash}</td>
              <td className="num">{r.jars_returned || dash}</td>
              <td className="num">{r.entry_type === 'payment' ? dash : r.net_jars}</td>
              <td className="num">{r.amount ? money(r.amount) : dash}</td>
              <td className="num text-emerald-700">{r.paid ? money(r.paid) : dash}</td>
              <td className="num text-amber-700">{r.udhari ? money(r.udhari) : dash}</td>
              <td className={`num font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(r.balance)}</td>
              <td className="num font-medium">{r.jar_balance}</td>
              {feat.bottles && <td className="num font-medium">{r.bottle_balance ?? 0}</td>}
              {feat.deposit && (
                <td className="num">
                  {r.deposit ? <span className={r.entry_type === 'returned' ? 'text-red-600' : 'text-emerald-700'}>{r.entry_type === 'returned' ? '−' : '+'}{money(r.deposit)}</span> : dash}
                  <div className="text-[11px] text-muted">{money(r.deposit_balance ?? 0)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
