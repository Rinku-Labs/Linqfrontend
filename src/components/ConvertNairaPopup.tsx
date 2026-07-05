import { createPortal } from 'react-dom';
import convertNairaImg from '../assets/convert-naira-popup.png';

// ConvertNairaPopup nudges winners to cash out their USDC prize to Naira. Same
// look as the home feature-discovery popups (flat image on a dimmed overlay,
// whole card tappable), but deliberately standalone: it is triggered on the
// predict page (occasionally) and always right after a prize is claimed, so it
// does NOT go through the home discovery rotation. Tapping the card runs
// onCtaClick (navigates to the transfer / off-ramp flow); the X closes it.
export default function ConvertNairaPopup({ onClose, onCtaClick }: { onClose: () => void; onCtaClick: () => void }) {
    return createPortal(
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 9998,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.3s ease-out', padding: '24px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: 'relative', maxWidth: '340px', width: '100%',
                    borderRadius: '24px', overflow: 'hidden',
                    animation: 'featurePopupIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    cursor: 'pointer',
                }}
                onClick={(e) => { e.stopPropagation(); onCtaClick(); }}
            >
                {/* Invisible close hit area over the image's built-in X button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    style={{
                        position: 'absolute', top: 0, right: 0, zIndex: 2,
                        width: '48px', height: '48px', border: 'none', background: 'transparent', cursor: 'pointer',
                    }}
                    aria-label="Close"
                />
                <img src={convertNairaImg} alt="" style={{ width: '100%', display: 'block' }} />
            </div>
        </div>,
        document.body
    );
}
