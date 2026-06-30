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

export async function getHistory(): Promise<HistoryItem[]> {
    const { data } = await client.get<{ predictions: HistoryItem[] }>('/predict/history');
    return data?.predictions ?? [];
}

// scoresStreamURL builds the absolute URL for the live-scores SSE endpoint from
// VITE_API_URL. There is deliberately NO localhost fallback — in production the
// env var must point at the deployed backend.
export function scoresStreamURL(): string {
    const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
    if (!base) {
        console.warn('VITE_API_URL is not set — live scores will not stream.');
        return '';
    }
    return `${base}/predict/scores/stream`;
}
