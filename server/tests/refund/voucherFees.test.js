import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";
import {
    RENTAL_REFUND_REASON,
    RENTAL_STATUS,
} from "../../constants/rentalConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";
import { VOUCHER_TYPE } from "../../constants/voucherConstants.js";

import {
    approveBookingExtension,
    cancelBooking,
    ensurePickupPaymentVerified,
    markBookingNoShow,
    requestBookingExtension,
} from "../../services/bookingService.js";
import { computeRefundableAmount } from "../../services/rentalService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * A voucher on the reservation fee (or pickup fee) lowers what's charged up
 * front, so it also lowers what the cancellation policy can keep. Payments
 * here have no PayMongo charge, so every refund takes the manual path.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;

// Gross: 4,800 rental + 500 reservation fee + 200 pickup distance fee.
const GROSS_PRICING = {
    dailyRate: 2400,
    reservationFee: 500,
    rentalDays: 2,
    subtotal: 4800,
    pickupDistanceFee: 200,
    returnDistanceFee: 0,
};

const reservationVoucher = (discountAmount) => ({
    voucher: newId(),
    code: "TESTFEE",
    type: VOUCHER_TYPE.RESERVATION_FEE,
    discountAmount,
});

const insertBooking = async ({
    start = new Date(Date.now() + 5 * DAY),
    voucher = null,
    pricing = {},
    ...overrides
} = {}) => {
    const _id = newId();
    const discount = Number(voucher?.discountAmount || 0);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: newId(),
        vehicle: newId(),
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate: start,
        endDate: new Date(start.getTime() + 2 * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            ...GROSS_PRICING,
            totalAmount: 4800 + 500 + 200 - discount,
            ...pricing,
        },
        voucher,
        status: BOOKING_STATUS.APPROVED,
        statusHistory: [
            {
                status: BOOKING_STATUS.APPROVED,
                changedAt: new Date(Date.now() - 20 * DAY),
            },
        ],
        extensions: [],
        reschedules: [],
        refundAmount: 0,
        audit: {},
        ...overrides,
    });

    return Booking.findById(_id).lean();
};

const payFor = (booking, amount, overrides = {}) =>
    Payment.create({
        booking: booking._id,
        customer: booking.customer,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        paymentMethod: PAYMENT_METHOD.GCASH,
        amount,
        status: PAYMENT_STATUS.VERIFIED,
        audit: { createdBy: adminId, updatedBy: adminId },
        ...overrides,
    });

const refundOn = async (booking) =>
    (await Payment.findOne({ booking: booking._id }).lean()).refund;

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Notification, Payment, Rental].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [Booking, Notification, Payment, Rental, User, Vehicle].map((model) =>
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

describe("customer cancellation with a reservation-fee voucher", () => {
    it("keeps nothing of a fee the voucher made free (paid in full, under 24h)", async () => {
        const booking = await insertBooking({
            start: new Date(Date.now() + 20 * HOUR),
            voucher: reservationVoucher(500),
        });

        // 4,800 + 0 fee + 200 pickup.
        await payFor(booking, 5000);

        await cancelBooking(
            booking._id,
            booking.customer,
            "Change of plans",
            "customer"
        );

        assert.equal((await refundOn(booking)).amount, 5000);
    });

    it("applies the 50% tier to the discounted fee only", async () => {
        const booking = await insertBooking({
            start: new Date(Date.now() + 30 * HOUR),
            voucher: reservationVoucher(250),
        });

        // 250 fee (after the voucher) + 200 pickup.
        await payFor(booking, 450);

        await cancelBooking(
            booking._id,
            booking.customer,
            "Change of plans",
            "customer"
        );

        // Half of the 250 fee is kept; the pickup fee comes back.
        assert.equal((await refundOn(booking)).amount, 325);
    });
});

describe("no-show with a reservation-fee voucher", () => {
    it("keeps only the discounted fee and the pickup fee", async () => {
        // A vehicle that was there to collect (no pickup problem).
        const vehicleId = newId();

        await Vehicle.collection.insertOne({
            _id: vehicleId,
            status: VEHICLE_STATUS.RESERVED,
            vehicleCode: `TEST-${vehicleId}`,
            plateNumber: `TEST-${vehicleId}`,
            availability: { bookingEnabled: true, blockedDates: [] },
        });

        const booking = await insertBooking({
            start: new Date(Date.now() - 6 * HOUR),
            vehicle: vehicleId,
            voucher: reservationVoucher(250),
        });

        // Paid in full: 4,800 + 250 + 200.
        await payFor(booking, 5250);

        await markBookingNoShow(booking._id, adminId);

        assert.equal((await refundOn(booking)).amount, 4800);
    });
});

describe("reservation payment amount at pickup", () => {
    const check = async (amount) => {
        const booking = await insertBooking({
            voucher: reservationVoucher(250),
        });

        await payFor(booking, amount);

        return ensurePickupPaymentVerified(
            await Booking.findById(booking._id)
        );
    };

    it("accepts the fees after the voucher", async () => {
        assert.ok(await check(450));
    });

    it("accepts the gross fees a payment made before this fix was charged", async () => {
        assert.ok(await check(700));
    });

    it("accepts the full total", async () => {
        assert.ok(await check(5250));
    });

    it("rejects any other amount", async () => {
        await assert.rejects(check(600), /does not match/);
    });
});

describe("post-pickup cancellation refund", () => {
    it("withholds only the fee charged after the voucher", async () => {
        const booking = await insertBooking({
            voucher: reservationVoucher(500),
            pricing: { pickupDistanceFee: 0, totalAmount: 4800 },
        });

        // Paid in full; the voucher made the fee free.
        await payFor(booking, 4800);

        const rental = await Rental.create({
            rentalCode: `RN-T${newId()}`,
            booking: booking._id,
            customer: booking.customer,
            vehicle: booking.vehicle,
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
        });

        assert.equal(
            await computeRefundableAmount(
                rental,
                RENTAL_REFUND_REASON.CANCELLATION
            ),
            4800
        );
    });
});

describe("extension approval", () => {
    it("keeps the voucher discount in the booking total", async () => {
        const vehicleId = newId();

        await Vehicle.collection.insertOne({
            _id: vehicleId,
            status: VEHICLE_STATUS.RESERVED,
            vehicleCode: `TEST-${vehicleId}`,
            plateNumber: `TEST-${vehicleId}`,
            brand: "Test",
            model: "Car",
            vehicleType: "Car",
            pricing: { dailyRate: 2400, reservationFee: 500 },
            availability: { bookingEnabled: true, blockedDates: [] },
        });

        const booking = await insertBooking({
            vehicle: vehicleId,
            voucher: {
                voucher: newId(),
                code: "TESTTOTAL",
                type: VOUCHER_TYPE.TOTAL,
                discountAmount: 300,
            },
        });

        const requested = await requestBookingExtension(
            booking._id,
            {
                requestedEndDate: new Date(
                    booking.endDate.getTime() + 4 * HOUR
                ),
            },
            booking.customer
        );

        await approveBookingExtension(
            booking._id,
            requested.extensions[0]._id,
            adminId
        );

        const saved = await Booking.findById(booking._id).lean();

        // 5,500 gross − 300 voucher + 400 for the 4 extra hours.
        assert.equal(saved.pricing.totalAmount, 5600);
    });
});
