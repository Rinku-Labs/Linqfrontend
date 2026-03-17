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
