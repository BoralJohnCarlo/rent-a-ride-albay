/*
 * Pointer tracking for the "spotlight" vehicle card hover effect
 * (styles/vehicle-hover.css): sets --spot-x/--spot-y on the hovered element
 * directly, so the glow follows the cursor without a re-render per move.
 * Values are unitless, -1 (left/top edge) to 1 (right/bottom edge), 0 at
 * centre - CSS scales them into the glow's box-shadow offset.
 * Harmless to attach even when the admin-chosen mode is "neon" - the
 * variable just goes unused by that mode's CSS.
 */
export const trackCardSpotlight = (event) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    target.style.setProperty("--spot-x", x.toFixed(2));
    target.style.setProperty("--spot-y", y.toFixed(2));
};
