/**
 * Sanitizes user input to prevent XSS and other injection attacks.
 * Strips HTML tags and dangerous characters.
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return input;

    // 1. Strip all HTML tags
    let sanitized = input.replace(/<[^>]*>?/gm, '');

    // 2. Remove potentially dangerous characters/sequences if strictly not needed
    // (Optional: depending on strictness, but stripping tags is usually enough for Act I)

    return sanitized;
}

/**
 * Trims whitespace from user input.
 * tailored for onBlur usage.
 */
export function trimInput(input: string): string {
    if (typeof input !== 'string') return input;
    return input.trim();
}
/**
 * Sanitizes technical error messages to be user-friendly.
 * Strips URLs, raw JSON, and technical keywords.
 */
export function sanitizeErrorMessage(message: string | undefined): string {
    if (!message || typeof message !== 'string') return 'An error occurred. Please try again.';

    let sanitized = message;

    // 1. Strip URLs (http/https)
    sanitized = sanitized.replace(/https?:\/\/[^\s"']+/g, '');

    // 2. Map common technical phrases to user-friendly ones
    const lower = sanitized.toLowerCase();
    if (lower.includes('timeout') || lower.includes('deadline exceeded')) {
        return 'The request timed out. Please check your connection and try again.';
    }
    if (lower.includes('insufficient')) {
        return 'Insufficient funds or limit exceeded.';
    }
    if (lower.includes('nomba') || lower.includes('flutterwave') || lower.includes('request failed')) {
        return 'Payment processing failed. Please try again in a few minutes.';
    }
    if (sanitized.includes('{') && sanitized.includes('}')) {
        return 'An internal error occurred while processing your request.';
    }

    // 3. Clean up any remaining artifacts like "Transaction Failed: " prefix if it's followed by nothing useful
    sanitized = sanitized.replace(/^Transaction Failed:\s*/i, '');
    sanitized = sanitized.replace(/^request failed:\s*/i, '');

    return sanitized.trim() || 'An error occurred. Please try again.';
}

/**
 * Returns true if the error message indicates a gas/network fee shortage.
 */
export function isGasFeeError(message: string | undefined): boolean {
    if (!message) return false;
    const lower = message.toLowerCase();
    return (
        lower.includes('insufficient funds for gas') ||
        lower.includes('out of gas') ||
        lower.includes('gas required exceeds') ||
        lower.includes('insufficient fee') ||
        lower.includes('insufficient energy') ||    // Tron
        lower.includes('insufficient bandwidth') || // Tron
        lower.includes('not enough energy') ||      // Tron
        lower.includes('not enough bandwidth') ||   // Tron
        (lower.includes('gas') && lower.includes('insufficient')) ||
        (lower.includes('fee') && lower.includes('insufficient'))
    );
}
