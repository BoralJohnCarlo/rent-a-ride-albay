/*
 * Client-side companion to server/services/cancellationPolicyService.js.
 * The server is the source of truth for what a cancellation actually refunds;
 * this only fills defaults, validates the admin's edits before they are sent,
 * and turns the policy into sentences customers and admins can read.
 */

export const MAX_CANCELLATION_TIERS = 6;

export const DEFAULT_CANCELLATION_POLICY = {
    fullRefundBeforeApproval: true,
    approvalGraceHours: 12,
    approvalGraceMinLeadHours: 24,
    tiers: [
        { hoursBefore: 48, refundPercent: 100 },
        { hoursBefore: 24, refundPercent: 50 },
    ],
};

const isFiniteNumber = (value) =>
    typeof value === "number" && Number.isFinite(value);

/* Largest `hoursBefore` (earliest cancellation) first. */
const sortTiers = (tiers) =>
    [...tiers].sort((a, b) => b.hoursBefore - a.hoursBefore);

export const resolveCancellationPolicy = (raw) => {
    const source = raw && typeof raw === "object" ? raw : {};

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
 * Mirrors the server's getCancellationPolicyError so a mistake is caught
 * before the request is sent. Unlike resolveCancellationPolicy it takes the
 * raw form state as-is, where a cleared input is "" rather than a number.
 */
export const getCancellationPolicyError = (policy) => {
    if (
        !Number.isInteger(policy?.approvalGraceHours) ||
        policy.approvalGraceHours < 0 ||
        policy.approvalGraceHours > 168
    ) {
        return "Cooling-off hours must be a whole number between 0 and 168.";
    }

    if (
        !Number.isInteger(policy.approvalGraceMinLeadHours) ||
        policy.approvalGraceMinLeadHours < 0 ||
        policy.approvalGraceMinLeadHours > 720
    ) {
        return "Cooling-off minimum lead time must be a whole number between 0 and 720 hours.";
    }

    const tiers = Array.isArray(policy.tiers) ? policy.tiers : [];

    if (tiers.length > MAX_CANCELLATION_TIERS) {
        return `At most ${MAX_CANCELLATION_TIERS} refund tiers are allowed.`;
    }

    const seenHours = new Set();

    for (const tier of tiers) {
        if (
            !Number.isInteger(tier?.hoursBefore) ||
            tier.hoursBefore < 1 ||
            tier.hoursBefore > 720
        ) {
            return "Each tier's hours must be a whole number between 1 and 720.";
        }

        if (
            !Number.isInteger(tier.refundPercent) ||
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

    const ordered = sortTiers(tiers);

    for (let index = 1; index < ordered.length; index += 1) {
        const earlier = ordered[index - 1];
        const later = ordered[index];

        if (later.refundPercent > earlier.refundPercent) {
            return `Cancelling closer to pickup can't refund more than cancelling earlier: the ${later.hoursBefore}-hour tier (${later.refundPercent}%) is higher than the ${earlier.hoursBefore}-hour tier (${earlier.refundPercent}%).`;
        }
    }

    return null;
};

const hoursLabel = (hours) =>
    `${hours} hour${hours === 1 ? "" : "s"}`;

const outcomeLabel = (percent) => {
    if (percent >= 100) {
        return "the reservation fee is refunded in full";
    }

    if (percent <= 0) {
        return "the reservation fee is not refunded";
    }

    return `${percent}% of the reservation fee is refunded`;
};

/*
 * The policy as plain sentences, in the order a customer meets them. Used by
 * the Terms, the FAQ and the admin's live preview, so all three always quote
 * the numbers the server enforces.
 */
export const describeCancellationPolicy = (
    rawPolicy,
    // Settings → Refunds → No-shows ({ refundPercent, keepsDistanceFee }).
    noShowPolicy = {}
) => {
    const policy = resolveCancellationPolicy(rawPolicy);
    const lines = [];

    if (policy.fullRefundBeforeApproval) {
        lines.push(
            "Cancelling before your booking is approved refunds the reservation fee in full."
        );
    }

    policy.tiers.forEach((tier, index) => {
        const previous = policy.tiers[index - 1];

        const range = previous
            ? `Between ${tier.hoursBefore} and ${hoursLabel(previous.hoursBefore)} before pickup`
            : `At least ${hoursLabel(tier.hoursBefore)} before pickup`;

        lines.push(`${range}: ${outcomeLabel(tier.refundPercent)}.`);
    });

    const lowest = policy.tiers[policy.tiers.length - 1];

    if (!lowest) {
        lines.push(
            "Once your booking is approved, the reservation fee is not refunded."
        );
    } else {
        lines.push(
            `Less than ${hoursLabel(lowest.hoursBefore)} before pickup: the reservation fee is not refunded.`
        );
    }

    if (policy.approvalGraceHours > 0) {
        lines.push(
            `Within ${hoursLabel(policy.approvalGraceHours)} after your booking is approved you can cancel for a full reservation-fee refund${
                policy.approvalGraceMinLeadHours > 0
                    ? `, as long as pickup is still at least ${hoursLabel(policy.approvalGraceMinLeadHours)} away`
                    : ""
            }.`
        );
    }

    // A no-show has its own refund (independent of the tiers above).
    const noShowPercent = Math.min(
        100,
        Math.max(0, Number(noShowPolicy.refundPercent) || 0)
    );
    const keepsDistanceFee = noShowPolicy.keepsDistanceFee !== false;

    const feeOutcome =
        noShowPercent >= 100
            ? "the reservation fee is refunded in full"
            : noShowPercent > 0
              ? `${noShowPercent}% of the reservation fee is refunded`
              : "the reservation fee is not refunded";

    lines.push(
        "When you cancel, anything you paid on top of the reservation fee is refunded in full.",
        `A no-show (the vehicle is never picked up): ${feeOutcome}, any pickup distance fee is ${
            keepsDistanceFee ? "not refunded" : "refunded"
        }, anything else you paid is refunded, and a voucher used on the booking is not returned.`,
        "These cancellation and no-show timings are measured from the pickup date and time you booked (Philippine time). The rental period itself starts at the actual time the vehicle is handed over."
    );

    return lines;
};
