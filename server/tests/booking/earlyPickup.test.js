import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import routes from "../../routes/index.js";

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
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import { createRental } from "../../services/rentalService.js";
import { getBookingSettings } from "../../services/settingsService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Settings → Bookings → Early Pickup: releasing a vehicle before the usual
 * window (12 h before the booked pickup) needs the setting AND an explicit
 * confirmation, keeps the full booked duration, and is refused rather than
 * shortened if the moved-up rental would touch anything else.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;
let customerId;
let vehicleId;

const LOCATION = { type: "Office", address: "Legazpi City", name: "Main Office" };

const insertBooking = async (startDate, endDate, overrides = {}) => {
    const _id = newId();

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle: vehicleId,
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate,
        endDate,
        pickupLocation: LOCATION,
        returnLocation: LOCATION,
        pricing: {
            dailyRate: 1000,
            reservationFee: 0,
            rentalDays: 2,
            subtotal: 2000,
            totalAmount: 2000,
        },
        status: BOOKING_STATUS.APPROVED,
        extensions: [],
        reschedules: [],
        statusHistory: [],
        audit: {},
        ...overrides,
    });

    return _id;
};

const setEarlyPickup = (allowAnytime) =>
    Settings.collection.updateOne(
        {},
        { $set: { "bookingSettings.earlyPickup.allowAnytime": allowAnytime } },
        { upsert: true }
    );

/* A booking 3 days out (well before the 12 h window), 2 days long. */
const futureBooking = () => {
    const start = new Date(Date.now() + 3 * DAY);

    return insertBooking(start, new Date(start.getTime() + 2 * DAY));
};

const vehicleStatus = async () =>
    (await Vehicle.findById(vehicleId).lean()).status;

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
    vehicleId = newId();

    await User.collection.insertMany([
        { _id: adminId, role: "admin", email: `admin-${adminId}@test.local` },
        {
            _id: customerId,
            role: "customer",
            firstName: "Test",
            email: `customer-${customerId}@test.local`,
        },
    ]);

    await Vehicle.collection.insertOne({
        _id: vehicleId,
        status: VEHICLE_STATUS.RESERVED,
        vehicleCode: `TEST-${vehicleId}`,
        plateNumber: `TEST-${vehicleId}`,
        brand: "Test",
        model: "Car",
        availability: { bookingEnabled: true, blockedDates: [] },
    });
});

