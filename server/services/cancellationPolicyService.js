import {
    BOOKING_STATUS,
    BOOKING_PICKUP_REFERENCE_HOUR,
    BOOKING_TIMEZONE_OFFSET_HOURS,
    BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS,
} from "../constants/bookingConstants.js";

/*
 * Pure, database-free rules for how much a customer gets back when they cancel
 * a booking before pickup. Only the reservation fee is ever at stake: anything
 * paid on top of it (a pay-in-full balance, the pickup distance fee) is always
 * refunded, and an admin-initiated cancellation always refunds everything.
 *
 * The fee refund depends on:
 *   - whether an admin has approved the booking yet (nothing has been
 *     committed to the customer before that),
 *   - how many hours remain until pickup (the configurable tiers),
 *   - a short cooling-off window right after approval.
 * A customer gets whichever of those is most generous.
 */

const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_CANCELLATION_POLICY = Object.freeze({
    fullRefundBeforeApproval: true,
    approvalGraceHours: 12,
    approvalGraceMinLeadHours: 24,
    tiers: Object.freeze([
        Object.freeze({ hoursBefore: 48, refundPercent: 100 }),
        Object.freeze({ hoursBefore: 24, refundPercent: 50 }),
    ]),
});

const MAX_TIERS = 6;
const MAX_TIER_HOURS = 720;
const MAX_GRACE_HOURS = 168;

const isFiniteNumber = (value) =>
    typeof value === "number" && Number.isFinite(value);

const round2 = (value) => Math.round(value * 100) / 100;

/* Largest `hoursBefore` (earliest cancellation) first. */
const sortTiers = (tiers) =>
    [...tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);

/*
 * Lean documents skip schema defaults, and documents saved before this
 * feature don't have the key at all, so fill every gap from the defaults.
 * An explicitly saved empty `tiers` list is kept as-is (it means "no refund
 * on the fee once approved"); only a missing/invalid one falls back.
 */
export const resolveCancellationPolicy = (raw) => {
    const source =
        raw && typeof raw === "object" ? raw : {};

    const tiers = Array.isArray(source.tiers)
        ? source.tiers
              .filter(
                  (tier) =>
                      isFiniteNumber(tier?.hoursBefore) &&
                      isFiniteNumber(tier?.refundPercent)
              )
              .map((tier) => ({
                  hoursBefore: tier.hoursBefore,
                  refundPercent: tier.refundPercent,
              }))
        : DEFAULT_CANCELLATION_POLICY.tiers.map((tier) => ({
              ...tier,
          }));

    return {
        fullRefundBeforeApproval:
            typeof source.fullRefundBeforeApproval === "boolean"
                ? source.fullRefundBeforeApproval
                : DEFAULT_CANCELLATION_POLICY.fullRefundBeforeApproval,

        approvalGraceHours: isFiniteNumber(source.approvalGraceHours)
            ? source.approvalGraceHours
            : DEFAULT_CANCELLATION_POLICY.approvalGraceHours,

        approvalGraceMinLeadHours: isFiniteNumber(
            source.approvalGraceMinLeadHours
        )
            ? source.approvalGraceMinLeadHours
            : DEFAULT_CANCELLATION_POLICY.approvalGraceMinLeadHours,

        tiers: sortTiers(tiers),
    };
};

/*
 * Returns an error message when a fully-resolved policy is invalid,
 * otherwise null. Strict on purpose: the settings endpoint's express-validator
 * chain is not enforced, so this is the real gate.
 */
