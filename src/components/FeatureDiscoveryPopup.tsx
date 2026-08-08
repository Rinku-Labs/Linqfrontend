import { createPortal } from 'react-dom';
import type { FeatureKey } from '../hooks/useFeatureDiscovery';

import inviteImg from '../assets/invite.png';
import saveAndSaveImg from '../assets/save-and-save.png';
import multipleChainImg from '../assets/multiple-chain.png';
import swapImg from '../assets/swap.png';

const featureImages: Record<FeatureKey, string> = {
    invite: inviteImg,
    'save-and-save': saveAndSaveImg,
    'multiple-chain': multipleChainImg,
    swap: swapImg,
};

interface Props {
    feature: FeatureKey;
    onClose: () => void;
    onCtaClick: () => void;
}

export default function FeatureDiscoveryPopup({ feature, onClose, onCtaClick }: Props) {
    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                animation: 'fadeIn 0.3s ease-out',
                padding: '24px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    position: 'relative',
                    maxWidth: '340px',
                    width: '100%',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    animation: 'featurePopupIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    cursor: 'pointer',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onCtaClick();
                }}
            >
                {/* Invisible close hit area over the image's built-in X button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        zIndex: 2,
                        width: '48px',
                        height: '48px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                    }}
                    aria-label="Close"
                />

                {/* Feature image */}
                <img
                    src={featureImages[feature]}
                    alt=""
                    style={{
                        width: '100%',
                        display: 'block',
                    }}
                />
            </div>
        </div>,
        document.body
    );
}
