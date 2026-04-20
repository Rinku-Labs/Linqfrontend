import client from '../api/client';
import type { Order } from '../components/TransactionPopup';

const CACHE_KEY = 'cachedOrders';
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface CachedData {
    orders: Order[];
    timestamp: number;
    fullFetch: boolean; // true if this was a full fetch (not paginated)
}

// Deduplicate concurrent fetches — reuse the same promise if already in-flight
let inFlightFetch: Promise<Order[]> | null = null;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, maxRetries = 3): Promise<any> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await client.get(url);
            return response;
        } catch (err: any) {
            const status = err?.response?.status;
            if (status === 429 && attempt < maxRetries - 1) {
                // Rate limited — wait with exponential backoff then retry
                const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
                await delay(waitMs);
                continue;
            }
            throw err;
        }
    }
};

export const getCachedOrders = (): CachedData | null => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    let data: CachedData;
    try {
        data = JSON.parse(cached);
    } catch {
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
    if (Date.now() - data.timestamp > CACHE_DURATION_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
    }
    return data;
};

export const setCachedOrders = (orders: Order[], fullFetch: boolean) => {
    const data: CachedData = { orders, timestamp: Date.now(), fullFetch };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
};

const mapBillToOrder = (bill: any): Order => ({
    id: bill.id,
    orderType: 'bill-payment',
    amountStableCoin: Number(bill.amountUsdc || 0),
    amountNgn: Number(bill.amountNgn || 0),
    accountName: bill.customerName || bill.itemName || bill.customerId,
    bankName: bill.provider || bill.network || bill.billCategory,
    billType: bill.billCategory || bill.billType, // Included for transactionIcons.tsx
    status: bill.status,
    createdAt: bill.created || bill.createdAt,
    created: bill.created || bill.createdAt,
    trnxWallet: bill.trnxWallet,
    rate: bill.rate,
    description: bill.description
});

export const fetchOrders = async (limit?: number, forceRefresh = false): Promise<Order[]> => {
    const cached = getCachedOrders();
    const needsFull = !limit;

    // Return cached if valid and not forcing refresh
    if (!forceRefresh && cached && (!needsFull || cached.fullFetch)) {
        return limit ? cached.orders.slice(0, limit) : cached.orders;
    }

    // If limit is specified, just fetch one page of orders and all bills (since bills API isn't paginated yet)
    if (limit) {
        try {
            const [ordersRes, billsRes] = await Promise.all([
                fetchWithRetry(`/user/orders?page=1&page_size=${limit}`),
                fetchWithRetry('/bills/orders').catch(() => ({ data: { data: [] } })) // Graceful failure for bills
            ]);

            let merged: Order[] = [];

            if (ordersRes.data?.data) {
                merged.push(...ordersRes.data.data.map((order: any) => ({
                    ...order,
                    createdAt: order.createdAt || order.created,
                    amountStableCoin: Number(order.amountStableCoin),
                    amountNgn: order.amountNgn
                })));
            }

            if (billsRes.data?.data) {
                merged.push(...billsRes.data.data.map(mapBillToOrder));
            }

            // Sort by date descending
            merged.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.created || 0).getTime();
                const dateB = new Date(b.createdAt || b.created || 0).getTime();
                return dateB - dateA;
            });

            const finalOrders = merged.slice(0, limit);
            setCachedOrders(finalOrders, false);
            return finalOrders;
        } catch (err) {
            console.error('Failed to fetch limited orders', err);
            return [];
        }
    }

    // Deduplicate: if a full fetch is already in-flight, reuse it
    if (inFlightFetch) {
        return inFlightFetch;
    }

    inFlightFetch = (async () => {
        try {
            // Fetch ALL pages for full fetch
            const allOrders: Order[] = [];
            let page = 1;
            const pageSize = 100; // Use a larger page size for efficiency
            let hasNext = true;

            while (hasNext) {
                const response = await fetchWithRetry(`/user/orders?page=${page}&page_size=${pageSize}`);

                if (response.data?.data && response.data.data.length > 0) {
                    const mappedOrders: Order[] = response.data.data.map((order: any) => ({
                        ...order,
                        createdAt: order.createdAt || order.created,
                        amountStableCoin: Number(order.amountStableCoin),
                        amountNgn: order.amountNgn
                    }));
                    allOrders.push(...mappedOrders);

                    // Check if there are more pages
                    hasNext = response.data.pagination?.has_next ?? false;
                    page++;

                    // Small delay between pages to avoid rate limiting
                    if (hasNext) {
                        await delay(200);
                    }
                } else {
                    hasNext = false;
                }
            }

            // Fetch bills and merge
            try {
                const billsRes = await fetchWithRetry('/bills/orders');
                if (billsRes.data?.data) {
                    allOrders.push(...billsRes.data.data.map(mapBillToOrder));
                }
            } catch (err) {
                console.error('Failed to fetch bill orders during full sync', err);
            }

            // Final sort
            allOrders.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.created || 0).getTime();
                const dateB = new Date(b.createdAt || b.created || 0).getTime();
                return dateB - dateA;
            });

            setCachedOrders(allOrders, true);
            return allOrders;
        } finally {
            inFlightFetch = null;
        }
    })();

    return inFlightFetch;
};

export const invalidateOrdersCache = () => {
    localStorage.removeItem(CACHE_KEY);
};
