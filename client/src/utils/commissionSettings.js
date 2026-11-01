export const MAX_PAYOUT_HOLD_HOURS = 8760;
export const normalizeCommissionSettings = (settings) => ({
    platformCommissionRate: settings.platformCommissionRate ?? 10,
    payoutCurrency: "PHP",
    payoutHoldHours: settings.payoutHoldHours ?? 24,
});

export const buildCommissionSettingsPatch = (draft, baseline) =>
    Object.fromEntries(["platformCommissionRate", "payoutCurrency", "payoutHoldHours"]
        .filter((key) => draft[key] !== baseline[key]).map((key) => [key, draft[key]]));

export const getCommissionSettingsError = (settings) => {
    if (!Number.isFinite(settings.platformCommissionRate) || settings.platformCommissionRate < 0 || settings.platformCommissionRate > 100) {
        return "Commission must be a number between 0 and 100.";
    }
    if (!Number.isInteger(settings.payoutHoldHours) || settings.payoutHoldHours < 0 || settings.payoutHoldHours > MAX_PAYOUT_HOLD_HOURS) {
        return `Payout hold must be a whole number between 0 and ${MAX_PAYOUT_HOLD_HOURS} hours.`;
    }
    return null;
};
