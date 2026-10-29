import { useEffect, useState } from "react";

// Keeps a vehicle's derived status (e.g. going stale/offline) updating
// even when no new telemetry arrives - a local UI clock, not a poll of
// the backend.
const useNowTicker = (intervalMs) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), intervalMs);

        return () => clearInterval(interval);
    }, [intervalMs]);

    return now;
};

// Latest of two optional timestamps (REST tracker snapshot vs live heartbeat).
export const latestTimestamp = (a, b) => {
    if (!a || !b) {
        return a || b || null;
    }

    return new Date(a) >= new Date(b) ? a : b;
};

export default useNowTicker;
