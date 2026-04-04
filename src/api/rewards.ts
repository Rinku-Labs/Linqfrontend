import client from './client';

export interface RewardsData {
    totalXp: number;
    leaderboardRank: number;
    referral: {
        totalReferrals: number;
        xpEarned: number;
        code: string;
    };
    volume: {
        totalVolume: number;
        xpAllTime: number;
        xpThisMonth: number;
    };
}

export interface LeaderboardEntry {
    rank: number;
    username: string;
    xp: number;
}

export async function getRewardsData(): Promise<RewardsData> {
    const { data } = await client.get<RewardsData>('/rewards');
    return data;
}

export async function getLeaderboard(period: 'week' | 'month' | 'all'): Promise<LeaderboardEntry[]> {
    const { data } = await client.get<LeaderboardEntry[]>('/leaderboard', {
        params: { period },
    });
    return data;
}
