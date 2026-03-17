import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function checkAccount() {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const destPubkeyStr = 'qY9KvmNAafGsujojf8A5erkb1MsYtFxChUkMkMLXyhP';
    const sourcePubkeyStr = 'DUv7NMLxAuwN1tCvPr1i5MnHVt6ZvEesK2rT5xUNrjyt';

    try {
        const destPubkey = new PublicKey(destPubkeyStr);
        const info = await connection.getAccountInfo(destPubkey);

        if (info && info.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
            // Destination is NOT owned by Token Program.
        }
    } catch (e) {
        console.error('Error checking destination:', e);
    }

    try {
        const sourcePubkey = new PublicKey(sourcePubkeyStr);
        const info = await connection.getAccountInfo(sourcePubkey);

        if (info && info.owner.toBase58() !== TOKEN_PROGRAM_ID.toBase58()) {
            // Source is NOT owned by Token Program.
        }
    } catch (e) {
        console.error('Error checking source:', e);
    }
}

checkAccount().catch(console.error);
