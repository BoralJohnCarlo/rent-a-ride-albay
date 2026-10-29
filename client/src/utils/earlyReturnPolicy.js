/*
 * Customer-facing lines for the early-return credit: unused full days are
 * credited as a voucher (not cash), per the admin's Early Return settings
 * (from the public settings endpoint). `earlyReturn` is null until those load,
 * so the wording then stays number-free rather than quote stale defaults.
 */
export const describeEarlyReturnPolicy = (earlyReturn) => {
    if (!earlyReturn) {
        return [
            "Returning early isn't refunded in cash. Unused full days may be credited as a voucher for a future booking.",
        ];
    }

    if (!earlyReturn.enabled) {
        return [
            "Returning early doesn't earn a refund or credit for unused days.",
        ];
    }

    const minDays = earlyReturn.minUnusedDaysToQualify;
    const months = earlyReturn.voucherValidityMonths;

    return [
        `Return ${minDays}+ full day${minDays === 1 ? "" : "s"} early and the unused days are credited as a voucher (at the vehicle's daily rate), not refunded in cash.`,
        `${earlyReturn.autoApprove ? "The voucher is issued automatically" : "The credit is reviewed by an admin before the voucher is issued"}. It can be used once, on any booking within ${months} month${months === 1 ? "" : "s"}.`,
    ];
};
