import { afterEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import ServiceLocation from "../../models/ServiceLocation.js";
import DistanceFeeRule from "../../models/DistanceFeeRule.js";
import Settings from "../../models/Settings.js";
import { resolveBookingLocationFees, previewBookingLocationFees, findDefaultServiceLocation } from "../../services/bookingService.js";
import { validationResult } from "express-validator";
import { createServiceLocationValidator, updateServiceLocationValidator } from "../../validators/serviceLocationValidator.js";
import { enableDistanceFeeRule } from "../../services/distanceFeeRuleService.js";

afterEach(() => mock.restoreAll());

it("rejects invalid default office coordinates before calculating distances", async () => {
    for (const coordinates of [
        { latitude: 91, longitude: 123 },
        { latitude: 13, longitude: -181 },
        { latitude: NaN, longitude: 123 },
    ]) {
        const stub = mock.method(ServiceLocation, "find", () => ({
            sort: () => ({ lean: async () => [{ isDefault: true, ...coordinates }] }),
        }));
        await assert.rejects(findDefaultServiceLocation(), /does not have valid coordinates/);
        stub.mock.restore();
    }
});

it("validates latitude and longitude ranges on location create and update", async () => {
    for (const validators of [createServiceLocationValidator, updateServiceLocationValidator]) {
        const request = { body: { name: "Office", region: "Bicol", province: "Albay", city: "Legazpi", latitude: 91, longitude: -181 } };
        for (const validator of validators) await validator.run(request);
        const fields = validationResult(request).array().map((error) => error.path);
        assert.ok(fields.includes("latitude"));
        assert.ok(fields.includes("longitude"));
    }
});

const origin = { _id: "office", enabled: true, isDefault: true, latitude: 13, longitude: 123 };
const setup = () => {
    mock.method(ServiceLocation, "find", () => ({ sort: () => ({ lean: async () => [origin] }) }));
    mock.method(Settings, "findOne", () => ({ lean: async () => ({ enableDistanceFeeCalculation: true }) }));
    mock.method(DistanceFeeRule, "findOne", (query) => ({
        sort: () => ({ lean: async () => ({ pickupFee: query.$or[0].maxDistanceKm.$gte > 10 ? 200 : 50, returnFee: 75 }) }),
    }));
};

it("prices pickup and return independently and uses authoritative coordinates in previews", async () => {
    setup();
    const pickup = { ...origin, _id: "pickup", latitude: 13.2 };
    mock.method(ServiceLocation, "findById", () => ({ lean: async () => pickup }));
    const result = await previewBookingLocationFees({
        pickupServiceLocationId: "pickup", pickupLatitude: 13, pickupLongitude: 123,
        returnLatitude: 13.01, returnLongitude: 123,
    });
    assert.equal(result.pickupDistanceFee, 200);
    assert.equal(result.returnDistanceFee, 75);
    assert.ok(result.pickupDistanceKm > result.returnDistanceKm);
});

it("rejects a service location without coordinates instead of silently charging zero", async () => {
    setup();
    await assert.rejects(resolveBookingLocationFees({
        pickupServiceLocation: { pickupFee: 100 }, returnLocation: origin,
        enableDistanceFeeCalculation: true,
    }), /pickup location requires valid map coordinates/);
});

it("uses configured side-specific fees when distance pricing is disabled", async () => {
    const result = await resolveBookingLocationFees({
        pickupServiceLocation: { pickupFee: 120, returnFee: 999 },
        returnServiceLocation: { pickupFee: 999, returnFee: 80 },
        enableDistanceFeeCalculation: false,
    });
    assert.equal(result.pickupDistanceFee, 120);
    assert.equal(result.returnDistanceFee, 80);
});

it("exempts bookings with a driver from location fees and coordinate requirements", async () => {
    const result = await resolveBookingLocationFees({
        driverOption: "With Driver", enableDistanceFeeCalculation: true,
    });
    assert.equal(result.pickupDistanceFee, 0);
    assert.equal(result.returnDistanceFee, 0);
});

it("rejects overlapping rules on reactivation without saving", async () => {
    let saved = false;
    mock.method(DistanceFeeRule, "findById", async () => ({
        minDistanceKm: 0, maxDistanceKm: 10, enabled: false,
        save: async () => { saved = true; },
    }));
    mock.method(DistanceFeeRule, "findOne", () => ({ lean: async () => ({ minDistanceKm: 5, maxDistanceKm: 15 }) }));
    await assert.rejects(enableDistanceFeeRule("rule"), { statusCode: 409 });
    assert.equal(saved, false);
});

it("allows reactivating a rule without overlaps", async () => {
    const rule = { minDistanceKm: 0, maxDistanceKm: 10, enabled: false,
        save: async () => {}, toObject() { return { enabled: this.enabled }; } };
    mock.method(DistanceFeeRule, "findById", async () => rule);
    mock.method(DistanceFeeRule, "findOne", () => ({ lean: async () => null }));
    assert.equal((await enableDistanceFeeRule("rule")).enabled, true);
});
