import successSound from '../assets/Success 3.mp3';

/**
 * Plays the success sound found in assets.
 * Throttled to prevent multiple simultaneous plays.
 */
let lastPlayTime = 0;
const PLAY_COOLDOWN = 1000; // 1 second cooldown

export const playSuccessSound = () => {
    const now = Date.now();
    if (now - lastPlayTime < PLAY_COOLDOWN) return;
    
    lastPlayTime = now;
    
    try {
        const audio = new Audio(successSound);
        audio.play().catch(err => {
            console.warn('Audio playback was blocked or failed:', err);
        });
    } catch (err) {
        console.error('Failed to initialize audio:', err);
    }
};
