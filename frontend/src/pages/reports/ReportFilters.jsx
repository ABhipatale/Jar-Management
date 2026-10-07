import { Search } from 'lucide-react';
import CustomerPicker from '../../components/CustomerPicker';
import { t } from '../../i18n';

/** Customer filter + search box shared by all reports. */
export default function ReportFilters({ customerId, onCustomer, search, onSearch, children }) {
  return (
    <div className="no-print card space-y-3 !p-3 sm:!p-4">
      {children}
      <div className={`grid gap-3 ${!customerId && onSearch ? 'lg:grid-cols-2' : ''}`}>
        <CustomerPicker value={customerId} includeInactive allowClear placeholder={t('rep.filter.allCustomers')} onChange={(id) => onCustomer(id || '')} />
        {!customerId && onSearch && (
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" type="search" placeholder={t('rep.filter.searchPh')} value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
