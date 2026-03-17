import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glass';
    fullWidth?: boolean;
    isLoading?: boolean;
}

export default function Button({
    children,
    variant = 'primary',
    fullWidth = false,
    isLoading = false,
    className = '',
    style,
    onClick,
    ...props
}: ButtonProps) {
    const [isInternalLoading, setIsInternalLoading] = React.useState(false);
    const isDisabled = props.disabled || isLoading || isInternalLoading;

    const baseStyles: React.CSSProperties = {
        padding: '16px',
        borderRadius: 'var(--radius)',
        fontWeight: 600,
        fontSize: '11px',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        width: fullWidth ? '100%' : 'auto',
        border: 'none',
        position: 'relative',
    };

    const variants = {
        primary: {
            backgroundColor: 'var(--primary)',
            color: 'white',
        },
        secondary: {
            backgroundColor: 'var(--surface)',
            color: 'var(--text-main)',
            boxShadow: 'var(--card-shadow)',
        },
        outline: {
            backgroundColor: 'transparent',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
        },
        ghost: {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            padding: '8px',
        },
        glass: {
            backgroundColor: 'var(--nav-bg)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-main)',
            boxShadow: 'var(--card-shadow)',
        }
    };

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled) {
            e.preventDefault();
            return;
        }

        if (onClick) {
            try {
                const result: any = onClick(e);
                if (result && typeof result.then === 'function') {
                    setIsInternalLoading(true);
                    await result;
                    setIsInternalLoading(false);
                } else {
                    // Prevent double clicks for synchronous actions
                    setIsInternalLoading(true);
                    setTimeout(() => setIsInternalLoading(false), 500);
                }
            } catch (error) {
                setIsInternalLoading(false);
            }
        }
    };

    return (
        <button
            style={{ ...baseStyles, ...variants[variant], ...style }}
            className={`btn-animated ${className}`}
            disabled={isDisabled}
            onClick={handleClick}
            {...props}
        >
            {isLoading ? (
                <>
                    <span className="spinner" style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid currentColor',
                        borderBottomColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        boxSizing: 'border-box',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </>
            ) : children}
        </button>
    );
}

