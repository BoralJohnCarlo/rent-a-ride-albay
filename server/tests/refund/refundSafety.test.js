import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import ManualRefund from "../../models/ManualRefund.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
import PayoutRequest from "../../models/PayoutRequest.js";
import { PAYOUT_STATUS, PAYOUT_METHOD } from "../../constants/payoutConstants.js";
import { reducePayoutForFaultRefund, scheduleOperatorPayout } from "../../services/payoutService.js";
import { createRefund } from "../../services/paymongoService.js";
import { normalizeRefundAmount } from "../../utils/refundAmount.js";
import { REFUND_IN_EFFECT_MATCH } from "../../utils/refundUtils.js";
import { settleRefundValidator, settleOwedRefundValidator, addRefundValidator, requestRefundValidator, approveRefundValidator } from "../../validators/rentalValidator.js";
import { validationResult } from "express-validator";

import {
    MANUAL_REFUND_STATUS,
    PAYMENT_METHOD,
    PAYMENT_REFUND_STATUS,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";
import {
    RENTAL_PAYMENT_METHOD,
    RENTAL_PAYMENT_STATUS,
    RENTAL_PAYMENT_TYPE,
    RENTAL_REFUND_REASON,
    RENTAL_REFUND_STATUS,
    RENTAL_STATUS,
} from "../../constants/rentalConstants.js";

import {
    completeManualRefund,
    processBookingRefund,
} from "../../services/paymentService.js";
import {
    computeRefundableAmount,
    recordRefund,
    settleRefundManually,
    syncBookingRefundAmount,
    requestRefund,
    approveRefund,
} from "../../services/rentalService.js";

import {
    BOOKING_RESCHEDULE_SETTLEMENT,
    BOOKING_RESCHEDULE_STATUS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";

import {
    cancelBooking,
    getBookingById,
} from "../../services/bookingService.js";
import { settleManualRefund } from "../../services/manualRefundService.js";
import { getOnlineRevenueForRange } from "../../services/onlineRevenueService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const newId = () => new mongoose.Types.ObjectId();

let adminId;

/*
 * Payments are created without a PayMongo charge, so every refund here takes
 * the manual path and nothing is sent to the gateway.
 */
const createPayment = (overrides = {}) =>
    Payment.create({
        booking: newId(),
        customer: newId(),
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        paymentMethod: PAYMENT_METHOD.GCASH,
        amount: 500,
        status: PAYMENT_STATUS.VERIFIED,
        audit: { createdBy: adminId, updatedBy: adminId },
        ...overrides,
    });

const createRental = (overrides = {}) =>
    Rental.create({
        rentalCode: `RN-T${newId()}`,
        booking: newId(),
        customer: newId(),
        vehicle: newId(),
        status: RENTAL_STATUS.COMPLETED,
        pickup: { date: new Date(), processedBy: adminId },
        return: { date: new Date(), processedBy: adminId },
        bookingPeriod: {
            originalStartDate: new Date(),
            originalEndDate: new Date(),
            actualStartDate: new Date(),
        },
        actualEndDate: new Date(),
        financial: { baseRentalCharge: 4800, reservationFee: 500 },
        ...overrides,
    });

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, ManualRefund, Notification, Payment, Rental].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [Booking, ManualRefund, Notification, Payment, Rental, User, Vehicle, PayoutRequest].map((model) =>
            model.deleteMany({})
        )
    );

    adminId = newId();

    await User.collection.insertOne({
        _id: adminId,
        role: "admin",
        email: `admin-${adminId}@test.local`,
    });
});

