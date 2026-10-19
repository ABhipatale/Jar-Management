import { Link } from 'react-router-dom';
import { Building2, CalendarPlus, History, ImageMinus, ImagePlus, KeyRound, LogIn, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { Empty, ErrorBox, Loader, PageHeader } from '../../components/ui';
import { lang, t } from '../../i18n';
import { fmtDate } from '../../lib/format';
import { useApi } from '../../lib/useApi';

const LOCALE = lang === 'mr' ? 'mr-IN-u-nu-latn' : 'en-IN';

// Icon + colour per action.
const ACTIONS = {
  'company.created': [Building2, 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20'],
  'company.updated': [Pencil, 'bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/20'],
  'company.suspended': [Pause, 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'],
  'company.activated': [Play, 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20'],
  'company.deleted': [Trash2, 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ring-1 ring-red-500/20'],
  'company.impersonated': [LogIn, 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20'],
  'company.logo_changed': [ImagePlus, 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20'],
  'company.logo_removed': [ImageMinus, 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20'],
  'owner.password_reset': [KeyRound, 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'],
};

const time = (iso) => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** What the super admin did, newest first (last 200), grouped by day. */
export default function AuditLog() {
  const { data, loading, error, reload } = useApi('/admin/audit');
  const rows = data?.data || [];

  const days = [];
  for (const r of rows) {
    const day = r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA') : ''; // local YYYY-MM-DD
    if (days.at(-1)?.day !== day) days.push({ day, rows: [] });
    days.at(-1).rows.push(r);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('adm.audit')} subtitle={t('adm.auditSub')} />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Empty icon={History} />
      ) : (
        <div className="space-y-5">
          {days.map((d) => (
            <section key={d.day}>
              <h2 className="section-title mb-2 flex items-center gap-2">
                <CalendarPlus size={14} aria-hidden="true" /> {fmtDate(d.day)}
              </h2>
              <ol className="card relative space-y-0 p-0!">
                {d.rows.map((r, i) => {
                  const [Icon, cls] = ACTIONS[r.action] || [History, 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20'];
                  return (
                    <li key={r.id} className="relative flex items-start gap-3 px-4 py-3">
                      {i < d.rows.length - 1 && <span className="absolute bottom-0 left-[2.15rem] top-12 w-px bg-line" aria-hidden="true" />}
                      <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4 ring-surface ${cls}`}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-ink">{t(`adm.act.${r.action}`)}</span>
                          {r.company && (
                            <Link to={`/admin/companies/${r.company.id}`} className="truncate text-sm font-medium text-brand-700 hover:underline">
                              {r.company.name}
                            </Link>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">{[r.user?.name, r.created_at && time(r.created_at)].filter(Boolean).join(' · ')}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
