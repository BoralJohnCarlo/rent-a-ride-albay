import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Review from "../../models/Review.js";
import Vehicle from "../../models/Vehicle.js";

import { BOOKING_STATUS } from "../../constants/bookingConstants.js";
import { getVehicleLeaderboard } from "../../services/vehicleLeaderboardService.js";

import {
    connectTestDb,
    disconnectTestDb,
} from "../helpers/testDb.js";

/*
 * Raw inserts: the leaderboard only reads a handful of fields, and the full
 * Booking/Review/Vehicle schemas require much more than that.
 */
const DAY = 24 * 60 * 60 * 1000;

const insertVehicle = async (brand, model, extra = {}) => {
    const _id = new mongoose.Types.ObjectId();

    await Vehicle.collection.insertOne({
        _id,
        brand,
        model,
        status: "Available",
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        images: [],
        ...extra,
    });

    return _id;
};

const insertBooking = (vehicle, {
    status = BOOKING_STATUS.COMPLETED,
    totalAmount = 1000,
    daysAgo = 1,
} = {}) =>
    Booking.collection.insertOne({
        // Unique index on bookingCode.
        bookingCode: `TEST-${new mongoose.Types.ObjectId()}`,
        vehicle,
        status,
        pricing: { totalAmount, rentalDays: 1 },
        createdAt: new Date(Date.now() - daysAgo * DAY),
    });

const insertReview = (vehicle, rating) =>
    Review.collection.insertOne({
        // One review per rental (unique index).
        rental: new mongoose.Types.ObjectId(),
        vehicle,
        rating,
        createdAt: new Date(),
    });

const names = (rows) =>
    rows.map((row) => `${row.vehicle.brand} ${row.vehicle.model}`);

describe("vehicle leaderboard", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(() =>
        Promise.all([
            Booking.collection.deleteMany({}),
            Review.collection.deleteMany({}),
            Vehicle.collection.deleteMany({}),
        ])
    );

    it("ranks performance by booking value and by bookings separately", async () => {
        const pricey = await insertVehicle("Toyota", "Fortuner");
        const busy = await insertVehicle("Honda", "Click");

        await insertBooking(pricey, { totalAmount: 9000 });
        await insertBooking(busy, { totalAmount: 1000 });
        await insertBooking(busy, { totalAmount: 1000 });
        await insertBooking(busy, {
            totalAmount: 1000,
            status: BOOKING_STATUS.APPROVED,
        });

        const board = await getVehicleLeaderboard({ period: "30d" });

        assert.deepEqual(names(board.topByBookingValue), [
            "Toyota Fortuner",
            "Honda Click",
        ]);
        assert.deepEqual(names(board.topByBookings), [
            "Honda Click",
            "Toyota Fortuner",
        ]);

        const click = board.topByBookings[0];
        assert.equal(click.bookings, 3);
        assert.equal(click.completedTrips, 2);
        assert.equal(click.bookingValue, 3000);
    });

    it("ignores bookings that never became a trip and ones outside the period", async () => {
        const vehicle = await insertVehicle("Suzuki", "Raider");

        await insertBooking(vehicle, { status: BOOKING_STATUS.CANCELLED });
        await insertBooking(vehicle, { status: BOOKING_STATUS.REJECTED });
        await insertBooking(vehicle, { status: BOOKING_STATUS.NO_SHOW });
        await insertBooking(vehicle, { daysAgo: 20 });

        const week = await getVehicleLeaderboard({ period: "7d" });
        assert.equal(week.topByBookings.length, 0);

        const month = await getVehicleLeaderboard({ period: "30d" });
        assert.equal(month.topByBookings[0].bookings, 1);
    });

    it("ranks ratings by average (more reviews win ties) and by review count", async () => {
        const perfectOnce = await insertVehicle("Isuzu", "Traviz");
        const perfectTwice = await insertVehicle("Hyundai", "Stargazer");
        const popular = await insertVehicle("Mitsubishi", "Mirage");

        await insertReview(perfectOnce, 5);
        await insertReview(perfectTwice, 5);
        await insertReview(perfectTwice, 5);
        await insertReview(popular, 4);
        await insertReview(popular, 4);
        await insertReview(popular, 5);

        const board = await getVehicleLeaderboard();

        assert.deepEqual(names(board.highestRated), [
            "Hyundai Stargazer",
            "Isuzu Traviz",
            "Mitsubishi Mirage",
        ]);
        assert.deepEqual(names(board.mostReviewed), [
            "Mitsubishi Mirage",
            "Hyundai Stargazer",
            "Isuzu Traviz",
        ]);

        const mirage = board.mostReviewed[0];
        assert.equal(mirage.averageRating, 4.3);
        assert.equal(mirage.reviewCount, 3);
        assert.equal(mirage.fiveStarCount, 1);
    });

    it("breaks full ties by vehicle name so the order is stable", async () => {
        const zeta = await insertVehicle("Zeta", "One");
        const alpha = await insertVehicle("Alpha", "One");

        await insertReview(zeta, 5);
        await insertReview(alpha, 5);

        const board = await getVehicleLeaderboard();

        assert.deepEqual(names(board.highestRated), [
            "Alpha One",
            "Zeta One",
        ]);
    });

    it("caps the limit, falls back on an unknown period, and skips deleted vehicles", async () => {
        const kept = await insertVehicle("Kept", "Car");
        const deleted = new mongoose.Types.ObjectId();

        await insertBooking(kept);
        await insertBooking(deleted);
        await insertReview(deleted, 5);

        const board = await getVehicleLeaderboard({
            period: "forever",
            limit: 500,
        });

        assert.equal(board.period, "30d");
        assert.equal(board.limit, 10);
        assert.deepEqual(names(board.topByBookings), ["Kept Car"]);
        assert.equal(board.highestRated.length, 0);
    });
});