export const getCancellationPolicyError = (policy) => {
    if (!policy || typeof policy !== "object") {
        return "cancellationPolicy must be an object.";
    }

    if (typeof policy.fullRefundBeforeApproval !== "boolean") {
        return "fullRefundBeforeApproval must be a boolean.";
    }

    if (
        !Number.isInteger(policy.approvalGraceHours) ||
        policy.approvalGraceHours < 0 ||
        policy.approvalGraceHours > MAX_GRACE_HOURS
    ) {
        return `approvalGraceHours must be a whole number between 0 and ${MAX_GRACE_HOURS}.`;
    }

    if (
        !Number.isInteger(policy.approvalGraceMinLeadHours) ||
        policy.approvalGraceMinLeadHours < 0 ||
        policy.approvalGraceMinLeadHours > MAX_TIER_HOURS
    ) {
        return `approvalGraceMinLeadHours must be a whole number between 0 and ${MAX_TIER_HOURS}.`;
    }

    if (!Array.isArray(policy.tiers)) {
        return "tiers must be a list.";
    }

    if (policy.tiers.length > MAX_TIERS) {
        return `At most ${MAX_TIERS} refund tiers are allowed.`;
    }

    const seenHours = new Set();

    for (const tier of policy.tiers) {
        if (
            !Number.isInteger(tier?.hoursBefore) ||
            tier.hoursBefore < 1 ||
            tier.hoursBefore > MAX_TIER_HOURS
        ) {
            return `Each tier's hours must be a whole number between 1 and ${MAX_TIER_HOURS}.`;
        }

        if (
            !Number.isInteger(tier?.refundPercent) ||
            tier.refundPercent < 0 ||
            tier.refundPercent > 100
        ) {
            return "Each tier's refund percentage must be a whole number between 0 and 100.";
        }

        if (seenHours.has(tier.hoursBefore)) {
            return `Two refund tiers use the same ${tier.hoursBefore}-hour cutoff.`;
        }

        seenHours.add(tier.hoursBefore);
    }

    const ordered = sortTiers(policy.tiers);

    for (let index = 1; index < ordered.length; index += 1) {
        const earlier = ordered[index - 1];
        const later = ordered[index];

        if (later.refundPercent > earlier.refundPercent) {
            return `Cancelling closer to pickup can't refund more than cancelling earlier: the ${later.hoursBefore}-hour tier (${later.refundPercent}%) is higher than the ${earlier.hoursBefore}-hour tier (${earlier.refundPercent}%).`;
        }
    }

    return null;
};

/*
 * The instant "hours before pickup" is measured against: the pickup time the
 * customer booked, as stored in `startDate`. Date-only bookings from before
 * pickup times existed were saved as UTC midnight, which already reads as
 * 8:00 AM Manila. One stored as Manila midnight (never a bookable pickup
 * time) is a bare date too, so it's read as BOOKING_PICKUP_REFERENCE_HOUR on
 * that Manila date.
 */
export const getPickupReference = (startDate) => {
    const start = new Date(startDate);

    if (Number.isNaN(start.getTime())) {
        return null;
    }

    const manila = new Date(
        start.getTime() + BOOKING_TIMEZONE_OFFSET_HOURS * HOUR_MS
    );

    if (manila.getUTCHours() !== 0 || manila.getUTCMinutes() !== 0) {
        return start;
    }

    return new Date(
        Date.UTC(
            manila.getUTCFullYear(),
            manila.getUTCMonth(),
            manila.getUTCDate()
        ) +
            (BOOKING_PICKUP_REFERENCE_HOUR -
                BOOKING_TIMEZONE_OFFSET_HOURS) *
                HOUR_MS
    );
};

/*
 * When an unpaid Pending booking is released: BOOKING_RESERVATION_PAYMENT_
 * WINDOW_HOURS after it was made, or at its booked pickup time if that comes
 * first — an unpaid booking must never hold the vehicle past its own pickup.
 */
export const getReservationPaymentDeadline = (booking) => {
    const windowEnd =
        new Date(booking.createdAt).getTime() +
        BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS * HOUR_MS;

    const pickupAt = getPickupReference(booking.startDate)?.getTime();

    return new Date(
        Number.isFinite(pickupAt) ? Math.min(windowEnd, pickupAt) : windowEnd
    );
};

const evaluateRefundPercent = (
    policy,
    { nowMs, pickupMs, approvedAtMs, isApproved }
) => {
    if (!isApproved && policy.fullRefundBeforeApproval) {
        return {
            percent: 100,
            rule: "before_approval",
            tierHoursBefore: null,
        };
    }

    const hoursUntilPickup = (pickupMs - nowMs) / HOUR_MS;

    let outcome = {
        percent: 0,
        rule: "none",
        tierHoursBefore: null,
    };

    for (const tier of policy.tiers) {
        if (hoursUntilPickup >= tier.hoursBefore) {
            outcome = {
                percent: tier.refundPercent,
                rule: "tier",
                tierHoursBefore: tier.hoursBefore,
            };

            break;
        }
    }

    if (
        isApproved &&
        approvedAtMs !== null &&
        policy.approvalGraceHours > 0 &&
        outcome.percent < 100
    ) {
        const hoursSinceApproval = (nowMs - approvedAtMs) / HOUR_MS;

        if (
            hoursSinceApproval >= 0 &&
            hoursSinceApproval <= policy.approvalGraceHours &&
            hoursUntilPickup >= policy.approvalGraceMinLeadHours
        ) {
            outcome = {
                percent: 100,
                rule: "approval_grace",
                tierHoursBefore: null,
            };
        }
    }

    return outcome;
};

const toMs = (value) => {
    if (!value) {
        return null;
    }

    const ms = new Date(value).getTime();

    return Number.isNaN(ms) ? null : ms;
};