describe("refund regressions", () => {
    for (const historical of [false, true]) {
        for (const linked of [false, true]) {
            it(`recovers ${historical ? "a missing historical" : "a fully offset"} payout after a failed ${linked ? "payment" : "rental"} refund`, async () => {
                const bookingId = newId(), vehicleId = newId();
                const booking = { _id: bookingId, bookingCode: `BK-${bookingId}`, pricing: { totalAmount: 1000 } };
                const vehicle = { _id: vehicleId, vehicleCode: `V-${vehicleId}`, plateNumber: String(vehicleId), operator: adminId, commission: { mode: "PERCENTAGE", value: 80 } };
                await Booking.collection.insertOne(booking);
                await Vehicle.collection.insertOne(vehicle);
                const payment = linked ? await createPayment({ booking: bookingId, amount: 1000, refund: {
                    amount: 1000, reason: "others", method: "manual", status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
                } }) : null;
                const rental = await createRental({ booking: bookingId, vehicle: vehicleId, refunds: [{
                    amount: 1000, reason: RENTAL_REFUND_REASON.VEHICLE_PERFORMANCE_ISSUE,
                    gatewayStatus: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION, gatewayPayment: payment?._id ?? null,
                }] });
                let releaseAt;
                if (!historical) {
                    const offset = await scheduleOperatorPayout(booking, vehicle, rental._id, adminId);
                    assert.equal(offset.status, PAYOUT_STATUS.CANCELLED);
                    assert.equal(offset.payoutAmount, 0);
                    assert.equal(offset.items[0].refundDeduction, 1000);
                    releaseAt = offset.scheduledReleaseAt;
                }
                if (linked) await completeManualRefund(payment._id, { succeeded: false }, adminId);
                else await settleRefundManually(rental._id, rental.refunds[0]._id, adminId, { succeeded: false });
                const payout = await PayoutRequest.findOne({ "items.booking": bookingId }).lean();
                assert.ok(payout);
                assert.equal(payout.status, PAYOUT_STATUS.SCHEDULED);
                assert.equal(payout.payoutAmount, 800);
                assert.equal(payout.items[0].refundDeduction, 0);
                if (releaseAt) assert.equal(payout.scheduledReleaseAt.getTime(), releaseAt.getTime());
                await reducePayoutForFaultRefund(bookingId, { recoverMissing: true });
                assert.equal(await PayoutRequest.countDocuments({ "items.booking": bookingId }), 1);
            });
        }
    }

    it("does not create a payout before completion or revive a manually cancelled payout", async () => {
        const bookingId = newId();
        const vehicleId = newId();
        await Booking.collection.insertOne({ _id: bookingId, bookingCode: `BK-${bookingId}`, pricing: { totalAmount: 1000 } });
        await Vehicle.collection.insertOne({ _id: vehicleId, vehicleCode: `V-${vehicleId}`, plateNumber: String(vehicleId), operator: adminId });
        const rental = await createRental({ booking: bookingId, vehicle: vehicleId, status: RENTAL_STATUS.ONGOING, audit: { createdBy: adminId } });
        assert.equal((await reducePayoutForFaultRefund(bookingId, { recoverMissing: true })).outcome, "none");
        assert.equal(await PayoutRequest.countDocuments({ "items.booking": bookingId }), 0);
        await Rental.updateOne({ _id: rental._id }, { $set: { status: RENTAL_STATUS.COMPLETED } });
        await PayoutRequest.create({
            operator: adminId, payoutCode: `PO-${newId()}`, payoutMethod: PAYOUT_METHOD.GCASH,
            status: PAYOUT_STATUS.CANCELLED, cancelledBy: adminId, cancellationReason: "Cancelled by admin",
            items: [{ booking: bookingId, vehicle: rental.vehicle, bookingAmount: 1000, platformCommission: 200, operatorEarnings: 800 }],
            subtotalAmount: 1000, totalCommission: 200, payoutAmount: 800, audit: { createdBy: adminId },
        });
        await reducePayoutForFaultRefund(bookingId, { recoverMissing: true });
        assert.equal(await PayoutRequest.countDocuments({ "items.booking": bookingId }), 1);
        assert.equal((await PayoutRequest.findOne({ "items.booking": bookingId })).status, PAYOUT_STATUS.CANCELLED);
    });

    it("validates whole-centavo amounts on refund recording, requesting and approval routes", async () => {
        for (const validators of [addRefundValidator, requestRefundValidator, approveRefundValidator]) {
            for (const amount of [0.001, 0.005, 1.005, 10.999, 0.01, 1.23, "1.20", 0.1 + 0.2]) {
                const req = { params: { rentalId: String(newId()), refundId: String(newId()) },
                    body: { amount, reason: "Other", refundType: "custom" } };
                for (const validator of validators) await validator.run(req);
                assert.equal(validationResult(req).isEmpty(), [0.01, 1.23, "1.20", 0.1 + 0.2].includes(amount));
            }
        }
    });

    it("preserves large two-decimal amounts and ordinary floating-point currency arithmetic", () => {
        for (const amount of [0.01, 1234.56, 100000000.01, 999999999.97, 999999999.99]) {
            assert.equal(normalizeRefundAmount(amount), amount);
        }
        assert.equal(normalizeRefundAmount(0.1 + 0.2), 0.3);
        assert.throws(() => normalizeRefundAmount(999999999.975), { statusCode: 400 });
    });

    it("rejects fractional centavos before saving rental or payment refunds", async () => {
        const rental = await createRental({ refunds: [{ amount: 5, reason: "Other", status: "Pending" }] });
        const payment = await createPayment({ booking: rental.booking, amount: 100 });
        for (const amount of [0.001, 1.005]) {
            await assert.rejects(recordRefund(rental._id, { amount, reason: "Other" }, adminId), { statusCode: 400 });
            await assert.rejects(requestRefund(rental._id, { amount, reason: "Other", refundType: "custom" }, rental.customer), { statusCode: 400 });
            await assert.rejects(approveRefund(rental._id, rental.refunds[0]._id, adminId, amount), { statusCode: 400 });
            await assert.rejects(processBookingRefund(rental.booking, { amount }), { statusCode: 400 });
        }
        assert.equal((await Rental.findById(rental._id)).refunds.length, 1);
        assert.equal((await Payment.findById(payment._id)).refund, null);
    });

    it("sends the exact recorded centavos to PayMongo and rejects smaller fractions without a request", async (t) => {
        const originalKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_refund_safety";
        const sent = [];
        t.mock.method(globalThis, "fetch", async (_url, options) => {
            sent.push(JSON.parse(options.body).data.attributes.amount);
            return { ok: true, json: async () => ({ data: { id: `ref_${newId()}`, attributes: { status: "succeeded" } } }) };
        });
        try {
            for (const amount of [0.001, 0.005, 1.005]) {
                await assert.rejects(createRefund({ paymentId: "pay_test", amount, reason: "others" }), { statusCode: 400 });
            }
            assert.equal(sent.length, 0);
            for (const amount of [0.01, 0.1 + 0.2, 1234.56]) {
                const result = await createRefund({ paymentId: "pay_test", amount, reason: "others" });
                assert.equal(result.amount, sent.at(-1) / 100);
            }
            assert.deepEqual(sent, [1, 30, 123456]);
        } finally {
            if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = originalKey;
        }
    });

    it("retains earlier and paid owed refunds without counting linked payments twice", async () => {
        const bookingId = newId();
        await Booking.collection.insertOne({ _id: bookingId, bookingCode: `BK-${bookingId}` });
        await createPayment({ booking: bookingId, paymentType: PAYMENT_TYPE.EXTENSION_FEE, bookingExtension: newId(), amount: 5300, refund: {
            amount: 1000, reason: "others", method: "manual", status: PAYMENT_REFUND_STATUS.SUCCEEDED,
        } });
        const linked = await createPayment({ booking: bookingId, refund: {
            amount: 500, reason: "others", method: "manual", status: PAYMENT_REFUND_STATUS.SUCCEEDED,
        } });
        await createRental({ booking: bookingId, refunds: [
            { amount: 500, reason: "Other", status: "Approved", gatewayStatus: "succeeded", gatewayPayment: linked._id },
            { amount: 50, reason: "Other", status: "Approved" },
            { amount: 200, reason: "Other", status: "Approved", gatewayStatus: "failed" },
            { amount: 99, reason: "Other", status: "Pending" },
        ] });
        await ManualRefund.create([
            { booking: bookingId, customer: newId(), amount: 100, reason: "Other", status: MANUAL_REFUND_STATUS.PAID },
            { booking: bookingId, customer: newId(), amount: 200, reason: "Other", status: MANUAL_REFUND_STATUS.OWED },
        ]);
        assert.equal(await syncBookingRefundAmount(bookingId), 1650);
        assert.equal((await Booking.findById(bookingId)).refundAmount, 1650);

        // A later payment settlement must refresh totals even after pickup.
        const later = await createPayment({ booking: bookingId, paymentType: PAYMENT_TYPE.EXTENSION_FEE, bookingExtension: newId(), refund: {
            amount: 300, reason: "others", method: "manual", status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
        } });
        await completeManualRefund(later._id, { succeeded: true }, adminId);
        assert.equal((await Booking.findById(bookingId)).refundAmount, 1950);
    });

    it("rejects percentage refunds rounded to zero but accepts one cent", async () => {
        const rental = await createRental({ financial: { baseRentalCharge: 0.01, reservationFee: 0 } });
        await createPayment({ booking: rental.booking, amount: 0.01 });
        await assert.rejects(requestRefund(rental._id, {
            reason: "Other", refundType: "partial", percentage: 1,
        }, rental.customer), { statusCode: 400 });
        assert.equal((await Rental.findById(rental._id)).refunds.length, 0);
        await requestRefund(rental._id, {
            reason: "Other", refundType: "partial", percentage: 100,
        }, rental.customer);
        assert.equal((await Rental.findById(rental._id)).refunds[0].amount, 0.01);
    });

    it("rejects approval of old zero-value requests", async () => {
        const rental = await createRental({ refunds: [{ amount: 0, reason: "Other", status: "Pending" }] });
        await createPayment({ booking: rental.booking });
        await assert.rejects(approveRefund(rental._id, rental.refunds[0]._id, adminId), { statusCode: 400 });
        assert.equal((await Rental.findById(rental._id)).refunds[0].status, "Pending");
        assert.equal((await Payment.findOne({ booking: rental.booking })).refund, null);
    });

    it("cannot overwrite a final settlement made during the gateway lookup", async (t) => {
        const originalKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_refund_safety";
        const refundId = `ref_${newId()}`;
        const payment = await createPayment({ refund: {
            amount: 500, reason: "others", method: "automatic", refundId, status: PAYMENT_REFUND_STATUS.PENDING,
        } });
        t.mock.method(globalThis, "fetch", async () => {
            await Payment.updateOne({ _id: payment._id }, { $set: { "refund.status": PAYMENT_REFUND_STATUS.SUCCEEDED } });
            return { ok: true, json: async () => ({ data: { id: refundId, attributes: { status: "failed" } } }) };
        });
        try {
            await assert.rejects(completeManualRefund(payment._id, { succeeded: false }, adminId), { statusCode: 409 });
            assert.equal((await Payment.findById(payment._id)).refund.status, PAYMENT_REFUND_STATUS.SUCCEEDED);
        } finally {
            if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = originalKey;
        }
    });

    it("leaves in-flight refunds unchanged when PayMongo cannot be reached", async (t) => {
        const originalKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_refund_safety";
        const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Test gateway outage"); });
        try {
            for (const status of [PAYMENT_REFUND_STATUS.PENDING, PAYMENT_REFUND_STATUS.PROCESSING]) {
                for (const succeeded of [true, false]) {
                    const payment = await createPayment({ refund: {
                        amount: 500, reason: "others", method: "automatic", refundId: `ref_${newId()}`, status,
                    } });
                    await assert.rejects(completeManualRefund(payment._id, { succeeded }, adminId), { statusCode: 409 });
                    const saved = await Payment.findById(payment._id).lean();
                    assert.equal(saved.refund.status, status);
                    assert.equal(saved.status, PAYMENT_STATUS.VERIFIED);
                }
            }
            assert.equal(fetchMock.mock.callCount(), 4);
        } finally {
            if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = originalKey;
        }
    });

    for (const gatewayStatus of ["", "processing", "failed", "succeeded"]) {
        it(`requires a confirmed gateway failure before manual settlement (${gatewayStatus || "unknown"})`, async (t) => {
            const originalKey = process.env.PAYMONGO_SECRET_KEY;
            process.env.PAYMONGO_SECRET_KEY = "sk_test_refund_safety";
            const refundId = `ref_${newId()}`;
            t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({
                data: { id: refundId, attributes: { status: gatewayStatus } },
            }) }));
            try {
                const payment = await createPayment({ refund: {
                    amount: 500, reason: "others", method: "automatic", refundId, status: PAYMENT_REFUND_STATUS.PENDING,
                } });
                if (gatewayStatus === "failed") {
                    await completeManualRefund(payment._id, { succeeded: false }, adminId);
                    assert.equal((await Payment.findById(payment._id)).refund.status, PAYMENT_REFUND_STATUS.FAILED);
                } else {
                    await assert.rejects(completeManualRefund(payment._id, { succeeded: false }, adminId), { statusCode: 409 });
                    assert.equal((await Payment.findById(payment._id)).refund.status, gatewayStatus || PAYMENT_REFUND_STATUS.PENDING);
                }
            } finally {
                if (originalKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
                else process.env.PAYMONGO_SECRET_KEY = originalKey;
            }
        });
    }

    it("normalizes settlement booleans on both refund routes", async () => {
        for (const validators of [settleRefundValidator, settleOwedRefundValidator]) {
            for (const [input, expected] of [[false, false], ["false", false], ["0", false], [true, true], ["true", true]]) {
                const req = {
                    params: { id: String(newId()), rentalId: String(newId()), refundId: String(newId()) },
                    body: { succeeded: input },
                };
                for (const validator of validators) await validator.run(req);
                assert.equal(validationResult(req).isEmpty(), true);
                assert.equal(req.body.succeeded, expected);
            }
            const req = {
                params: { id: String(newId()), rentalId: String(newId()), refundId: String(newId()) },
                body: { succeeded: "invalid" },
            };
            for (const validator of validators) await validator.run(req);
            assert.equal(validationResult(req).isEmpty(), false);
        }
    });

    it("includes legacy approved refunds in statistics but excludes failed and pending ones", async () => {
        const rental = await createRental();
        await Rental.collection.updateOne({ _id: rental._id }, { $set: { refunds: [
            { amount: 100 },
            { amount: 200, status: "Approved" },
            { amount: 400, status: "Approved", gatewayStatus: PAYMENT_REFUND_STATUS.FAILED },
            { amount: 800, status: "Pending" },
        ] } });
        const [total] = await Rental.aggregate([
            { $unwind: "$refunds" }, { $match: REFUND_IN_EFFECT_MATCH },
            { $group: { _id: null, amount: { $sum: "$refunds.amount" } } },
        ]);
        assert.equal(total.amount, 300);
    });

    for (const linked of [false, true]) {
        for (const amount of [200, 1000]) {
            it(`restores a ${amount === 1000 ? "cancelled" : "reduced"} payout after a failed ${linked ? "payment" : "rental"} refund`, async () => {
                const bookingId = newId();
                const vehicleId = newId();
                await Booking.collection.insertOne({ _id: bookingId, bookingCode: `BK-${bookingId}`, pricing: { totalAmount: 1000 } });
                await Vehicle.collection.insertOne({ _id: vehicleId, vehicleCode: `V-${vehicleId}`, plateNumber: String(vehicleId), operator: adminId, commission: { mode: "PERCENTAGE", value: 80 } });
                const payment = linked ? await createPayment({ booking: bookingId, amount: 1000, refund: { amount, reason: "others", status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION, method: "manual" } }) : null;
                const rental = await createRental({ booking: bookingId, vehicle: vehicleId, refunds: [{
                    amount, reason: RENTAL_REFUND_REASON.VEHICLE_PERFORMANCE_ISSUE,
                    status: RENTAL_REFUND_STATUS.APPROVED,
                    gatewayStatus: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
                    gatewayPayment: payment?._id ?? null,
                }] });
                const releaseAt = new Date(Date.now() + 86400000);
                const payout = await PayoutRequest.create({
                    operator: adminId, payoutCode: `PO-${newId()}`, payoutMethod: PAYOUT_METHOD.GCASH,
                    status: PAYOUT_STATUS.SCHEDULED, scheduledReleaseAt: releaseAt,
                    items: [{ booking: bookingId, vehicle: vehicleId, bookingAmount: 1000, platformCommission: 200, operatorEarnings: 800 }],
                    subtotalAmount: 1000, totalCommission: 200, payoutAmount: 800, audit: { createdBy: adminId },
                });
                await reducePayoutForFaultRefund(bookingId);
                const reduced = await PayoutRequest.findById(payout._id).lean();
                assert.equal(reduced.status, amount === 1000 ? PAYOUT_STATUS.CANCELLED : PAYOUT_STATUS.SCHEDULED);
                if (linked) await completeManualRefund(payment._id, { succeeded: false }, adminId);
                else await settleRefundManually(rental._id, rental.refunds[0]._id, adminId, { succeeded: false });
                const restored = await PayoutRequest.findById(payout._id).lean();
                assert.equal(restored.status, PAYOUT_STATUS.SCHEDULED);
                assert.equal(restored.payoutAmount, 800);
                assert.equal(restored.items[0].refundDeduction, 0);
                assert.equal(restored.scheduledReleaseAt.getTime(), releaseAt.getTime());
            });
        }
    }
});

