import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Keyboard, CameraOff, CheckCircle } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { preprocessForOcr } from '../../utils/imagePreprocess';
import { parseScannedText } from '../../utils/scanParser';
import { findMatchingBanks } from '../../utils/bankSuggestion';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'idle' | 'scanning' | 'found';
type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

const FRAME_INTERVAL_MS = 300;   // small breather between reads
const STABLE_READS = 2;          // same number across N frames -> trust it
const CROP_W = 0.84;             // fraction of the frame we OCR (matches the guide box)
const CROP_H = 0.54;
const MAX_OCR_WIDTH = 1000;      // cap OCR input size for speed on high-res cameras

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

    // --- Continuous on-device auto-scan (no button, no cloud) ---
    useEffect(() => {
        if (cameraStatus !== 'ready') return;

        let active = true;
        let worker: TesseractWorker | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let prevCandidate = '';
        let stableCount = 0;
        let bestBank: { name: string; code: string } | null = null;

        const succeed = (accountNumber: string, bankName: string | null, bankCode: string | null) => {
            if (foundRef.current) return;
            foundRef.current = true;
            active = false;
            setScanState('found');
            setTimeout(() => {
                stopCamera();
                navigate('/send/details', {
                    state: { scannedPrefill: { accountNumber, bankName: bankName || null, bankCode: bankCode || null } },
                });
            }, 600);
        };

        const tick = async () => {
            if (!active || foundRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && worker && video.videoWidth && video.videoHeight) {
                try {
                    // Crop to the central guide box and cap the OCR size — far less
                    // for Tesseract to read = faster, and cleaner = bank word read too.
                    const vw = video.videoWidth;
                    const vh = video.videoHeight;
                    const cw = Math.max(1, Math.round(vw * CROP_W));
                    const ch = Math.max(1, Math.round(vh * CROP_H));
                    const sx = Math.round((vw - cw) / 2);
                    const sy = Math.round((vh - ch) / 2);
                    const scale = Math.min(1, MAX_OCR_WIDTH / cw);
                    const dw = Math.max(1, Math.round(cw * scale));
                    const dh = Math.max(1, Math.round(ch * scale));

                    canvas.width = dw;
                    canvas.height = dh;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(video, sx, sy, cw, ch, 0, 0, dw, dh);
                        preprocessForOcr(canvas);
                        const { data } = await worker.recognize(canvas);
                        const text = data.text || '';
                        const local = parseScannedText(text);

                        if (!bestBank && local.bankName && local.bankCode) {
                            bestBank = { name: local.bankName, code: local.bankCode };
                        }

                        if (local.accountNumber) {
                            const bankName = local.bankName || bestBank?.name || null;
                            const bankCode = local.bankCode || bestBank?.code || null;

                            // Trust a checksum-valid NUBAN immediately, or the same number
                            // read across consecutive frames.
                            if (findMatchingBanks(local.accountNumber).length > 0) {
                                succeed(local.accountNumber, bankName, bankCode);
                                return;
                            }
                            if (local.accountNumber === prevCandidate) {
                                stableCount += 1;
                            } else {
                                prevCandidate = local.accountNumber;
                                stableCount = 1;
                            }
                            if (stableCount >= STABLE_READS) {
                                succeed(local.accountNumber, bankName, bankCode);
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
                    Fit the account number and bank name inside the box — it scans automatically.
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

                    {/* Framing guide (matches the OCR crop) + live "scanning" pill */}
                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <>
                            <div style={{
                                position: 'absolute',
                                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
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
