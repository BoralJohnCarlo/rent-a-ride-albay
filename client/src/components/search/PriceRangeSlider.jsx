import { useMemo } from "react";

/*
 * Dual-thumb range slider for a numeric min/max window. Both native range inputs are stacked; only their thumbs
 * receive pointer events so each thumb can be grabbed independently.
 */
const PriceRangeSlider = ({
    min = 0,
    max = 100,
    step = 1,
    value = [min, max],
    onChange,
    formatValue = (amount) => `₱${Number(amount).toLocaleString("en-PH")}`,
    disabled = false,
    rangeLabel = "daily rate",
    showMaxPlus = true,
}) => {
    const [low, high] = value;

    const safeRange = Math.max(max - min, 1);

    const lowPercent = useMemo(
        () => ((low - min) / safeRange) * 100,
        [low, min, safeRange]
    );

    const highPercent = useMemo(
        () => ((high - min) / safeRange) * 100,
        [high, min, safeRange]
    );

    const handleLowChange = (event) => {
        const next = Math.min(
            Number(event.target.value),
            high - step
        );

        onChange?.([Math.max(next, min), high]);
    };

    const handleHighChange = (event) => {
        const next = Math.max(
            Number(event.target.value),
            low + step
        );

        onChange?.([low, Math.min(next, max)]);
    };

    const thumbClasses = `
        pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent
        focus:outline-none
        [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
        [&::-webkit-slider-thumb]:-translate-y-0 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-yellow-500
        [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition
        [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:active:cursor-grabbing
        dark:[&::-webkit-slider-thumb]:bg-gray-900
        [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5
        [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-yellow-500 [&::-moz-range-thumb]:bg-white
        [&::-moz-range-thumb]:shadow-md dark:[&::-moz-range-thumb]:bg-gray-900
    `;

    return (
        <div className={disabled ? "opacity-60" : ""}>
            <div className="relative h-5">
                {/* Base track */}
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />

                {/* Selected range */}
                <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-yellow-500 transition-all duration-150 dark:bg-yellow-400"
                    style={{
                        left: `${lowPercent}%`,
                        width: `${Math.max(highPercent - lowPercent, 0)}%`,
                    }}
                />

                <input
                    type="range"
                    aria-label={`Minimum ${rangeLabel}`}
                    min={min}
                    max={max}
                    step={step}
                    value={low}
                    disabled={disabled}
                    onChange={handleLowChange}
                    className={thumbClasses}
                    style={{
                        zIndex:
                            low > max - safeRange * 0.08 ? 5 : 3,
                    }}
                />

                <input
                    type="range"
                    aria-label={`Maximum ${rangeLabel}`}
                    min={min}
                    max={max}
                    step={step}
                    value={high}
                    disabled={disabled}
                    onChange={handleHighChange}
                    className={thumbClasses}
                    style={{ zIndex: 4 }}
                />
            </div>

            <div className="mt-3 flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white">
                <span className="rounded-lg bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
                    {formatValue(low)}
                </span>

                <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    to
                </span>

                <span className="rounded-lg bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
                    {formatValue(high)}
                    {showMaxPlus && high >= max ? "+" : ""}
                </span>
            </div>
        </div>
    );
};

export default PriceRangeSlider;
