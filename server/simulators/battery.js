const START_BATTERY_PERCENT = 95;
const DRAIN_PERCENT_PER_MINUTE = 0.05; // ~3% per hour of simulated runtime
const MIN_BATTERY_PERCENT = 15;

/*
 * Battery drains deterministically with elapsed wall-clock time since the
 * simulator started, not randomly per tick - matches "decreases gradually,
 * not randomly every second".
 */
export const createBatteryModel = (startedAt = Date.now()) => {
    return () => {
        const elapsedMinutes = (Date.now() - startedAt) / 60000;
        const level =
            START_BATTERY_PERCENT - elapsedMinutes * DRAIN_PERCENT_PER_MINUTE;

        return Math.max(
            MIN_BATTERY_PERCENT,
            Math.round(level * 10) / 10
        );
    };
};
