import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function checkAccount() {
    const connection = new Connection('https://api.mainnet-beta.solana.com'); // Use mainnet
    const destPubkeyStr = 'qY9KvmNAafGsujojf8A5erkb1MsYtFxChUkMkMLXyhP';
    const sourcePubkeyStr = 'DUv7NMLxAuwN1tCvPr1i5MnHVt6ZvEesK2rT5xUNrjyt';

    console.log(`Checking Destination: ${destPubkeyStr}`);
    try {
        const destPubkey = new PublicKey(destPubkeyStr);
        const info = await connection.getAccountInfo(destPubkey);

        if (!info) {
            console.log('Destination Account does not exist.');
        } else {
            console.log('Destination Account exists!');
            console.log('Owner:', info.owner.toBase58());
            console.log('Data Length:', info.data.length);
            console.log('Lamports:', info.lamports);
            console.log('Executable:', info.executable);

            if (info.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
                console.log('Destination is owned by Token Program.');
            } else {
                console.log('WARNING: Destination is NOT owned by Token Program.');
            }
        }
    } catch (e) {
        console.error('Error checking destination:', e);
    }

    console.log(`\nChecking Source: ${sourcePubkeyStr}`);
    try {
        const sourcePubkey = new PublicKey(sourcePubkeyStr);
        const info = await connection.getAccountInfo(sourcePubkey);

        if (!info) {
            console.log('Source Account does not exist.');
        } else {
            console.log('Source Account exists!');
            console.log('Owner:', info.owner.toBase58());
            if (info.owner.toBase58() === TOKEN_PROGRAM_ID.toBase58()) {
                console.log('Source is owned by Token Program.');
            } else {
                console.log('WARNING: Source is NOT owned by Token Program.');
            }
        }
    } catch (e) {
        console.error('Error checking source:', e);
    }
}

checkAccount().catch(console.error);
