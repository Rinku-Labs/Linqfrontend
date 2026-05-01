import { useState, useEffect, useRef } from 'react';


export const useWebSocket = <T>(params: { orderId?: string; userId?: string; token?: string } | undefined) => {
    const [lastMessage, setLastMessage] = useState<T | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const stoppedRef = useRef(false);

    useEffect(() => {
        if (!params || (!params.orderId && !params.userId)) return;
        // Don't connect if no token is available — backend will reject unauthenticated WS
        if (!params.token) return;

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connect = () => {
            // Determine WS URL from existing API URL or default
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.linq.pxxl.click';
            const queryParts: string[] = [];
            if (params.orderId) queryParts.push(`orderId=${params.orderId}`);
            else if (params.userId) queryParts.push(`userId=${params.userId}`);
            if (params.token) queryParts.push(`token=${encodeURIComponent(params.token)}`);

            const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws?${queryParts.join('&')}`;

            console.log(`[WS] Connecting (attempt ${reconnectAttempts + 1})`, wsUrl.replace(/token=[^&]+/, 'token=***'));
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log('[WS] Connected', { orderId: params.orderId, userId: params.userId });
                setIsConnected(true);
                reconnectAttempts = 0; // Reset attempts on successful connection
            };

            socket.onmessage = (event) => {
                console.log('[WS] Message received', event.data);
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);
                } catch (_) {
                    console.warn('[WS] Failed to parse message', event.data);
                }
            };

            socket.onclose = (event) => {
                console.warn('[WS] Disconnected', { code: event.code, reason: event.reason, wasClean: event.wasClean, attempt: reconnectAttempts });
                setIsConnected(false);
                if (stoppedRef.current) return;
                // Exponential backoff for reconnection
                if (reconnectAttempts < maxReconnectAttempts) {
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30s
                    console.log(`[WS] Reconnecting in ${timeout}ms...`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts++;
                        connect();
                    }, timeout);
                } else {
                    console.error('[WS] Max reconnect attempts reached, giving up');
                }
            };

            socket.onerror = (event) => {
                console.error('[WS] Error', event);
                socket.close(); // Triggers onclose
            };

            socketRef.current = socket;
        };

        connect();

        return () => {
            if (socketRef.current) {
                // Prevent reconnect logic from firing on intentional close
                socketRef.current.onclose = null;
                socketRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [params?.orderId, params?.userId, params?.token]);

    const stop = () => {
        stoppedRef.current = true;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (socketRef.current) {
            socketRef.current.onclose = null;
            socketRef.current.close();
        }
    };

    return { lastMessage, isConnected, stop };
};
