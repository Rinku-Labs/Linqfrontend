import { createWorker } from 'tesseract.js';
import banksData from '../../banks.json';
import { findMatchingBanks } from './bankSuggestion';

export async function initOCR() {
    const worker = await createWorker('eng');
    return worker;
}

export async function scanFrame(
    worker: any,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    cropRect: { x: number; y: number; width: number; height: number }
): Promise<{ accountNumber: string; bankName: string } | null> {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = cropRect.width;
    canvas.height = cropRect.height;
    ctx.drawImage(
        video,
        cropRect.x, cropRect.y, cropRect.width, cropRect.height,
        0, 0, cropRect.width, cropRect.height
    );

    // B&W filter for OCR contrast
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const brightness = 0.34 * d[i] + 0.5 * d[i + 1] + 0.16 * d[i + 2];
        const val = brightness > 120 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    const { data: { text } } = await worker.recognize(canvas);
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // 1. Find exactly 10 digits
    const acctMatch = cleanText.match(/\b\d{10}\b/);
    if (!acctMatch) return null;
    const accountNumber = acctMatch[0];

    // 2. Use NUBAN Checksum to mathematically find valid banks for this number
    const matchingBanks = findMatchingBanks(accountNumber);
    if (matchingBanks.length === 0) {
        // Mathematically invalid account number (e.g., a phone number)
        return null;
    }

    // 3. From the 1 or 2 mathematically valid banks, see if one is mentioned
    let finalBankName: string | null = null;
    const lowerText = cleanText.toLowerCase();

    for (const match of matchingBanks) {
        const coreWords = match.bank.name.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2 && !['bank', 'microfinance', 'mfb', 'plc', 'limited', 'ltd'].includes(w));
        
        // If the OCR text contains ANY unique word from the mathematically valid bank (e.g. "kuda", "opay")
        const isMentioned = coreWords.some(word => lowerText.includes(word));
        
        if (isMentioned) {
            finalBankName = match.bank.name;
            break;
        }
    }

    // If we didn't find the name in text, but there is ONLY ONE mathematically valid bank, it's a 99% guarantee
    if (!finalBankName && matchingBanks.length === 1) {
        finalBankName = matchingBanks[0].bank.name;
    }

    if (!finalBankName) return null;

    return { accountNumber, bankName: finalBankName };
}
