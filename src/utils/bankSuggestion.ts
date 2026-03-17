import banksData from '../../banks.json';
import nubanBanksData from '../data/nubanBanks.json';

export interface Bank {
    name: string;
    code: string;
}

export interface MatchResult {
    bank: Bank;
    fullNuban: string;
}

/**
 * NUBAN Check Digit Algorithm
 * Reference: CBN NUBAN Standards 2019
 */
const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

const NAME_MAPPING: Record<string, string> = {
    "united bank for africa": "uba",
    "guaranty trust bank": "gtbank",
    "first bank of nigeria": "first bank",
    "ecobank bank": "ecobank",
    "opay": "opay",
    "kuda microfinance bank": "kuda microfinance",
    "palmpay": "palmpay",
    "moniepoint mfb": "moniepoint mfb"
};

/**
 * Normalizes a bank name to find its exact match in banks.json
 * Returns the matched bank object { name, code } or undefined
 */
export function getNormalizedBank(bankName?: string | null, localBanks?: any[]): { name: string; code: string } | undefined {
    if (!bankName) return undefined;
    const banks = localBanks || banksData.data;
    const lowerName = bankName.toLowerCase();
    const mappedName = NAME_MAPPING[lowerName] || lowerName;

    // First try exact lowercase match
    const exactMatch = banks.find(b => b.name.toLowerCase() === mappedName || b.name.toLowerCase() === lowerName);
    if (exactMatch) {
        return exactMatch;
    }

    // Try a fuzzy match
    const fuzzyMatch = banks.find(b => b.name.toLowerCase().includes(mappedName) || mappedName.includes(b.name.toLowerCase()));

    return fuzzyMatch;
}

/**
 * Normalizes a bank name to find its exact match in banks.json
 */
function getLocalBankName(nubanName: string, localBanks: any[]): string {
    const match = getNormalizedBank(nubanName, localBanks);
    return match ? match.name : nubanName;
}

/**
 * Convert bank code to 6-digit format for NUBAN calculation.
 */
function normalizeBankCode(bankCode: string): string {
    if (bankCode.length === 6) {
        return bankCode;
    }
    if (bankCode.length === 3) {
        return bankCode.padStart(6, '0');
    }
    if (bankCode.length === 5) {
        return '9' + bankCode;
    }
    return bankCode.padStart(6, '0');
}

/**
 * Calculate NUBAN check digit for a given bank code and account serial
 */
export function calculateCheckDigit(bankCode: string, accountSerial: string): number {
    const normalizedBankCode = normalizeBankCode(bankCode);
    const paddedSerial = accountSerial.padStart(9, '0');
    const fullNumber = normalizedBankCode + paddedSerial;
    const digits = fullNumber.split('').map(Number);

    let sum = 0;
    for (let i = 0; i < 15; i++) {
        sum += digits[i] * WEIGHTS[i];
    }

    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Find matching banks for a given 10-digit account number
 */
export function findMatchingBanks(accountNumber: string): MatchResult[] {
    const cleanNumber = accountNumber.replace(/\D/g, '');

    if (cleanNumber.length !== 10) {
        return [];
    }

    const actualCheckDigit = parseInt(cleanNumber.slice(-1));
    const accountSerial = cleanNumber.slice(0, 9);
    const matches: MatchResult[] = [];
    const localBanks = banksData.data;

    // Try each NUBAN bank code
    for (const nubanBank of nubanBanksData.data) {
        if (!/^\d+$/.test(nubanBank.bank_code)) continue;

        const expectedCheckDigit = calculateCheckDigit(nubanBank.bank_code, accountSerial);

        if (expectedCheckDigit === actualCheckDigit) {
            const normalizedCode = normalizeBankCode(nubanBank.bank_code);
            const localName = getLocalBankName(nubanBank.name, localBanks);

            // Try to find the local Code to use if it's strictly required by downstream
            // but the UI only uses bank name to set the BankSelector
            const localBankObj = localBanks.find(b => b.name === localName);

            matches.push({
                bank: {
                    name: localName,
                    code: localBankObj ? localBankObj.code : nubanBank.bank_code
                },
                fullNuban: normalizedCode + accountSerial + actualCheckDigit,
            });
        }
    }

    const uniqueMatches = Array.from(new Map(matches.map(m => [m.bank.name, m])).values());

    // Add OPay and PalmPay based on prefixes common for mobile-number-based accounts
    const prefixes = ['70', '80', '81', '90', '91'];
    const startsWithPrefix = prefixes.some(p => cleanNumber.startsWith(p));

    if (startsWithPrefix) {
        // Find OPay and PalmPay in localBanks if they exist there to get correct code
        const opayLocal = localBanks.find((b: any) => b.name.toLowerCase() === 'opay');
        const palmpayLocal = localBanks.find((b: any) => b.name.toLowerCase() === 'palmpay');

        const specialSuggestions: MatchResult[] = [];

        if (opayLocal) {
            specialSuggestions.push({
                bank: { name: opayLocal.name, code: opayLocal.code },
                fullNuban: cleanNumber // Use the number as is for non-standard mobile-based accounts
            });
        }

        if (palmpayLocal) {
            specialSuggestions.push({
                bank: { name: palmpayLocal.name, code: palmpayLocal.code },
                fullNuban: cleanNumber
            });
        }

        // Add to matches if not already present
        specialSuggestions.forEach(suggestion => {
            if (!uniqueMatches.some(m => m.bank.name.toLowerCase() === suggestion.bank.name.toLowerCase())) {
                uniqueMatches.unshift(suggestion); // Add to the beginning for high relevance
            }
        });
    }

    return uniqueMatches;
}
