import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import AccountDetails from './pages/SendFlow/AccountDetails';
import InputAmount from './pages/SendFlow/InputAmount';
import Confirm from './pages/SendFlow/Confirm';
import Payment from './pages/SendFlow/Payment';
import Success from './pages/SendFlow/Success';
import DepositAmount from './pages/DepositFlow/DepositAmount';
import DepositPayment from './pages/DepositFlow/DepositPayment';
import DepositStatus from './pages/DepositFlow/DepositStatus';
import TransactionsList from './pages/Transactions/List';
import TransactionDetail from './pages/Transactions/Detail';
import Analysis from './pages/Analysis';
import Settings from './pages/Settings';
import BankDetails from './pages/BankDetails';
import CreatePin from './pages/CreatePin';
import Verification from './pages/Verification';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Topup from './pages/BillsFlow/Topup';


import BillConfirm from './pages/BillsFlow/BillConfirm';
import BillPayment from './pages/BillsFlow/BillPayment';
import Swap from './pages/Swap';
import Savings from './pages/Savings';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';
// import { SolanaWalletProvider } from './context/SolanaWalletProvider';

// Helper component to check if user is authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuth();

  if (!isAuthenticated && !token) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        
        <Route path="/create-pin" element={<RequireAuth><CreatePin /></RequireAuth>} /> // Secured route


        <Route path="/verification" element={<RequireAuth><Verification /></RequireAuth>} /> // Secured route

        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          {/* Dashboard Home - now under a separate path or shared with RootRoute */}
          <Route path="/" element={<Home />} />

          {/* Send Flow */}
          <Route path="/send/details" element={<AccountDetails />} />
          <Route path="/send/amount" element={<InputAmount />} />
          <Route path="/send/confirm" element={<Confirm />} />
          <Route path="/send/payment" element={<Payment />} />
          <Route path="/send/success" element={<Success />} />

          {/* Transactions */}
          <Route path="/transactions" element={<TransactionsList />} />
          <Route path="/transactions/:id" element={<TransactionDetail />} />
          <Route path="/transactions/analysis" element={<Analysis />} />

          {/* Savings */}
          <Route path="/savings" element={<Savings />} />

          {/* Settings */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/bank-details" element={<BankDetails />} />

          {/* Swap */}
          <Route path="/swap" element={
            <ErrorBoundary>
              <Swap />
            </ErrorBoundary>
          } />

          {/* Bill Payments Flow */}
          <Route path="/bills/topup" element={<Topup />} />
          <Route path="/bills/airtime" element={<Navigate to="/bills/topup" replace />} />
          <Route path="/bills/data" element={<Navigate to="/bills/topup" replace />} />
          <Route path="/bills/confirm" element={<BillConfirm />} />
          <Route path="/bills/payment" element={<BillPayment />} />

          {/* Deposit Flow */}
          <Route path="/deposit" element={<DepositAmount />} />
          <Route path="/deposit/payment" element={<DepositPayment />} />
          <Route path="/deposit/status" element={<DepositStatus />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
