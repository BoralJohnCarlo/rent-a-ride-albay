import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";

import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Fragment, useEffect, useRef } from "react";

// Pixels per second while sliding, and the pause at each end.
const SLIDE_SPEED = 38;
const END_PAUSE = 1.4;

// Dragged down this far (or flicked), the pill opens the full card.
const OPEN_DRAG_PX = 28;
const OPEN_DRAG_VELOCITY = 350;

/*
 * The summary text, sliding like the Dynamic Island when it doesn't fit:
 * wait, glide to show the end, pause, glide back, repeat. Static (and
 * truncated by the fade) when it fits or the visitor prefers less motion.
 */
const SlidingSummary = ({ items }) => {
    const reduceMotion = useReducedMotion();
    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const x = useMotionValue(0);

    const key = items.join("|");

    useEffect(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;

        if (!viewport || !track) return undefined;

        let controls = null;

        const run = () => {
            controls?.stop();
            x.set(0);

            const overflow = track.scrollWidth - viewport.clientWidth;

            if (reduceMotion || overflow <= 4) return;

            const slide = overflow / SLIDE_SPEED;
            const total = END_PAUSE * 2 + slide * 2;

            controls = animate(x, [0, 0, -overflow, -overflow, 0], {
                duration: total,
                times: [
                    0,
                    END_PAUSE / total,
                    (END_PAUSE + slide) / total,
                    (END_PAUSE * 2 + slide) / total,
                    1,
                ],
                ease: "easeInOut",
                repeat: Infinity,
            });
        };

        run();

        const observer = new ResizeObserver(run);
        observer.observe(viewport);
        observer.observe(track);

        return () => {
            observer.disconnect();
            controls?.stop();
        };
    }, [key, reduceMotion, x]);

    return (
        <div
            ref={viewportRef}
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{
                maskImage:
                    "linear-gradient(to right, transparent, #000 6%, #000 92%, transparent)",
                WebkitMaskImage:
                    "linear-gradient(to right, transparent, #000 6%, #000 92%, transparent)",
            }}
        >
            <motion.div
                ref={trackRef}
                style={{ x }}
                className="flex w-max items-center gap-2 whitespace-nowrap px-2 text-[13px] font-semibold"
            >
                {items.map((item, index) => (
                    <Fragment key={`${item}-${index}`}>
                        {index > 0 && (
                            <span
                                aria-hidden="true"
                                className="h-1 w-1 shrink-0 rounded-full bg-yellow-400/70"
                            />
                        )}
                        <span
                            className={
                                index === 0
                                    ? "text-yellow-300"
                                    : "text-white/90"
                            }
                        >
                            {item}
                        </span>
                    </Fragment>
                ))}
            </motion.div>
        </div>
    );
};

/**
 * The minimised search filter on phones: a dark island summarising what's
 * set (count, dates, changed filters). Tap it or drag it down to open the
 * full card again.
 */
const FilterSummaryPill = ({ items, onExpand }) => {
    const summary = items.join(", ");

    return (
        <motion.button
            type="button"
            onClick={onExpand}
            aria-expanded={false}
            aria-label={`Show filters. ${summary}`}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            dragSnapToOrigin
            onDragEnd={(_event, info) => {
                if (
                    info.offset.y > OPEN_DRAG_PX ||
                    info.velocity.y > OPEN_DRAG_VELOCITY
                ) {
                    onExpand();
                }
            }}
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{ touchAction: "none" }}
            className="flex h-12 w-full items-center gap-2 rounded-full bg-gray-950 py-1.5 pl-1.5 pr-2 text-left shadow-xl shadow-gray-950/30 ring-1 ring-white/10 dark:bg-black dark:ring-white/15"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-gray-950">
                <SlidersHorizontal size={16} strokeWidth={2.4} />
            </span>

            <SlidingSummary items={items} />

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <ChevronDown size={17} />
            </span>
        </motion.button>
    );
};

export default FilterSummaryPill;
