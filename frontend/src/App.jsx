import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import CustomerDetail from './pages/CustomerDetail';
import Ledger from './pages/Ledger';
import Jars from './pages/Jars';
import DailyEntry from './pages/DailyEntry';
import Payments from './pages/Payments';
import PaymentForm from './pages/PaymentForm';
import Transactions from './pages/Transactions';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Bookings from './pages/Bookings';
import Reports from './pages/reports/Reports';
import PeriodReport from './pages/reports/PeriodReport';
import CashReport from './pages/reports/CashReport';
import UdhariReport from './pages/reports/UdhariReport';
import PendingReport from './pages/reports/PendingReport';
import JarStatusReport from './pages/reports/JarStatusReport';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<CustomerForm />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />
          <Route path="customers/:id/ledger" element={<Ledger />} />
          <Route path="jars" element={<Jars />} />
          <Route path="entry" element={<DailyEntry />} />
          <Route path="payments" element={<Payments />} />
          <Route path="payments/new" element={<PaymentForm />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/daily" element={<PeriodReport kind="daily" />} />
          <Route path="reports/weekly" element={<PeriodReport kind="weekly" />} />
          <Route path="reports/monthly" element={<PeriodReport kind="monthly" />} />
          <Route path="reports/cash" element={<CashReport />} />
          <Route path="reports/udhari" element={<UdhariReport />} />
          <Route path="reports/pending" element={<PendingReport />} />
          <Route path="reports/jar-status" element={<JarStatusReport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}
