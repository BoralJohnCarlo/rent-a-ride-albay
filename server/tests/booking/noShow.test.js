import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Driver from "../../models/Driver.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_RESCHEDULE_STATUS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    DRIVER_AVAILABILITY,
    DRIVER_STATUS,
} from "../../constants/driverConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import {
    markBookingNoShow,
    markNoShowBookings,
} from "../../services/bookingService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;
let customerId;

/*
 * Schemas require full listings the logic under test never reads, so
 * documents are inserted directly with just the fields the services query.
 */
const insertVehicle = async () => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.RESERVED,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Toyota",
        model: "Vios",
        vehicleType: "Car",
        pricing: { dailyRate: 2400, reservationFee: 0 },
        availability: { bookingEnabled: true, blockedDates: [] },
    });

    return _id;
};

const insertDriver = async (overrides = {}) => {
    const _id = newId();

    await Driver.collection.insertOne({
        _id,
        driverCode: `RAR-DRV-${_id}`,
        firstName: "Test",
        lastName: "Driver",
        email: `driver-${_id}@test.local`,
        status: DRIVER_STATUS.ACTIVE,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        license: {
            licenseNumber: `N-${_id}`,
            licenseType: "Professional",
            expiryDate: new Date(Date.now() + 365 * DAY),
        },
        archive: { isArchived: false },
        audit: {},
        ...overrides,
    });

    return _id;
};

/* Approved, pickup two days ago, never collected — past every cutoff. */
const insertMissedBooking = async (overrides = {}) => {
    const _id = newId();
    const start = new Date(Date.now() - 2 * DAY);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle: await insertVehicle(),
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate: start,
        endDate: new Date(start.getTime() + 3 * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            dailyRate: 2400,
            reservationFee: 0,
            rentalDays: 3,
            subtotal: 7200,
            totalAmount: 7200,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
        },
        status: BOOKING_STATUS.APPROVED,
        statusHistory: [
            {
                status: BOOKING_STATUS.APPROVED,
                changedAt: new Date(start.getTime() - DAY),
            },
        ],
        extensions: [],
        reschedules: [],
        audit: {},
        ...overrides,
    });

    return _id;
};

const setRefundSettings = (values) =>
    Settings.collection.updateOne(
        {},
        {
            $set: Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                    `refundSettings.${key}`,
                    value,
                ])
            ),
        },
        { upsert: true }
    );

const statusOf = async (bookingId) =>
    (await Booking.findById(bookingId).lean()).status;

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Payment, Notification].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [
            Booking,
            Driver,
            Notification,
            Payment,
            Rental,
            Settings,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();
    customerId = newId();

    await User.collection.insertMany([
        {
            _id: adminId,
            role: "admin",
            email: `admin-${adminId}@test.local`,
        },
        {
            _id: customerId,
            role: "customer",
            firstName: "Maria",
            email: `customer-${customerId}@test.local`,
        },
    ]);
});

describe("automatic no-show marking (Settings → Refunds)", () => {
    it("marks a missed booking while it's on (the default)", async () => {
        const bookingId = await insertMissedBooking();

        await markNoShowBookings();

        assert.equal(await statusOf(bookingId), BOOKING_STATUS.NO_SHOW);
    });

    it("leaves it to the admins, alerting them once, while it's off", async () => {
        await setRefundSettings({ noShowAutoMark: false });

        const bookingId = await insertMissedBooking();

        await markNoShowBookings();
        await markNoShowBookings();

        assert.equal(await statusOf(bookingId), BOOKING_STATUS.APPROVED);
        assert.equal(
            await Notification.countDocuments({
                recipient: adminId,
                type: "Booking Not Picked Up",
                "metadata.relatedId": bookingId,
            }),
            1
        );

        // Admins can still mark it by hand.
        await markBookingNoShow(bookingId, adminId);
        assert.equal(await statusOf(bookingId), BOOKING_STATUS.NO_SHOW);
    });
});

describe("pickup problems on our side", () => {
    const expectSkipped = async (bookingId, pattern) => {
        await markNoShowBookings();

        assert.equal(await statusOf(bookingId), BOOKING_STATUS.APPROVED);

        const alert = await Notification.findOne({
            recipient: adminId,
            type: "Booking No-Show Skipped",
            "metadata.relatedId": bookingId,
        }).lean();

        assert.ok(alert);
        assert.match(alert.message, pattern);

        // The manual button stops too, saying why.
        await assert.rejects(
            markBookingNoShow(bookingId, adminId),
            (error) =>
                error.errors?.code === "PICKUP_BLOCKED" &&
                pattern.test(error.errors.pickupBlocker)
        );
    };

    it("doesn't penalise a customer whose driver was archived", async () => {
        const driverId = await insertDriver({
            archive: { isArchived: true },
        });
        const bookingId = await insertMissedBooking({
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driver: driverId,
        });

        await expectSkipped(bookingId, /no longer active/);
    });

    it("doesn't penalise one whose driver's license doesn't cover the trip", async () => {
        const driverId = await insertDriver({
            license: {
                licenseNumber: "N-OLD",
                licenseType: "Professional",
                expiryDate: new Date(Date.now() - DAY),
            },
        });
        const bookingId = await insertMissedBooking({
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driver: driverId,
        });

        await expectSkipped(bookingId, /license/);
    });

    it("doesn't penalise one who asked to reschedule and got no answer", async () => {
        const bookingId = await insertMissedBooking({
            reschedules: [
                {
                    _id: newId(),
                    status: BOOKING_RESCHEDULE_STATUS.PENDING,
                    requestedAt: new Date(Date.now() - 4 * DAY),
                    newStartDate: new Date(Date.now() + 5 * DAY),
                    newEndDate: new Date(Date.now() + 8 * DAY),
                },
            ],
        });

        await expectSkipped(bookingId, /reschedule/);
    });
});

describe("the customer's no-show notice", () => {
    it("doesn't show the booking code", async () => {
        const bookingId = await insertMissedBooking();

        await markBookingNoShow(bookingId, adminId);

        const notice = await Notification.findOne({
            recipient: customerId,
            title: "Booking Marked as No-Show",
        }).lean();

        assert.ok(notice);
        assert.doesNotMatch(notice.message, /BK-/);
    });
});
