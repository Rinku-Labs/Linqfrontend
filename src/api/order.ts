import client from './client';

export interface OrderStatusResponse {
    id: string;
    status: string;
    amountStableCoin?: number;
    amountNgn?: number;
    rate?: number;
    created?: string;
}

export const getOrderStatus = async (orderId: string): Promise<OrderStatusResponse> => {
    const response = await client.get(`/status?id=${orderId}`);
    return response.data;
};