/*
 * What a cancellation at `now` refunds. `totalPaid` is the verified payment
 * amount and `reservationFee` the portion of it the policy governs.
 */
export const computeCancellationRefund = ({
    policy,
    now = new Date(),
    startDate,
    approvedAt = null,
    isApproved,
    totalPaid,
    reservationFee,
    cancelledByRole = "customer",
}) => {
    const paid = round2(Math.max(0, Number(totalPaid) || 0));

    if (cancelledByRole === "admin") {
        return {
            refundAmount: paid,
            keptAmount: 0,
            refundPercent: 100,
            rule: "admin",
            tierHoursBefore: null,
            hoursUntilPickup: null,
        };
    }

    const feeAtStake = Math.min(
        paid,
        Math.max(0, Number(reservationFee) || 0)
    );

    const pickupAt = getPickupReference(startDate);
    const nowMs = new Date(now).getTime();

    const outcome = pickupAt
        ? evaluateRefundPercent(policy, {
              nowMs,
              pickupMs: pickupAt.getTime(),
              approvedAtMs: toMs(approvedAt),
              isApproved: Boolean(isApproved),
          })
        : { percent: 0, rule: "none", tierHoursBefore: null };

    const refundedFee = round2((feeAtStake * outcome.percent) / 100);
    const refundAmount = round2(paid - feeAtStake + refundedFee);

    return {
        refundAmount,
        keptAmount: round2(paid - refundAmount),
        refundPercent: outcome.percent,
        rule: outcome.rule,
        tierHoursBefore: outcome.tierHoursBefore,
        hoursUntilPickup: pickupAt
            ? (pickupAt.getTime() - nowMs) / HOUR_MS
            : null,
    };
};

/*
 * The next moment (after `now`) at which cancelling starts refunding less,
 * or null when nothing will change on its own — e.g. before approval, where
 * the only thing that changes the outcome is an admin approving.
 * `after` is the last instant the current refund still applies.
 *
 * `policies` (optional) are several policies of which the customer gets
 * whichever refunds most — a booking's locked terms and today's policy
 * (lockedTermsService); without it, just `policy`.
 */
export const getNextRefundChange = (input) => {
    const { now = new Date(), startDate, approvedAt, isApproved } = input;

    const policies =
        Array.isArray(input.policies) && input.policies.length > 0
            ? input.policies
            : [input.policy];

    const pickupAt = getPickupReference(startDate);

    if (!pickupAt) {
        return null;
    }

    const nowMs = new Date(now).getTime();
    const pickupMs = pickupAt.getTime();

    // The best refund across the policies at `at`.
    const refundAt = (at) =>
        policies
            .map((policy) =>
                computeCancellationRefund({ ...input, policy, now: at })
            )
            .reduce((best, result) =>
                result.refundAmount > best.refundAmount ? result : best
            );

    const current = refundAt(now);

    const boundaries = new Set();

    for (const policy of policies) {
        for (const tier of policy.tiers) {
            boundaries.add(pickupMs - tier.hoursBefore * HOUR_MS);
        }

        if (isApproved) {
            const approvedAtMs = toMs(approvedAt);

            if (approvedAtMs !== null && policy.approvalGraceHours > 0) {
                boundaries.add(
                    approvedAtMs + policy.approvalGraceHours * HOUR_MS
                );
            }

            boundaries.add(
                pickupMs - policy.approvalGraceMinLeadHours * HOUR_MS
            );
        }
    }

    const upcoming = [...boundaries]
        .filter((boundaryMs) => boundaryMs >= nowMs)
        .sort((a, b) => a - b);

    for (const boundaryMs of upcoming) {
        // 1ms past the boundary is the first instant the rule has changed.
        const future = refundAt(new Date(boundaryMs + 1));

        if (future.refundAmount < current.refundAmount) {
            return {
                after: new Date(boundaryMs),
                refundPercent: future.refundPercent,
                refundAmount: future.refundAmount,
                keptAmount: future.keptAmount,
            };
        }
    }

    return null;
};

/*
 * No-shows. A customer who never collects an approved booking keeps what
 * Settings → Refunds says (computeNoShowRefund): the reservation fee less the
 * no-show refund %, and the pickup distance fee unless that's switched off.
 * Everything else they paid (a pay-in-full balance) is refunded. The timing
 * below is measured from the booked pickup time.
 */

/*
 * The moment the customer could first have picked up: the pickup reference
 * time, or the approval if an admin approved the booking later than that
 * (approval isn't blocked once the start date has passed). Everything
 * no-show related is measured from here, so a late approval never turns into
 * a no-show before the customer had a real chance to come.
 */
