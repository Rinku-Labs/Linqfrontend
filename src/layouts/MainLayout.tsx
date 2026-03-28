import { Outlet } from 'react-router-dom';
import BottomNav from '../components/Layout/BottomNav';
import { Toaster } from 'sonner';
import VerificationOverlay from '../components/VerificationOverlay';
import { useAuth } from '../context/AuthContext';
import '../index.css';

export default function MainLayout() {
    const { isVerified, isCheckingVerification, hasTrialRemaining } = useAuth();

    return (
        <div style={{
            maxWidth: '480px',
            margin: '0 auto',
            minHeight: '100vh',
            backgroundColor: 'var(--background)',
            position: 'relative',
            transition: 'background-color 0.3s ease',
            width: '100%',
            overflowX: 'hidden' as any
        }}>
            <div style={{ padding: '16px', paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
                <Outlet />
            </div>
            <BottomNav />
            <Toaster position="top-center" />
            <VerificationOverlay isVerified={isVerified} isCheckingVerification={isCheckingVerification} hasTrialRemaining={hasTrialRemaining} />
        </div>
    );
}

