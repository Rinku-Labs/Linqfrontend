import client from './client';
import { getNormalizedBank } from '../utils/bankSuggestion';

export interface ScanResult {
    accountNumber: string;
    bankName: string;
    bankCode: string;
}

/**
 * Cloud OCR fallback for scan-to-pay. Sends a base64 image to the backend /ocr
 * endpoint (Google Gemini) to extract the account number + bank from messy or
 * handwritten signs the on-device engine couldn't read.
 *
 * Returns null on any failure — including when the backend OCR isn't configured
 * (HTTP 503) — so the caller can silently keep its on-device result.
 */
export const scanImageForAccount = async (
    imageBase64: string,
    mimeType = 'image/jpeg',
): Promise<ScanResult | null> => {
    try {
        const { data } = await client.post<{ accountNumber: string; bankName: string }>('/ocr', {
            image: imageBase64,
            mimeType,
        });
        if (!data?.accountNumber) return null;
        const normalized = data.bankName ? getNormalizedBank(data.bankName) : undefined;
        return {
            accountNumber: data.accountNumber,
            bankName: normalized?.name || data.bankName || '',
            bankCode: normalized?.code || '',
        };
    } catch {
        return null;
    }
};
