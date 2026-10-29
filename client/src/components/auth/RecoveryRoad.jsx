import { motion } from "framer-motion";

import { CarFront, Check, Flag } from "lucide-react";

const DRIVE = {
    type: "spring",
    stiffness: 70,
    damping: 16,
    mass: 1.1,
};

const FINISH = { label: "Back on the road", hint: "Sign in with your new password" };

const Car = () => (
    <CarFront
        size={22}
        className="text-yellow-300 drop-shadow-[0_2px_6px_rgba(250,204,21,0.45)]"
    />
);

const Marker = ({ state, number, finish }) => (
    <span
        className={`
            relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black transition-colors duration-500
            ${
                state === "done"
                    ? "border-yellow-400 bg-yellow-400 text-gray-950"
                    : state === "active"
                      ? "border-yellow-400 bg-gray-950 text-yellow-300"
                      : "border-white/25 bg-gray-950 text-white/40"
            }
        `}
    >
        {state === "done" ? (
            <Check size={14} strokeWidth={3} />
        ) : finish ? (
            <Flag size={13} strokeWidth={2.5} />
        ) : (
            number
        )}
    </span>
);

/*
 * The forgot-password progress, drawn as a road: one checkpoint per step
 * and a finish flag, with a car that drives to the current one. Vertical
 * beside the form on wide screens, horizontal above it on phones.
 *
 * Checkpoints are evenly spaced (fixed-height rows / justify-between), and
 * the road and car track both run from the first marker's centre to the
 * last's, so the car's % position lands exactly on each marker.
 *
 * `steps` - [{ label, hint }]; `current` - index, steps.length = finished.
 */
const RecoveryRoad = ({ steps, current, orientation = "vertical" }) => {
    const stops = [...steps, FINISH];
    const lastIndex = stops.length - 1;
    const reached = Math.min(current, lastIndex);
    const position = `${(reached / lastIndex) * 100}%`;

    const stateOf = (index) =>
        index < current ? "done" : index === current ? "active" : "upcoming";

    if (orientation === "horizontal") {
        return (
            <div className="px-2">
                <div className="relative h-14">
                    {/* Asphalt + lane markings */}
                    <div className="absolute inset-x-3.5 top-8.5 h-3 -translate-y-1/2 rounded-full bg-gray-800 ring-1 ring-white/10">
                        <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 border-t-2 border-dashed border-yellow-300/60" />
                    </div>

                    <div className="absolute inset-x-0 top-8.5 flex -translate-y-1/2 justify-between">
                        {stops.map((stop, index) => (
                            <Marker
                                key={stop.label}
                                state={stateOf(index)}
                                number={index + 1}
                                finish={index === lastIndex}
                            />
                        ))}
                    </div>

                    <div className="absolute inset-x-3.5 top-0">
                        <motion.div
                            initial={false}
                            animate={{ left: position }}
                            transition={DRIVE}
                            className="absolute -translate-x-1/2"
                        >
                            <Car />
                        </motion.div>
                    </div>
                </div>

                <p className="mt-1 text-center text-xs font-semibold text-white/80">
                    {stops[reached].label}
                </p>
            </div>
        );
    }

    return (
        <ol className="relative pl-8">
            {/* Asphalt + lane markings */}
            <div className="absolute bottom-3.5 left-9.75 top-3.5 w-3.5 rounded-full bg-gray-800 ring-1 ring-white/10">
                <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 border-l-2 border-dashed border-yellow-300/60" />
            </div>

            {/* The car's lane, beside the road */}
            <div className="pointer-events-none absolute bottom-3.5 left-0 top-3.5 w-6">
                <motion.div
                    initial={false}
                    animate={{ top: position }}
                    transition={DRIVE}
                    className="absolute -translate-y-1/2"
                >
                    <Car />
                </motion.div>
            </div>

            {stops.map((stop, index) => {
                const state = stateOf(index);

                return (
                    <li
                        key={stop.label}
                        className={`relative flex gap-3 ${
                            index < lastIndex ? "h-19" : "h-7"
                        }`}
                    >
                        <Marker
                            state={state}
                            number={index + 1}
                            finish={index === lastIndex}
                        />

                        <div className="pt-0.5">
                            <p
                                className={`text-sm font-bold transition-colors duration-500 ${
                                    state === "upcoming" ? "text-white/45" : "text-white"
                                }`}
                            >
                                {stop.label}
                            </p>
                            <p
                                className={`mt-0.5 text-xs transition-colors duration-500 ${
                                    state === "active" ? "text-yellow-200/90" : "text-white/40"
                                }`}
                            >
                                {stop.hint}
                            </p>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
};

export default RecoveryRoad;
