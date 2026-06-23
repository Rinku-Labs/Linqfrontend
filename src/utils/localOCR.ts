import { createWorker } from 'tesseract.js';
import banksData from '../../banks.json';

// Keep a persistent worker so we don't reload the Tesseract core on every frame
let workerPromise: Promise<Tesseract.Worker> | null = null;

export const initOCR = async () => {
    if (!workerPromise) {
        workerPromise = (async () => {
            const worker = await createWorker('eng');
            // Optimizations for speed: only look for alphanumeric characters
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ',
            });
            return worker;
        })();
    }
    return workerPromise;
};

export interface LocalOCRResult {
    accountNumber: string | null;
    bankName: string | null;
}

export const scanFrame = async (imageBase64: string): Promise<LocalOCRResult> => {
    const worker = await initOCR();
    // Tesseract recognizes base64 images if prefixed properly or if passed as a Buffer.
    // For browser Tesseract.js, a base64 string works if it has the data URI prefix.
    const dataUri = `data:image/jpeg;base64,${imageBase64}`;
    
    const { data: { text } } = await worker.recognize(dataUri);
    
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // 1. Find a 10-digit number
    const acctMatch = cleanText.match(/\b\d{10}\b/);
    const accountNumber = acctMatch ? acctMatch[0] : null;

    // 2. Look for bank keywords
    let bankName: string | null = null;
    const lowerText = cleanText.toLowerCase();

    // Check against local banks
    const banks = banksData.data as { name: string; code: string }[];
    for (const b of banks) {
        // e.g. "opay", "moniepoint", "kuda"
        // we can split by spaces and check if the core name is in the text
        const coreName = b.name.toLowerCase().replace(/ bank| microfinance| mfb| plc| limited/g, '').trim();
        if (coreName.length > 2 && lowerText.includes(coreName)) {
            bankName = b.name;
            break;
        }
    }

    return { accountNumber, bankName };
};
