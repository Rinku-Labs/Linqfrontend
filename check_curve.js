import { PublicKey } from '@solana/web3.js';

const addr = 'qY9KvmNAafGsujojf8A5erkb1MsYtFxChUkMkMLXyhP';
const pubkey = new PublicKey(addr);
const isOnCurve = PublicKey.isOnCurve(pubkey.toBuffer());

console.log(`Address: ${addr}`);
console.log(`Is on curve? ${isOnCurve}`);
if (isOnCurve) {
    console.log("This is a standard Wallet Address (Ed25519 public key).");
} else {
    console.log("This is an off-curve address (likely a PDA/ATA).");
}
