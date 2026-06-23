import { getNormalizedBank } from './bankSuggestion';
import banksData from '../../banks.json';

/**
 * Parser for OCR text captured from a printed bank-account sign ("scan to pay").
 *
 * Design note: OCR only has to reliably recover the 10-digit NUBAN. The bank is
 * a best-effort hint — when the OCR mangles the bank word, the caller falls back
 * to the NUBAN check-digit algorithm (see bankSuggestion.findMatchingBanks) to
 * derive candidate banks from the number itself, and the verified account name
 * is resolved server-side via /verifybank. So this parser is deliberately strict
 * about the account number and forgiving about everything else.
 */

export interface ParsedScan {
    accountNumber: string | null;
    bankName: string | null;
    bankCode: string | null;
    rawText: string;
}

// Conservative OCR letter -> digit confusions. Only the high-confidence ones, to
// avoid corrupting genuinely numeric tokens that happen to contain a stray glyph.
const DIGIT_CONFUSIONS: Record<string, string> = {
    O: '0', o: '0', Q: '0', D: '0',
    I: '1', l: '1', '|': '1',
    Z: '2',
    S: '5',
    B: '8',
    G: '6',
};

function coerceDigits(token: string): string {
    return token
        .split('')
        .map((c) => DIGIT_CONFUSIONS[c] ?? c)
        .join('');
}

interface NumericToken {
    digits: string;
    idx: number;
}

/**
 * Extract candidate numbers from OCR text using token isolation. Numbers are
 * isolated by non-alphanumeric boundaries so a 10-digit account is never read as
 * a fragment of an 11-digit phone number. Adjacent numeric tokens are also
 * combined to recover account numbers the OCR split with a space
 * (e.g. "8224 043406" -> "8224043406"), but only when the combined length is
 * exactly 10 — so two distinct numbers sitting side by side are never merged.
 */
function candidateNumbers(text: string): string[] {
    const tokens = text.split(/[^0-9A-Za-z|]+/).filter(Boolean);

    const numericTokens: NumericToken[] = [];
    tokens.forEach((tok, idx) => {
        const digitCount = (tok.match(/\d/g) || []).length;
        // "Mostly numeric": at least 2 digits and 60%+ of the token is digits.
        if (digitCount >= 2 && digitCount / tok.length >= 0.6) {
            const digits = coerceDigits(tok).replace(/\D/g, '');
            if (digits.length > 0) numericTokens.push({ digits, idx });
        }
    });

    const candidates: string[] = [];

    // Single tokens.
    for (const t of numericTokens) candidates.push(t.digits);

    // Adjacent token pairs that together make exactly 10 digits.
    for (let i = 0; i < numericTokens.length - 1; i++) {
        if (numericTokens[i + 1].idx === numericTokens[i].idx + 1) {
            const combined = numericTokens[i].digits + numericTokens[i + 1].digits;
            if (combined.length === 10) candidates.push(combined);
        }
    }

    return candidates;
}

/**
 * Returns the most likely 10-digit NUBAN from OCR text, or null.
 * Nigerian NUBAN is exactly 10 digits; phone numbers are 11 digits, so length
 * alone separates them.
 */
export function extractAccountNumber(text: string): string | null {
    const tens = candidateNumbers(text).filter((c) => c.length === 10);
    return tens.length > 0 ? tens[0] : null;
}

// Curated keyword patterns for banks/fintechs people commonly photograph.
// Matched against the uppercased OCR text; resolved to a concrete bank (name +
// code) via the existing banks.json lookup so the code can flow into /verifybank.
const BANK_PATTERNS: { pattern: RegExp; name: string }[] = [
    { pattern: /MONI?E?POINT/, name: 'Moniepoint MFB' },
    { pattern: /\bOPAY\b/, name: 'OPay' },
    { pattern: /PALM\s?PAY/, name: 'PalmPay' },
    { pattern: /\bKUDA\b/, name: 'Kuda' },
    { pattern: /GT\s?BANK|GUARANTY|\bGTB\b|\bGTCO\b/, name: 'GTBank' },
    { pattern: /ACCESS/, name: 'Access Bank' },
    { pattern: /ZENITH/, name: 'Zenith Bank' },
    { pattern: /\bUBA\b|UNITED BANK FOR AFRICA/, name: 'UBA' },
    { pattern: /FIRST\s?BANK/, name: 'First Bank of Nigeria' },
    { pattern: /FIDELITY/, name: 'Fidelity Bank' },
    { pattern: /UNION\s?BANK/, name: 'Union Bank' },
    { pattern: /STERLING/, name: 'Sterling Bank' },
    { pattern: /WEMA|\bALAT\b/, name: 'Wema Bank' },
    { pattern: /POLARIS/, name: 'Polaris Bank' },
    { pattern: /STANBIC/, name: 'Stanbic IBTC Bank' },
    { pattern: /ECOBANK/, name: 'Ecobank' },
    { pattern: /\bFCMB\b/, name: 'FCMB' },
    { pattern: /KEYSTONE/, name: 'Keystone Bank' },
    { pattern: /STANDARD\s?CHARTERED/, name: 'Standard Chartered' },
    { pattern: /PROVIDUS/, name: 'Providus Bank' },
    { pattern: /\bTAJ\b/, name: 'TAJBank' },
];

