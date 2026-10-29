/*
 * Outline of the home hero's golden ribbon (light mode), in the wave SVG's
 * 1440×80 viewBox. It follows the wave's edge — the cubic
 * M0,40 C360,80 1080,0 1440,48 — but as a filled band whose width swells
 * and pinches like a ribbon: full on the two long sweeps, twisting down to
 * a sliver mid-page (under the trust badges) and tapering at both ends.
 */

export const HERO_WAVE_EDGE = "M0,40 C360,80 1080,0 1440,48";

const P0 = [0, 40];
const P1 = [360, 80];
const P2 = [1080, 0];
const P3 = [1440, 48];

const bezier = (t, a, b, c, d) =>
    (1 - t) ** 3 * a +
    3 * (1 - t) ** 2 * t * b +
    3 * (1 - t) * t ** 2 * c +
    t ** 3 * d;

const bezierSlope = (t, a, b, c, d) =>
    3 * (1 - t) ** 2 * (b - a) +
    6 * (1 - t) * t * (c - b) +
    3 * t ** 2 * (d - c);

/* Half-width along the ribbon (viewBox units): ~5 at the ends, ~8 on the
   sweeps, ~0.6 at the mid-page twist. */
const halfWidth = (t) =>
    0.6 + 7.4 * Math.abs(Math.sin(Math.PI * (1.6 * t + 0.2)));

const buildRibbonPath = (samples = 96) => {
    const upper = [];
    const lower = [];

    for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;

        const x = bezier(t, P0[0], P1[0], P2[0], P3[0]);
        const y = bezier(t, P0[1], P1[1], P2[1], P3[1]);

        const dx = bezierSlope(t, P0[0], P1[0], P2[0], P3[0]);
        const dy = bezierSlope(t, P0[1], P1[1], P2[1], P3[1]);
        const length = Math.hypot(dx, dy) || 1;

        // Unit normal to the curve.
        const nx = -dy / length;
        const ny = dx / length;

        const w = halfWidth(t);

        upper.push([x + nx * w, y + ny * w]);
        lower.push([x - nx * w, y - ny * w]);
    }

    const point = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

    return (
        `M${point(upper[0])} ` +
        upper.slice(1).map((p) => `L${point(p)}`).join(" ") +
        " " +
        lower.reverse().map((p) => `L${point(p)}`).join(" ") +
        " Z"
    );
};

export const HERO_RIBBON_PATH = buildRibbonPath();
