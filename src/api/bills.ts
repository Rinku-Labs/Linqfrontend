import client from './client';

// ============================================================
// Types
// ============================================================

export interface BillCategory {
    id: number;
    biller_code: string;
    name: string;
    default_commission: number;
    country: string;
    is_airtime: boolean;
    biller_name: string;
    item_code: string;
    short_name: string;
    fee: number;
    label_name: string;
    amount: number;
}

export interface BillCategoriesResponse {
    status: string;
    message: string;
    data: BillCategory[];
}

export interface CreateBillPaymentRequest {
    billType: string;
    network: string;
    customerId: string;
    customerLabel: string;
    amountNgn: number;
    amountUsdc: number;
    rate: number;
    itemCode: string;
    billerCode: string;
    billerType: string;
    itemName: string;
    meterType?: string; // electricity only: "prepaid" or "postpaid"
    coin: {
        sui: boolean;
        base: boolean;
        solana: boolean;
        ethereum: boolean;
        aptos: boolean;
        bsc: boolean;
    };
    userWalletAddress: string;
}

export interface BillPaymentOrder {
    id: string;
    userId: number;
    billType: string;
    network: string;
    customerId: string;
    customerLabel: string;
    amountNgn: number;
    amountUsdc: number;
    rate: number;
    itemCode: string;
    billerCode: string;
    billerType: string;
    itemName: string;
    trnxWallet: string;
    status: string;
    description: string;
    flwRef: string;
    created: string;
    customerName?: string;
    meterType?: string;
    vendToken?: string; // electricity prepaid recharge token from Nomba
    vendUnits?: string; // electricity units purchased
}

// ============================================================
// API Functions
// ============================================================

export const getBillCategories = async (): Promise<BillCategoriesResponse> => {
    const response = await client.get('/bills/categories');
    return response.data;
};

export const getBillers = async (category: string): Promise<BillCategoriesResponse> => {
    const response = await client.get(`/bills/billers?category=${category}`);
    return response.data;
};

export const getBillItems = async (billerCode: string): Promise<any> => {
    const response = await client.get(`/bills/items?biller_code=${billerCode}`);
    return response.data;
};

export const createBillPayment = async (data: CreateBillPaymentRequest): Promise<{ id: string; wallet: string }> => {
    const response = await client.post('/bills/pay', data);
    return response.data;
};

export const getBillStatus = async (id: string): Promise<BillPaymentOrder> => {
    const response = await client.get(`/bills/status?id=${id}`);
    return response.data;
};

export const getUserBillOrders = async (): Promise<{ data: BillPaymentOrder[] }> => {
    const response = await client.get('/bills/orders');
    return response.data;
};

export const validateMeter = async (
    itemCode: string,
    billerCode: string,
    customer: string,
    category?: string,
): Promise<any> => {
    const params = new URLSearchParams({
        item_code: itemCode,
        biller_code: billerCode,
        customer,
    });
    if (category) params.append('category', category);
    const response = await client.get(`/bills/validate?${params.toString()}`);
    return response.data;
};