describe("refundPayment", () => {
    it("refunds a payment once when two flows refund it at the same time", async () => {
        const payment = await createPayment();

        const [first, second] = await Promise.all([
            processBookingRefund(payment.booking, { amount: 500 }),
            processBookingRefund(payment.booking, { amount: 300 }),
        ]);

        // Both callers see the single refund that exists.
        assert.equal(
            String(first.refund._id ?? first.refund.amount),
            String(second.refund._id ?? second.refund.amount)
        );

        const saved = await Payment.findById(payment._id).lean();
        assert.ok([500, 300].includes(saved.refund.amount));

        assert.equal(
            await Notification.countDocuments({
                recipient: adminId,
                type: "Refund Requires Manual Action",
            }),
            1,
            "only the winning refund may alert the admins"
        );
    });
});

describe("computeRefundableAmount", () => {
    it("nets out a pre-pickup refund made on the payment (reschedule to fewer days)", async () => {
        const rental = await createRental();

        await createPayment({
            booking: rental.booking,
            amount: 5300,
            refund: {
                amount: 2400,
                status: PAYMENT_REFUND_STATUS.SUCCEEDED,
                method: "manual",
                reason: "others",
            },
        });

        assert.equal(
            await computeRefundableAmount(
                rental,
                RENTAL_REFUND_REASON.OVERPAYMENT
            ),
            2900
        );
    });

    it("doesn't subtract a payment refund twice when a rental refund tracks it", async () => {
        const rental = await createRental();

        const payment = await createPayment({
            booking: rental.booking,
            amount: 5300,
            refund: {
                amount: 1000,
                status: PAYMENT_REFUND_STATUS.SUCCEEDED,
                method: "automatic",
                reason: "others",
            },
        });

        rental.refunds.push({
            amount: 1000,
            reason: RENTAL_REFUND_REASON.OVERPAYMENT,
            status: RENTAL_REFUND_STATUS.APPROVED,
            gatewayPayment: payment._id,
            gatewayStatus: PAYMENT_REFUND_STATUS.SUCCEEDED,
        });
        await rental.save();

        assert.equal(
            await computeRefundableAmount(
                rental,
                RENTAL_REFUND_REASON.OVERPAYMENT
            ),
            4300
        );
    });
});

