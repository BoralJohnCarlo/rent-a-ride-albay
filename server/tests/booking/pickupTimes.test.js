import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Rental from "../../models/Rental.js";
import Settings from "../../models/Settings.js";
import Vehicle from "../../models/Vehicle.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import {
    getVehicleAvailabilityCalendar,
    getVehiclePickupTimes,
} from "../../services/vehicleService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const DAY = 24 * 60 * 60 * 1000;
const MANILA_OFFSET = 8 * 60 * 60 * 1000;

/* Manila "YYYY-MM-DD", `days` from today. */
const dateKey = (days) =>
    new Date(Date.now() + MANILA_OFFSET + days * DAY)
        .toISOString()
        .slice(0, 10);

/* The instant of a Manila date key + "HH:mm". */
const at = (key, time) => new Date(`${key}T${time}:00+08:00`);

const insertVehicle = async (overrides = {}) => {
    const _id = new mongoose.Types.ObjectId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.AVAILABLE,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        availability: { bookingEnabled: true, blockedDates: [] },
        ...overrides,
    });

    return _id;
};

const insertBooking = async (vehicle, startDate, endDate, overrides = {}) =>
    Booking.collection.insertOne({
        bookingCode: `BK-T${new mongoose.Types.ObjectId()}`,
        customer: new mongoose.Types.ObjectId(),
        vehicle,
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate,
        endDate,
        status: BOOKING_STATUS.APPROVED,
        ...overrides,
    });

const availableTimes = ({ times }) =>
    times.filter((slot) => slot.available).map((slot) => slot.time);

before(connectTestDb);
after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all([
        Booking.deleteMany({}),
        Rental.deleteMany({}),
        Settings.deleteMany({}),
        Vehicle.deleteMany({}),
    ]);
});

describe("getVehiclePickupTimes", () => {
    it("offers every pickup time from 8 AM to 6 PM when nothing is booked", async () => {
        const vehicle = await insertVehicle();

        const result = await getVehiclePickupTimes(
            vehicle,
            dateKey(5),
            dateKey(6)
        );

        assert.equal(result.times.length, 21);
        assert.equal(availableTimes(result).length, 21);
        assert.equal(result.times[0].time, "08:00");
        assert.equal(result.times.at(-1).time, "18:00");
    });

    it("blocks a whole day when the previous return + buffer runs past 6 PM", async () => {
        const vehicle = await insertVehicle();

        // 5 PM → 5 PM next day, 2h buffer: busy until 7 PM.
        await insertBooking(
            vehicle,
            at(dateKey(5), "17:00"),
            at(dateKey(6), "17:00")
        );

        assert.deepEqual(
            availableTimes(
                await getVehiclePickupTimes(vehicle, dateKey(6), dateKey(7))
            ),
            []
        );
        assert.equal(
            availableTimes(
                await getVehiclePickupTimes(vehicle, dateKey(7), dateKey(8))
            ).length,
            21
        );
    });

    it("opens pickups from return + buffer on the same day", async () => {
        const vehicle = await insertVehicle();

        await insertBooking(
            vehicle,
            at(dateKey(4), "10:00"),
            at(dateKey(6), "10:00")
        );

        const times = availableTimes(
            await getVehiclePickupTimes(vehicle, dateKey(6), dateKey(7))
        );

        assert.equal(times[0], "12:00");
        assert.equal(times.at(-1), "18:00");
    });

    it("limits the time when the return would run into the next booking", async () => {
        const vehicle = await insertVehicle();

        // Next customer picks up at 2 PM: this return must be by 12 PM.
        await insertBooking(
            vehicle,
            at(dateKey(9), "14:00"),
            at(dateKey(10), "14:00")
        );

        const times = availableTimes(
            await getVehiclePickupTimes(vehicle, dateKey(7), dateKey(9))
        );

        assert.equal(times[0], "08:00");
        assert.equal(times.at(-1), "12:00");
    });

    it("includes the chosen driver's other bookings", async () => {
        const vehicle = await insertVehicle();
        const driver = new mongoose.Types.ObjectId();

        await insertBooking(
            new mongoose.Types.ObjectId(),
            at(dateKey(5), "08:00"),
            at(dateKey(6), "18:00"),
            { driver, driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER }
        );

        assert.deepEqual(
            availableTimes(
                await getVehiclePickupTimes(
                    vehicle,
                    dateKey(5),
                    dateKey(6),
                    driver
                )
            ),
            []
        );
        assert.equal(
            availableTimes(
                await getVehiclePickupTimes(vehicle, dateKey(5), dateKey(6))
            ).length,
            21
        );
    });

    it("ignores cancelled bookings and offers nothing on a disabled vehicle", async () => {
        const vehicle = await insertVehicle();

        await insertBooking(
            vehicle,
            at(dateKey(5), "08:00"),
            at(dateKey(6), "18:00"),
            { status: BOOKING_STATUS.CANCELLED }
        );

        assert.equal(
            availableTimes(
                await getVehiclePickupTimes(vehicle, dateKey(5), dateKey(6))
            ).length,
            21
        );

        const disabled = await insertVehicle({
            availability: { bookingEnabled: false, blockedDates: [] },
        });

        assert.deepEqual(
            availableTimes(
                await getVehiclePickupTimes(disabled, dateKey(5), dateKey(6))
            ),
            []
        );
    });

    it("offers only the configured pickup hours", async () => {
        await Settings.create({
            bookingSettings: {
                pickupHours: { earliestTime: "09:00", latestTime: "17:00" },
            },
        });

        const vehicle = await insertVehicle();

        const { times } = await getVehiclePickupTimes(
            vehicle,
            dateKey(5),
            dateKey(6)
        );

        assert.equal(times.length, 17);
        assert.equal(times[0].time, "09:00");
        assert.equal(times.at(-1).time, "17:00");
        assert.ok(times.every((slot) => slot.available));
    });

    it("rejects a return date that isn't after the pickup date", async () => {
        const vehicle = await insertVehicle();

        await assert.rejects(
            getVehiclePickupTimes(vehicle, dateKey(6), dateKey(6)),
            /after the pickup date/
        );
    });
});

