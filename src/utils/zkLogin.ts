import { jwtDecode } from 'jwt-decode';
import { computeZkLoginAddress } from '@mysten/sui/zklogin';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_CLIENT_KEY;
// Using a fixed salt for now as requested for "simple production" simulation. 
// In a real production environment where privacy is key, this should be a service that maps sub -> salt, 
// or a derived value from a master secret only known to the backend.
// Here we use a client-side derivation for demonstration/simplicity as we don't have a backend salt service.
// WARNING: Changing this MASTER_SEED will change all generated addresses.
const MASTER_SEED = 'LINQ_ZK_LOGIN_MASTER_SEED_V1';

export interface GoogleUser {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
    iss: string;
    aud: string;
}

export function getGoogleLoginUrl(): string {
    const redirectUri = window.location.origin + '/onboarding';
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || '',
        redirect_uri: redirectUri,
        response_type: 'id_token',
        scope: 'openid email profile',
        nonce: generateNonce(), // Should ideally be validated
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function parseGoogleToken(token: string): GoogleUser | null {
    try {
        return jwtDecode<GoogleUser>(token);
    } catch (e) {
        console.error("Failed to decode JWT", e);
        return null;
    }
}

/**
 * Generates a deterministic salt for the user based on their unique subject ID.
 * This ensures the user always gets the same address.
 */
export async function generateUserSalt(sub: string): Promise<bigint> {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(sub + MASTER_SEED);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Convert first 16 bytes to BigInt to fit in salt requirements (usually adequate)
    const hex = hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
    return BigInt('0x' + hex);
}

/**
 * Derives a deterministic password from the user's sub.
 * We use the same hashing mechanism but return the full hex string to be used as a password.
 */
export async function derivePasswordFromSub(sub: string): Promise<string> {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(sub + MASTER_SEED);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function computeGoogleAddress(idToken: string): Promise<string | null> {
    const user = parseGoogleToken(idToken);
    if (!user) return null;

    try {
        const salt = await generateUserSalt(user.sub);

        // Google checks
        if (user.aud !== GOOGLE_CLIENT_ID) {
            console.warn("Token audience mismatch", user.aud);
            // In dev we might ignore, but strictly we should warn.
        }

        const zkLoginAddress = computeZkLoginAddress({
            claimName: 'sub',
            claimValue: user.sub,
            iss: 'https://accounts.google.com',
            aud: GOOGLE_CLIENT_ID,
            userSalt: salt,
            // Must stay true: preserves the address derivation used by @mysten/sui 1.x so
            // existing users' zkLogin wallets keep resolving to the same Sui address.
            legacyAddress: true,
        });

        return zkLoginAddress;
    } catch (e) {
        console.error("Failed to compute zkLogin address", e);
        return null;
    }
}

function generateNonce(length: number = 20) {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}
