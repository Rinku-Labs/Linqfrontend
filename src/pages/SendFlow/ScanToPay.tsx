import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Loader2, Keyboard, CameraOff } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/Layout/Header';
import { preprocessForOcr } from '../../utils/imagePreprocess';
import { parseScannedText } from '../../utils/scanParser';

type CameraStatus = 'starting' | 'ready' | 'denied' | 'error';

export default function ScanToPay() {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('starting');
    const [isScanning, setIsScanning] = useState(false);

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

    const goToManualEntry = () => {
        stopCamera();
        navigate('/send/details');
    };

    const handleCapture = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || cameraStatus !== 'ready' || isScanning) return;
        if (!video.videoWidth || !video.videoHeight) return;

        setIsScanning(true);
        let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null;
        try {
            // Grab the current frame.
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) throw new Error('canvas unavailable');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Clean it up, then OCR. Tesseract is lazy-loaded so it never bloats
            // the initial bundle.
            preprocessForOcr(canvas);
            const { createWorker } = await import('tesseract.js');
            worker = await createWorker('eng');
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
            });
            const { data } = await worker.recognize(canvas);

            const parsed = parseScannedText(data.text || '');
            if (!parsed.accountNumber) {
                toast.error("Couldn't read an account number. Hold steady and try again, or type it in.");
                return;
            }

            stopCamera();
            navigate('/send/details', {
                state: {
                    scannedPrefill: {
                        accountNumber: parsed.accountNumber,
                        bankName: parsed.bankName,
                        bankCode: parsed.bankCode,
                    },
                },
            });
        } catch {
            toast.error('Scan failed. Please try again or type the details in.');
        } finally {
            if (worker) await worker.terminate().catch(() => undefined);
            setIsScanning(false);
        }
    };

    return (
        <div className="page-enter" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header title="Scan to pay" showBack />

            <div style={{ padding: '0 4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>
                    Point your camera at an account number written on a sign or screen.
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

                    {/* Framing guide */}
                    {cameraStatus === 'ready' && (
                        <div style={{
                            position: 'absolute',
                            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                            width: '78%', height: '36%',
                            border: '2px solid rgba(255,255,255,0.85)',
                            borderRadius: '16px',
                            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                        }} />
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

                    {/* Scanning overlay */}
                    {isScanning && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: '12px', background: 'rgba(0,0,0,0.55)', color: '#fff',
                        }}>
                            <Loader2 className="animate-spin" size={28} />
                            <span style={{ fontSize: '11px' }}>Reading…</span>
                        </div>
                    )}
                </div>

                {/* Hidden working canvas */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ marginTop: 'auto', paddingTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleCapture}
                        disabled={cameraStatus !== 'ready' || isScanning}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '16px',
                            border: 'none',
                            background: cameraStatus === 'ready' && !isScanning ? 'var(--primary)' : 'var(--border-color)',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: cameraStatus === 'ready' && !isScanning ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'background 0.2s',
                        }}
                    >
                        {isScanning ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
                        {isScanning ? 'Scanning' : 'Capture & scan'}
                    </button>

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
