const PLACEHOLDER_VALUES = new Set(['', '-', '--', '---', '—', 'n/a', 'na', 'null', 'undefined']);

export const cleanDisplayValue = (value?: string | number | null): string => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return PLACEHOLDER_VALUES.has(text.toLowerCase()) ? '' : text;
};

export const displayOrFallback = (value?: string | number | null, fallback = 'N/A'): string => {
    return cleanDisplayValue(value) || fallback;
};
