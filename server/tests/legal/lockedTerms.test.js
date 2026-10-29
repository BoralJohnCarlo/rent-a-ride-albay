import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";

import {
    getBookingCancellationPreview,
    markNoShowBookings,
} from "../../services/bookingService.js";
import { getNextRefundChange } from "../../services/cancellationPolicyService.js";
import {
    POLICY_SOURCE,
    computeBookingCancellationRefund,
    computeBookingLatePenalty,
    computeBookingNoShowRefund,
    getBookingEarlyReturnSettings,
    getBookingNoShowTiming,
    getBookingPenaltyCap,
} from "../../services/lockedTermsService.js";
import { resolveRefundSettings } from "../../services/settingsService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

/* A booking whose customer accepted terms with these settings. */
const lockedBooking = (snapshot, extra = {}) => ({
    termsAcceptance: {
        document: newId(),
        version: 3,
        acceptedAt: new Date(),
        policySnapshot: snapshot,
    },
    ...extra,
});

const policy = (tiers) => ({
    fullRefundBeforeApproval: true,
    approvalGraceHours: 0,
    approvalGraceMinLeadHours: 24,
    tiers,
});

/* Approved long ago, pickup `hoursAhead` from now, ₱1,000 fee paid. */
const cancelInput = (hoursAhead) => ({
    startDate: new Date(Date.now() + hoursAhead * HOUR),
    approvedAt: new Date(Date.now() - 5 * DAY),
    isApproved: true,
    totalPaid: 1000,
    reservationFee: 1000,
    cancelledByRole: "customer",
});

describe("cancellation refunds", () => {
    const today = { cancellationPolicy: policy([{ hoursBefore: 72, refundPercent: 100 }]) };

    it("refunds under the booking's terms when they give more", () => {
        const booking = lockedBooking({
            cancellationPolicy: policy([{ hoursBefore: 24, refundPercent: 50 }]),
        });

        const result = computeBookingCancellationRefund(
            booking,
            today,
            cancelInput(48)
        );

        assert.equal(result.refundAmount, 500);
        assert.equal(result.policySource, POLICY_SOURCE.BOOKING);
        assert.equal(result.termsVersion, 3);
    });

    it("refunds under today's policy when that gives more", () => {
        const booking = lockedBooking({
            cancellationPolicy: policy([{ hoursBefore: 96, refundPercent: 100 }]),
        });

        const kinderToday = {
            cancellationPolicy: policy([{ hoursBefore: 24, refundPercent: 100 }]),
        };

        const result = computeBookingCancellationRefund(
            booking,
            kinderToday,
            cancelInput(48)
        );

        assert.equal(result.refundAmount, 1000);
        assert.equal(result.policySource, POLICY_SOURCE.CURRENT);
    });

    it("follows today's policy, with no source, for a booking without locked terms", () => {
        const result = computeBookingCancellationRefund({}, today, cancelInput(48));

        assert.equal(result.refundAmount, 0);
        assert.equal(result.policySource, null);
    });

    it("still refunds everything when an admin cancels", () => {
        const booking = lockedBooking({
            cancellationPolicy: policy([]),
        });

        const result = computeBookingCancellationRefund(booking, today, {
            ...cancelInput(2),
            cancelledByRole: "admin",
        });

        assert.equal(result.refundAmount, 1000);
        assert.equal(result.policySource, null);
    });

    it("says when the better refund next drops", () => {
        const locked = policy([{ hoursBefore: 24, refundPercent: 50 }]);
        const current = policy([{ hoursBefore: 72, refundPercent: 100 }]);
        const input = cancelInput(48);

        const next = getNextRefundChange({
            ...input,
            policies: [locked, current],
        });

        assert.equal(next.refundAmount, 0);
        assert.equal(
            next.after.getTime(),
            input.startDate.getTime() - 24 * HOUR
        );

        // One policy behaves exactly as before.
        const single = getNextRefundChange({ ...input, policy: locked });
        assert.equal(single.after.getTime(), next.after.getTime());
    });
});

