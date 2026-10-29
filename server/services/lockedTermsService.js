import {
    computeCancellationRefund,
    computeNoShowRefund,
    resolveCancellationPolicy,
} from "./cancellationPolicyService.js";
import { resolveRefundSettings } from "./settingsService.js";

import { computeLatePenalty } from "../utils/latePenalty.js";

/*
 * A booking's fee rules are locked to what applied when its customer booked
 * (Booking.termsAcceptance.policySnapshot, taken when they accepted the
 * Terms & Conditions). If an admin changes a rule afterwards, the customer
 * gets whichever of the locked rule and today's is better for them: the
 * larger refund or credit, the smaller charge, the later no-show time. A
 * booking made before snapshots were taken has none and simply follows
 * today's settings, as before.
 *
 * Results carry `policySource` — "booking" when the booking's own terms
 * decided it (ties included), "current" when today's rules were kinder, null
 * for a booking without locked terms — and `termsVersion`, for the notes
 * customers and admins see next to the amount.
 */

export const POLICY_SOURCE = Object.freeze({
    BOOKING: "booking",
    CURRENT: "current",
});

const getSnapshot = (booking) => {
    const snapshot = booking?.termsAcceptance?.policySnapshot;

    return snapshot && typeof snapshot === "object" ? snapshot : null;
};

export const getTermsVersion = (booking) =>
    booking?.termsAcceptance?.version ?? null;

const withSource = (booking, useLocked) => ({
    policySource: useLocked ? POLICY_SOURCE.BOOKING : POLICY_SOURCE.CURRENT,
    termsVersion: getTermsVersion(booking),
});

const NO_SOURCE = Object.freeze({ policySource: null, termsVersion: null });

const versionLabel = (termsVersion) =>
    termsVersion ? `Version ${termsVersion}` : "the version accepted";

/* For refund notes and admin notices; "" without locked terms. */
export const describePolicySource = ({ policySource, termsVersion } = {}) => {
    if (policySource === POLICY_SOURCE.BOOKING) {
        return `the terms the customer agreed to when booking (${versionLabel(termsVersion)})`;
    }

    if (policySource === POLICY_SOURCE.CURRENT) {
        return `today's policy (better for the customer than the terms they booked under, ${versionLabel(termsVersion)})`;
    }

    return "";
};

/* The same, addressed to the customer. */
export const describePolicySourceForCustomer = ({
    policySource,
    termsVersion,
} = {}) => {
    if (policySource === POLICY_SOURCE.BOOKING) {
        return `the terms you agreed to when booking (${versionLabel(termsVersion)})`;
    }

    if (policySource === POLICY_SOURCE.CURRENT) {
        return "today's policy, which is better for you than the terms you booked under";
    }

    return "";
};

/* Settings → Refunds as they stood when the customer booked, or null. */
export const getLockedRefundSettings = (booking) => {
    const snapshot = getSnapshot(booking);

    if (!snapshot) {
        return null;
    }

    return resolveRefundSettings({
        requireCancellationReason: snapshot.requireCancellationReason,
        gracePeriodHours: snapshot.refundRequestWindowHours,
        noShowGraceHours: snapshot.noShowGraceHours,
        noShowRefundPercent: snapshot.noShowRefundPercent,
        noShowKeepsDistanceFee: snapshot.noShowKeepsDistanceFee,
        noShowAutoMark: snapshot.noShowAutoMark,
        cancellationPolicy: snapshot.cancellationPolicy,
    });
};

/* ------------------------------------------------------------------------ */
/*                               Cancellation                               */
/* ------------------------------------------------------------------------ */

/*
 * The cancellation policies a booking is entitled to: today's, plus its
 * locked one when it has one. `refundSettings` is Settings.refundSettings.
 */
export const getBookingCancellationPolicies = (booking, refundSettings) => {
    const current = resolveCancellationPolicy(
        refundSettings?.cancellationPolicy
    );
    const locked = getLockedRefundSettings(booking)?.cancellationPolicy;

    return locked ? { current, locked } : { current, locked: null };
};

/*
 * computeCancellationRefund under the better of the two policies. `input`
 * is everything computeCancellationRefund takes except `policy`. Also
 * returns `policies`, for getNextRefundChange.
 */
export const computeBookingCancellationRefund = (
    booking,
    refundSettings,
    input
) => {
    const { current, locked } = getBookingCancellationPolicies(
        booking,
        refundSettings
    );

    const currentResult = computeCancellationRefund({
        ...input,
        policy: current,
    });

    // An admin cancel refunds everything whatever the policy says.
    if (!locked || input.cancelledByRole === "admin") {
        return {
            ...currentResult,
            policies: [current],
            ...NO_SOURCE,
        };
    }

    const lockedResult = computeCancellationRefund({
        ...input,
        policy: locked,
    });

    const useLocked = lockedResult.refundAmount >= currentResult.refundAmount;

    return {
        ...(useLocked ? lockedResult : currentResult),
        policies: [locked, current],
        ...withSource(booking, useLocked),
    };
};

/* ------------------------------------------------------------------------ */
/*                                 No-shows                                 */
/* ------------------------------------------------------------------------ */

/*
 * When the booking can become a no-show: the longer grace of the two, and
 * marked automatically only if both its terms and today's settings say so
 * (otherwise an admin decides). `refundSettings` is already resolved
 * (resolveRefundSettings).
 */
export const getBookingNoShowTiming = (booking, refundSettings) => {
    const locked = getLockedRefundSettings(booking);

    if (!locked) {
        return {
            graceHours: refundSettings.noShowGraceHours,
            autoMark: refundSettings.noShowAutoMark,
        };
    }

    return {
        graceHours: Math.max(
            refundSettings.noShowGraceHours,
            locked.noShowGraceHours
        ),
        autoMark: refundSettings.noShowAutoMark && locked.noShowAutoMark,
    };
};

