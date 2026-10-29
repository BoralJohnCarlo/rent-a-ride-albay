import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Discount from "../../models/Discount.js";
import Notification from "../../models/Notification.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import { BOOKING_DRIVER_OPTIONS, BOOKING_STATUS } from "../../constants/bookingConstants.js";
import {
    DISCOUNT_METHOD,
    DISCOUNT_SCOPE,
    DISCOUNT_STATUS,
} from "../../constants/discountConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import {
    attachActiveDiscounts,
    createDiscount,
    deleteDiscountById,
    getActiveDiscounts,
    resolveVehicleRate,
    updateDiscountById,
} from "../../services/discountService.js";
import { requestBookingExtension } from "../../services/bookingService.js";
import { toBusinessDateKey } from "../../utils/businessTime.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const dayKey = (offsetDays) =>
    toBusinessDateKey(new Date(Date.now() + offsetDays * DAY));

const vehicle = (id = new mongoose.Types.ObjectId(), dailyRate = 2400) => ({
    _id: id,
    pricing: { dailyRate, reservationFee: 500 },
});

const discount = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    name: "Sale",
    label: "",
    scope: DISCOUNT_SCOPE.ALL_VEHICLES,
    vehicles: [],
    discountMethod: DISCOUNT_METHOD.PERCENTAGE,
    discountValue: 10,
    ...overrides,
});

describe("resolveVehicleRate", () => {
    it("takes the discount that saves the most - they never stack", () => {
        const result = resolveVehicleRate(vehicle(), [
            discount({ name: "Ten", discountValue: 10 }),
            discount({
                name: "Flat",
                discountMethod: DISCOUNT_METHOD.FIXED,
                discountValue: 500,
            }),
        ]);

        assert.equal(result.originalDailyRate, 2400);
        assert.equal(result.dailyRate, 1900);
        assert.equal(result.discount.name, "Flat");
        assert.equal(result.discount.amountPerDay, 500);
    });

    it("never takes a fixed discount below zero", () => {
        const result = resolveVehicleRate(vehicle(undefined, 300), [
            discount({ discountMethod: DISCOUNT_METHOD.FIXED, discountValue: 500 }),
        ]);

        assert.equal(result.dailyRate, 0);
        assert.equal(result.discount.amountPerDay, 300);
    });

    it("applies a specific-vehicle discount only to its vehicles", () => {
        const listed = new mongoose.Types.ObjectId();
        const sale = discount({
            scope: DISCOUNT_SCOPE.SPECIFIC_VEHICLES,
            vehicles: [listed],
        });

        assert.equal(resolveVehicleRate(vehicle(listed), [sale]).dailyRate, 2160);

        const other = resolveVehicleRate(vehicle(), [sale]);
        assert.equal(other.dailyRate, 2400);
        assert.equal(other.discount, null);
    });

    it("keeps a booking's locked discount when it beats what runs now", () => {
        const locked = {
            name: "Ended sale",
            discountMethod: DISCOUNT_METHOD.PERCENTAGE,
            discountValue: 25,
        };

        assert.equal(
            resolveVehicleRate(vehicle(), [], { lockedDiscount: locked }).dailyRate,
            1800
        );

        // A better sale running now wins over the locked one.
        assert.equal(
            resolveVehicleRate(vehicle(), [discount({ discountValue: 50 })], {
                lockedDiscount: locked,
            }).dailyRate,
            1200
        );
    });
});

