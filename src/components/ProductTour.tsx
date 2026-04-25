import { useState, useEffect, useCallback, useRef } from 'react';
import './ProductTour.css';

interface TourStep {
    targetId: string;
    text: string;
}

const TOUR_STEPS: TourStep[] = [
    { targetId: 'tour-transfer', text: 'Send money to any local bank account' },
    { targetId: 'tour-deposit', text: 'Buy crypto with naira' },
    { targetId: 'tour-topup', text: 'Buy airtime, data, electricity and TV subscriptions' },
    { targetId: 'tour-swap', text: 'Swap and bridge your crypto across chains' },
    { targetId: 'tour-rewards', text: 'Refer your friends, earn rewards, climb the leaderboard' },
];

const PADDING = 10; // px around the highlighted element

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export default function ProductTour() {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<Rect | null>(null);
    const [isExiting, setIsExiting] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Check if tour should be shown
    useEffect(() => {
        const shouldShow = localStorage.getItem('linq_showTour') === 'true';
        if (shouldShow) {
            // Small delay to let the homepage fully render & layout settle
            const timer = setTimeout(() => {
                setIsActive(true);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, []);

    // Calculate the position of the current target element
    const updateTargetRect = useCallback(() => {
        if (!isActive) return;
        const step = TOUR_STEPS[currentStep];
        const el = document.getElementById(step.targetId);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        setTargetRect({
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
        });

        // Scroll the element into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [isActive, currentStep]);

    // Update rect on step change and on resize/scroll
    useEffect(() => {
        if (!isActive) return;

        // Initial position after a tiny delay for scroll to settle
        const initialTimer = setTimeout(updateTargetRect, 100);

        window.addEventListener('resize', updateTargetRect);
        window.addEventListener('scroll', updateTargetRect, true);

        return () => {
            clearTimeout(initialTimer);
            window.removeEventListener('resize', updateTargetRect);
            window.removeEventListener('scroll', updateTargetRect, true);
        };
    }, [isActive, updateTargetRect]);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleDismiss();
        }
    };

    const handleDismiss = () => {
        setIsExiting(true);
        localStorage.removeItem('linq_showTour');
        setTimeout(() => {
            setIsActive(false);
            setIsExiting(false);
        }, 300);
    };

    // Prevent body scroll while tour is active
    useEffect(() => {
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isActive]);

    if (!isActive || !targetRect) return null;

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    // Calculate tooltip position — prefer below the element, fall back to above
    const viewportHeight = window.innerHeight;
    const tooltipHeight = 120; // estimated
    const spaceBelow = viewportHeight - (targetRect.top + targetRect.height + 12);
    const placeBelow = spaceBelow > tooltipHeight;

    const tooltipStyle: React.CSSProperties = {
        left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 296)),
        ...(placeBelow
            ? { top: targetRect.top + targetRect.height + 12 }
            : { top: targetRect.top - tooltipHeight - 12 }),
    };

    // SVG mask: full-screen dark rect with a rounded-rect hole cut out
    const svgWidth = window.innerWidth;
    const svgHeight = window.innerHeight;
    const rx = 16; // border-radius for the cutout

    return (
        <div
            ref={overlayRef}
            className={`tour-overlay ${isExiting ? 'tour-overlay--exiting' : ''}`}
            onClick={(e) => {
                // Clicking the dark area dismisses
                if (e.target === overlayRef.current || (e.target as HTMLElement).tagName === 'rect') {
                    handleDismiss();
                }
            }}
        >
            {/* Dark overlay with cutout hole */}
            <svg className="tour-overlay__svg" width={svgWidth} height={svgHeight}>
                <defs>
                    <mask id="tour-mask">
                        {/* White = visible (dark overlay shows), Black = hidden (hole) */}
                        <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="white" />
                        <rect
                            x={targetRect.left}
                            y={targetRect.top}
                            width={targetRect.width}
                            height={targetRect.height}
                            rx={rx}
                            ry={rx}
                            fill="black"
                            style={{
                                transition: 'all 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width={svgWidth}
                    height={svgHeight}
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#tour-mask)"
                />
            </svg>

            {/* Dashed border around the cutout */}
            <div
                className="tour-cutout-border"
                style={{
                    top: targetRect.top,
                    left: targetRect.left,
                    width: targetRect.width,
                    height: targetRect.height,
                }}
            />

            {/* Tooltip */}
            <div className="tour-tooltip" style={tooltipStyle} key={`tooltip-${currentStep}`}>
                <p className="tour-tooltip__text">{step.text}</p>
                <div className="tour-tooltip__actions">
                    <div className="tour-tooltip__dots">
                        {TOUR_STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`tour-tooltip__dot ${i === currentStep ? 'tour-tooltip__dot--active' : ''}`}
                            />
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!isLastStep && (
                            <button className="tour-tooltip__skip-btn" onClick={handleDismiss}>
                                Skip
                            </button>
                        )}
                        <button className="tour-tooltip__next-btn" onClick={handleNext}>
                            {isLastStep ? 'Done' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