/*
 * computeNoShowRefund under the better of the booking's no-show terms and
 * today's. `input`: { totalPaid, reservationFee, pickupDistanceFee }.
 */
export const computeBookingNoShowRefund = (booking, refundSettings, input) => {
    const currentResult = computeNoShowRefund({
        ...input,
        refundPercent: refundSettings.noShowRefundPercent,
        keepDistanceFee: refundSettings.noShowKeepsDistanceFee,
    });

    const locked = getLockedRefundSettings(booking);

    if (!locked) {
        return { ...currentResult, ...NO_SOURCE };
    }

    const lockedResult = computeNoShowRefund({
        ...input,
        refundPercent: locked.noShowRefundPercent,
        keepDistanceFee: locked.noShowKeepsDistanceFee,
    });

    const useLocked = lockedResult.refundAmount >= currentResult.refundAmount;

    return {
        ...(useLocked ? lockedResult : currentResult),
        ...withSource(booking, useLocked),
    };
};

/* ------------------------------------------------------------------------ */
/*                               Late returns                               */
/* ------------------------------------------------------------------------ */

/*
 * The booking's locked penalty rules. Bookings locked before the rate
 * fields were kept fall back to today's rate type/rate for those.
 */
const getLockedPenaltySettings = (booking, currentPenaltySettings) => {
    const locked = getSnapshot(booking)?.latePenalty;

    if (!locked || typeof locked !== "object") {
        return null;
    }

    return {
        rateType: currentPenaltySettings.rateType,
        customRate: currentPenaltySettings.customRate,
        rateMultiplier: currentPenaltySettings.rateMultiplier,
        ...Object.fromEntries(
            Object.entries(locked).filter(([, value]) => value !== undefined)
        ),
    };
};

/* The vehicle's daily rate when booked, before any vehicle discount. */
const getBookedDailyRate = (booking) => {
    const rate = Number(
        booking?.pricing?.originalDailyRate ?? booking?.pricing?.dailyRate
    );

    return Number.isFinite(rate) && rate > 0 ? rate : 0;
};

/*
 * The late-return charge: today's rules at today's rate, or — when the
 * booking has locked terms — the lower of that and the locked rules at the
 * lower of the booked and today's daily rate.
 */
export const computeBookingLatePenalty = (
    booking,
    currentPenaltySettings,
    { expectedReturnAt, actualReturnAt, dailyRate }
) => {
    const currentResult = computeLatePenalty({
        penaltySettings: currentPenaltySettings,
        expectedReturnAt,
        actualReturnAt,
        dailyRate,
    });

    const lockedSettings = getLockedPenaltySettings(
        booking,
        currentPenaltySettings
    );

    if (!lockedSettings) {
        return { ...currentResult, ...NO_SOURCE };
    }

    const bookedRate = getBookedDailyRate(booking);
    const lockedRate =
        bookedRate > 0 && dailyRate > 0
            ? Math.min(bookedRate, dailyRate)
            : bookedRate || dailyRate;

    const lockedResult = computeLatePenalty({
        penaltySettings: lockedSettings,
        expectedReturnAt,
        actualReturnAt,
        dailyRate: lockedRate,
    });

    const useLocked = lockedResult.amount <= currentResult.amount;

    return {
        ...(useLocked ? lockedResult : currentResult),
        ...withSource(booking, useLocked),
    };
};

/*
 * The most an admin may set a late charge to: the lower cap (a cap is
 * kinder than none). 0 = no cap.
 */
export const getBookingPenaltyCap = (booking, currentPenaltySettings) => {
    const currentCap = Number(currentPenaltySettings?.maximumCap) || 0;
    const lockedSettings = getLockedPenaltySettings(
        booking,
        currentPenaltySettings ?? {}
    );

    if (!lockedSettings) {
        return currentCap;
    }

    const caps = [currentCap, Number(lockedSettings.maximumCap) || 0].filter(
        (cap) => cap > 0
    );

    return caps.length ? Math.min(...caps) : 0;
};

/* ------------------------------------------------------------------------ */
/*                              Early returns                               */
/* ------------------------------------------------------------------------ */

const resolveEarlyReturnSettings = (settings) => ({
    enabled: settings?.enabled ?? true,
    autoApprove: settings?.autoApprove ?? false,
    minUnusedDaysToQualify: settings?.minUnusedDaysToQualify ?? 1,
    voucherValidityMonths: settings?.voucherValidityMonths ?? 12,
});

/*
 * The early-return credit rules: each the more generous of the booking's
 * and today's (credit on if either has it, fewer days to qualify, issued
 * automatically if either does, the longer voucher validity).
 */
export const getBookingEarlyReturnSettings = (
    booking,
    currentEarlyReturnSettings
) => {
    const current = resolveEarlyReturnSettings(currentEarlyReturnSettings);
    const lockedRaw = getSnapshot(booking)?.earlyReturn;

    if (!lockedRaw || typeof lockedRaw !== "object") {
        return { ...current, ...NO_SOURCE };
    }

    const locked = resolveEarlyReturnSettings(lockedRaw);

    const effective = {
        enabled: current.enabled || locked.enabled,
        autoApprove: current.autoApprove || locked.autoApprove,
        minUnusedDaysToQualify: Math.min(
            current.minUnusedDaysToQualify,
            locked.minUnusedDaysToQualify
        ),
        voucherValidityMonths: Math.max(
            current.voucherValidityMonths,
            locked.voucherValidityMonths
        ),
    };

    const sameAsLocked = Object.keys(effective).every(
        (key) => effective[key] === locked[key]
    );

    return { ...effective, ...withSource(booking, sameAsLocked) };
};