describe("early pickup override", () => {
    it("is off by default and refuses an early release", async () => {
        assert.equal((await getBookingSettings()).earlyPickup.allowAnytime, false);

        const booking = await futureBooking();

        await assert.rejects(
            createRental(booking, adminId, { releaseEarly: true }),
            /can be released from .*reschedule the booking/
        );

        // Rolled back: nothing changed.
        assert.equal(await vehicleStatus(), VEHICLE_STATUS.RESERVED);
        assert.equal(await Rental.countDocuments(), 0);
    });

    it("still needs the release confirmed while the setting is on", async () => {
        await setEarlyPickup(true);
        const booking = await futureBooking();

        await assert.rejects(
            createRental(booking, adminId),
            /confirm an early release/
        );
        assert.equal(await Rental.countDocuments(), 0);
    });

    it("releases early with the full booked duration and notes it", async () => {
        await setEarlyPickup(true);
        const bookingId = await futureBooking();
        const booked = await Booking.findById(bookingId).lean();

        const before = Date.now();
        const rental = await createRental(bookingId, adminId, {
            releaseEarly: true,
        });
        const after = Date.now();

        const saved = await Booking.findById(bookingId).lean();
        const start = saved.startDate.getTime();

        assert.equal(saved.status, BOOKING_STATUS.ONGOING);
        assert.ok(start >= before && start <= after);
        assert.equal(saved.endDate.getTime() - start, 2 * DAY);
        assert.equal(
            saved.scheduledStartDate.getTime(),
            booked.startDate.getTime()
        );
        assert.equal(rental.bookingPeriod.returnCapped, false);
        assert.match(saved.statusHistory.at(-1).notes, /Released early by an admin/);
        assert.equal(await vehicleStatus(), VEHICLE_STATUS.RENTED);
    });

    it("refuses when another booking sits between now and the booked pickup", async () => {
        await setEarlyPickup(true);
        const bookingId = await futureBooking();

        // Tomorrow, 4 hours: inside the moved-up rental.
        const otherStart = new Date(Date.now() + DAY);
        await insertBooking(otherStart, new Date(otherStart.getTime() + 4 * HOUR));

        await assert.rejects(
            createRental(bookingId, adminId, { releaseEarly: true }),
            /overlap another booking of this vehicle/
        );

        const saved = await Booking.findById(bookingId).lean();
        assert.equal(saved.status, BOOKING_STATUS.APPROVED);
        assert.equal(await vehicleStatus(), VEHICLE_STATUS.RESERVED);
    });

    it("refuses when the next booking starts inside the turnaround buffer", async () => {
        await setEarlyPickup(true);
        const bookingId = await futureBooking();

        // The early rental would end ~2 days from now; this starts 1 h later
        // (default buffer is 2 h), still before the booked pickup.
        const otherStart = new Date(Date.now() + 2 * DAY + HOUR);
        await insertBooking(
            otherStart,
            new Date(otherStart.getTime() + 2 * HOUR),
            { status: BOOKING_STATUS.PAYMENT_RECEIVED }
        );

        await assert.rejects(
            createRental(bookingId, adminId, { releaseEarly: true }),
            /overlap another booking of this vehicle/
        );
    });

    it("ignores bookings that ended without a trip", async () => {
        await setEarlyPickup(true);
        const bookingId = await futureBooking();

        const otherStart = new Date(Date.now() + DAY);
        await insertBooking(otherStart, new Date(otherStart.getTime() + 4 * HOUR), {
            status: BOOKING_STATUS.CANCELLED,
        });

        await createRental(bookingId, adminId, { releaseEarly: true });

        assert.equal(
            (await Booking.findById(bookingId).lean()).status,
            BOOKING_STATUS.ONGOING
        );
    });

    it("refuses when blocked dates fall inside the moved-up rental", async () => {
        await setEarlyPickup(true);
        const bookingId = await futureBooking();

        await Vehicle.collection.updateOne(
            { _id: vehicleId },
            {
                $set: {
                    "availability.blockedDates": [
                        {
                            _id: newId(),
                            startDate: new Date(Date.now() + DAY),
                            endDate: new Date(Date.now() + DAY + 6 * HOUR),
                            reason: "Inspection",
                        },
                    ],
                },
            }
        );

        await assert.rejects(
            createRental(bookingId, adminId, { releaseEarly: true }),
            /overlap dates blocked on this vehicle/
        );
    });

    it("leaves pickups inside the usual window unchanged", async () => {
        // Setting off, no confirmation: 6 h ahead is inside the 12 h window.
        const start = new Date(Date.now() + 6 * HOUR);
        const bookingId = await insertBooking(
            start,
            new Date(start.getTime() + 2 * DAY)
        );

        await createRental(bookingId, adminId);

        const saved = await Booking.findById(bookingId).lean();
        assert.equal(saved.status, BOOKING_STATUS.ONGOING);
        assert.doesNotMatch(saved.statusHistory.at(-1).notes, /Released early/);
    });

    describe("over HTTP", () => {
        let server;
        let baseUrl;

        before(async () => {
            const app = express();
            app.use(express.json());
            app.use(cookieParser());
            app.use("/api", routes);

            await new Promise((resolve) => {
                server = app.listen(0, resolve);
            });
            baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        });

        after(() => new Promise((resolve) => server.close(resolve)));

        const adminCookie = () =>
            `token=${jwt.sign({ id: adminId }, process.env.JWT_SECRET)}`;

        const putSettings = (body) =>
            fetch(`${baseUrl}/settings`, {
                method: "PUT",
                headers: {
                    Cookie: adminCookie(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

        it("saves the setting and keeps it when other booking settings are saved", async () => {
            assert.equal(
                (await putSettings({ bookingSettings: { earlyPickup: { allowAnytime: true } } })).status,
                200
            );

            // The booking settings are rebuilt on save; this must not wipe it.
            assert.equal(
                (await putSettings({ bookingSettings: { turnaroundBufferMinutes: 180 } })).status,
                200
            );

            const settings = await getBookingSettings();
            assert.equal(settings.earlyPickup.allowAnytime, true);
            assert.equal(settings.turnaroundBufferMinutes, 180);

            const bad = await putSettings({
                bookingSettings: { earlyPickup: { allowAnytime: "yes" } },
            });
            assert.equal(bad.status, 400);
            assert.equal((await getBookingSettings()).earlyPickup.allowAnytime, true);
        });

        it("only takes a real boolean for releaseEarly", async () => {
            await setEarlyPickup(true);
            const bookingId = await futureBooking();

            const bad = await fetch(`${baseUrl}/rentals`, {
                method: "POST",
                headers: {
                    Cookie: adminCookie(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ booking: String(bookingId), releaseEarly: "true" }),
            });
            assert.equal(bad.status, 400);

            const ok = await fetch(`${baseUrl}/rentals`, {
                method: "POST",
                headers: {
                    Cookie: adminCookie(),
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ booking: String(bookingId), releaseEarly: true }),
            });
            assert.equal(ok.status, 201);
        });
    });
});
