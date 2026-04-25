import { useState, useEffect, useRef } from 'react';
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

const PADDING = 10;

export default function ProductTour() {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);
    
    const overlayRef = useRef<HTMLDivElement>(null);
    const cutoutRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>();
    
    // Check if tour should be shown
    useEffect(() => {
        const shouldShow = localStorage.getItem('linq_showTour') === 'true';
        if (shouldShow) {
            setIsActive(true);
        }
    }, []);

    // Continuous tracking loop for perfect alignment
    useEffect(() => {
        if (!isActive || isExiting) return;

        const updatePosition = () => {
            const step = TOUR_STEPS[currentStep];
            const el = document.getElementById(step.targetId);
            
            if (el && cutoutRef.current && tooltipRef.current) {
                const rect = el.getBoundingClientRect();
                
                // Cutout positioning
                const top = rect.top - PADDING;
                const left = rect.left - PADDING;
                const width = rect.width + PADDING * 2;
                const height = rect.height + PADDING * 2;
                
                cutoutRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                cutoutRef.current.style.width = `${width}px`;
                cutoutRef.current.style.height = `${height}px`;
                cutoutRef.current.style.opacity = '1';
                
                // Tooltip positioning
                const tooltipHeight = tooltipRef.current.offsetHeight || 120;
                const viewportHeight = window.innerHeight;
                const spaceBelow = viewportHeight - (top + height + 12);
                const placeBelow = spaceBelow > tooltipHeight;
                
                const tooltipLeft = Math.max(16, Math.min(left, window.innerWidth - 296));
                const tooltipTop = placeBelow ? top + height + 12 : top - tooltipHeight - 12;
                
                tooltipRef.current.style.transform = `translate3d(${tooltipLeft}px, ${tooltipTop}px, 0)`;
                tooltipRef.current.style.opacity = '1';
            } else if (cutoutRef.current && tooltipRef.current) {
                // Element not found yet (e.g. data still loading, skeleton showing)
                cutoutRef.current.style.opacity = '0';
                tooltipRef.current.style.opacity = '0';
            }
            
            rafRef.current = requestAnimationFrame(updatePosition);
        };
        
        rafRef.current = requestAnimationFrame(updatePosition);
        
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [isActive, isExiting, currentStep]);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
            // Smooth scroll to ensure the next element is centered
            const nextEl = document.getElementById(TOUR_STEPS[currentStep + 1].targetId);
            if (nextEl) {
                nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
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

    if (!isActive) return null;

    const step = TOUR_STEPS[currentStep];
    const isLastStep = currentStep === TOUR_STEPS.length - 1;

    return (
        <div
            ref={overlayRef}
            className={`tour-overlay ${isExiting ? 'tour-overlay--exiting' : ''}`}
            onClick={(e) => {
                // Only dismiss if clicking the dark overlay area
                if (e.target === overlayRef.current) {
                    handleDismiss();
                }
            }}
        >
            {/* The Cutout and Dark Mask */}
            <div
                ref={cutoutRef}
                className="tour-cutout"
                style={{ opacity: 0 }}
            />

            {/* The Tooltip */}
            <div
                ref={tooltipRef}
                className="tour-tooltip"
                style={{ opacity: 0 }}
            >
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