describe("getVehicleAvailabilityCalendar pickup hints", () => {
    it("marks partial days, return-only days and fully booked days", async () => {
        const vehicle = await insertVehicle();

        // Busy until 12 PM on day 6.
        await insertBooking(
            vehicle,
            at(dateKey(5), "10:00"),
            at(dateKey(6), "10:00")
        );

        // Next booking at 9 AM on day 9: day 8 can't start a 1-day rental.
        await insertBooking(
            vehicle,
            at(dateKey(9), "09:00"),
            at(dateKey(10), "09:00")
        );

        const calendar = await getVehicleAvailabilityCalendar(
            vehicle,
            dateKey(3),
            dateKey(12)
        );

        // Day 4: a 1-day rental must be back by 8 AM on day 5.
        assert.deepEqual(calendar.limitedPickupTimes[dateKey(4)], {
            from: "08:00",
            until: "08:00",
        });

        // Day 5: busy from 8 AM (10 AM pickup − buffer).
        assert.ok(calendar.unavailableDates.includes(dateKey(5)));

        // Day 6: back at 10 AM + buffer.
        assert.ok(!calendar.unavailableDates.includes(dateKey(6)));
        assert.deepEqual(calendar.limitedPickupTimes[dateKey(6)], {
            from: "12:00",
            until: "18:00",
        });

        // Day 7: wide open.
        assert.equal(calendar.limitedPickupTimes[dateKey(7)], undefined);
        assert.ok(!calendar.returnOnlyDates.includes(dateKey(7)));

        // Day 8: free, but a pickup would have to be back by 7 AM.
        assert.ok(!calendar.unavailableDates.includes(dateKey(8)));
        assert.ok(calendar.returnOnlyDates.includes(dateKey(8)));

        assert.ok(calendar.unavailableDates.includes(dateKey(9)));
    });
});
