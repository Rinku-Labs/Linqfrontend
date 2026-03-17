import { Home, History, PiggyBank, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    // Only show on main tabs
    const showNav = ['/', '/transactions', '/settings', '/savings'].includes(location.pathname);

    if (!showNav) return null;

    const navItems = [
        { icon: Home, label: 'Home', path: '/' },
        { icon: History, label: 'History', path: '/transactions' },
        { icon: PiggyBank, label: 'Savings', path: '/savings' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <nav style={{
            position: 'fixed',
            bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 10px))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '400px',
            backgroundColor: 'var(--nav-bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)', // Safari support
            border: '1px solid var(--glass-border)',
            borderRadius: '24px',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--nav-shadow)',
            zIndex: 100,
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease'
        }}>
            {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className="nav-icon"
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '12px',
                            transform: active ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <item.icon
                            size={24}
                            color={active ? 'var(--primary)' : 'var(--icon-muted)'}
                            strokeWidth={active ? 2.5 : 2}
                            style={{ transition: 'all 0.25s ease' }}
                        />
                    </button>
                );
            })}
        </nav>
    );
}

