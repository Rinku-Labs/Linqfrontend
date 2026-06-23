import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, CameraOff, CheckCircle, ScanLine, AlertCircle } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { scanImageForAccount } from '../../api/scan';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'aiming' | 'scanning' | 'found' | 'failed';

const CROP_W = 0.86;          // fraction of frame sent (matches guide box)
const CROP_H = 0.6;
const MAX_OCR_WIDTH = 900;    // smaller image = faster upload + faster/cheaper read
const JPEG_QUALITY = 0.72;
const SETTLE_MS = 500;        // brief settle so autofocus catches the sign

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);   // hidden, builds the Gemini payload
    const freezeCanvasRef = useRef<HTMLCanvasElement>(null); // visible, the frozen still
    const streamRef = useRef<MediaStream | null>(null);
    const foundRef = useRef(false);
    const runRef = useRef(0);

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [scanState, setScanState] = useState<ScanState>('aiming');

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const startCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraStatus('error');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
            runRef.current += 1;
            stopCamera();
        };
    }, [stopCamera]);

    // Draw the current frame onto the visible canvas — the "freeze".
    const freezeFrame = useCallback(() => {
        const video = videoRef.current;
        const fc = freezeCanvasRef.current;
        if (!video || !fc || !video.videoWidth) return;
        fc.width = video.videoWidth;
        fc.height = video.videoHeight;
        fc.getContext('2d')?.drawImage(video, 0, 0, fc.width, fc.height);
    }, []);

    // Crop the central region to base64 JPEG for the Gemini call.
    const captureBase64 = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = cropCanvasRef.current;
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
        return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] || null;
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
        }, 550);
    }, [navigate, stopCamera]);

    // One clean shot: freeze the frame, animate while reading, then resolve.
    const doScan = useCallback(async () => {
        const myRun = runRef.current;
        const image = captureBase64();
        freezeFrame();
        if (!image) {
            setScanState('failed');
            return;
        }
        setScanState('scanning');
        const result = await scanImageForAccount(image, 'image/jpeg');
        if (myRun !== runRef.current || foundRef.current) return;
        if (result?.accountNumber) {
            succeed(result.accountNumber, result.bankName, result.bankCode);
        } else {
            setScanState('failed');
        }
    }, [captureBase64, freezeFrame, succeed]);

    // Auto-fire one scan when the camera goes live.
    useEffect(() => {
        if (cameraStatus !== 'ready' || foundRef.current) return;
        runRef.current += 1;
        const id = setTimeout(() => doScan(), SETTLE_MS);
        return () => clearTimeout(id);
    }, [cameraStatus, doScan]);

    const scanAgain = () => {
        if (foundRef.current) return;
        runRef.current += 1;
        setScanState('aiming');
        setTimeout(() => doScan(), SETTLE_MS);
    };

    const goToManualEntry = () => {
        runRef.current += 1;
        stopCamera();
        navigate('/send/details');
    };

    const frozen = scanState === 'scanning' || scanState === 'found';

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`@keyframes linq-scanline {0%{top:3%}50%{top:94%}100%{top:3%}}`}</style>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Fit the account number and bank name inside the box — it scans automatically.
                </p>

                <div style={{
                    position: 'relative', width: '100%', aspectRatio: '3 / 4',
                    borderRadius: '24px', overflow: 'hidden', background: '#000', boxShadow: 'var(--card-shadow)',
                }}>
                    {/* Live camera */}
                    <video
                        ref={videoRef}
                        playsInline
                        muted
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            display: cameraStatus === 'ready' ? 'block' : 'none',
                        }}
                    />

                    {/* Frozen still (shown while reading / on success) */}
                    <canvas
                        ref={freezeCanvasRef}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', display: frozen ? 'block' : 'none',
                        }}
                    />

                    {/* Framing box + sweeping scan-line */}
                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
                            border: `2px solid ${scanState === 'failed' ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.85)'}`,
                            borderRadius: '16px',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                            overflow: 'hidden',
                        }}>
                            {scanState === 'scanning' && (
                                <div style={{
                                    position: 'absolute', left: 0, right: 0, height: '3px',
                                    background: 'linear-gradient(to right, transparent, #22c55e, transparent)',
                                    boxShadow: '0 0 12px 2px rgba(34,197,94,0.7)',
                                    animation: 'linq-scanline 1.4s ease-in-out infinite',
                                }} />
                            )}
                        </div>
                    )}

                    {/* Status pill */}
                    {cameraStatus === 'ready' && (scanState === 'scanning' || scanState === 'aiming') && (
                        <div style={{
                            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                        }}>
                            Reading…
                        </div>
                    )}

                    {/* Non-ready camera states */}
                    {cameraStatus !== 'ready' && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px',
                            color: 'rgba(255,255,255,0.85)', padding: '24px', textAlign: 'center',
                        }}>
                            {cameraStatus === 'starting' && <span style={{ fontSize: '11px' }}>Starting camera…</span>}
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

                    {/* Failed overlay */}
                    {scanState === 'failed' && cameraStatus === 'ready' && (
                        <div style={{
                            position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(0,0,0,0.6)', color: '#fff',
                            padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                        }}>
                            <AlertCircle size={14} />
                            <span>Couldn’t read it — line it up and scan again</span>
                        </div>
                    )}

                    {/* Success overlay */}
                    {scanState === 'found' && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px',
                            background: 'rgba(0,0,0,0.45)', color: '#fff',
                        }}>
                            <CheckCircle size={40} color="#22c55e" />
                            <span style={{ fontSize: '12px' }}>Scanned successfully</span>
                        </div>
                    )}
                </div>

                <canvas ref={cropCanvasRef} style={{ display: 'none' }} />

                <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {cameraStatus === 'ready' && scanState === 'failed' && (
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
