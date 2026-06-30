// Downloads the PP-OCRv5 models for on-device OCR (scan-to-pay) into public/.
//
// We deliberately do NOT commit these ~21MB binaries to git. Instead this script
// fetches them at install/build time so they're served from our own origin at
// runtime — no third-party CDN, which keeps the OCR engine inside a strict CSP
// and means a user's bank-account photo never leaves their device. Models are
// pinned by sha256 so we control exactly what ships; re-runs are no-ops once
// valid. Run automatically via the predev/prebuild npm hooks.
//
// The onnxruntime-web wasm runtime is NOT handled here — Vite resolves and
// self-hosts it from node_modules as a hashed asset during the build.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modelsOut = join(root, 'public', 'models');

// PP-OCRv5 mobile models, pinned by sha256 for integrity.
const MODEL_BASE = 'https://raw.githubusercontent.com/X3ZvaWQ/paddleocr.js/main/assets';
const MODELS = [
    { name: 'PP-OCRv5_mobile_det_infer.onnx', sha256: '4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae' },
    { name: 'PP-OCRv5_mobile_rec_infer.onnx', sha256: '86b1f8bffa31748e0d6364a98af983bbd33b92523141d4a02fa587b4b66b54af' },
    { name: 'ppocrv5_dict.txt', sha256: '7680a8a77c6617aba27bc9c52d320f451ae7871613a43b5358ac4a68c88d87c0' },
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function downloadModels() {
    mkdirSync(modelsOut, { recursive: true });
    for (const { name, sha256: expected } of MODELS) {
        const dest = join(modelsOut, name);
        if (existsSync(dest) && sha256(readFileSync(dest)) === expected) {
            console.log(`[ocr-assets] ${name} present and verified.`);
            continue;
        }
        const url = `${MODEL_BASE}/${name}`;
        process.stdout.write(`[ocr-assets] downloading ${name}… `);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`failed to download ${name}: HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const got = sha256(buf);
        if (got !== expected) {
            throw new Error(`checksum mismatch for ${name}: expected ${expected}, got ${got}`);
        }
        writeFileSync(dest, buf);
        console.log('ok');
    }
}

try {
    await downloadModels();
    console.log('[ocr-assets] done.');
} catch (err) {
    console.error('[ocr-assets] setup failed:', err.message);
    process.exit(1);
}
