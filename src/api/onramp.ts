import client from './client';

export interface OnrampOrderRequest {
    amountStableCoin: number;
    currency: string;
    walletAddress: string;
    rate: number;
    coin: {
        sui: boolean;
        base: boolean;
        solana: boolean;
        ethereum: boolean;
        aptos: boolean;
        bsc: boolean;
    };
}

export interface OnrampOrderResponse {
    orderId: string;
    accountNumber: string;
    bankName: string;
    amountNgn: number;
    amountStableCoin: number;
    expiresAt: string;
    status: string;
}

export interface OnrampStatusResponse {
    orderId: string;
    status: 'pending' | 'awaiting_payment' | 'payment_received' | 'sending_crypto' | 'completed' | 'failed' | 'expired';
    amount: number;
    amountNgn?: number;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
}

export const createOnrampOrder = async (data: OnrampOrderRequest): Promise<OnrampOrderResponse> => {
    const response = await client.post('/onramp-order', { ...data, orderType: 'on-ramp' });
    return response.data;
};

export const getOnrampStatus = async (orderId: string): Promise<OnrampStatusResponse> => {
    const response = await client.get(`/onramp-status?id=${orderId}`);
    return response.data;
};

export const getOnrampRate = async (): Promise<number> => {
    const { fetchRate } = await import('../utils/rateCache');
    return fetchRate();
};

export const getLiquidityBalance = async (): Promise<number> => {
    const response = await client.get('/onramp/liquidity');
    return response.data.balance;
};