// Generic words shared by many bank names — ignored when matching name tokens
// so they don't cause false positives.
const GENERIC_BANK_WORDS = new Set([
    // Generic bank-name words
    'BANK', 'MFB', 'MICROFINANCE', 'MICRO', 'FINANCE', 'LIMITED', 'LTD', 'PLC',
    'NIGERIA', 'NIG', 'COMPANY', 'MONEY', 'DIGITAL', 'SAVINGS', 'LOANS', 'TRUST',
    'MERCHANT', 'PAYMENT', 'PAYMENTS', 'SERVICE', 'SERVICES', 'GROUP', 'HOLDINGS',
    'INTERNATIONAL', 'GLOBAL', 'CREDIT', 'CAPITAL', 'INVESTMENT', 'EXPRESS', 'XPRESS',
    'WALLET', 'FUND', 'FUNDS', 'ENTERPRISE', 'ENTERPRISES', 'VENTURES', 'RESOURCES',
    // Words that commonly appear on the sign itself (not bank identity)
    'ACCOUNT', 'ACCT', 'NUMBER', 'NUMBERS', 'NAME', 'TRANSFER', 'TRANSFERS',
    'MOBILE', 'PHONE', 'ONLINE', 'AGENT', 'AGENCY', 'STORE', 'SHOP', 'CASH', 'POS',
]);

// Precomputed distinctive bank-name tokens -> bank, longest-first (most specific).
// Lets us recognise any bank whose name appears on a sign, not just the curated
// fintech aliases below.
const BANK_TOKENS: { token: string; name: string; code: string }[] = (() => {
    const out: { token: string; name: string; code: string }[] = [];
    for (const bank of banksData.data as { name: string; code: string }[]) {
        const tokens = bank.name
            .toUpperCase()
            .replace(/[^A-Z\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 4 && !GENERIC_BANK_WORDS.has(t));
        for (const token of tokens) out.push({ token, name: bank.name, code: bank.code });
    }
    out.sort((a, b) => b.token.length - a.token.length);
    return out;
})();

/**
 * Best-effort bank detection from OCR text. Returns the resolved bank (with a
 * usable code) or null when nothing matches — callers fall back to NUBAN-derived
 * suggestions in that case.
 */
export function extractBank(text: string): { name: string; code: string } | null {
    const upper = text.toUpperCase();

    // 1. Curated aliases first — fintechs / abbreviations whose sign name differs
    //    from the official bank list (OPAY, GTB, ALAT, MONIEPOINT, …).
    for (const { pattern, name } of BANK_PATTERNS) {
        if (pattern.test(upper)) {
            const resolved = getNormalizedBank(name);
            if (resolved) return { name: resolved.name, code: resolved.code };
        }
    }

    // 2. Full bank list — match the most specific (longest) distinctive bank-name
    //    token that appears as a whole word in the OCR text. This covers any bank
    //    whose name is on the sign (UBA, Zenith, Providus, Jaiz, Fidelity, …).
    const padded = ` ${upper.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ')} `;
    for (const { token, name, code } of BANK_TOKENS) {
        if (padded.includes(` ${token} `)) {
            return { name, code };
        }
    }
    return null;
}

/**
 * Parse raw OCR text into the fields needed to prefill the transfer screen.
 */
export function parseScannedText(rawText: string): ParsedScan {
    const accountNumber = extractAccountNumber(rawText);
    const bank = extractBank(rawText);
    return {
        accountNumber,
        bankName: bank?.name ?? null,
        bankCode: bank?.code ?? null,
        rawText,
    };
}
