import { Inbox, ArrowUpRight, BarChart3, Users, type LucideIcon } from 'lucide-react';
import Button from './Button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    variant?: 'default' | 'inline';
}

const presetIcons: Record<string, LucideIcon> = {
    transactions: Inbox,
    send: ArrowUpRight,
    analytics: BarChart3,
    beneficiaries: Users,
};

export default function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    actionLabel,
    onAction,
    variant = 'default',
}: EmptyStateProps) {
    const isInline = variant === 'inline';

    return (
        <div className="animate-fadeIn" style={{
            textAlign: 'center',
            padding: isInline ? '24px 16px' : '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: isInline ? '8px' : '16px',
        }}>
            {/* Icon container with subtle gradient background */}
            <div style={{
                width: isInline ? '48px' : '72px',
                height: isInline ? '48px' : '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(167, 139, 250, 0.08))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: isInline ? '0' : '8px',
            }}>
                <Icon
                    size={isInline ? 22 : 32}
                    color="var(--primary)"
                    strokeWidth={1.5}
                />
            </div>

            <div>
                <p style={{
                    fontSize: isInline ? '14px' : '16px',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    marginBottom: '4px',
                }}>
                    {title}
                </p>
                {description && (
                    <p style={{
                        fontSize: isInline ? '12px' : '14px',
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        maxWidth: '260px',
                    }}>
                        {description}
                    </p>
                )}
            </div>

            {actionLabel && onAction && (
                <Button
                    variant="outline"
                    onClick={onAction}
                    style={{
                        marginTop: '8px',
                        padding: '10px 24px',
                        fontSize: '10px',
                        borderRadius: '14px',
                    }}
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

export { presetIcons };
