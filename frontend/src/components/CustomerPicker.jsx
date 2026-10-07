import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Droplets, Phone, Search, X } from 'lucide-react';
import api from '../api/client';
import { t } from '../i18n';
import { PendingText } from './ui';

let cache = null; // shared across screens; refreshed on each mount

/**
 * Search-as-you-type customer selector (name or mobile).
 * Loads the customer list once and filters on the phone — instant even on slow networks.
 */
export default function CustomerPicker({ value, onChange, placeholder = t('cust.searchPh'), includeInactive = false, allowClear = false }) {
  const [list, setList] = useState(cache || []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    api
      .get('/customers')
      .then((r) => {
        cache = r.data.data;
        setList(cache);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const selected = useMemo(() => list.find((c) => c.id === Number(value)) || null, [list, value]);

  useEffect(() => {
    if (selected) onChange?.(selected.id, selected, { silent: true });
    // Push fresh balances to the parent when the list loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.current_jars, selected?.pending_amount]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list
      .filter((c) => includeInactive || c.status === 'active' || c.id === Number(value))
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.mobile.includes(s))
      .slice(0, 40);
  }, [list, q, includeInactive, value]);

  if (selected && !open) {
    return (
      <div className="flex animate-fade-in items-center gap-3 rounded-xl bg-brand-50 px-3 py-2.5 ring-1 ring-inset ring-brand-500/40">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-[15px] font-semibold text-brand-700 ring-1 ring-brand-500/20">
          {selected.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{selected.name}</span>
            <Check size={15} className="shrink-0 text-brand-600" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Phone size={12} aria-hidden="true" /> {selected.mobile}
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets size={12} aria-hidden="true" /> {t('common.jarsCount', { n: selected.current_jars })}
            </span>
            <PendingText amount={selected.pending_amount} />
          </div>
        </div>
        <button type="button" className="btn-light btn-sm shrink-0" onClick={() => { setQ(''); setOpen(true); }}>
          {t('common.change')}
        </button>
        {allowClear && (
          <button type="button" className="icon-btn shrink-0" onClick={() => onChange(null, null)} aria-label={t('picker.clear')}>
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        className="input pl-10 pr-10"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      <ChevronDown
        size={18}
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
      {open && (
        <div className="absolute z-40 mt-1.5 max-h-72 w-full animate-pop-in overflow-y-auto rounded-xl bg-surface p-1 shadow-pop ring-1 ring-line" role="listbox">
          {matches.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted">
              <Search size={18} className="text-slate-400" aria-hidden="true" />
              {t('picker.noCustomer')}
            </div>
          )}
          {matches.map((c) => {
            const isSel = c.id === Number(value);
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSel}
                key={c.id}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-surface-2 ${isSel ? 'bg-brand-50' : ''}`}
                onClick={() => { onChange(c.id, c); setOpen(false); setQ(''); }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{c.name}</span>
                  <span className="text-sm tabular-nums text-muted">{c.mobile}</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="flex items-center justify-end gap-1 text-muted">
                    <Droplets size={12} aria-hidden="true" /> <span className="font-semibold tabular-nums text-ink">{c.current_jars}</span>
                  </span>
                  <PendingText amount={c.pending_amount} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
