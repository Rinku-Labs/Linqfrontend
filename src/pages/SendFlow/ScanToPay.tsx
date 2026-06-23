import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, CameraOff, CheckCircle } from 'lucide-react';
import Header from '../../components/Layout/Header';
import { scanImageForAccount } from '../../api/scan';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';
type ScanState = 'searching' | 'reading' | 'found';

const CROP_W = 0.86;            // fraction of frame sent (matches guide box)
const CROP_H = 0.6;
const MAX_OCR_WIDTH = 900;      // smaller image = faster + cheaper read
const JPEG_QUALITY = 0.72;

// Auto-capture tuning (waits for the user to align — no "scan again").
const ANALYZE_INTERVAL = 220;   // how often we check the frame
const STABLE_THRESH = 8;        // mean pixel change below this = phone held steady
const MIN_ENERGY = 6;           // min edge density = there's actually content/text
const FIRE_COOLDOWN = 2500;     // min gap between Gemini reads (protects credits)
const MAX_WAIT = 3500;          // safety: read anyway if steady-detect never trips

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);     // hidden, Gemini payload
    const freezeCanvasRef = useRef<HTMLCanvasElement>(null);   // visible, the frozen still
    const analyzeCanvasRef = useRef<HTMLCanvasElement>(null);  // hidden, tiny, for steady-detect
    const streamRef = useRef<MediaStream | null>(null);
    const foundRef = useRef(false);

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [scanState, setScanState] = useState<ScanState>('searching');

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
            stopCamera();
        };
    }, [stopCamera]);

    const freezeFrame = useCallback(() => {
        const video = videoRef.current;
        const fc = freezeCanvasRef.current;
        if (!video || !fc || !video.videoWidth) return;
        fc.width = video.videoWidth;
        fc.height = video.videoHeight;
        fc.getContext('2d')?.drawImage(video, 0, 0, fc.width, fc.height);
    }, []);

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
        setScanState('found');
        setTimeout(() => {
            stopCamera();
            navigate('/send/details', {
                state: { scannedPrefill: { accountNumber, bankName: bankName || null, bankCode: bankCode || null } },
            });
        }, 550);
    }, [navigate, stopCamera]);

    // Watch the live frame; auto-capture when the user holds steady on a clear
    // sign, then freeze + read. On a miss, silently resume — never "scan again".
    useEffect(() => {
        if (cameraStatus !== 'ready') return;

        let active = true;
        let reading = false;
        let prevGray: Float32Array | null = null;
        let searchStart = Date.now();
        let lastFire = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const analyze = (): { energy: number; diff: number | null; gray: Float32Array } | null => {
            const video = videoRef.current;
            const ac = analyzeCanvasRef.current;
            if (!video || !ac || !video.videoWidth || !video.videoHeight) return null;
            const SW = 160;
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = vw * CROP_W;
            const ch = vh * CROP_H;
            const sx = (vw - cw) / 2;
            const sy = (vh - ch) / 2;
            const sh = Math.max(1, Math.round(SW * (ch / cw)));
            ac.width = SW;
            ac.height = sh;
            const ctx = ac.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;
            ctx.drawImage(video, sx, sy, cw, ch, 0, 0, SW, sh);
            const d = ctx.getImageData(0, 0, SW, sh).data;
            const n = SW * sh;
            const gray = new Float32Array(n);
            for (let i = 0, p = 0; i < d.length; i += 4, p++) {
                gray[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            }
            // Edge energy (content/focus) — higher = more text-like detail.
            let energy = 0;
            for (let y = 1; y < sh - 1; y++) {
                for (let x = 1; x < SW - 1; x++) {
                    const idx = y * SW + x;
                    energy += Math.abs(gray[idx - 1] - gray[idx + 1]) + Math.abs(gray[idx - SW] - gray[idx + SW]);
                }
            }
            energy /= n;
            // Frame-to-frame difference (motion / steadiness).
            let diff: number | null = null;
            if (prevGray && prevGray.length === n) {
                let s = 0;
                for (let i = 0; i < n; i++) s += Math.abs(gray[i] - prevGray[i]);
                diff = s / n;
            }
            return { energy, diff, gray };
        };

        const fire = async () => {
            reading = true;
            const image = captureBase64();
            freezeFrame();
            if (!image) {
                reading = false;
                return;
            }
            setScanState('reading');
            lastFire = Date.now();
            const result = await scanImageForAccount(image, 'image/jpeg');
            if (!active || foundRef.current) return;
            if (result?.accountNumber) {
                succeed(result.accountNumber, result.bankName, result.bankCode);
                return;
            }
            // Miss — quietly go back to watching for a good frame.
            reading = false;
            prevGray = null;
            searchStart = Date.now();
            setScanState('searching');
        };

        const loop = () => {
            if (!active || foundRef.current) return;
            if (!reading) {
                const a = analyze();
                if (a) {
                    const steady = a.diff !== null && a.diff < STABLE_THRESH && a.energy > MIN_ENERGY;
                    const waited = Date.now() - searchStart > MAX_WAIT;
                    const cooled = Date.now() - lastFire > FIRE_COOLDOWN;
                    if ((steady || waited) && cooled) {
                        fire();
                    }
                    prevGray = a.gray;
                }
            }
            if (active && !foundRef.current) timer = setTimeout(loop, ANALYZE_INTERVAL);
        };

        timer = setTimeout(loop, ANALYZE_INTERVAL);
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [cameraStatus, captureBase64, freezeFrame, succeed]);

    const goToManualEntry = () => {
        stopCamera();
        navigate('/send/details');
    };

    const frozen = scanState === 'reading' || scanState === 'found';

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`@keyframes linq-scanline {0%{top:3%}50%{top:94%}100%{top:3%}}`}</style>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Line up the account number and bank inside the box — hold steady.
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

                    {/* Frozen still — appears the moment we capture, so the user knows
                        they can lower their phone */}
                    <canvas
                        ref={freezeCanvasRef}
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', display: frozen ? 'block' : 'none',
                        }}
                    />

                    {/* Framing box (brand purple) + sweeping line while reading */}
                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <div style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: `${CROP_W * 100}%`, height: `${CROP_H * 100}%`,
                            border: '2px solid var(--primary)', borderRadius: '16px',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)', overflow: 'hidden',
                        }}>
                            {scanState === 'reading' && (
                                <div style={{
                                    position: 'absolute', left: 0, right: 0, height: '3px',
                                    background: 'linear-gradient(to right, transparent, var(--primary), transparent)',
                                    boxShadow: '0 0 14px 2px rgba(124,58,237,0.75)',
                                    animation: 'linq-scanline 1.3s ease-in-out infinite',
                                }} />
                            )}
                        </div>
                    )}

                    {/* Status pill */}
                    {cameraStatus === 'ready' && scanState !== 'found' && (
                        <div style={{
                            position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            padding: '8px 14px', borderRadius: '20px', fontSize: '11px',
                        }}>
                            {scanState === 'reading' ? 'Reading…' : 'Scanning…'}
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
                <canvas ref={analyzeCanvasRef} style={{ display: 'none' }} />

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
