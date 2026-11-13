export const BOUNDARY_DEFAULTS = Object.freeze({
    alertsEnabled: true, penaltiesEnabled: false, warningDistanceKm: 2,
    gracePeriodMinutes: 15, penaltyAmount: 500, bufferMeters: 200,
    confirmationSeconds: 60,
});

export const resolveBoundarySettings = (value = {}) => ({ ...BOUNDARY_DEFAULTS, ...value });

export const validateBoundaryPatch = (patch) => {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Boundary settings must be an object.");
    const ranges = { warningDistanceKm: [0.5, 20], gracePeriodMinutes: [5, 1440],
        penaltyAmount: [0, 100000], bufferMeters: [50, 1000], confirmationSeconds: [30, 600] };
    for (const [key, value] of Object.entries(patch)) {
        if (["alertsEnabled", "penaltiesEnabled"].includes(key)) {
            if (typeof value !== "boolean") throw new Error(`${key} must be a boolean.`);
        } else if (ranges[key]) {
            const [min, max] = ranges[key];
            if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
                throw new Error(`${key} must be between ${min} and ${max}.`);
            if (key === "penaltyAmount" && Math.abs(Math.round(value * 100) - value * 100) > 1e-7)
                throw new Error("Penalty amount must have at most two decimal places.");
            if (["gracePeriodMinutes", "bufferMeters", "confirmationSeconds"].includes(key) && !Number.isInteger(value))
                throw new Error(`${key} must be a whole number.`);
        } else throw new Error(`Unknown boundary setting: ${key}.`);
    }
    return patch;
};

// A new policy can only make an existing rental's financial terms kinder.
// Rentals without an accepted boundary policy are never charged retroactively.
export const lockedBoundaryPolicy = (current, snapshot) => ({
    ...current,
    penaltiesEnabled: current.alertsEnabled && current.penaltiesEnabled &&
        snapshot?.alertsEnabled === true && snapshot?.penaltiesEnabled === true,
    penaltyAmount: Math.min(current.penaltyAmount, snapshot?.penaltyAmount ?? 0),
    gracePeriodMinutes: Math.max(current.gracePeriodMinutes, snapshot?.gracePeriodMinutes ?? 0),
});

export const assertReviewedBoundaryPolicy = (settings, reviewed) => {
    const current = resolveBoundarySettings(settings);
    if (!current.alertsEnabled || !current.penaltiesEnabled) return;
    if (!reviewed || ["alertsEnabled", "penaltiesEnabled", "penaltyAmount", "gracePeriodMinutes"].some(key => reviewed[key] !== current[key])) {
        const error = new Error("The boundary policy changed. Reload the booking form and review the boundary terms before booking.");
        error.statusCode = 409;
        throw error;
    }
};
