import { Pencil } from 'lucide-react';
import { t } from '../i18n';
import { fmtDate, money } from '../lib/format';
import { Badge } from './ui';

const dash = <span className="text-slate-400">–</span>;

/**
 * Date | Given | Returned | Net Jar | Amount | Paid | Udhari | Balance | Jars
 * flush: the table runs edge-to-edge inside a `.card !p-0` (no outer gutter, no last-row border).
 */
export default function LedgerTable({ rows, onEdit, flush = false }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
