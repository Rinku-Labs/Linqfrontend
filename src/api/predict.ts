import client from './client';

// Predict & Win — World Cup 2026. The frontend talks ONLY to our backend
// (/predict/*); it never touches TxLINE. Fixtures + live scores are public match
// data; submit + history are authenticated (client.ts attaches the bearer token).

export interface Fixture {
    fixtureId: number;
    startTime: number; // unix milliseconds
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    closed?: boolean; // display-only match: visible, but no predicting and no payout
}

export interface LiveScore {
    fixtureId: number;
    homeTeamId: number;
    awayTeamId: number;
    homeGoals: number;
    awayGoals: number;
    homePens: number;
    awayPens: number;
    status: string; // NS|H1|HT|H2|ET1|HTET|ET2|PE|WET|WPE|F|FET|FPE|A|C|P|I...
    minute: number;
    updatedAt: number; // unix ms
}

export interface Prediction {
    ID: number;
    fixtureId: number;
    predHome: number;
    predAway: number;
    result: string; // '' | 'won' | 'lost'
    settledAt: string | null;
}

export interface HistoryItem {
    id: number; // prediction id — used to build the public win-share URL
    fixtureId: number;
    homeTeam: string;
    awayTeam: string;
    homeFlag: string;
    awayFlag: string;
    competition: string;
    kickoff: string;
    predHome: number;
    predAway: number;
    finalHome: number | null;
    finalAway: number | null;
    homePens: number | null;
    awayPens: number | null;
    status: string;
    result: string; // '' | 'won' | 'lost'
    settledAt: string | null;
    // position is this user's rank among everyone who called this exact scoreline
    // (1 = first). Powers the "You're 3rd to call 2-1" line.
    position: number;
    // Prize (meaningful when result === 'won').
    prizeEligible: boolean;       // correct AND in the first N callers → claimable
    prizeShareUsd: number | null; // this winner's share of the pool
    prizePoolUsd: number | null;  // the pool the share came from
    claimed: boolean;
    claimedAt: string | null;
    // Admin-authorized payout. '' = n/a; 'awaiting' = claimed, not yet authorized;
    // 'paid' = sent (payoutTxHash set).
    payoutStatus?: string;
    payoutTxHash?: string;
}

export interface HistoryResponse {
    predictions: HistoryItem[];
    hasPayoutInfo: boolean;
    prizePoolUsd: number;
    maxWinners: number;
    acceptedTerms: boolean;
    suiWallet: string; // saved payout details (own), for prefill + edit
    xHandle: string;
    shareGate: boolean; // winners must share on X + paste the link to claim
}

export async function getFixtures(): Promise<Fixture[]> {
    const { data } = await client.get<Fixture[]>('/predict/fixtures');
    return Array.isArray(data) ? data : [];
}

export async function getScores(): Promise<LiveScore[]> {
    const { data } = await client.get<LiveScore[]>('/predict/scores');
    return Array.isArray(data) ? data : [];
}

export async function submitPrediction(fixtureId: number, home: number, away: number): Promise<Prediction> {
    const { data } = await client.post<Prediction>('/predict/submit', { fixtureId, home, away });
    return data;
}

export async function getHistory(): Promise<HistoryResponse> {
    const { data } = await client.get<HistoryResponse>('/predict/history');
    return {
        predictions: data?.predictions ?? [],
        hasPayoutInfo: !!data?.hasPayoutInfo,
        prizePoolUsd: data?.prizePoolUsd ?? 0,
        maxWinners: data?.maxWinners ?? 5,
        acceptedTerms: !!data?.acceptedTerms,
        suiWallet: data?.suiWallet ?? '',
        xHandle: data?.xHandle ?? '',
        shareGate: !!data?.shareGate,
    };
}

// acceptTerms records that the user accepted the game's Terms & Conditions. Called
// only from the "Agree & Submit" action — declining must NOT call this, so the user
// is prompted again next time.
export async function acceptTerms(): Promise<void> {
    await client.post('/predict/accept-terms', {});
}

// claimPrize claims a won match. Pass suiWallet + xHandle to save/update the user's
// payout details (first claim, or an "Edit"); omit them to reuse saved details.
// A 422 { needPayoutInfo:true } means the app must collect the wallet + handle.
export async function claimPrize(
    fixtureId: number,
    suiWallet?: string,
    xHandle?: string,
    xPostUrl?: string,
): Promise<Prediction> {
    const { data } = await client.post<Prediction>('/predict/claim', { fixtureId, suiWallet, xHandle, xPostUrl });
    return data;
}

// winShareURL builds the absolute, public URL of a win's share page (the backend
// renders the branded card there as an OG/Twitter image). Passed as the link in
// the X post so the tweet unfurls the card. The optional handle is the sharer's
// own X handle, shown on the card. Returns '' if VITE_API_URL is unset.
export function winShareURL(predictionId: number, handle?: string): string {
    const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
    if (!base) {
        console.warn('VITE_API_URL is not set — win share link unavailable.');
        return '';
    }
    const h = (handle ?? '').trim();
    return `${base}/predict/share?p=${predictionId}${h ? `&h=${encodeURIComponent(h)}` : ''}`;
}

// scoresStreamURL builds the absolute URL for the live-scores SSE endpoint from
// VITE_API_URL. There is deliberately NO localhost fallback — in production the
// env var must point at the deployed backend.
//
// The stream is authenticated, but EventSource can't send an Authorization
// header and the cross-site auth cookie is blocked by many mobile browsers —
// so the JWT rides in ?token= instead, which the backend lifts into the
// Authorization header and validates like any other request.
export function scoresStreamURL(): string {
    const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
    if (!base) {
        console.warn('VITE_API_URL is not set — live scores will not stream.');
        return '';
    }
    const token = localStorage.getItem('linqAuthToken');
    return `${base}/predict/scores/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
