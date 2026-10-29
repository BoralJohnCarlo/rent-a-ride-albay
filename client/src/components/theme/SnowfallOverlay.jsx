const FLAKE_COUNT = 28;

// Seeded so the flake layout is computed once, stays pure during render,
// and looks the same on every load. (minstd LCG, seed must be 1..2^31-2.)
const createRandom = (seed) => {
    let value = seed;

    return () => {
        value = (value * 16807) % 2147483647;

        return (value - 1) / 2147483646;
    };
};

const buildFlakes = () => {
    const random = createRandom(20251225);

    return Array.from({ length: FLAKE_COUNT }, (_, id) => ({
        id,
        left: random() * 100,
        size: 3 + random() * 5,
        duration: 10 + random() * 12,
        // Negative delay: the snow is already mid-fall when it mounts
        // rather than every flake starting at the top together.
        delay: -random() * 22,
        drift: (random() - 0.5) * 90,
        opacity: 0.45 + random() * 0.45,
        glyph: id % 5 === 0,
    }));
};

const FLAKES = buildFlakes();

/*
 * Decorative falling snow. Purely visual: fixed, click-through and hidden
 * from assistive tech. The animation, colours, phone thinning and
 * reduced-motion handling all live in styles/christmas.css.
 */
const SnowfallOverlay = () => (
    <div className="xmas-snow" aria-hidden="true">
        {FLAKES.map((flake) => (
            <span
                key={flake.id}
                className={
                    flake.glyph
                        ? "xmas-flake xmas-flake--glyph"
                        : "xmas-flake"
                }
                style={{
                    "--left": `${flake.left}%`,
                    "--size": `${flake.size}px`,
                    "--dur": `${flake.duration}s`,
                    "--delay": `${flake.delay}s`,
                    "--drift": `${flake.drift}px`,
                    "--alpha": flake.opacity,
                }}
            >
                {flake.glyph ? "❄" : null}
            </span>
        ))}
    </div>
);

export default SnowfallOverlay;
