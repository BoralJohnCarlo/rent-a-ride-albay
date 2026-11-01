import createError from "./createError.js";

export const MAX_PAYOUT_HOLD_HOURS = 8760;
export const DEFAULT_PAYOUT_SETTINGS = Object.freeze({
    platformCommissionRate: 10, payoutCurrency: "PHP", payoutHoldHours: 24,
});

export const validatePayoutSettingsPatch = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw createError("Payout settings must be an object.", 400);
    }
    const patch = {};
    for (const key of Object.keys(DEFAULT_PAYOUT_SETTINGS)) {
        if (!Object.hasOwn(data, key)) continue;
        const value = data[key];
        if (key === "payoutCurrency") {
            if (value !== "PHP") throw createError("Payout currency must be PHP.", 400);
        } else if (!Number.isFinite(value) || value < 0 ||
            value > (key === "platformCommissionRate" ? 100 : MAX_PAYOUT_HOLD_HOURS) ||
            (key === "payoutHoldHours" && !Number.isInteger(value))) {
            throw createError(key === "platformCommissionRate"
                ? "platformCommissionRate must be a finite number between 0 and 100."
                : `payoutHoldHours must be a whole number between 0 and ${MAX_PAYOUT_HOLD_HOURS}.`, 400);
        }
        patch[key] = value;
    }
    return patch;
};

export const resolvePayoutSettings = (data) => {
    const result = { ...DEFAULT_PAYOUT_SETTINGS };
    for (const key of Object.keys(result)) {
        try { Object.assign(result, validatePayoutSettingsPatch({ [key]: data?.[key] ?? result[key] })); }
        catch { /* Invalid legacy values use the default. */ }
    }
    return result;
};
