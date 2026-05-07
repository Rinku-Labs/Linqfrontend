import client from './client';
import { getCachedRewards, setCachedRewards } from '../utils/rewardsCache';

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

export interface FullLeaderboardData {
    week: LeaderboardEntry[];
    month: LeaderboardEntry[];
    all: LeaderboardEntry[];
}

export async function getRewardsData(forceRefresh = false): Promise<RewardsData> {
    if (!forceRefresh) {
        const cached = getCachedRewards();
        if (cached) return cached;
    }
    const { data } = await client.get<RewardsData>('/rewards');
    setCachedRewards(data);
    return data;
}

export async function getLeaderboard(period: 'week' | 'month' | 'all'): Promise<LeaderboardEntry[]> {
    const { data } = await client.get<LeaderboardEntry[]>('/leaderboard', {
        params: { period },
    });
    return data;
}

export async function getFullLeaderboard(): Promise<FullLeaderboardData> {
    const { data } = await client.get<FullLeaderboardData>('/leaderboard/all');
    return data;
}
