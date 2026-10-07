import { Badge } from '../../components/ui';
import { t } from '../../i18n';

export function StatusBadge({ company }) {
  if (company.status === 'suspended') return <Badge kind="inactive">{t('adm.status.suspended')}</Badge>;
  if (company.expired) return <Badge kind="damaged">{t('adm.status.expired')}</Badge>;
  return <Badge kind="active">{t('adm.status.active')}</Badge>;
}
