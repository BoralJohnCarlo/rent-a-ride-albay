/*
 * Presets for <SwapLayer>: { out, in }, each [keyframes, transition].
 * "out" plays when a piece hides, "in" when it comes back.
 */

const EASE_OUT = [0.22, 1, 0.36, 1];

const HIDE = { duration: 0.3, ease: "easeIn" };
const SHOW = { duration: 0.55, ease: EASE_OUT };

/* Slides out sideways (negative = left) and glides back to where it was. */
const slideSwap = (offset) => ({
    out: [{ opacity: 0, x: offset }, HIDE],
    in: [{ opacity: 1, x: 0 }, SHOW],
});

export const SLIDE_LEFT_SWAP = slideSwap(-56);
export const SLIDE_RIGHT_SWAP = slideSwap(56);
export const NUDGE_LEFT_SWAP = slideSwap(-20);
export const NUDGE_RIGHT_SWAP = slideSwap(20);

/* Recedes (shrinks) as it fades, and zooms back up. */
export const ZOOM_SWAP = {
    out: [{ opacity: 0, scale: 0.9 }, HIDE],
    in: [{ opacity: 1, scale: 1 }, { ...SHOW, duration: 0.65 }],
};

/* Sinks a little as it fades, and rises back. */
export const RISE_SWAP = {
    out: [{ opacity: 0, y: 16 }, { ...HIDE, duration: 0.25 }],
    in: [{ opacity: 1, y: 0 }, SHOW],
};

/* Hero / featured-section call-to-action buttons: shrink, drop and fade
   out; pop back in with a springy overshoot after a short pause. */
export const BUTTON_SWAP = {
    out: [
        { opacity: 0, scale: 0.75, y: 18 },
        { duration: 0.22, ease: "easeIn" },
    ],
    in: [
        { opacity: [0, 1], scale: [0.6, 1], y: 0 },
        { type: "spring", stiffness: 420, damping: 16, delay: 0.12 },
    ],
};
