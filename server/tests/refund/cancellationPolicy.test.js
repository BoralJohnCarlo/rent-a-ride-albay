import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    DEFAULT_CANCELLATION_POLICY,
    computeCancellationRefund,
    computeNoShowRefund,
    getCustomerCancelCutoff,
    getNextRefundChange,
    getPickupReference,
    resolveCancellationPolicy,
} from "../../services/cancellationPolicyService.js";
import { getUpfrontFees } from "../../utils/bookingFees.js";
import { VOUCHER_TYPE } from "../../constants/voucherConstants.js";

/*
 * The pure refund rules, at their boundaries. Defaults: 100% before approval;
 * after it ≥48h → 100%, 24–48h → 50%, <24h → 0; a 12h cooling-off after
 * approval while pickup is still ≥24h away.
 */

const HOUR = 60 * 60 * 1000;

const policy = resolveCancellationPolicy(DEFAULT_CANCELLATION_POLICY);

// 2:00 PM Manila.
const PICKUP = new Date("2026-11-10T06:00:00.000Z");

const before = (ms) => new Date(PICKUP.getTime() - ms);

// Approved long before any of the cancellations below (no cooling-off).
const approvedLongAgo = before(30 * 24 * HOUR);

const cancelAt = (now, overrides = {}) =>
    computeCancellationRefund({
        policy,
        now,
        startDate: PICKUP,
        approvedAt: approvedLongAgo,
        isApproved: true,
        totalPaid: 500,
        reservationFee: 500,
        ...overrides,
    });

describe("cancellation tiers", () => {
    it("refunds everything exactly 48 hours before pickup", () => {
        const result = cancelAt(before(48 * HOUR));

        assert.equal(result.refundPercent, 100);
        assert.equal(result.refundAmount, 500);
    });

    it("drops to 50% one millisecond inside 48 hours", () => {
        const result = cancelAt(before(48 * HOUR - 1));

        assert.equal(result.refundPercent, 50);
        assert.equal(result.refundAmount, 250);
        assert.equal(result.keptAmount, 250);
    });

    it("still refunds 50% exactly 24 hours before pickup", () => {
        assert.equal(cancelAt(before(24 * HOUR)).refundPercent, 50);
    });

    it("refunds nothing one millisecond inside 24 hours", () => {
        const result = cancelAt(before(24 * HOUR - 1));

        assert.equal(result.refundPercent, 0);
        assert.equal(result.refundAmount, 0);
        assert.equal(result.keptAmount, 500);
    });

    it("refunds nothing after the pickup time", () => {
        assert.equal(cancelAt(new Date(PICKUP.getTime() + HOUR)).refundAmount, 0);
    });

    it("takes the 50% from the reservation fee only, never the rest of a pay-in-full payment", () => {
        const result = cancelAt(before(30 * HOUR), {
            totalPaid: 5300,
            reservationFee: 500,
        });

        assert.equal(result.refundAmount, 5050);
        assert.equal(result.keptAmount, 250);
    });

    it("refunds the whole fee before approval, even past the pickup time", () => {
        const result = cancelAt(new Date(PICKUP.getTime() + HOUR), {
            isApproved: false,
            approvedAt: null,
        });

        assert.equal(result.rule, "before_approval");
        assert.equal(result.refundAmount, 500);
    });

    it("refunds everything when an admin cancels", () => {
        const result = cancelAt(new Date(PICKUP.getTime() + HOUR), {
            cancelledByRole: "admin",
            totalPaid: 5300,
        });

        assert.equal(result.refundAmount, 5300);
        assert.equal(result.keptAmount, 0);
    });
});

describe("approval cooling-off", () => {
    // Approved 40h before pickup: the tier alone would give 50%.
    const approvedAt = before(40 * HOUR);

    it("refunds in full up to and including 12 hours after approval", () => {
        const result = cancelAt(new Date(approvedAt.getTime() + 12 * HOUR), {
            approvedAt,
        });

        assert.equal(result.rule, "approval_grace");
        assert.equal(result.refundAmount, 500);
    });

    it("ends one millisecond after the 12 hours", () => {
        const result = cancelAt(
            new Date(approvedAt.getTime() + 12 * HOUR + 1),
            { approvedAt }
        );

        assert.equal(result.refundPercent, 50);
    });

    it("applies exactly 24 hours before pickup, not one millisecond later", () => {
        const lateApproval = before(30 * HOUR);

        assert.equal(
            cancelAt(before(24 * HOUR), { approvedAt: lateApproval })
                .refundPercent,
            100
        );
        assert.equal(
            cancelAt(before(24 * HOUR - 1), { approvedAt: lateApproval })
                .refundPercent,
            0
        );
    });

    it("gives nothing to a booking approved less than 24 hours before pickup", () => {
        const result = cancelAt(before(19 * HOUR), {
            approvedAt: before(20 * HOUR),
        });

        assert.equal(result.refundAmount, 0);
    });
});

describe("getNextRefundChange", () => {
    it("names the 48-hour cutoff as the next drop", () => {
        const next = getNextRefundChange({
            policy,
            now: before(50 * HOUR),
            startDate: PICKUP,
            approvedAt: approvedLongAgo,
            isApproved: true,
            totalPaid: 500,
            reservationFee: 500,
        });

        assert.equal(next.after.getTime(), before(48 * HOUR).getTime());
        assert.equal(next.refundAmount, 250);
    });

    it("has nothing to report before approval", () => {
        assert.equal(
            getNextRefundChange({
                policy,
                now: before(50 * HOUR),
                startDate: PICKUP,
                isApproved: false,
                totalPaid: 500,
                reservationFee: 500,
            }),
            null
        );
    });
});

