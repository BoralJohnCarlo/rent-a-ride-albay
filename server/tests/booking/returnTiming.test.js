import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Notification from "../../models/Notification.js";
import Rental from "../../models/Rental.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import { RENTAL_STATUS } from "../../constants/rentalConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import { processReturn } from "../../services/rentalService.js";
import { getVehiclePickupTimes } from "../../services/vehicleService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MANILA_OFFSET = 8 * HOUR;

/* Manila "YYYY-MM-DD", `days` from today. */
const dateKey = (days) =>
    new Date(Date.now() + MANILA_OFFSET + days * DAY)
        .toISOString()
        .slice(0, 10);

const at = (key, time) => new Date(`${key}T${time}:00+08:00`);

const newId = () => new mongoose.Types.ObjectId();

let adminId;
let customerId;

const insertVehicle = async () => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.RENTED,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Test",
        model: "Car",
        availability: { bookingEnabled: true, blockedDates: [] },
    });

    return _id;
};

const insertBooking = async (vehicle, startDate, endDate, overrides = {}) => {
    const _id = newId();

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle,
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate,
        endDate,
        status: BOOKING_STATUS.APPROVED,
        extensions: [],
        ...overrides,
    });

    return _id;
};

/* An ongoing rental for a booking picked up at `start`, due back at `end`. */
const startRental = async (vehicle, start, end) => {
    const booking = await insertBooking(vehicle, start, end, {
        status: BOOKING_STATUS.ONGOING,
    });

    const rental = await Rental.create({
        rentalCode: `RN-T${newId()}`,
        booking,
        customer: customerId,
        vehicle,
        status: RENTAL_STATUS.ONGOING,
        pickup: { date: start, processedBy: adminId },
        bookingPeriod: {
            originalStartDate: start,
            originalEndDate: end,
            actualStartDate: start,
        },
        actualEndDate: end,
        financial: { baseRentalCharge: 2400, reservationFee: 0 },
    });

    return { booking, rental };
};

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Notification, Rental].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [Booking, Notification, Rental, Settings, User, Vehicle].map(
            (model) => model.deleteMany({})
        )
    );

    adminId = newId();
    customerId = newId();

    await User.collection.insertMany([
        { _id: adminId, role: "admin", email: `admin-${adminId}@test.local` },
        {
            _id: customerId,
            role: "customer",
            firstName: "Test",
            email: `customer-${customerId}@test.local`,
        },
    ]);
});

describe("processReturn timing", () => {
    it("moves a late return's booking end to the actual return and keeps the due-back time", async () => {
        const vehicle = await insertVehicle();
        const due = at(dateKey(3), "10:00");
        const returnedAt = at(dateKey(3), "11:30");

        const { booking, rental } = await startRental(
            vehicle,
            at(dateKey(2), "10:00"),
            due
        );

        await processReturn(rental._id, { date: returnedAt }, adminId);

        const saved = await Booking.findById(booking).lean();

        assert.equal(saved.endDate.getTime(), returnedAt.getTime());
        assert.equal(saved.dueBackDate.getTime(), due.getTime());

        const notice = await Notification.findOne({
            recipient: customerId,
            type: "Rental Returned",
        }).lean();

        assert.match(notice.message, /Due back: /);
        assert.match(notice.message, /\(1 hr 30 min late\)/);
    });

    it("counts the turnaround buffer from the actual return for new bookings", async () => {
        const vehicle = await insertVehicle();

        const { rental } = await startRental(
            vehicle,
            at(dateKey(2), "10:00"),
            at(dateKey(3), "10:00")
        );

        await processReturn(
            rental._id,
            { date: at(dateKey(3), "11:30") },
            adminId
        );

        const { times } = await getVehiclePickupTimes(
            vehicle,
            dateKey(3),
            dateKey(4)
        );

        // 11:30 AM + 2h buffer → 1:30 PM, not 12:00 PM.
        assert.equal(
            times.find((slot) => slot.available).time,
            "13:30"
        );
    });

    it("caps the end before an existing next booking and alerts admins", async () => {
        const vehicle = await insertVehicle();
        const nextStart = at(dateKey(3), "12:00");

        const { booking, rental } = await startRental(
            vehicle,
            at(dateKey(2), "10:00"),
            at(dateKey(3), "10:00")
        );

        const nextBooking = await insertBooking(
            vehicle,
            nextStart,
            at(dateKey(4), "12:00")
        );

        await processReturn(
            rental._id,
            { date: at(dateKey(3), "11:30") },
            adminId
        );

        const saved = await Booking.findById(booking).lean();

        // One buffer before the next pickup, never into it.
        assert.equal(
            saved.endDate.getTime(),
            nextStart.getTime() - 2 * HOUR
        );

        const alert = await Notification.findOne({
            recipient: adminId,
            type: "Short Turnaround",
        }).lean();

        assert.ok(alert);
        assert.match(alert.message, new RegExp(`BK-T${nextBooking}`));
    });

    it("frees the rest of the time on an early return", async () => {
        const vehicle = await insertVehicle();
        const due = at(dateKey(4), "10:00");
        const returnedAt = at(dateKey(3), "09:00");

        const { booking, rental } = await startRental(
            vehicle,
            at(dateKey(2), "10:00"),
            due
        );

        await processReturn(rental._id, { date: returnedAt }, adminId);

        const saved = await Booking.findById(booking).lean();

        assert.equal(saved.endDate.getTime(), returnedAt.getTime());
        assert.equal(saved.dueBackDate.getTime(), due.getTime());

        const notice = await Notification.findOne({
            recipient: customerId,
            type: "Rental Returned",
        }).lean();

        assert.match(notice.message, /\(1 day 1 hr early\)/);
    });
});
