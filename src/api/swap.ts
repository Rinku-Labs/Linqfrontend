import client from './client';

// API_URL is handled by client base URL

export interface Token {
    assetId: string;
    symbol: string;
    name: string;
    decimals: number;
    blockchain: string;
    contractAddress?: string;
    price?: number;
    logoURI?: string;
    icon?: string;
}

export interface QuoteRequest {
    originAsset: string;
    destinationAsset: string;
    amount: string;
    recipient: string; // destination address
    recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
    refundTo: string; // sender address for refunds
    refundType: 'ORIGIN_CHAIN' | 'INTENTS';
    depositType: 'ORIGIN_CHAIN' | 'INTENTS';
    swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT' | 'ANY_INPUT';
    slippageTolerance: number; // integer 0-10000 (e.g. 100 = 1%)
    deadline: string; // ISO 8601
    dry: boolean;
}

export interface QuoteResponse {
    quote: {
        amountIn: string;
        amountInFormatted: string;
        amountInUsd: string;
        amountOut: string;
        amountOutFormatted: string;
        amountOutUsd: string;
        depositAddress?: string;
        timeEstimate: number;
    };
    quoteRequest: QuoteRequest;
    signature?: string;
    correlationId: string;
    timestamp: string;
}

export const getTokens = async (): Promise<Token[]> => {
    // Client interceptor handles token
    const response = await client.get('/swap/tokens');
    return response.data;
};

export const getQuote = async (data: QuoteRequest): Promise<QuoteResponse> => {
    const response = await client.post('/swap/quote', data);
    return response.data;
};

export const getSwapStatus = async (depositAddress: string): Promise<any> => {
    const response = await client.get('/swap/status', {
        params: { depositAddress }
    });
    return response.data;
};
