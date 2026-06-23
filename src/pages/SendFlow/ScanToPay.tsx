import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Keyboard, CameraOff, CheckCircle } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { preprocessForOcr } from '../../utils/imagePreprocess';
import { parseScannedText } from '../../utils/scanParser';
import { findMatchingBanks } from '../../utils/bankSuggestion';
import { scanImageForAccount } from '../../api/scan';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'idle' | 'scanning' | 'found';
type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

// How the auto-scan loop is paced / cost-controlled.
const FRAME_INTERVAL_MS = 600;      // breather between local reads
const GEMINI_AFTER_MS = 1500;       // give the free engine a pass or two before any cloud call
const GEMINI_COOLDOWN_MS = 4000;    // at most ~one cloud call per this window
const STABLE_READS = 2;             // same number across N frames -> trust it (no cloud needed)

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const foundRef = useRef(false);

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [scanState, setScanState] = useState<ScanState>('idle');

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    // --- Camera lifecycle ---
    useEffect(() => {
        let cancelled = false;

        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraStatus('error');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play().catch(() => undefined);
                }
                setCameraStatus('ready');
            } catch (err) {
                const name = (err as DOMException)?.name;
                setCameraStatus(name === 'NotAllowedError' ? 'denied' : 'error');
            }
        };

        startCamera();
        return () => {
            cancelled = true;
            stopCamera();
        };
    }, [stopCamera]);

    // --- Continuous auto-scan loop (no button) ---
    useEffect(() => {
        if (cameraStatus !== 'ready') return;

        let active = true;
        let worker: TesseractWorker | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const startedAt = Date.now();
        let lastGeminiAt = 0;
        let prevCandidate = '';
        let stableCount = 0;
        // Remember the first bank read during this scan, so if a later frame locks
        // the number on a frame that didn't catch the bank word, we still have it.
        let bestBank: { name: string; code: string } | null = null;

        const succeed = (accountNumber: string, bankName: string | null, bankCode: string | null) => {
            if (foundRef.current) return;
            foundRef.current = true;
            active = false;
            setScanState('found');
            setTimeout(() => {
                stopCamera();
                navigate('/send/details', {
                    state: {
                        scannedPrefill: {
                            accountNumber,
                            bankName: bankName || null,
                            bankCode: bankCode || null,
                        },
                    },
                });
            }, 700);
        };

        const tick = async () => {
            if (!active || foundRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && worker && video.videoWidth && video.videoHeight) {
                try {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        // Keep the original colour frame for the cloud before binarizing.
                        const originalBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

                        // Tier 1 — free on-device read. Trust only a checksum-valid NUBAN.
                        preprocessForOcr(canvas);
                        const { data } = await worker.recognize(canvas);
                        const text = data.text || '';
                        const local = parseScannedText(text);
                        if (!bestBank && local.bankName && local.bankCode) {
                            bestBank = { name: local.bankName, code: local.bankCode };
                        }

                        // Tier 1 — free on-device. Accept immediately on a checksum-valid
                        // NUBAN, or when the SAME number is read across consecutive frames
                        // (a stable read we can trust without the cloud — this is what makes
                        // printed signs lock on fast).
                        if (local.accountNumber) {
                            if (findMatchingBanks(local.accountNumber).length > 0) {
                                succeed(local.accountNumber, local.bankName || bestBank?.name || null, local.bankCode || bestBank?.code || null);
                                return;
                            }
                            if (local.accountNumber === prevCandidate) {
                                stableCount += 1;
                            } else {
                                prevCandidate = local.accountNumber;
                                stableCount = 1;
                            }
                            if (stableCount >= STABLE_READS) {
                                succeed(local.accountNumber, local.bankName || bestBank?.name || null, local.bankCode || bestBank?.code || null);
                                return;
                            }
                        }

                        // Tier 2 — accurate cloud read (Gemini). Triggered as soon as a sign is
                        // detected in frame — a bank keyword, an account-shaped number, or a
                        // cluster of digits — rather than waiting for the free engine to give up.
                        // Throttled by a cooldown so it stays cheap; no-ops with no API key.
                        const digitCount = (text.match(/\d/g) || []).length;
                        const hasSignal = !!local.bankName || !!local.accountNumber || digitCount >= 8;
                        const now = Date.now();
                        if (
                            hasSignal &&
                            now - startedAt > GEMINI_AFTER_MS &&
                            now - lastGeminiAt > GEMINI_COOLDOWN_MS
                        ) {
                            lastGeminiAt = now;
                            const cloud = await scanImageForAccount(originalBase64, 'image/jpeg');
                            if (cloud?.accountNumber) {
                                succeed(cloud.accountNumber, cloud.bankName || bestBank?.name || null, cloud.bankCode || bestBank?.code || null);
                                return;
                            }
                        }
                    }
                } catch {
                    // Ignore a bad frame and keep scanning.
                }
            }

            if (active && !foundRef.current) {
                timer = setTimeout(tick, FRAME_INTERVAL_MS);
            }
        };

        (async () => {
            try {
                const { createWorker } = await import('tesseract.js');
                worker = await createWorker('eng');
                await worker.setParameters({
                    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
                });
                if (!active) {
                    await worker.terminate().catch(() => undefined);
                    return;
                }
                setScanState('scanning');
                tick();
            } catch {
                // OCR engine failed to load — user can still type it in.
            }
        })();

        return () => {
            active = false;
            if (timer) clearTimeout(timer);
            if (worker) worker.terminate().catch(() => undefined);
        };
    }, [cameraStatus, navigate, stopCamera]);

    const goToManualEntry = () => {
        stopCamera();
        navigate('/send/details');
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Point at the account number — it scans automatically.
                </p>

                {/* Camera viewport */}
                <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '3 / 4',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    background: '#000',
                    boxShadow: 'var(--card-shadow)',
                }}>
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStatus === 'ready' ? 'block' : 'none' }}
                    />

                    {/* Framing guide + live "scanning" pill */}
                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <>
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                width: '78%', height: '36%',
                                border: '2px solid rgba(255,255,255,0.85)',
                                borderRadius: '16px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                            }} />
                            <div style={{
                                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(0,0,0,0.55)', color: '#fff',
                                padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                            }}>
                                <Loader2 className="animate-spin" size={14} />
                                <span>Scanning…</span>
                            </div>
                        </>
                    )}

                    {/* Non-ready states */}
                    {cameraStatus !== 'ready' && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '12px', color: 'rgba(255,255,255,0.85)', padding: '24px', textAlign: 'center',
                        }}>
                            {cameraStatus === 'starting' && (
                                <>
                                    <Loader2 className="animate-spin" size={28} />
                                    <span style={{ fontSize: '11px' }}>Starting camera…</span>
                                </>
                            )}
                            {(cameraStatus === 'denied' || cameraStatus === 'error') && (
                                <>
                                    <CameraOff size={28} />
                                    <span style={{ fontSize: '11px' }}>
                                        {cameraStatus === 'denied'
                                            ? 'Camera permission was blocked. You can still type the details in.'
                                            : "Camera isn't available on this device. You can still type the details in."}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Success overlay */}
                    {scanState === 'found' && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '12px', background: 'rgba(0,0,0,0.6)', color: '#fff',
                        }}>
                            <CheckCircle size={40} color="#22c55e" />
                            <span style={{ fontSize: '12px' }}>Scanned successfully</span>
                        </div>
                    )}
                </div>

                {/* Hidden working canvas */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={goToManualEntry}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '16px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            fontWeight: 500,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        }}
                    >
                        <Keyboard size={16} />
                        Type it in instead
                    </button>

                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                        You'll always confirm the verified account name before any money is sent.
                    </p>
                </div>
            </div>
        </div>
    );
}
