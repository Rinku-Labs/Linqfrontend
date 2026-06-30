import { useEffect, useRef, useState } from 'react';
import { getScores, scoresStreamURL, type LiveScore } from '../api/predict';

// usePredictScores keeps a map of live scores keyed by fixtureId, seeded from the
// REST snapshot and kept fresh by the backend's SSE stream (one backend
// observation fanned out to all browsers — the browser never polls TxLINE). It
// auto-reconnects on error and ignores out-of-order updates (by updatedAt).
export function usePredictScores(): Record<number, LiveScore> {
    const [scores, setScores] = useState<Record<number, LiveScore>>({});
    const scoresRef = useRef<Record<number, LiveScore>>({});

    const apply = (s: LiveScore) => {
        if (!s || !s.fixtureId) return;
        const prev = scoresRef.current[s.fixtureId];
        if (prev && prev.updatedAt > s.updatedAt) return; // ignore stale/out-of-order
        scoresRef.current = { ...scoresRef.current, [s.fixtureId]: s };
        setScores(scoresRef.current);
    };

    useEffect(() => {
        let cancelled = false;

        // Seed from the snapshot so a freshly-opened page shows current scores fast.
        getScores()
            .then((list) => {
                if (cancelled) return;
                list.forEach(apply);
            })
            .catch(() => {});

        const url = scoresStreamURL();
        if (!url) return; // VITE_API_URL not set — nothing to stream

        let es: EventSource | null = null;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let watchdog: ReturnType<typeof setInterval> | undefined;
        let lastSeen = Date.now();

        const reconnect = () => {
            if (watchdog) clearInterval(watchdog);
            es?.close();
            if (!cancelled) retry = setTimeout(connect, 3000);
        };

        const connect = () => {
            lastSeen = Date.now();
            es = new EventSource(url);
            // Any frame — a score or the server's 15s "ping" heartbeat — proves the
            // connection is alive and resets the watchdog clock.
            const bump = () => { lastSeen = Date.now(); };
            const onScore = (e: MessageEvent) => {
                bump();
                try {
                    apply(JSON.parse(e.data));
                } catch {
                    /* ignore malformed frame */
                }
            };
            es.addEventListener('score', onScore);
            es.addEventListener('ping', bump); // heartbeat — liveness only, no payload
            es.onopen = bump;
            es.onmessage = onScore;
            es.onerror = reconnect; // explicit error: drop and retry

            // Watchdog for a *silently* dead connection: some proxies hold the socket
            // open but stop forwarding, so onerror never fires and we'd sit on a stale
            // score (e.g. a match stuck at LIVE 95' that has actually finished). If no
            // frame arrives for 45s (3 missed 15s heartbeats), force a reconnect — and
            // reconnecting re-seeds the current state from the server.
            if (watchdog) clearInterval(watchdog);
            watchdog = setInterval(() => {
                if (Date.now() - lastSeen > 45000) reconnect();
            }, 15000);
        };
        connect();

        return () => {
            cancelled = true;
            if (retry) clearTimeout(retry);
            if (watchdog) clearInterval(watchdog);
            es?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return scores;
}
