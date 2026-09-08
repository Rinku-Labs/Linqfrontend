# Linq — Consumer Web App

The Linq consumer app: hold stablecoins, send them, pay bills, and cash out to
a Nigerian bank account. React + TypeScript + Vite.

Linq settles payments across Sui, Solana, Base, BNB Chain, Tron and **Stellar**.

---

## Stellar integration

Stellar is the newest rail and the only one where a payment costs the user
nothing. It leads the chain selector for that reason.

| Concern | Where |
|---|---|
| Wallet connection (Stellar Wallets Kit v2) | [`src/context/StellarWalletProvider.tsx`](src/context/StellarWalletProvider.tsx) |
| SEP-10 web authentication | [`src/utils/stellarAuth.ts`](src/utils/stellarAuth.ts) |
| Payments, balances, error mapping | [`src/utils/stellarUtils.ts`](src/utils/stellarUtils.ts) |
| Chain selector | [`src/components/ChainSelector.tsx`](src/components/ChainSelector.tsx) |

**Wallets supported:** Freighter, xBull, Lobstr, Albedo, Hana, Rabet, and any
WalletConnect-compatible mobile wallet.

The WalletConnect module is not optional padding. Every other module is
extension-based and reports unavailable on mobile — including Freighter's own
mobile app, whose in-app browser injects a marker rather than an extension API.
Without WalletConnect registered, the kit offers an "Install" link to users who
are already inside the wallet.

**SEP-10** proves the connected wallet controls the account it claims and
exchanges that proof for a session token, against Linq's Stellar settlement
service. It is offered from Settings rather than run on connect: it costs a
wallet signature, and someone checking a balance should not be asked for one.

Settlement itself — deposit accounts, Horizon indexing, treasury sweeps, NGN
payout — lives in [`Rinku-Labs/linq-stellar`](https://github.com/Rinku-Labs/linq-stellar).

---

## Running locally

```bash
npm install
npm run dev
```

### Environment

Copy the variables below into `.env`. Stellar defaults to public network and
Circle's mainnet USDC issuer, so the Stellar block is only needed to point at
testnet or a different deployment.

```bash
VITE_API_URL=                      # Linq backend
VITE_CLIENT_KEY=
VITE_CUSTOMERCARELINE=

VITE_SOLANA_RPC_URL=
VITE_BASE_RPC_URL=
VITE_BSC_RPC_URL=

VITE_WALLETCONNECT_PROJECT_ID=     # required for Stellar wallets on mobile

VITE_STELLAR_AUTH_URL=             # settlement service, for SEP-10
VITE_STELLAR_HORIZON_URL=
VITE_STELLAR_NETWORK_PASSPHRASE=
VITE_STELLAR_USDC_ISSUER=          # must be set for testnet — a different issuer
```

### Other commands

```bash
npm run build     # production build
npm run lint
npm test
```