export const getNoShowReference = (startDate, approvedAt = null) => {
    const pickupAt = getPickupReference(startDate);

    if (!pickupAt) {
        return null;
    }

    const approvedMs = toMs(approvedAt);

    return approvedMs !== null && approvedMs > pickupAt.getTime()
        ? new Date(approvedMs)
        : pickupAt;
};

/* When an admin may start marking the booking as a no-show. */
export const getNoShowEligibleAt = (
    startDate,
    graceHours,
    approvedAt = null
) => {
    const reference = getNoShowReference(startDate, approvedAt);

    return reference
        ? new Date(
              reference.getTime() +
                  Math.max(0, Number(graceHours) || 0) * HOUR_MS
          )
        : null;
};

/*
 * Until when a customer may cancel an approved booking themselves: its
 * booked pickup time — or, for a booking approved so late that this leaves
 * them no time (a same-day booking approved after its pickup time), until the
 * no-show grace period after the approval has run, i.e. the same moment an
 * admin could first mark it as a no-show. After this, not picking it up is a
 * no-show.
 *
 * Measured from getPickupReference, the same instant the refund tiers use,
 * so the cutoff and the refund can never disagree about when pickup is.
 */
export const getCustomerCancelCutoff = (
    startDate,
    graceHours,
    approvedAt = null
) => {
    const startMs = getPickupReference(startDate)?.getTime() ?? null;

    if (startMs === null) {
        return null;
    }

    const approvedMs = toMs(approvedAt);

    const afterApprovalMs =
        approvedMs === null
            ? startMs
            : approvedMs +
              Math.max(0, Number(graceHours) || 0) * HOUR_MS;

    return new Date(Math.max(startMs, afterApprovalMs));
};

/* Midnight (Manila) at the end of the Manila day that `date` falls in. */
const getEndOfManilaDay = (date) => {
    const manila = new Date(
        date.getTime() + BOOKING_TIMEZONE_OFFSET_HOURS * HOUR_MS
    );

    return new Date(
        Date.UTC(
            manila.getUTCFullYear(),
            manila.getUTCMonth(),
            manila.getUTCDate() + 1
        ) -
            BOOKING_TIMEZONE_OFFSET_HOURS * HOUR_MS
    );
};

/*
 * When a booking still not picked up is marked automatically: the end of the
 * (Manila) day on which the admin could first mark it. Normally that's
 * midnight at the end of the start date; a booking approved late in the day
 * gets until the end of the next day instead of being marked within hours.
 * (1 ms back so a grace period ending exactly at midnight still means that
 * midnight, not the one after.)
 */
export const getNoShowAutoAt = (
    startDate,
    graceHours,
    approvedAt = null
) => {
    const eligibleAt = getNoShowEligibleAt(
        startDate,
        graceHours,
        approvedAt
    );

    return eligibleAt
        ? getEndOfManilaDay(new Date(eligibleAt.getTime() - 1))
        : null;
};

/*
 * What a no-show keeps and refunds (Settings → Refunds → No-Shows): the
 * reservation fee less `refundPercent` of it, the pickup distance fee while
 * `keepDistanceFee`, and nothing else — any pay-in-full balance is refunded.
 * Independent of the cancellation tiers (their cooling-off rule must never
 * turn a no-show into a full refund).
 */
export const computeNoShowRefund = ({
    totalPaid,
    reservationFee,
    pickupDistanceFee,
    refundPercent = 0,
    keepDistanceFee = true,
}) => {
    const paid = round2(Math.max(0, Number(totalPaid) || 0));

    const percent = Math.min(
        100,
        Math.max(0, Number(refundPercent) || 0)
    );

    const distanceFeeKept = keepDistanceFee
        ? round2(
              Math.min(
                  paid,
                  Math.max(0, Number(pickupDistanceFee) || 0)
              )
          )
        : 0;

    const remaining = round2(paid - distanceFeeKept);

    const feeAtStake = round2(
        Math.min(
            remaining,
            Math.max(0, Number(reservationFee) || 0)
        )
    );

    const reservationFeeKept = round2(
        feeAtStake - (feeAtStake * percent) / 100
    );

    const refundAmount = round2(remaining - reservationFeeKept);

    return {
        refundAmount,
        keptAmount: round2(paid - refundAmount),
        reservationFeeKept,
        distanceFeeKept,
        refundPercent: percent,
    };
};

/* The most recent time an admin approved a booking, or null. */
export const getBookingApprovedAt = (booking) => {
    const history = Array.isArray(booking?.statusHistory)
        ? booking.statusHistory
        : [];

    for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index]?.status === BOOKING_STATUS.APPROVED) {
            return history[index].changedAt ?? null;
        }
    }

    return null;
};
