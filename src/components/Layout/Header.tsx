import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
    title?: string;
    showBack?: boolean;
}

export default function Header({ title, showBack = true }: HeaderProps) {
    const navigate = useNavigate();

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 0',
            marginBottom: '20px',
            position: 'relative'
        }}>
            {showBack && (
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'var(--nav-bg)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        marginRight: '16px',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        position: 'relative',
                        zIndex: 1
                    }}
                >
                    <ArrowLeft size={24} color="var(--text-main)" />
                </button>
            )}
            {title && (
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    margin: 0,
                    ...(showBack ? {
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    } : {
                        flex: 1,
                        textAlign: 'left'
                    }),
                    color: 'var(--text-main)',
                }}>
                    {title}
                </h1>
            )}
        </header>
    );
}

