/**
 * SEP-10 web authentication.
 *
 * Proves to Linq's Stellar service that the connected wallet controls the
 * account it claims, and exchanges that proof for a session token.
 *
 * The flow is deliberately stateless on our side: the server hands out a
 * challenge transaction, the wallet signs it, the server verifies the
 * signature. The challenge carries sequence number 0, so it can never be
 * submitted to the network as a real transaction — signing it moves no funds
 * and costs nothing.
 *
 * https://stellar.org/protocol/sep-10
 */

const AUTH_BASE = (
    import.meta.env.VITE_STELLAR_AUTH_URL ||
    'https://linq-stellar-uselinq-4c0e2a4f.koyeb.app'
).replace(/\/+$/, '');

const TOKEN_KEY = 'stellarAuthToken';

export interface StellarAuthResult {
    token: string;
    account: string;
}

/**
 * Runs the full handshake: request a challenge, sign it, exchange it.
 *
 * `signXdr` is the wallet's signer — the same one used for payments, so the
 * user approves this in the wallet they already connected.
 */
export async function authenticateStellar(
    address: string,
    signXdr: (xdr: string) => Promise<string>,
): Promise<StellarAuthResult> {
    const challengeResponse = await fetch(
        `${AUTH_BASE}/sep10/auth?account=${encodeURIComponent(address)}`,
    );
    if (!challengeResponse.ok) {
        // 501 means the deployment has SEP-10 switched off, which is a
        // configuration state rather than a failure the user caused.
        if (challengeResponse.status === 501) {
            throw new Error('Stellar authentication is not enabled on this environment.');
        }
        throw new Error('Could not start Stellar authentication.');
    }

    const { transaction } = (await challengeResponse.json()) as { transaction?: string };
    if (!transaction) throw new Error('Authentication challenge was malformed.');

    const signedTxXdr = await signXdr(transaction);

    const verifyResponse = await fetch(`${AUTH_BASE}/sep10/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: signedTxXdr }),
    });
    if (!verifyResponse.ok) {
        throw new Error('Stellar authentication failed.');
    }

    const { token } = (await verifyResponse.json()) as { token?: string };
    if (!token) throw new Error('No session token was returned.');

    storeStellarToken(token);
    return { token, account: address };
}

export function storeStellarToken(token: string) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        // Storage can be unavailable in private browsing; the token still works
        // for the life of this page.
    }
}

export function getStellarToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function clearStellarToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch {
        // Nothing to do — an unreadable store is also an unwritable one.
    }
}
