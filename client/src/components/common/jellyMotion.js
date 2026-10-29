/*
 * Shared "jelly" motion presets for accordion cards that use <Collapse>.
 */

/*
 * A quick vertical squash for the accordion card itself, played every time
 * it toggles. Vertical only — the card's width must stay fixed whether it's
 * open or closed. Use with `animate={isOpen ? "open" : "closed"}` and
 * `initial={false}` so it doesn't play on mount.
 */
const JELLY_KEYFRAMES = {
    scaleY: [1, 0.985, 1.008, 0.998, 1],
    transition: {
        duration: 0.55,
        ease: "easeOut",
        times: [0, 0.25, 0.55, 0.8, 1],
    },
};

export const jellyCardVariants = {
    open: JELLY_KEYFRAMES,
    closed: JELLY_KEYFRAMES,
};

/* Springy chevron flip to match. */
export const jellyChevronTransition = {
    type: "spring",
    visualDuration: 0.45,
    bounce: 0.45,
};