describe("no-shows", () => {
    const today = resolveRefundSettings({
        noShowGraceHours: 2,
        noShowRefundPercent: 0,
        noShowKeepsDistanceFee: true,
        noShowAutoMark: true,
    });

    it("waits the longer grace and only auto-marks if both allow it", () => {
        const booking = lockedBooking({
            noShowGraceHours: 6,
            noShowAutoMark: false,
        });

        assert.deepEqual(getBookingNoShowTiming(booking, today), {
            graceHours: 6,
            autoMark: false,
        });
        assert.deepEqual(getBookingNoShowTiming({}, today), {
            graceHours: 2,
            autoMark: true,
        });
    });

    it("refunds the larger share", () => {
        const booking = lockedBooking({
            noShowRefundPercent: 50,
            noShowKeepsDistanceFee: false,
        });

        const result = computeBookingNoShowRefund(booking, today, {
            totalPaid: 1200,
            reservationFee: 1000,
            pickupDistanceFee: 200,
        });

        // Distance fee back too, plus half the reservation fee.
        assert.equal(result.refundAmount, 700);
        assert.equal(result.policySource, POLICY_SOURCE.BOOKING);
    });
});

describe("late returns", () => {
    const due = new Date("2026-10-10T06:00:00Z");
    const threeHoursLate = new Date(due.getTime() + 3 * HOUR);

    const today = {
        gracePeriodMinutes: 0,
        chargingUnit: "Hour",
        rateType: "derived",
        maximumCap: 0,
    };

    it("charges the lower of the booking's rules and today's", () => {
        const booking = lockedBooking(
            {
                latePenalty: {
                    gracePeriodMinutes: 120,
                    chargingUnit: "Hour",
                    maximumCap: 0,
                    rateType: "derived",
                },
            },
            { pricing: { dailyRate: 2400 } }
        );

        const result = computeBookingLatePenalty(booking, today, {
            expectedReturnAt: due,
            actualReturnAt: threeHoursLate,
            dailyRate: 2400,
        });

        // 2-hour grace: 1 hour charged instead of 3.
        assert.equal(result.chargedUnits, 1);
        assert.equal(result.amount, 100);
        assert.equal(result.policySource, POLICY_SOURCE.BOOKING);
    });

    it("uses the booked daily rate when the vehicle got pricier", () => {
        const booking = lockedBooking(
            { latePenalty: { ...today } },
            { pricing: { dailyRate: 1200, originalDailyRate: 2400 } }
        );

        const result = computeBookingLatePenalty(booking, today, {
            expectedReturnAt: due,
            actualReturnAt: threeHoursLate,
            dailyRate: 4800,
        });

        // Booked at ₱2,400/day before its discount (₱100/hour), not ₱4,800.
        assert.equal(result.amount, 300);
        assert.equal(result.policySource, POLICY_SOURCE.BOOKING);
    });

    it("keeps today's rules for a booking without locked terms", () => {
        const result = computeBookingLatePenalty({}, today, {
            expectedReturnAt: due,
            actualReturnAt: threeHoursLate,
            dailyRate: 2400,
        });

        assert.equal(result.amount, 300);
        assert.equal(result.policySource, null);
    });

    it("caps an admin's adjustment at the lower cap", () => {
        const booking = lockedBooking({ latePenalty: { maximumCap: 500 } });

        assert.equal(getBookingPenaltyCap(booking, { maximumCap: 0 }), 500);
        assert.equal(getBookingPenaltyCap(booking, { maximumCap: 300 }), 300);
        assert.equal(getBookingPenaltyCap({}, { maximumCap: 0 }), 0);
    });
});

describe("early returns", () => {
    it("takes the more generous of each rule", () => {
        const booking = lockedBooking({
            earlyReturn: {
                enabled: true,
                autoApprove: false,
                minUnusedDaysToQualify: 1,
                voucherValidityMonths: 12,
            },
        });

        const result = getBookingEarlyReturnSettings(booking, {
            enabled: false,
            autoApprove: true,
            minUnusedDaysToQualify: 2,
            voucherValidityMonths: 6,
        });

        assert.equal(result.enabled, true);
        assert.equal(result.autoApprove, true);
        assert.equal(result.minUnusedDaysToQualify, 1);
        assert.equal(result.voucherValidityMonths, 12);
        // Today's auto-approval is kinder, so it isn't just the booking's.
        assert.equal(result.policySource, POLICY_SOURCE.CURRENT);
    });
});

