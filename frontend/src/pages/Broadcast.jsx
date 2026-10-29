import { useMemo, useState } from 'react';
import { Check, MapPin, Megaphone, RotateCcw, Send, Users } from 'lucide-react';
import { Empty, ErrorBox, Loader, PageHeader, PendingText } from '../components/ui';
import { useSettings } from '../context/SettingsContext';
import { t } from '../i18n';
import { useApi } from '../lib/useApi';
import { BROADCAST_TEMPLATES, broadcastText, openWhatsApp } from '../lib/whatsapp';

// The message and who was already sent it are kept on this phone, so leaving for WhatsApp
// and coming back (or a reload) carries on where it stopped.
const MSG_KEY = 'rws_bc_msg';
const SENT_KEY = 'rws_bc_sent';
const load = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage blocked: works for this visit only */
  }
};

const KINDS = ['festival', 'offer', 'holiday', 'price', 'custom'];
const WHO = ['all', 'area', 'udhari', 'jars'];

export default function Broadcast() {
  const { settings } = useSettings();
  const { data, loading, error, reload } = useApi('/customers');
  const saved = load(MSG_KEY, null);
  const [kind, setKind] = useState(saved?.kind || 'festival');
  const [text, setText] = useState(saved?.text || BROADCAST_TEMPLATES.festival);
  const [who, setWho] = useState('all');
  const [area, setArea] = useState('');
  const [sent, setSent] = useState(() => load(SENT_KEY, []));

  const updateText = (v, k = kind) => {
    setText(v);
    save(MSG_KEY, { kind: k, text: v });
  };
  const markSent = (ids) => {
    setSent(ids);
    save(SENT_KEY, ids);
  };
  const pickKind = (k) => {
    setKind(k);
    updateText(BROADCAST_TEMPLATES[k], k);
    markSent([]); // a new message starts a new round
  };

  const list = useMemo(() => {
    const a = area.trim().toLowerCase();
    return (data?.data || [])
      .filter((c) => c.status === 'active' && c.mobile)
      .filter((c) => {
        if (who === 'area') return a !== '' && String(c.address || '').toLowerCase().includes(a);
        if (who === 'udhari') return c.pending_amount > 0;
        if (who === 'jars') return c.current_jars > 0 || c.current_bottles > 0;
        return true;
      });
  }, [data, who, area]);

  const sentSet = new Set(sent);
  const done = list.filter((c) => sentSet.has(c.id)).length;
  const next = list.find((c) => !sentSet.has(c.id));
  const hasBlanks = text.includes('___');

  const sendTo = (c) => {
    if (hasBlanks) return;
    markSent([...new Set([...sent, c.id])]);
    openWhatsApp(c.mobile, broadcastText(settings, text, c.name));
  };

  return (
    <div className="space-y-5">
      <PageHeader title={t('bc.title')} subtitle={t('bc.sub')} />

      <section className="card space-y-3">
        <h2 className="font-semibold text-ink">{t('bc.step1')}</h2>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} type="button" className={`chip ${kind === k ? 'chip-active' : ''}`} onClick={() => pickKind(k)}>
              {t(`bc.t.${k}`)}
            </button>
          ))}
        </div>
        <textarea className="input !h-auto font-[inherit] leading-relaxed" rows={12} value={text} onChange={(e) => updateText(e.target.value)} />
        <p className="text-xs leading-relaxed text-muted">{t('bc.editHint')}</p>
        {hasBlanks && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
            {t('bc.blanks')}
          </p>
        )}
        <details className="rounded-lg bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink">{t('bc.preview')}</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words font-[inherit] text-[13px] leading-relaxed text-ink">
            {broadcastText(settings, text, list[0]?.name)}
          </pre>
        </details>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-ink">{t('bc.step2')}</h2>
        <div className="flex flex-wrap gap-2">
          {WHO.map((w) => (
            <button key={w} type="button" className={`chip ${who === w ? 'chip-active' : ''}`} onClick={() => setWho(w)}>
              {t(`bc.who.${w}`)}
            </button>
          ))}
        </div>
        {who === 'area' && (
          <div>
            <div className="relative">
              <MapPin size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input className="input pl-10" value={area} onChange={(e) => setArea(e.target.value)} placeholder={t('bc.areaPh')} />
            </div>
            <p className="mt-1.5 text-xs text-muted">{t('bc.areaHint')}</p>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Users size={16} className="text-muted" aria-hidden="true" /> {t('bc.count', { n: list.length })}
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-ink">{t('bc.step3')}</h2>

        <div className="rounded-xl bg-surface-2 p-3">
          <h3 className="font-medium text-ink">{t('bc.groupTitle')}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('bc.groupHint')}</p>
          <button type="button" className="btn-wa mt-3 w-full" disabled={hasBlanks} onClick={() => openWhatsApp(null, broadcastText(settings, text, null))}>
            <Megaphone size={17} /> {t('bc.groupBtn')}
          </button>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-ink">{t('bc.oneByOne')}</h3>
            {sent.length > 0 && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => markSent([])}>
                <RotateCcw size={14} /> {t('bc.reset')}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{t('bc.oneByOneHint')}</p>

          {error && <ErrorBox message={error} onRetry={reload} />}
          {loading && !data && <Loader rows={3} />}

          {data && list.length === 0 && <Empty icon={Users}>{t('bc.empty')}</Empty>}

          {list.length > 0 && (
            <>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
                  <div className="h-full rounded-full bg-[#1fae55] transition-all" style={{ width: `${(done / list.length) * 100}%` }} />
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted">{t('bc.sentCount', { sent: done, n: list.length })}</span>
              </div>

              {next ? (
                <button type="button" className="btn-wa mt-3 w-full" disabled={hasBlanks} onClick={() => sendTo(next)}>
                  <Send size={17} className="shrink-0" />
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span>{t('bc.sendNext')}</span>
                    <span className="max-w-full truncate text-xs font-normal opacity-90">{next.name}</span>
                  </span>
                </button>
              ) : (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-center font-semibold text-emerald-800 ring-1 ring-emerald-200">{t('bc.allSent')}</p>
              )}

              <ul className="mt-3 divide-y divide-line">
                {list.map((c) => {
                  const isSent = sentSet.has(c.id);
                  return (
                    <li key={c.id} className="flex min-w-0 items-center gap-3 py-2.5">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${isSent ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>
                        {isSent ? <Check size={16} /> : c.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{c.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {c.mobile} · {c.address || t('bc.noAddress')}
                        </span>
                        {who === 'udhari' && <PendingText amount={c.pending_amount} className="text-xs" />}
                      </span>
                      <button
                        type="button"
                        className={`btn-sm shrink-0 ${isSent ? 'btn-ghost' : 'btn-wa'}`}
                        disabled={hasBlanks}
                        onClick={() => sendTo(c)}
                      >
                        {isSent ? t('bc.sent') : t('bc.send')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
