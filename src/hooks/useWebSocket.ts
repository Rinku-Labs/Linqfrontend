import { useState, useEffect, useRef } from 'react';


export const useWebSocket = <T>(params: { orderId?: string; userId?: string } | undefined) => {
    const [lastMessage, setLastMessage] = useState<T | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        if (!params || (!params.orderId && !params.userId)) return;

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connect = () => {
            // Determine WS URL from existing API URL or default
            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.linq.pxxl.click';
            let queryString = '';
            if (params.orderId) queryString = `orderId=${params.orderId}`;
            else if (params.userId) queryString = `userId=${params.userId}`;

            const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws?${queryString}`;

            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                setIsConnected(true);
                reconnectAttempts = 0; // Reset attempts on successful connection
            };

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);
                } catch (_) {
                    // Silently ignore parse errors
                }
            };

            socket.onclose = () => {
                setIsConnected(false);
                // Exponential backoff for reconnection
                if (reconnectAttempts < maxReconnectAttempts) {
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30s
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts++;
                        connect();
                    }, timeout);
                }
            };

            socket.onerror = () => {
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
    }, [params?.orderId, params?.userId]);

    return { lastMessage, isConnected };
};
