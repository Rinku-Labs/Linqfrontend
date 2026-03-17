import React from 'react';
import { AlertCircle, Info, XCircle } from 'lucide-react';

interface InlineErrorProps {
    message: string;
    type?: 'error' | 'warning' | 'info';
    suggestion?: string;
    onDismiss?: () => void;
    style?: React.CSSProperties;
}

const config = {
    error: {
        icon: XCircle,
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.2)',
        color: 'var(--error)',
        iconColor: '#ef4444',
    },
    warning: {
        icon: AlertCircle,
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.2)',
        color: '#d97706',
        iconColor: '#f59e0b',
    },
    info: {
        icon: Info,
        bg: 'rgba(139, 92, 246, 0.08)',
        border: 'rgba(139, 92, 246, 0.2)',
        color: 'var(--primary)',
        iconColor: 'var(--primary)',
    },
};

export default function InlineError({
    message,
    type = 'error',
    suggestion,
    onDismiss,
    style,
}: InlineErrorProps) {
    const { icon: Icon, bg, border, color, iconColor } = config[type];

    return (
        <div
            className="animate-scaleIn"
            role="alert"
            style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                ...style,
            }}
        >
            <Icon size={18} color={iconColor} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: '9px', fontWeight: 500, color, lineHeight: 1.4 }}>
                    {message}
                </p>
                {suggestion && (
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                        💡 {suggestion}
                    </p>
                )}
            </div>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                    }}
                    aria-label="Dismiss"
                >
                    ×
                </button>
            )}
        </div>
    );
}
