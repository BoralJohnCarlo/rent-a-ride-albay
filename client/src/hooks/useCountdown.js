import { useEffect, useState } from "react";

const secondsUntil = (deadline) =>
    deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;

/*
 * Whole seconds left until `deadline` (a ms timestamp), ticking once a
 * second; 0 once it passes or when there's no deadline. Measured against
 * the clock each tick, so a backgrounded tab doesn't drift.
 */
const useCountdown = (deadline) => {
    const [remaining, setRemaining] = useState(() => secondsUntil(deadline));

    useEffect(() => {
        setRemaining(secondsUntil(deadline));

        if (!deadline) {
            return undefined;
        }

        const id = setInterval(() => {
            const next = secondsUntil(deadline);
            setRemaining(next);

            if (next === 0) {
                clearInterval(id);
            }
        }, 1000);

        return () => clearInterval(id);
    }, [deadline]);

    return remaining;
};

export const formatCountdown = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default useCountdown;