/* -------------------------------------------------------------------------- */

describe("with the database", () => {
    let customerId;

    before(async () => {
        await connectTestDb();
        await Promise.all(
            [Booking, Payment, Notification].map((model) => model.init())
        );
    });

    after(disconnectTestDb);

    beforeEach(async () => {
        await Promise.all(
            [Booking, Notification, Payment, Settings, User, Vehicle].map(
                (model) => model.deleteMany({})
            )
        );

        customerId = newId();

        await User.collection.insertMany([
            { _id: newId(), role: "admin", email: `a-${newId()}@test.local` },
            {
                _id: customerId,
                role: "customer",
                firstName: "Maria",
                email: `c-${customerId}@test.local`,
            },
        ]);
    });

    const insertBooking = async ({ start, snapshot }) => {
        const _id = newId();
        const vehicleId = newId();

        await Vehicle.collection.insertOne({
            _id: vehicleId,
            status: "Reserved",
            vehicleCode: `TEST-${vehicleId}`,
            plateNumber: `TEST-${vehicleId}`,
            brand: "Toyota",
            model: "Vios",
            vehicleType: "Car",
            pricing: { dailyRate: 2400, reservationFee: 1000 },
        });

        await Booking.collection.insertOne({
            _id,
            bookingCode: `BK-T${_id}`,
            customer: customerId,
            vehicle: vehicleId,
            driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
            driver: null,
            startDate: start,
            endDate: new Date(start.getTime() + 2 * DAY),
            pickupLocation: { type: "Office", address: "Legazpi" },
            returnLocation: { type: "Office", address: "Legazpi" },
            pricing: {
                dailyRate: 2400,
                reservationFee: 1000,
                rentalDays: 2,
                subtotal: 4800,
                totalAmount: 5800,
                pickupDistanceFee: 0,
                returnDistanceFee: 0,
            },
            status: BOOKING_STATUS.APPROVED,
            statusHistory: [
                {
                    status: BOOKING_STATUS.APPROVED,
                    changedAt: new Date(Date.now() - 5 * DAY),
                },
            ],
            extensions: [],
            reschedules: [],
            termsAcceptance: {
                document: newId(),
                version: 2,
                acceptedAt: new Date(Date.now() - 6 * DAY),
                policySnapshot: snapshot,
            },
            audit: {},
        });

        return _id;
    };

    it("previews the cancellation refund under the booking's terms", async () => {
        await Settings.collection.updateOne(
            {},
            {
                $set: {
                    "refundSettings.cancellationPolicy": policy([
                        { hoursBefore: 72, refundPercent: 100 },
                    ]),
                },
            },
            { upsert: true }
        );

        const bookingId = await insertBooking({
            start: new Date(Date.now() + 48 * HOUR),
            snapshot: {
                cancellationPolicy: policy([
                    { hoursBefore: 24, refundPercent: 50 },
                ]),
            },
        });

        await Payment.collection.insertOne({
            booking: bookingId,
            customer: customerId,
            paymentType: PAYMENT_TYPE.RESERVATION_FEE,
            status: PAYMENT_STATUS.VERIFIED,
            amount: 1000,
        });

        const preview = await getBookingCancellationPreview(
            bookingId,
            customerId,
            "customer"
        );

        assert.equal(preview.refundAmount, 500);
        assert.equal(preview.policySource, POLICY_SOURCE.BOOKING);
        assert.equal(preview.termsVersion, 2);
        assert.equal(preview.next.refundAmount, 0);
    });

    it("doesn't auto-mark a no-show while the booking's longer grace is running", async () => {
        const bookingId = await insertBooking({
            start: new Date(Date.now() - 2 * DAY),
            snapshot: { noShowGraceHours: 96 },
        });

        // Same booking under today's default grace: marked.
        const controlId = await insertBooking({
            start: new Date(Date.now() - 2 * DAY),
            snapshot: {},
        });

        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);

        const control = await Booking.findById(controlId).lean();
        assert.equal(control.status, BOOKING_STATUS.NO_SHOW);
        assert.equal(control.noShowOutcome.policySource, POLICY_SOURCE.BOOKING);
    });
});
