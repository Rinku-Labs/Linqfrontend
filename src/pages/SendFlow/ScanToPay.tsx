import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Keyboard, CameraOff, CheckCircle, ScanLine } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { scanImageForAccount } from '../../api/scan';
import { parseScannedText } from '../../utils/scanParser';
import { preloadOnDeviceOcr, recognizeOnDevice, type OcrPixels } from '../../utils/onDeviceOcr';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'aiming' | 'reading' | 'found' | 'paused';

const CROP_W = 0.86;            // fraction of the frame we send (matches guide box)
const CROP_H = 0.6;
const MAX_OCR_WIDTH = 1100;     // cap image size to keep the call light
const SETTLE_MS = 900;          // let autofocus settle before the first capture
const RETRY_MS = 1100;          // gap between auto attempts
const MAX_AUTO_ATTEMPTS = 4;    // then pause and wait for a tap (protects credits)

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const foundRef = useRef(false);
    const runRef = useRef(0); // bumps to cancel an in-flight scan cycle

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [scanState, setScanState] = useState<ScanState>('aiming');

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
            runRef.current += 1; // cancel any running cycle
            stopCamera();
        };
    }, [stopCamera]);

    // Grab the central guide-box region of the current frame once, returning
    // both the RGBA pixels (for on-device PaddleOCR) and a base64 JPEG (for the
    // cloud fallback) so we never capture the same moment twice.
    const captureFrame = useCallback((): { pixels: OcrPixels; base64: string } | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !video.videoWidth || !video.videoHeight) return null;
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
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, sx, sy, cw, ch, 0, 0, dw, dh);
        const imageData = ctx.getImageData(0, 0, dw, dh);
        const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1] || '';
        if (!base64) return null;
        return {
            pixels: { width: dw, height: dh, data: new Uint8Array(imageData.data.buffer) },
            base64,
        };
    }, []);

    const succeed = useCallback((accountNumber: string, bankName: string, bankCode: string) => {
        if (foundRef.current) return;
        foundRef.current = true;
        runRef.current += 1;
        setScanState('found');
        setTimeout(() => {
            stopCamera();
            navigate('/send/details', {
                state: { scannedPrefill: { accountNumber, bankName: bankName || null, bankCode: bankCode || null } },
            });
        }, 600);
    }, [navigate, stopCamera]);

    // Hybrid scan cycle. Each attempt captures one frame and tries the free,
    // private on-device engine (PaddleOCR) first. If that can't read a valid
    // 10-digit NUBAN — typically messy handwriting — we fall back to one cloud
    // (Gemini) call from the second attempt onward. After a few tries we pause
    // so we don't keep spending or burning CPU on a bad aim.
    const runScanCycle = useCallback(async () => {
        const myRun = runRef.current;
        let attempts = 0;
        const cancelled = () => myRun !== runRef.current || foundRef.current;

        const attempt = async () => {
            if (cancelled()) return;
            const frame = captureFrame();
            if (!frame) {
                if (myRun === runRef.current) setTimeout(attempt, 400);
                return;
            }
            setScanState('reading');

            // 1) On-device first (free, unlimited, image never leaves the phone).
            const text = await recognizeOnDevice(frame.pixels);
            if (cancelled()) return;
            const local = text ? parseScannedText(text) : null;
            if (local?.accountNumber) {
                succeed(local.accountNumber, local.bankName ?? '', local.bankCode ?? '');
                return;
            }

            // 2) Cloud fallback for the hard cases, from the 2nd attempt onward
            //    (the first attempt stays fully on-device for printed signs).
            if (attempts >= 1) {
                const result = await scanImageForAccount(frame.base64, 'image/jpeg');
                if (cancelled()) return;
                if (result?.accountNumber) {
                    succeed(result.accountNumber, result.bankName, result.bankCode);
                    return;
                }
            }

            attempts += 1;
            if (attempts >= MAX_AUTO_ATTEMPTS) {
                setScanState('paused');
                return;
            }
            setScanState('aiming');
            setTimeout(attempt, RETRY_MS);
        };

        setTimeout(attempt, SETTLE_MS);
    }, [captureFrame, succeed]);

    // Warm up the on-device engine as the screen mounts, so the one-time model
    // download + wasm init happens while the user is still aiming — not at the
    // moment of capture. Fails soft: if it can't load we just use the cloud.
    useEffect(() => {
        void preloadOnDeviceOcr();
    }, []);

    // Start scanning once the camera is live.
    useEffect(() => {
        if (cameraStatus !== 'ready' || foundRef.current) return;
        runRef.current += 1;
        runScanCycle();
    }, [cameraStatus, runScanCycle]);

    const scanAgain = () => {
        if (foundRef.current) return;
        runRef.current += 1;
        setScanState('aiming');
        runScanCycle();
    };

    const goToManualEntry = () => {
        runRef.current += 1;
        stopCamera();
        navigate('/send/details');
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`@keyframes linq-scanline { 0% { top: 4%; } 50% { top: 94%; } 100% { top: 4%; } }`}</style>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Fit the account number and bank name inside the box — it scans automatically.
                </p>

                <div style={{
                    position: 'relative', width: '100%', aspectRatio: '3 / 4',
                    borderRadius: '24px', overflow: 'hidden', background: '#000', boxShadow: 'var(--card-shadow)',
                }}>
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStatus === 'ready' ? 'block' : 'none' }}
                    />

                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <>
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
                                border: '2px solid var(--primary)', borderRadius: '16px',
                                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                            }} />
                            {scanState !== 'paused' && (
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                    width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
                                    borderRadius: '16px', overflow: 'hidden', pointerEvents: 'none',
                                }}>
                                    <div style={{
                                        position: 'absolute', left: '6%', right: '6%', height: '2px',
                                        background: 'linear-gradient(to right, transparent, var(--primary), transparent)',
                                        boxShadow: '0 0 14px 2px rgba(124,58,237,0.75)',
                                        animation: 'linq-scanline 1.3s ease-in-out infinite',
                                    }} />
                                </div>
                            )}
                            <div style={{
                                position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(0,0,0,0.55)', color: '#fff',
                                padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                            }}>
                                {scanState === 'paused'
                                    ? <span>Tap “Scan again”</span>
                                    : <span>Scanning…</span>}
                            </div>
                        </>
                    )}

                    {cameraStatus !== 'ready' && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px',
                            color: 'rgba(255,255,255,0.85)', padding: '24px', textAlign: 'center',
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

                    {scanState === 'found' && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px',
                            background: 'rgba(0,0,0,0.6)', color: '#fff',
                        }}>
                            <CheckCircle size={40} color="var(--primary)" fill="rgba(124,58,237,0.25)" />
                            <span style={{ fontSize: '12px' }}>Scanned successfully</span>
                        </div>
                    )}
                </div>

                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cameraStatus === 'ready' && scanState === 'paused' && (
                        <button
                            onClick={scanAgain}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '16px', border: 'none',
                                background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '14px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            }}
                        >
                            <ScanLine size={18} />
                            Scan again
                        </button>
                    )}

                    <button
                        onClick={goToManualEntry}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '16px',
                            border: '1px solid var(--border-color)', background: 'var(--surface)',
                            color: 'var(--text-main)', fontWeight: 500, fontSize: '13px', cursor: 'pointer',
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
