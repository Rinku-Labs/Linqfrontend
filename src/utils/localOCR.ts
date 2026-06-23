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

    // 3. From the mathematically valid banks, see if one is explicitly mentioned
    let finalBankName: string | null = null;
    const lowerText = cleanText.toLowerCase();

    // Re-add common aliases so if a mathematically valid bank is GTB, we catch "GTB" in the text
    const bankAliases: Record<string, string[]> = {
        'Guaranty Trust Bank': ['gtb', 'gt bank', 'gtbank'],
        'United Bank For Africa': ['uba'],
        'First Bank of Nigeria': ['first bank', 'firstbank'],
        'Zenith Bank': ['zenith'],
        'Access Bank': ['access'],
        'OPay': ['opay', 'paycom'],
        'Moniepoint MFB': ['moniepoint'],
        'Kuda Microfinance Bank': ['kuda'],
        'PalmPay': ['palmpay'],
        'FCMB': ['fcm', 'fcmb'],
        'Sterling Bank': ['sterling'],
        'Wema Bank': ['wema', 'alat'],
        'Union Bank of Nigeria': ['union bank'],
        'Stanbic IBTC Bank': ['stanbic'],
        'Fidelity Bank': ['fidelity'],
        'Polaris Bank': ['polaris'],
        'Keystone Bank': ['keystone'],
        'Ecobank Nigeria': ['ecobank'],
        'Providus Bank': ['providus'],
        'Jaiz Bank': ['jaiz'],
        'TAJBank': ['taj'],
        'Globus Bank': ['globus'],
        'Titan Trust Bank': ['titan'],
        'Parallex Bank': ['parallex'],
        'SunTrust Bank': ['suntrust'],
        'VFD Microfinance Bank': ['vfd'],
        'Rubies MFB': ['rubies']
    };

    for (const match of matchingBanks) {
        const officialName = match.bank.name;
        
        // Check core words from official name
        const coreWords = officialName.toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2 && !['bank', 'microfinance', 'mfb', 'plc', 'limited', 'ltd'].includes(w));
        
        let isMentioned = coreWords.some(word => lowerText.includes(word));

        // Check common aliases
        if (!isMentioned && bankAliases[officialName]) {
            isMentioned = bankAliases[officialName].some(alias => {
                if (alias.length <= 4) {
                    return new RegExp(`\\b${alias}\\b`).test(lowerText);
                }
                return lowerText.includes(alias);
            });
        }
        
        if (isMentioned) {
            finalBankName = officialName;
            break;
        }
    }

    // STRICT ENFORCEMENT: We NEVER guess. If we mathematically found valid banks 
    // but their name/alias is NOT explicitly printed in the text, we return null 
    // and force the scanner to keep looking until the user frames the bank name properly.
    if (!finalBankName) return null;

    return { accountNumber, bankName: finalBankName };
}
