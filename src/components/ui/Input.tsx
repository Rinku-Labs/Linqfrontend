import React from 'react';
import { sanitizeInput } from '../../utils/sanitize';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    showCount?: boolean;
}

export default function Input({ label, showCount, style, onChange, onBlur, ...props }: InputProps) {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // We can optionally sanitize aggressively on change, 
        // but it might interrupt typing if we strip characters like < immediately if user intends to type math symbols.
        // For now, we trust React to handle display, but we can prevent script injection patterns.
        // A simple pass-through for now, or lightweight cleaning.

        // Let's rely on onBlur for heavy modification (trimming) to avoid jumping cursors,
        // but if we want to strictly forbid HTML, we can strip it here.
        // However, stripping on every keystroke is annoying.

        // Better approach: Pass through, let parent state update, parent can sanitize if needed,
        // OR we wrap the onChange to provide a "clean" value?
        // Standard React Input: just fire onChange.

        // For this task "input sanitization everywhere", let's be safe but usable.
        // We will NOT modify value on Change to avoid cursor issues, unless critical.
        if (onChange) {
            onChange(e);
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // Trim and sanitize on blur
        const originalValue = e.target.value;
        // Sanitize (strip tags) and trim whitespace on blur
        const sanitized = sanitizeInput(originalValue);
        const finalValue = sanitized.trim();

        // We could also strip tags here if we want to enforce it on the value in the DOM/State
        // But updating the state from within onBlur requires the parent to handle the update 
        // if this was a controlled component using internal state, or we fire a synthetic change event?
        // 
        // Since this is likely a controlled component (value prop passed), 
        // we can't easily change the value "inside" here without firing onChange again.
        // 
        // If we want to force sanitization, we should intercept onChange and strip dangerous chars immediately
        // OR fire a new onChange event on Blur with the cleaned value.

        // Attempt to clean if the user left dangling whitespace or tags (fire change if needed?)
        // Actually, let's just implement the 'trim on blur' logic effectively:
        if (finalValue !== originalValue && onChange) {
            // Create a synthetic event to update parent state with trimmed value
            const newEvent = {
                ...e,
                target: { ...e.target, value: finalValue },
                currentTarget: { ...e.currentTarget, value: finalValue }
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            onChange(newEvent);
        }

        if (onBlur) {
            onBlur(e);
        }
    };

    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = props.type === 'password';

    const togglePasswordVisibility = () => {
        setShowPassword((prev) => !prev);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {label && (
                <label style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-main)'
                }}>
                    {label}
                </label>
            )}
            <div style={{ position: 'relative' }}>
                <input
                    style={{
                        padding: '16px',
                        paddingRight: isPassword ? '48px' : '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        fontSize: '11px',
                        color: 'var(--text-main)',
                        outline: 'none',
                        transition: 'background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                        width: '100%',
                        ...style
                    }}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    {...props}
                    type={isPassword ? (showPassword ? 'text' : 'password') : props.type}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        style={{
                            position: 'absolute',
                            right: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {showPassword ? (
                            // Eye Off Icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        ) : (
                            // Eye Icon
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

