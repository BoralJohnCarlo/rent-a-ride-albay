import { describeCancellationPolicy } from "./cancellationPolicy";
import { describeEarlyReturnPolicy } from "./earlyReturnPolicy";
import {
    CANCELLATION_POLICY_LOADING_TEXT,
    DEPOSIT_RULES,
    FUEL_RULES,
    LICENSE_RULES,
    MOTORCYCLE_AREA_RULE,
    VEHICLE_USE_RULES,
    describeCancellationProcess,
    describeExtensions,
    describeLateReturn,
    describeLateReturnEffects,
    describeNoShowTiming,
    describePayment,
    describePickupTimeRules,
    describeRentalPeriodRules,
    describeRescheduling,
    describeTurnaroundBuffer,
} from "./bookingPolicyText";

/*
 * The booking terms' live blocks (server LEGAL_LIVE_BLOCKS): rule sentences
 * written from the admin's settings, the same ones the booking form's
 * Important Reminders card uses (utils/bookingPolicyText), so the terms
 * can't contradict what the system enforces. Admins place them in the
 * terms but can't reword them; to change one, change its setting.
 *
 * `values` is what usePublicRefundSettings returns — live settings, or a
 * booking's stored snapshot (normalizePublicSettings) when showing the
 * terms a customer accepted.
 */
export const LIVE_BLOCKS = Object.freeze({
    pickupTimeRules: {
        label: "Pickup time rules",
        source: "Settings → Bookings (pickup & booking hours)",
        render: (v) => describePickupTimeRules(v.bookingHours, v.pickupHours),
    },
    turnaroundBuffer: {
        label: "Time between rentals",
        source: "Settings → Bookings (turnaround buffer)",
        render: (v) => [describeTurnaroundBuffer(v.turnaroundBufferMinutes)],
    },
    rentalPeriodRules: {
        label: "Rental period",
        source: "Built-in booking rules",
        render: () => describeRentalPeriodRules(),
    },
    cancellationPolicy: {
        label: "Cancellation refund tiers",
        source: "Settings → Refunds (cancellation policy, no-shows)",
        render: (v) =>
            v.policy
                ? describeCancellationPolicy(v.policy, v.noShowPolicy)
                : [CANCELLATION_POLICY_LOADING_TEXT],
    },
    noShowTiming: {
        label: "No-show timing",
        source: "Settings → Refunds (no-show grace)",
        render: (v) => [
            describeNoShowTiming(v.noShowGraceHours, v.noShowPolicy?.autoMark),
        ],
    },
    cancellationProcess: {
        label: "How to cancel & request refunds",
        source: "Settings → Refunds",
        render: (v) =>
            describeCancellationProcess({
                requireCancellationReason: v.requireCancellationReason,
                refundRequestWindowHours: v.refundRequestWindowHours,
            }),
    },
    rescheduling: {
        label: "Rescheduling rules",
        source: "Built-in booking rules",
        render: () => describeRescheduling(),
    },
    payment: {
        label: "Payment rules",
        source: "Built-in booking rules",
        render: () => describePayment(),
    },
    lateReturn: {
        label: "Late-return charge",
        source: "Settings → Penalties",
        render: (v) => [describeLateReturn(v.latePenalty)],
    },
    extensions: {
        label: "Extensions",
        source: "Built-in booking rules",
        render: () => describeExtensions(),
    },
    lateReturnEffects: {
        label: "Late returns and the next booking",
        source: "Built-in booking rules",
        render: () => describeLateReturnEffects(),
    },
    earlyReturnCredit: {
        label: "Early return credit",
        source: "Early Return settings",
        render: (v) => describeEarlyReturnPolicy(v.earlyReturn),
    },
    depositRules: {
        label: "Security deposit rules",
        source: "Built-in booking rules",
        render: () => DEPOSIT_RULES,
    },
    fuelRules: {
        label: "Fuel rules",
        source: "Built-in booking rules",
        render: () => FUEL_RULES,
    },
    licenseRules: {
        label: "Driver's license rules",
        source: "Built-in booking rules",
        render: () => LICENSE_RULES,
    },
    authorizedDriverRule: {
        label: "Who may drive",
        source: "Built-in booking rules",
        render: () => [VEHICLE_USE_RULES[0]],
    },
    motorcycleAreaRule: {
        label: "Motorcycle travel area",
        source: "Built-in booking rules",
        render: () => [MOTORCYCLE_AREA_RULE],
    },
});

export const LIVE_BLOCK_OPTIONS = Object.entries(LIVE_BLOCKS).map(
    ([value, block]) => ({ value, label: block.label })
);

export const renderLiveBlock = (liveKey, values) =>
    LIVE_BLOCKS[liveKey]?.render(values ?? {}) ?? [];

const isSectionShown = (section, values) =>
    section.condition !== "earlyReturnEnabled" ||
    values?.earlyReturn?.enabled !== false;

/*
 * A document's sections ready to show: live blocks expanded into their
 * sentences, sections whose condition is off (e.g. Early Return Credit
 * while it's turned off) left out.
 */
export const resolveLegalSections = (document, values) =>
    (document?.sections ?? [])
        .filter((section) => isSectionShown(section, values))
        .map((section) => ({
            ...section,
            lines: (section.items ?? []).flatMap((item) =>
                item.kind === "live"
                    ? renderLiveBlock(item.liveKey, values)
                    : item.text
                      ? [item.text]
                      : []
            ),
        }));
