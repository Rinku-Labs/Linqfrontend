import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, CameraOff, CheckCircle } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { scanFrame, initOCR } from '../../utils/localOCR';
import { getNormalizedBank } from '../../utils/bankSuggestion';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'scanning' | 'found';

const CROP_W = 0.86;          // fraction of frame sent (matches guide box)
const CROP_H = 0.6;
const MAX_OCR_WIDTH = 900;    // smaller image = faster + cheaper read
const JPEG_QUALITY = 0.72;
const FIRST_DELAY = 500;      // let autofocus settle before the first read
const POLL_GAP = 350;         // gap between reads while searching

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);     // hidden, Gemini payload
    const freezeCanvasRef = useRef<HTMLCanvasElement>(null);   // visible, the frozen still
    const streamRef = useRef<MediaStream | null>(null);
    const foundRef = useRef(false);

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [scanState, setScanState] = useState<ScanState>('scanning');

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        initOCR(); // Preload Tesseract worker as soon as component mounts
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
            stopCamera();
        };
    }, [stopCamera]);

    // Draw the current frame onto the hidden crop canvas (Gemini payload) AND the
    // visible freeze canvas (kept hidden until we succeed). Returns the base64.
    const capture = useCallback((): string | null => {
        const video = videoRef.current;
        const crop = cropCanvasRef.current;
        const freeze = freezeCanvasRef.current;
        if (!video || !crop || !video.videoWidth || !video.videoHeight) return null;

        const vw = video.videoWidth;
        const vh = video.videoHeight;

        // Freeze still = the full current frame (revealed only on success).
        if (freeze) {
            freeze.width = vw;
            freeze.height = vh;
            freeze.getContext('2d')?.drawImage(video, 0, 0, vw, vh);
        }

        // Cropped, size-capped payload for the read.
        const cw = Math.max(1, Math.round(vw * CROP_W));
        const ch = Math.max(1, Math.round(vh * CROP_H));
        const sx = Math.round((vw - cw) / 2);
        const sy = Math.round((vh - ch) / 2);
        const scale = Math.min(1, MAX_OCR_WIDTH / cw);
        const dw = Math.max(1, Math.round(cw * scale));
        const dh = Math.max(1, Math.round(ch * scale));
        crop.width = dw;
        crop.height = dh;
        const ctx = crop.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, sx, sy, cw, ch, 0, 0, dw, dh);
        return crop.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] || null;
    }, []);

    const succeed = useCallback((accountNumber: string, bankName: string, bankCode: string) => {
        if (foundRef.current) return;
        foundRef.current = true;
        setScanState('found'); // reveals the frozen frame (the one we just read)
        setTimeout(() => {
            stopCamera();
            navigate('/send/details', {
                state: { scannedPrefill: { accountNumber, bankName: bankName || null, bankCode: bankCode || null } },
            });
        }, 550);
    }, [navigate, stopCamera]);

    // Keep reading frames in the background while the camera stays live
    const lastSeenAccountRef = useRef<string | null>(null);

    useEffect(() => {
        if (cameraStatus !== 'ready') return;
        let active = true;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const tick = async () => {
            if (!active || foundRef.current) return;
            const image = capture();
            if (image) {
                const result = await scanFrame(image);
                if (!active || foundRef.current) return;
                
                if (result.accountNumber && result.bankName) {
                    // Double Confirmation Rule
                    if (lastSeenAccountRef.current === result.accountNumber) {
                        const normalized = getNormalizedBank(result.bankName);
                        succeed(result.accountNumber, result.bankName, normalized?.code || '');
                        return;
                    } else {
                        lastSeenAccountRef.current = result.accountNumber;
                    }
                } else {
                    // Reset if we see nothing valid this frame
                    lastSeenAccountRef.current = null;
                }
            }
            if (active && !foundRef.current) timer = setTimeout(tick, POLL_GAP);
        };

        timer = setTimeout(tick, FIRST_DELAY);
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [cameraStatus, capture, succeed]);

    const goToManualEntry = () => {
        stopCamera();
        navigate('/send/details');
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`@keyframes linq-scanline {0%{top:3%}50%{top:94%}100%{top:3%}}`}</style>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Point at the account number — it scans automatically.
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraStatus === 'ready' ? 'block' : 'none' }}
                    />

                    {/* Frozen still — revealed only when we've captured the data */}
                    <canvas
                        ref={freezeCanvasRef}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', display: scanState === 'found' ? 'block' : 'none',
                        }}
                    />

                    {/* Framing box (brand purple) + continuous sweeping line while scanning */}
                    {cameraStatus === 'ready' && scanState === 'scanning' && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
                            border: '2px solid var(--primary)', borderRadius: '16px',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute', left: 0, right: 0, height: '3px',
                                background: 'linear-gradient(to right, transparent, var(--primary), transparent)',
                                boxShadow: '0 0 14px 2px rgba(124,58,237,0.75)',
                                animation: 'linq-scanline 1.3s ease-in-out infinite',
                            }} />
                        </div>
                    )}

                    {/* Status pill */}
                    {cameraStatus === 'ready' && scanState === 'scanning' && (
                        <div style={{
                            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                        }}>
                            Scanning…
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

                    {/* Success */}
                    {scanState === 'found' && (
                        <div style={{
                            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: '12px',
                            background: 'rgba(0,0,0,0.45)', color: '#fff',
                        }}>
                            <CheckCircle size={40} color="var(--primary)" fill="rgba(124,58,237,0.25)" />
                            <span style={{ fontSize: '12px' }}>Scanned successfully</span>
                        </div>
                    )}
                </div>

                <canvas ref={cropCanvasRef} style={{ display: 'none' }} />

                <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
