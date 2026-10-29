import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Driver from "../../models/Driver.js";
import Settings from "../../models/Settings.js";
import { BOOKING_DRIVER_OPTIONS } from "../../constants/bookingConstants.js";
import {
    applyDriverFee,
    resolveDriverDailyRate,
} from "../../services/driverPricingService.js";
import {
    connectTestDb,
    disconnectTestDb,
} from "../helpers/testDb.js";

describe("driver booking pricing", () => {
    before(async () => connectTestDb());
    after(async () => disconnectTestDb());

    beforeEach(async () => {
        await Promise.all([Driver.deleteMany({}), Settings.deleteMany({})]);
    });

    it("charges the global daily rate in global mode and adds it to the booking total", async () => {
        const settings = await Settings.create({
            driverPricingSettings: { mode: "global", globalDailyRate: 850 },
        });
        const dailyRate = await resolveDriverDailyRate({
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            settings,
        });
        const pricing = applyDriverFee(
            { rentalDays: 3, totalAmount: 5200 },
            dailyRate
        );

        assert.equal(pricing.driverDailyRate, 850);
        assert.equal(pricing.driverFee, 2550);
        assert.equal(pricing.totalAmount, 7750);
    });

    it("uses the selected driver's rate in individual mode and falls back to global", async () => {
        const settings = await Settings.create({
            driverPricingSettings: { mode: "individual", globalDailyRate: 700 },
        });
        const ownDriverId = new mongoose.Types.ObjectId();
        const fallbackDriverId = new mongoose.Types.ObjectId();
        await Driver.collection.insertMany([
            {
                _id: ownDriverId,
                driverCode: "TEST-DRIVER-OWN",
                email: "own-rate@example.test",
                license: { licenseNumber: "OWN-RATE" },
                pricing: { dailyRate: 950 },
            },
            {
                _id: fallbackDriverId,
                driverCode: "TEST-DRIVER-FALLBACK",
                email: "fallback-rate@example.test",
                license: { licenseNumber: "FALLBACK-RATE" },
                pricing: { dailyRate: null },
            },
        ]);

        assert.equal(
            await resolveDriverDailyRate({
                driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
                driverId: ownDriverId,
                settings,
            }),
            950
        );
        assert.equal(
            await resolveDriverDailyRate({
                driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
                driverId: fallbackDriverId,
                settings,
            }),
            700
        );
    });

    it("does not charge for a booking without a driver", async () => {
        assert.equal(
            await resolveDriverDailyRate({
                driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
            }),
            0
        );
    });
});