describe("getPickupReference (the 8:00 AM fallback)", () => {
    it("uses a booked pickup time as stored", () => {
        assert.equal(getPickupReference(PICKUP).getTime(), PICKUP.getTime());
    });

    it("reads a legacy UTC-midnight date as 8:00 AM Manila", () => {
        const legacy = new Date("2026-11-10T00:00:00.000Z");

        assert.equal(getPickupReference(legacy).getTime(), legacy.getTime());
    });

    it("reads a Manila-midnight date as 8:00 AM Manila that day", () => {
        assert.equal(
            getPickupReference(new Date("2026-11-09T16:00:00.000Z")).toISOString(),
            "2026-11-10T00:00:00.000Z"
        );
    });
});

describe("getCustomerCancelCutoff", () => {
    it("is the pickup time for a booking approved in advance", () => {
        assert.equal(
            getCustomerCancelCutoff(PICKUP, 4, approvedLongAgo).getTime(),
            PICKUP.getTime()
        );
    });

    it("runs to approval + grace for one approved after its pickup time", () => {
        const approvedAt = new Date(PICKUP.getTime() + 2 * HOUR);

        assert.equal(
            getCustomerCancelCutoff(PICKUP, 4, approvedAt).getTime(),
            approvedAt.getTime() + 4 * HOUR
        );
    });
});

describe("computeNoShowRefund", () => {
    it("keeps the reservation and pickup distance fees and refunds the rest", () => {
        const result = computeNoShowRefund({
            policy,
            startDate: PICKUP,
            approvedAt: approvedLongAgo,
            totalPaid: 5500,
            reservationFee: 500,
            pickupDistanceFee: 200,
        });

        assert.equal(result.refundAmount, 4800);
        assert.equal(result.reservationFeeKept, 500);
        assert.equal(result.distanceFeeKept, 200);
    });

    it("refunds the configured share of the reservation fee", () => {
        const result = computeNoShowRefund({
            totalPaid: 700,
            reservationFee: 500,
            pickupDistanceFee: 200,
            refundPercent: 40,
        });

        assert.equal(result.reservationFeeKept, 300);
        assert.equal(result.distanceFeeKept, 200);
        assert.equal(result.refundAmount, 200);
        assert.equal(result.keptAmount, 500);
    });

    it("refunds the pickup distance fee when it isn't kept", () => {
        const result = computeNoShowRefund({
            totalPaid: 700,
            reservationFee: 500,
            pickupDistanceFee: 200,
            keepDistanceFee: false,
        });

        assert.equal(result.distanceFeeKept, 0);
        assert.equal(result.refundAmount, 200);
        assert.equal(result.keptAmount, 500);
    });

    it("never lets the cancellation cooling-off rule refund a no-show", () => {
        // Approved 2 hours before pickup, with a policy whose cooling-off
        // needs no lead time — a cancellation then would be refunded in full.
        const result = computeNoShowRefund({
            policy: {
                ...policy,
                approvalGraceHours: 12,
                approvalGraceMinLeadHours: 0,
            },
            startDate: PICKUP,
            approvedAt: new Date(PICKUP.getTime() - 2 * HOUR),
            totalPaid: 500,
            reservationFee: 500,
            pickupDistanceFee: 0,
        });

        assert.equal(result.refundAmount, 0);
        assert.equal(result.keptAmount, 500);
    });

    it("clamps an out-of-range percentage", () => {
        assert.equal(
            computeNoShowRefund({
                totalPaid: 500,
                reservationFee: 500,
                refundPercent: 250,
            }).refundAmount,
            500
        );
    });
});

describe("getUpfrontFees", () => {
    const pricing = { reservationFee: 500, pickupDistanceFee: 200 };

    it("is the gross fees without a voucher", () => {
        assert.deepEqual(getUpfrontFees({ pricing }), {
            reservationFee: 500,
            pickupDistanceFee: 200,
            total: 700,
        });
    });

    it("takes a reservation-fee voucher off the reservation fee", () => {
        assert.deepEqual(
            getUpfrontFees({
                pricing,
                voucher: {
                    type: VOUCHER_TYPE.RESERVATION_FEE,
                    discountAmount: 500,
                },
            }),
            { reservationFee: 0, pickupDistanceFee: 200, total: 200 }
        );
    });

    it("takes a pickup-fee voucher off the pickup distance fee", () => {
        assert.equal(
            getUpfrontFees({
                pricing,
                voucher: {
                    type: VOUCHER_TYPE.PICKUP_FEE,
                    discountAmount: 50,
                },
            }).pickupDistanceFee,
            150
        );
    });

    it("leaves the upfront fees alone for a voucher on the rental itself", () => {
        for (const type of [VOUCHER_TYPE.TOTAL, VOUCHER_TYPE.VEHICLE_PRICE]) {
            assert.equal(
                getUpfrontFees({
                    pricing,
                    voucher: { type, discountAmount: 300 },
                }).total,
                700
            );
        }
    });

    it("never goes below zero", () => {
        assert.equal(
            getUpfrontFees({
                pricing,
                voucher: {
                    type: VOUCHER_TYPE.RESERVATION_FEE,
                    discountAmount: 9999,
                },
            }).reservationFee,
            0
        );
    });
});
