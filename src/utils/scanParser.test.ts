import { describe, it, expect } from 'vitest';
import { extractAccountNumber, extractBank, parseScannedText } from './scanParser';

describe('extractAccountNumber', () => {
    it('reads the 10-digit NUBAN from a typical sign', () => {
        expect(extractAccountNumber('8224043406 MONIEPOINT AJUAH EMMANUEL BEANS PALACE'))
            .toBe('8224043406');
    });

    it('joins an account number that OCR split with a space', () => {
        expect(extractAccountNumber('8224 043406 MONIEPOINT')).toBe('8224043406');
    });

    it('rejects an 11-digit phone number and picks the 10-digit account', () => {
        expect(extractAccountNumber('Call 08031234567 OPAY 6100123456')).toBe('6100123456');
    });

    it('does not read a 10-digit fragment out of an 11-digit phone', () => {
        expect(extractAccountNumber('Phone 08031234567 only')).toBeNull();
    });

    it('corrects common OCR letter-for-digit misreads', () => {
        // B->8, O->0
        expect(extractAccountNumber('B224O43406 MONIEPOINT')).toBe('8224043406');
    });

    it('returns null when there is no account-shaped number', () => {
        expect(extractAccountNumber('BEANS PALACE — best buka in town')).toBeNull();
        expect(extractAccountNumber('')).toBeNull();
    });
});

describe('extractBank', () => {
    it('detects Moniepoint', () => {
        expect(extractBank('MONIEPOINT')?.name.toLowerCase()).toContain('moniepoint');
    });

    it('detects OPay', () => {
        expect(extractBank('Pay to OPAY')?.name.toLowerCase()).toContain('opay');
    });

    it('returns null for an unknown bank word', () => {
        expect(extractBank('SOME RANDOM SHOP')).toBeNull();
    });
});

describe('parseScannedText', () => {
    it('extracts account number and bank from the Beans Palace sign', () => {
        const result = parseScannedText('8224043406 MONIEPOINT AJUAH EMMANUEL BEANS PALACE');
        expect(result.accountNumber).toBe('8224043406');
        expect(result.bankName?.toLowerCase()).toContain('moniepoint');
        expect(result.bankCode).toBeTruthy();
        expect(result.rawText).toContain('BEANS PALACE');
    });

    it('still returns the account number when the bank word is unreadable', () => {
        const result = parseScannedText('8224043406 M0N1EP01NT');
        expect(result.accountNumber).toBe('8224043406');
        expect(result.bankName).toBeNull();
    });
});
