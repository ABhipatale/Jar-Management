import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { Empty, ErrorBox, Loader, PageHeader } from '../../components/ui';
import { t } from '../../i18n';
import { useApi } from '../../lib/useApi';

function when(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

/** What the super admin did, newest first (last 200). */
export default function AuditLog() {
  const { data, loading, error, reload } = useApi('/admin/audit');
  const rows = data?.data || [];

  return (
    <div className="space-y-4">
      <PageHeader title={t('adm.audit')} />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Empty icon={History} />
      ) : (
        <ul className="card divide-y divide-line !p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3 text-sm">
              <span className="font-medium text-ink">{t(`adm.act.${r.action}`)}</span>
              {r.company && (
                <Link to={`/admin/companies/${r.company.id}`} className="text-brand-700 hover:underline">
                  {r.company.name}
                </Link>
              )}
              <span className="ml-auto text-xs text-muted">
                {r.user?.name} · {when(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
