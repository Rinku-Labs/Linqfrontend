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
import Rewards from './pages/Rewards';
import Leaderboard from './pages/Leaderboard';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import SEO from './components/SEO';

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
        <Route path="/onboarding" element={<><SEO title="Welcome" description="Join Linq today." /><Onboarding /></>} />
        <Route path="/privacy-policy" element={<><SEO title="Privacy Policy" /><PrivacyPolicy /></>} />
        
        <Route path="/create-pin" element={<RequireAuth><SEO title="Create PIN" /><CreatePin /></RequireAuth>} /> // Secured route


        <Route path="/verification" element={<RequireAuth><SEO title="Account Verification" /><Verification /></RequireAuth>} /> // Secured route

        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          {/* Dashboard Home - now under a separate path or shared with RootRoute */}
          <Route path="/" element={<><SEO title="Home" /><Home /></>} />

          {/* Send Flow */}
          <Route path="/send/details" element={<><SEO title="Send Money - Recipient Details" /><AccountDetails /></>} />
          <Route path="/send/amount" element={<><SEO title="Send Money - Select Amount" /><InputAmount /></>} />
          <Route path="/send/confirm" element={<><SEO title="Confirm Transfer" /><Confirm /></>} />
          <Route path="/send/payment" element={<><SEO title="Sign Transaction" /><Payment /></>} />
          <Route path="/send/success" element={<><SEO title="Transfer Successful" /><Success /></>} />

          {/* Transactions */}
          <Route path="/transactions" element={<><SEO title="Transaction History" /><TransactionsList /></>} />
          <Route path="/transactions/:id" element={<><SEO title="Transaction Details" /><TransactionDetail /></>} />
          <Route path="/transactions/analysis" element={<><SEO title="Spending Analysis" /><Analysis /></>} />

          {/* Savings */}
          <Route path="/savings" element={<><SEO title="Savings & Goals" /><Savings /></>} />

          {/* Settings */}
          <Route path="/settings" element={<><SEO title="Settings" /><Settings /></>} />
          <Route path="/settings/bank-details" element={<><SEO title="Saved Bank Accounts" /><BankDetails /></>} />

          {/* Swap */}
          <Route path="/swap" element={
            <ErrorBoundary>
              <SEO title="Swap Assets" />
              <Swap />
            </ErrorBoundary>
          } />

          {/* Bill Payments Flow */}
          <Route path="/bills/topup" element={<><SEO title="Bill Payments" /><Topup /></>} />
          <Route path="/bills/airtime" element={<Navigate to="/bills/topup" replace />} />
          <Route path="/bills/data" element={<Navigate to="/bills/topup" replace />} />
          <Route path="/bills/confirm" element={<><SEO title="Confirm Bill Payment" /><BillConfirm /></>} />
          <Route path="/bills/payment" element={<><SEO title="Sign Bill Payment" /><BillPayment /></>} />

          {/* Rewards & Leaderboard */}
          <Route path="/rewards" element={<><SEO title="Earn Rewards" /><Rewards /></>} />
          <Route path="/leaderboard" element={<><SEO title="Leaderboard" /><Leaderboard /></>} />

          {/* Deposit Flow */}
          <Route path="/deposit" element={<><SEO title="Deposit Funds" /><DepositAmount /></>} />
          <Route path="/deposit/payment" element={<><SEO title="Payment Instructions" /><DepositPayment /></>} />
          <Route path="/deposit/status" element={<><SEO title="Deposit Status" /><DepositStatus /></>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