describe("recordRefund", () => {
    it("lets only one of two simultaneous refunds use up the balance", async () => {
        const rental = await createRental();

        await createPayment({ booking: rental.booking, amount: 5300 });

        const record = () =>
            recordRefund(
                rental._id,
                {
                    amount: 5300,
                    reason: RENTAL_REFUND_REASON.OVERPAYMENT,
                },
                adminId
            );

        const results = await Promise.allSettled([record(), record()]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );
        assert.equal(
            results.find((result) => result.status === "rejected").reason
                .statusCode,
            409
        );

        const saved = await Rental.findById(rental._id).lean();
        assert.equal(saved.refunds.length, 1);
    });

    it("settles a refund larger than the online payment fully by hand", async () => {
        const rental = await createRental({
            payments: [
                {
                    amount: 4800,
                    type: RENTAL_PAYMENT_TYPE.FULL_PAYMENT,
                    status: RENTAL_PAYMENT_STATUS.VERIFIED,
                    paymentMethod: RENTAL_PAYMENT_METHOD.CASH,
                },
            ],
        });

        const payment = await createPayment({
            booking: rental.booking,
            amount: 500,
            paymongo: { chargeId: "pay_test_not_called" },
        });

        await recordRefund(
            rental._id,
            { amount: 1000, reason: RENTAL_REFUND_REASON.OVERPAYMENT },
            adminId
        );

        // The online payment was left alone: no partial PayMongo refund.
        const savedPayment = await Payment.findById(payment._id).lean();
        assert.equal(savedPayment.refund, null);

        const [entry] = (await Rental.findById(rental._id).lean()).refunds;
        assert.equal(
            entry.gatewayStatus,
            PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
        );
        assert.equal(entry.gatewayPayment ?? null, null);
    });
});

