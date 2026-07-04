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

        // Seed from the REST snapshot (goes through axios with the auth header, so it
        // works even when the SSE stream can't).
        const seed = () =>
            getScores()
                .then((list) => { if (!cancelled) list.forEach(apply); })
                .catch(() => {});
        seed(); // initial paint

        // Guaranteed fallback: the SSE stream can silently stall (a proxy holding the
        // socket open but not forwarding) or fail — leaving scores frozen until the
        // user refreshes. So while ANY match is live, re-seed from REST every 25s.
        // This recovers scores independently of the stream's health. It is gated on a
        // live match, so between matches there is NO polling and no backend load.
        const LIVE = new Set(['H1', 'HT', 'H2', 'ET1', 'HTET', 'ET2', 'PE', 'WET', 'WPE']);
        const poll = setInterval(() => {
            if (cancelled) return;
            if (Object.values(scoresRef.current).some((s) => LIVE.has(s.status))) seed();
        }, 25000);

        const url = scoresStreamURL();
        if (!url) return () => { cancelled = true; clearInterval(poll); }; // no stream — poll only

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
            // withCredentials so the browser sends the Authorization cookie set at
            // login — EventSource can't set an Authorization header, and the stream
            // is now authenticated on the backend (RequireAuth falls back to the
            // cookie). CORS already allows credentials for our origins.
            es = new EventSource(url, { withCredentials: true });
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
            clearInterval(poll);
            if (retry) clearTimeout(retry);
            if (watchdog) clearInterval(watchdog);
            es?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return scores;
}
