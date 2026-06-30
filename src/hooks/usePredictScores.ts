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

        const connect = () => {
            es = new EventSource(url);
            const onScore = (e: MessageEvent) => {
                try {
                    apply(JSON.parse(e.data));
                } catch {
                    /* ignore malformed frame */
                }
            };
            es.addEventListener('score', onScore);
            es.onmessage = onScore;
            es.onerror = () => {
                es?.close();
                if (!cancelled) retry = setTimeout(connect, 3000); // auto-reconnect
            };
        };
        connect();

        return () => {
            cancelled = true;
            if (retry) clearTimeout(retry);
            es?.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return scores;
}
