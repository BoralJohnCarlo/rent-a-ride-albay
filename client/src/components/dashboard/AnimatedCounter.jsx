import { animate } from "framer-motion";

import {
    useEffect,
    useRef,
    useState,
} from "react";

/*
 * Smoothly tweens a number from its previous value to the next one whenever
 * `value` changes. Renders a plain <span> so it can be dropped anywhere a
 * number would otherwise be printed (including inside StatCard).
 */
const AnimatedCounter = ({
    value = 0,
    duration = 1.1,
    format,
    className = "",
}) => {
    const [display, setDisplay] = useState(0);

    const previousValue = useRef(0);

    useEffect(() => {
        const target = Number(value);

        const safeTarget = Number.isFinite(target)
            ? target
            : 0;

        const controls = animate(
            previousValue.current,
            safeTarget,
            {
                duration,
                ease: "easeOut",
                onUpdate: (latest) => {
                    setDisplay(latest);
                },
            }
        );

        previousValue.current = safeTarget;

        return () => controls.stop();
    }, [value, duration]);

    const rounded = Math.round(display);

    return (
        <span className={className}>
            {format
                ? format(rounded)
                : rounded.toLocaleString("en-PH")}
        </span>
    );
};

export default AnimatedCounter;
