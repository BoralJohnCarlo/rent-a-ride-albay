// Compare against this editor's last loaded/saved values, not another
// request's shared store snapshot. Policy tiers remain one atomic list.
export const buildRefundSettingsPatch = (current, baseline) => {
    const patch = {};
    for (const section of ["refundSettings", "earlyReturnSettings"]) {
        const changes = {};
        for (const [key, value] of Object.entries(current[section] ?? {})) {
            if (section === "refundSettings" && key === "cancellationPolicy") {
                const policyChanges = {};
                for (const [field, fieldValue] of Object.entries(value)) {
                    if (JSON.stringify(fieldValue) !== JSON.stringify(baseline[section]?.[key]?.[field])) {
                        policyChanges[field] = fieldValue;
                    }
                }
                if (Object.keys(policyChanges).length) changes[key] = policyChanges;
            } else if (JSON.stringify(value) !== JSON.stringify(baseline[section]?.[key])) {
                changes[key] = value;
            }
        }
        if (Object.keys(changes).length) patch[section] = changes;
    }
    return patch;
};
import { resolveCancellationPolicy } from "./cancellationPolicy.js";
import { DEFAULT_NO_SHOW_GRACE_HOURS } from "../constants/bookingStatus.js";

export const normalizeRefundSettings = (settings) => ({
    ...settings,
    refundSettings: {
        autoApproveRefundThreshold: 500,
        requireCancellationReason: true,
        gracePeriodHours: 24,
        noShowGraceHours: DEFAULT_NO_SHOW_GRACE_HOURS,
        noShowRefundPercent: 0,
        noShowKeepsDistanceFee: true,
        noShowAutoMark: true,
        ...settings.refundSettings,
        cancellationPolicy: resolveCancellationPolicy(settings.refundSettings?.cancellationPolicy),
    },
    earlyReturnSettings: {
        enabled: true,
        autoApprove: false,
        voucherValidityMonths: 12,
        minUnusedDaysToQualify: 1,
        ...settings.earlyReturnSettings,
    },
});

