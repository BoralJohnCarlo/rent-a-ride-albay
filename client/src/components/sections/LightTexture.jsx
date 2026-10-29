/*
 * Decorative light-mode background texture: masked line grid, film grain,
 * concentric rings on the right, and a striped corner. Hidden in dark mode
 * (dark sections carry their own atmosphere). Place inside an
 * `absolute inset-0` / `pointer-events-none` background layer.
 */

const GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Full class strings so Tailwind can see them.
const ACCENTS = {
    yellow: {
        ring: "border-yellow-500/20",
        ringSoft: "border-yellow-500/10",
        stripe: "rgba(202,138,4,0.14)",
    },
    blue: {
        ring: "border-blue-500/20",
        ringSoft: "border-blue-500/10",
        stripe: "rgba(37,99,235,0.12)",
    },
};

/*
 * `decorOnly` skips the grid + grain — use it on page surfaces that already
 * get the site-wide texture (styles/site-texture.css) so it doesn't double.
 */
const LightTexture = ({
    accent = "yellow",
    className = "inset-0",
    decorOnly = false,
}) => {
    const colors = ACCENTS[accent] ?? ACCENTS.yellow;

    return (
        <div
            aria-hidden="true"
            className={`pointer-events-none absolute overflow-hidden dark:hidden ${className}`}
        >
            {!decorOnly && (
                <>
                    {/* Line grid, fading out from the top */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_75%)]" />

                    {/* Film grain */}
                    <div
                        className="absolute inset-0 opacity-[0.07] mix-blend-multiply"
                        style={{
                            backgroundImage: GRAIN,
                            backgroundSize: "160px 160px",
                        }}
                    />
                </>
            )}

            {/* Concentric rings, right side */}
            <div className="absolute -right-40 top-1/2 h-[40rem] w-[40rem] -translate-y-1/2">
                <div
                    className={`absolute inset-0 rounded-full border ${colors.ringSoft}`}
                />
                <div
                    className={`absolute inset-[5rem] rounded-full border ${colors.ring}`}
                />
                <div
                    className={`absolute inset-[10rem] rounded-full border border-dashed ${colors.ring}`}
                />
                <div
                    className={`absolute inset-[15rem] rounded-full border ${colors.ringSoft}`}
                />
            </div>

            {/* Striped corner, bottom-left */}
            <div
                className="absolute -bottom-6 -left-6 h-48 w-80 [mask-image:radial-gradient(ellipse_at_bottom_left,black,transparent_70%)]"
                style={{
                    backgroundImage: `repeating-linear-gradient(135deg, ${colors.stripe} 0px, ${colors.stripe} 1px, transparent 1px, transparent 10px)`,
                }}
            />
        </div>
    );
};

export default LightTexture;
