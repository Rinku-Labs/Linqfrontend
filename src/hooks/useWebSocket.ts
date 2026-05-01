import { useState, useEffect, useRef } from 'react';


export const useWebSocket = <T>(params: { orderId?: string; userId?: string; token?: string } | undefined) => {
    const [lastMessage, setLastMessage] = useState<T | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const stoppedRef = useRef(false);
    const mountedRef = useRef(false);

    useEffect(() => {
        if (!params || (!params.orderId && !params.userId)) return;
        if (!params.token) return;

        mountedRef.current = true;
        stoppedRef.current = false;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connect = () => {
            if (!mountedRef.current || stoppedRef.current) return;

            const apiUrl = import.meta.env.VITE_API_URL || 'https://api.linq.pxxl.click';
            const queryParts: string[] = [];
            if (params.orderId) queryParts.push(`orderId=${params.orderId}`);
            else if (params.userId) queryParts.push(`userId=${params.userId}`);
            if (params.token) queryParts.push(`token=${encodeURIComponent(params.token)}`);

            const wsUrl = apiUrl.replace(/^http/, 'ws') + `/ws?${queryParts.join('&')}`;
            const socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                if (!mountedRef.current) { socket.close(); return; }
                setIsConnected(true);
                reconnectAttempts = 0;
            };

            socket.onmessage = (event) => {
                if (!mountedRef.current) return;
                try {
                    const message = JSON.parse(event.data);
                    setLastMessage(message);
                } catch (_) { /* ignore parse errors */ }
            };

            socket.onclose = () => {
                setIsConnected(false);
                if (!mountedRef.current || stoppedRef.current) return;
                if (reconnectAttempts < maxReconnectAttempts) {
                    const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts++;
                        connect();
                    }, timeout);
                }
            };

            socket.onerror = () => {
                socket.close();
            };

            socketRef.current = socket;
        };

        // Small delay prevents React StrictMode double-mount from spawning duplicate connections
        const startTimeout = setTimeout(connect, 50);

        return () => {
            mountedRef.current = false;
            clearTimeout(startTimeout);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current) {
                socketRef.current.onclose = null;
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [params?.orderId, params?.userId, params?.token]);

    const stop = () => {
        stoppedRef.current = true;
        mountedRef.current = false;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (socketRef.current) {
            socketRef.current.onclose = null;
            socketRef.current.close();
            socketRef.current = null;
        }
    };

    return { lastMessage, isConnected, stop };
};
