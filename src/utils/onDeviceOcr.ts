// wasm-only entry (no WebGPU/JSEP): smaller runtime, and Vite emits + self-hosts
// the .wasm as a hashed asset on our own origin automatically.
import * as ort from 'onnxruntime-web/wasm';
import { PaddleOcrService, type OrtModule } from 'paddleocr';

/**
 * On-device OCR for scan-to-pay, powered by PaddleOCR (PP-OCRv5) running
 * locally via onnxruntime-web. This is the free, unlimited, private default in
 * the hybrid scanner: the user's bank-account photo never leaves the device.
 * When it can't read a valid account (e.g. messy handwriting), the caller falls
 * back to one cloud (Gemini) call — see api/scan.ts.
 *
 * Models and the ORT wasm runtime are self-hosted under /models and /ort (see
 * scripts/setup-ocr-assets.mjs), so nothing is fetched from a third-party CDN
 * at runtime. Every entry point fails soft (returns null / stays un-ready) so a
 * missing model or unsupported browser silently degrades to the cloud path
 * instead of breaking the scanner.
 */

export interface OcrPixels {
    width: number;
    height: number;
    data: Uint8Array;
}

const MODEL_BASE = '/models';
const DET_MODEL = `${MODEL_BASE}/PP-OCRv5_mobile_det_infer.onnx`;
const REC_MODEL = `${MODEL_BASE}/PP-OCRv5_mobile_rec_infer.onnx`;
const DICT_FILE = `${MODEL_BASE}/ppocrv5_dict.txt`;

// Single-threaded so we don't need SharedArrayBuffer / cross-origin isolation
// (which would break the wallet-connect popups). The wasm binary itself is
// resolved and self-hosted by the bundler from our own origin.
ort.env.wasm.numThreads = 1;

let servicePromise: Promise<PaddleOcrService> | null = null;
let ready = false;

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
    return res.arrayBuffer();
}

async function createService(): Promise<PaddleOcrService> {
    const [detBuf, recBuf, dictText] = await Promise.all([
        fetchBuffer(DET_MODEL),
        fetchBuffer(REC_MODEL),
        fetch(DICT_FILE).then((r) => {
            if (!r.ok) throw new Error(`Failed to load dictionary: HTTP ${r.status}`);
            return r.text();
        }),
    ]);
    const charactersDictionary = dictText.split('\n').map((l) => l.replace(/\r$/, ''));
    const service = await PaddleOcrService.createInstance({
        ort: ort as unknown as OrtModule,
        detection: { modelBuffer: detBuf },
        recognition: { modelBuffer: recBuf, charactersDictionary },
    });
    ready = true;
    return service;
}

/**
 * Kick off model download + engine init. Safe to call repeatedly; the work runs
 * once. Call it as the scan screen mounts so the ~21MB one-time download and
 * wasm init happen while the user is still aiming the camera, not at capture.
 * Returns true if the engine is ready, false if it failed to load.
 */
export async function preloadOnDeviceOcr(): Promise<boolean> {
    if (!servicePromise) {
        servicePromise = createService().catch((err) => {
            // Reset so a later attempt can retry, and let the caller fall back.
            console.warn('[onDeviceOcr] init failed, will use cloud OCR:', err);
            servicePromise = null;
            throw err;
        });
    }
    try {
        await servicePromise;
        return true;
    } catch {
        return false;
    }
}

export function isOnDeviceOcrReady(): boolean {
    return ready;
}

/**
 * Run on-device OCR over RGBA pixels (from canvas getImageData) and return the
 * recognised text joined into one string, or null if the engine isn't available
 * or finds nothing. Never throws — failures degrade to the cloud fallback.
 */
export async function recognizeOnDevice(pixels: OcrPixels): Promise<string | null> {
    try {
        if (!servicePromise) {
            const ok = await preloadOnDeviceOcr();
            if (!ok) return null;
        }
        const service = await servicePromise!;
        const results = await service.recognize(pixels);
        if (!results?.length) return null;
        const text = results.map((r) => r.text).join(' ').trim();
        return text || null;
    } catch (err) {
        console.warn('[onDeviceOcr] recognize failed, falling back to cloud:', err);
        return null;
    }
}