describe("discount management", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(() =>
        Promise.all([
            Booking.collection.deleteMany({}),
            Discount.deleteMany({}),
            Notification.deleteMany({}),
            Vehicle.collection.deleteMany({}),
        ])
    );

    const create = (overrides = {}) =>
        createDiscount({
            name: "Holiday Sale",
            discountMethod: DISCOUNT_METHOD.PERCENTAGE,
            discountValue: 20,
            startDate: dayKey(-1),
            endDate: dayKey(5),
            ...overrides,
        });

    it("runs only while active and within its Manila days", async () => {
        const running = await create();
        await create({ name: "Upcoming", startDate: dayKey(3), endDate: dayKey(6) });
        await create({ name: "Ended", startDate: dayKey(-6), endDate: dayKey(-2) });
        await create({ name: "Off", status: DISCOUNT_STATUS.INACTIVE });

        const active = await getActiveDiscounts();

        assert.deepEqual(
            active.map((entry) => String(entry._id)),
            [String(running._id)]
        );
        assert.equal(running.dateState, "current");
    });

    it("allows a one-day sale but not an end before the start", async () => {
        const oneDay = await create({ startDate: dayKey(0), endDate: dayKey(0) });
        assert.equal(oneDay.dateState, "current");

        await assert.rejects(
            create({ startDate: dayKey(2), endDate: dayKey(1) }),
            /before the start date/
        );
    });

    it("checks the discount as it will be after an edit", async () => {
        const fixed = await create({
            discountMethod: DISCOUNT_METHOD.FIXED,
            discountValue: 500,
        });

        await assert.rejects(
            updateDiscountById(fixed._id, {
                discountMethod: DISCOUNT_METHOD.PERCENTAGE,
            }),
            /cannot exceed 100/
        );
    });

    it("requires a running discount to be switched off before deleting", async () => {
        const running = await create();

        await assert.rejects(deleteDiscountById(running._id), /inactive first/);

        await updateDiscountById(running._id, {
            status: DISCOUNT_STATUS.INACTIVE,
        });
        await deleteDiscountById(running._id);

        assert.equal(await Discount.countDocuments(), 0);
    });

    it("shows the running discount on the vehicle", async () => {
        await create({ label: "Holiday Sale" });

        const [listed] = await attachActiveDiscounts([vehicle()]);

        assert.equal(listed.activeDiscount.label, "Holiday Sale");
        assert.equal(listed.activeDiscount.originalDailyRate, 2400);
        assert.equal(listed.activeDiscount.discountedDailyRate, 1920);
    });

    it("prices an extension with the booking's discount after the sale ended", async () => {
        const vehicleId = new mongoose.Types.ObjectId();

        await Vehicle.collection.insertOne({
            _id: vehicleId,
            status: VEHICLE_STATUS.RESERVED,
            vehicleCode: `TEST-${vehicleId}`,
            plateNumber: `TEST-${vehicleId}`,
            vehicleType: "Car",
            pricing: { dailyRate: 2400, reservationFee: 500 },
            availability: { bookingEnabled: true, blockedDates: [] },
        });

        const bookingId = new mongoose.Types.ObjectId();
        const customerId = new mongoose.Types.ObjectId();
        const start = new Date(Date.now() + 3 * DAY);

        await Booking.collection.insertOne({
            _id: bookingId,
            bookingCode: `BK-T${bookingId}`,
            customer: customerId,
            vehicle: vehicleId,
            driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
            driver: null,
            startDate: start,
            endDate: new Date(start.getTime() + 2 * DAY),
            pickupLocation: { type: "Office", address: "Legazpi" },
            returnLocation: { type: "Office", address: "Legazpi" },
            pricing: {
                dailyRate: 1800,
                originalDailyRate: 2400,
                vehicleDiscount: {
                    name: "Ended sale",
                    discountMethod: DISCOUNT_METHOD.PERCENTAGE,
                    discountValue: 25,
                    amountPerDay: 600,
                },
                reservationFee: 0,
                rentalDays: 2,
                subtotal: 3600,
                totalAmount: 3600,
                pickupDistanceFee: 0,
                returnDistanceFee: 0,
            },
            status: BOOKING_STATUS.APPROVED,
            statusHistory: [],
            extensions: [],
            reschedules: [],
            audit: {},
        });

        const booking = await Booking.findById(bookingId).lean();

        const requested = await requestBookingExtension(
            bookingId,
            { requestedEndDate: new Date(booking.endDate.getTime() + 4 * HOUR) },
            customerId
        );

        // 4 hours at 1800/day (75/h), not the full 2400/day (100/h).
        assert.equal(requested.extensions[0].pricing.amount, 300);
    });
});
