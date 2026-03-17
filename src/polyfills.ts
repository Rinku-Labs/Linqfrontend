import { Buffer } from 'buffer';

// Ensure global is defined for libraries that expect it
if (typeof (window as any).global === 'undefined') {
    (window as any).global = window;
}

// Ensure Buffer is defined globally
if (typeof (window as any).Buffer === 'undefined') {
    (window as any).Buffer = Buffer;
}