describe("completeManualRefund", () => {
    it("lets only one of two admins settle the same refund", async () => {
        const payment = await createPayment({
            refund: {
                amount: 500,
                status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
                method: "manual",
                reason: "others",
            },
        });

        const results = await Promise.allSettled([
            completeManualRefund(payment._id, { succeeded: true }, adminId),
            completeManualRefund(payment._id, { succeeded: false }, adminId),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        const saved = await Payment.findById(payment._id).lean();
        const winner = results.find((result) => result.status === "fulfilled");

        assert.equal(saved.refund.status, winner.value.refund.status);

        if (saved.refund.status === PAYMENT_REFUND_STATUS.SUCCEEDED) {
            assert.equal(saved.status, PAYMENT_STATUS.REFUNDED);
        } else {
            assert.equal(saved.status, PAYMENT_STATUS.VERIFIED);
        }
    });
});

describe("owed (manual) refunds", () => {
    /*
     * Pay-in-full ₱5,300, rescheduled to fewer days (₱1,000 refunded from
     * the payment — its one refund slot), then cancelled by an admin: the
     * remaining ₱4,300 can't go back through the payment.
     */
    const setUpRescheduledBooking = async () => {
        const bookingId = newId();
        const customerId = newId();
        const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

        await Booking.collection.insertOne({
            _id: bookingId,
            bookingCode: `BK-T${bookingId}`,
            customer: customerId,
            vehicle: newId(),
            driverOption: "Without Driver",
            driver: null,
            startDate: start,
            endDate: new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000),
            pickupLocation: { type: "Office", address: "Legazpi" },
            returnLocation: { type: "Office", address: "Legazpi" },
            pricing: {
                dailyRate: 2400,
                reservationFee: 500,
                rentalDays: 2,
                subtotal: 4800,
                totalAmount: 4300,
                pickupDistanceFee: 0,
                returnDistanceFee: 0,
            },
            status: BOOKING_STATUS.APPROVED,
            statusHistory: [
                { status: BOOKING_STATUS.APPROVED, changedAt: new Date() },
            ],
            extensions: [],
            reschedules: [
                {
                    _id: newId(),
                    requestedStartDate: start,
                    requestedEndDate: start,
                    previousStartDate: start,
                    previousEndDate: start,
                    status: BOOKING_RESCHEDULE_STATUS.APPROVED,
                    settlement: {
                        kind: BOOKING_RESCHEDULE_SETTLEMENT.REFUND,
                        amount: 1000,
                        manual: false,
                    },
                },
            ],
            refundAmount: 0,
            audit: {},
        });

        await createPayment({
            booking: bookingId,
            customer: customerId,
            amount: 5300,
            refund: {
                amount: 1000,
                reason: "others",
                status: PAYMENT_REFUND_STATUS.SUCCEEDED,
                method: "manual",
            },
        });

        return bookingId;
    };

    it("puts a refund the payment can't carry on the Owed list", async () => {
        const bookingId = await setUpRescheduledBooking();

        await cancelBooking(bookingId, adminId, "", "admin");

        const owed = await ManualRefund.find({ booking: bookingId }).lean();

        assert.equal(owed.length, 1);
        assert.equal(owed[0].amount, 4300);
        assert.equal(owed[0].status, MANUAL_REFUND_STATUS.OWED);

        // What the customer's refund badge reads.
        const booking = await Booking.findById(bookingId).lean();
        const view = await getBookingById(
            bookingId,
            booking.customer,
            "customer"
        );

        assert.equal(view.owedRefunds.length, 1);
        assert.equal(view.owedRefunds[0].amount, 4300);
    });

    it("settles once, and counts in the booking's refund total and revenue", async () => {
        const bookingId = await setUpRescheduledBooking();

        await cancelBooking(bookingId, adminId, "", "admin");

        const [owed] = await ManualRefund.find({ booking: bookingId }).lean();

        const revenueBefore = await getOnlineRevenueForRange(new Date(0), null);

        // Owed money is already counted as refunded (it's going back).
        assert.equal(revenueBefore.refunded, 1000 + 4300);

        const results = await Promise.allSettled([
            settleManualRefund(owed._id, { succeeded: true }, adminId),
            settleManualRefund(owed._id, { succeeded: true }, adminId),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.refundAmount, 1000 + 4300);

        assert.equal(
            await Notification.countDocuments({
                recipient: booking.customer,
                type: "Refund Processed",
            }),
            1
        );
    });

    it("stops counting a refund marked Not Paid", async () => {
        const bookingId = await setUpRescheduledBooking();

        await cancelBooking(bookingId, adminId, "", "admin");

        const [owed] = await ManualRefund.find({ booking: bookingId }).lean();

        await settleManualRefund(owed._id, { succeeded: false }, adminId);

        const revenue = await getOnlineRevenueForRange(new Date(0), null);
        assert.equal(revenue.refunded, 1000);

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.refundAmount, 1000);
    });
});
