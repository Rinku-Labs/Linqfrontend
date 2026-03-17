import { PublicKey } from '@solana/web3.js';

const addr = 'qY9KvmNAafGsujojf8A5erkb1MsYtFxChUkMkMLXyhP';
const pubkey = new PublicKey(addr);
const isOnCurve = PublicKey.isOnCurve(pubkey.toBuffer());

if (isOnCurve) {
    // This is a standard Wallet Address
} else {
    // This is an off-curve address
}
