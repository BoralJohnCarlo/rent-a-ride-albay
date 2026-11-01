import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Settings from "../../models/Settings.js";
import ServiceLocation from "../../models/ServiceLocation.js";
import { assertDefaultLocationPolicy } from "../../utils/defaultLocationPolicy.js";
import { updateSettingsValidator } from "../../validators/settingsValidator.js";
import { createServiceLocationValidator, updateServiceLocationValidator } from "../../validators/serviceLocationValidator.js";
import { validationResult } from "express-validator";
import { computeLatePenalty } from "../../utils/latePenalty.js";

mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
const { updateBookingLocationPolicy } = await import("../../services/settingsService.js");
const { getPublicSettings, updateSettings } = await import("../../controllers/settingsController.js");
const { createServiceLocation, updateServiceLocation, disableServiceLocation, deleteServiceLocation } =
    await import("../../services/serviceLocationService.js");
mock.restoreAll();
afterEach(() => mock.restoreAll());

const query = (value) => ({ session() { return this; }, lean: async () => value });
const locationData = { name: "Office", region: "Bicol", province: "Albay", city: "Legazpi",
    enabled: true, isDefault: true, latitude: 13.14, longitude: 123.74 };

it("location create and edit accept absent coordinates while rejecting invalid coordinates", async () => {
    for (const validators of [createServiceLocationValidator, updateServiceLocationValidator]) {
        for (const coords of [ { latitude: null, longitude: null },
            { latitude: 0, longitude: 0 }, { latitude: 90, longitude: -180 } ]) {
            const req = { params: { id: "507f1f77bcf86cd799439011" }, body: { ...locationData, ...coords } };
            for (const validator of validators) await validator.run(req);
            assert.equal(validationResult(req).isEmpty(), true);
        }
        for (const coords of [{ latitude: 91 }, { longitude: 181 }, { latitude: "invalid" }]) {
            const req = { params: { id: "507f1f77bcf86cd799439011" }, body: { ...locationData, ...coords } };
            for (const validator of validators) await validator.run(req);
            assert.equal(validationResult(req).isEmpty(), false);
        }
    }
});

const prepare = (settings, defaultLocation = locationData) => {
    const session = { withTransaction: async (run) => run(), endSession: async () => {} };
    mock.method(mongoose, "startSession", async () => session);
    mock.method(mongoose.model("BookingCreationGuard"), "updateOne", async () => ({}));
    mock.method(Settings, "findOne", () => query(settings));
    mock.method(ServiceLocation, "findOne", () => query(defaultLocation));
    const settingsWrite = mock.method(Settings, "findOneAndUpdate", (_filter, update) => {
        const next = structuredClone(settings);
        for (const [path, value] of Object.entries(update)) {
            const parts = path.split(".");
            let target = next;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {};
            target[parts.at(-1)] = value;
        }
        return query(next);
    });
    const location = new ServiceLocation(locationData);
    mock.method(ServiceLocation, "findById", () => ({ session: async () => location }));
    const locationSave = mock.method(location, "save", async () => location);
    const defaultsWrite = mock.method(ServiceLocation, "updateMany", async () => ({}));
    return { location, locationSave, settingsWrite, defaultsWrite };
};

it("default-only booking permits a saved office without map coordinates", () => {
    assert.doesNotThrow(() => assertDefaultLocationPolicy({ allowOnlyDefaultLocation: true },
        { ...locationData, latitude: null, longitude: null }));
});

it("distance pricing requires valid office coordinates", () => {
    for (const latitude of [null, 91, "invalid"]) {
        assert.throws(() => assertDefaultLocationPolicy({ enableDistanceFeeCalculation: true },
            { ...locationData, latitude }), /coordinates/);
    }
});

it("public settings expose the default-only policy", async () => {
    prepare({ allowOnlyDefaultLocation: true });
    const response = { status() { return this; }, json(body) { this.body = body; return this; } };
    await getPublicSettings({}, response);
    assert.equal(response.body.data.allowOnlyDefaultLocation, true);
});

it("cannot enable a location-dependent policy without an enabled default", async () => {
    for (const key of ["allowOnlyDefaultLocation", "enableDistanceFeeCalculation"]) {
        mock.restoreAll();
        const { settingsWrite } = prepare({}, null);
        await assert.rejects(updateBookingLocationPolicy({ [key]: true }), /enabled default/);
        assert.equal(settingsWrite.mock.callCount(), 0);
    }
});

it("enabling default-only policy does not require coordinates", async () => {
    const { settingsWrite } = prepare({}, { ...locationData, latitude: null, longitude: null });
    await updateBookingLocationPolicy({ allowOnlyDefaultLocation: true });
    assert.equal(settingsWrite.mock.callCount(), 1);
});

it("cannot enable distance pricing without office coordinates", async () => {
    const { settingsWrite } = prepare({}, { ...locationData, latitude: null });
    await assert.rejects(updateBookingLocationPolicy({ enableDistanceFeeCalculation: true }), /coordinates/);
    assert.equal(settingsWrite.mock.callCount(), 0);
});

it("disable, delete, and clearing default status are refused while a policy requires it", async () => {
    for (const policy of ["allowOnlyDefaultLocation", "enableDistanceFeeCalculation"]) {
        for (const action of [disableServiceLocation, deleteServiceLocation,
            (id) => updateServiceLocation(id, { isDefault: false })]) {
            mock.restoreAll();
            const { location, locationSave } = prepare({ [policy]: true });
            await assert.rejects(action(location._id), /enabled default/);
            assert.equal(locationSave.mock.callCount(), 0);
            assert.equal(location.enabled, true);
            assert.equal(location.isDefault, true);
        }
    }
});

it("removing required office coordinates is refused before saving", async () => {
    const { location, locationSave } = prepare({ enableDistanceFeeCalculation: true });
    await assert.rejects(updateServiceLocation(location._id, { latitude: null }), /coordinates/);
    assert.equal(locationSave.mock.callCount(), 0);
});

it("can disable the default when both dependent policies are off", async () => {
    const { location, locationSave } = prepare({});
    const result = await disableServiceLocation(location._id);
    assert.equal(result.enabled, false);
    assert.equal(locationSave.mock.callCount(), 1);
});

it("a failed replacement default does not clear the existing default", async () => {
    const { defaultsWrite } = prepare({ allowOnlyDefaultLocation: true });
    mock.method(ServiceLocation.prototype, "save", async () => { throw Error("Save failed"); });
    await assert.rejects(createServiceLocation(locationData), /Save failed/);
    assert.equal(defaultsWrite.mock.callCount(), 0);
});

it("can switch to another valid default without unsetting the replacement", async () => {
    const { defaultsWrite } = prepare({ enableDistanceFeeCalculation: true });
    mock.method(ServiceLocation.prototype, "save", async function () { return this; });
    const replacement = await createServiceLocation({ ...locationData, name: "New office" });
    assert.equal(replacement.isDefault, true);
    assert.equal(defaultsWrite.mock.callCount(), 1);
    assert.equal(String(defaultsWrite.mock.calls[0].arguments[0]._id.$ne), String(replacement._id));
    assert.ok(defaultsWrite.mock.calls[0].arguments[2].session);
});

it("can turn off dependent policies when a default is already missing", async () => {
    prepare({ allowOnlyDefaultLocation: true, enableDistanceFeeCalculation: true }, null);
    const result = await updateBookingLocationPolicy({ allowOnlyDefaultLocation: false, enableDistanceFeeCalculation: false });
    assert.equal(result.allowOnlyDefaultLocation, false);
});

const saveValidatedSettings = async (body) => {
    const req = { body };
    for (const validator of updateSettingsValidator) await validator.run(req);
    const response = { status(code) { this.code = code; return this; }, json(result) { this.body = result; return this; } };
    await updateSettings(req, response);
    return response;
};

for (const path of ["bookingSettings", "penaltySettings", "bookingHours", "pickupHours", "offRoadVehicles", "earlyPickup"]) {
    for (const value of [null, false, 0, "invalid", []]) {
        it(`rejects malformed ${path}: ${JSON.stringify(value)} without writing`, async () => {
            const { settingsWrite } = prepare({});
            const root = path === "bookingSettings" || path === "penaltySettings";
            const response = await saveValidatedSettings(root ? { [path]: value } : { bookingSettings: { [path]: value } });
            assert.equal(response.code, 400);
            const expectedPath = root ? path : `bookingSettings.${path}`;
            assert.ok(response.body.errors.some((error) => error.path === expectedPath));
            assert.equal(settingsWrite.mock.callCount(), 0);
        });
    }
}

it("partial penalty updates preserve unrelated penalty fields and zero multipliers", async () => {
    const { settingsWrite } = prepare({});
    const response = await saveValidatedSettings({ penaltySettings: { maximumCap: 500, rateMultiplier: 0 } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], {
        "penaltySettings.maximumCap": 500, "penaltySettings.rateMultiplier": 0,
    });
});

for (const section of ["refundSettings", "earlyReturnSettings", "driverPricingSettings", "driverAssignmentSettings", "validIdRenewalSettings", "validIdExpirationSettings"]) {
    for (const value of [null, false, [], "invalid"]) {
        it(`rejects malformed ${section}: ${JSON.stringify(value)} before writing`, async () => {
            const { settingsWrite } = prepare({});
            const response = await saveValidatedSettings({ [section]: value });
            assert.equal(response.code, 400);
            assert.equal(settingsWrite.mock.callCount(), 0);
        });
    }
}

it("partial driver updates preserve other fields in each section", async () => {
    const { settingsWrite } = prepare({ driverPricingSettings: { mode: "global", globalDailyRate: 500 },
        driverAssignmentSettings: { requireAdminDriverAssignment: false, motorcycleDriversEnabled: false } });
    const response = await saveValidatedSettings({ driverPricingSettings: { mode: "individual" },
        driverAssignmentSettings: { requireAdminDriverAssignment: true } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], {
        "driverPricingSettings.mode": "individual", "driverAssignmentSettings.requireAdminDriverAssignment": true,
    });
    assert.equal(response.body.data.driverPricingSettings.globalDailyRate, 500);
    assert.equal(response.body.data.driverAssignmentSettings.motorcycleDriversEnabled, false);
});

it("partial valid ID settings updates preserve other limits and reminder options", async () => {
    const { settingsWrite } = prepare({ validIdRenewalSettings: { maxUploadsPerYear: 2, renewalPeriodYears: 3, maxAttempts: 4 },
        validIdExpirationSettings: { enabled: true, firstReminderDays: 60, notifyOnExpired: true } });
    const response = await saveValidatedSettings({ validIdRenewalSettings: { maxAttempts: 5 }, validIdExpirationSettings: { enabled: false } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], {
        "validIdRenewalSettings.maxAttempts": 5, "validIdExpirationSettings.enabled": false,
    });
    assert.equal(response.body.data.validIdRenewalSettings.renewalPeriodYears, 3);
    assert.equal(response.body.data.validIdExpirationSettings.firstReminderDays, 60);
});

it("partial early-return updates only write requested fields", async () => {
    const { settingsWrite } = prepare({ earlyReturnSettings: {
        enabled: true, autoApprove: true, voucherValidityMonths: 6, minUnusedDaysToQualify: 3,
    } });
    const response = await saveValidatedSettings({ earlyReturnSettings: { enabled: false } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], { "earlyReturnSettings.enabled": false });
});

it("overlapping partial refund saves preserve both independent changes", async () => {
    const { settingsWrite } = prepare({ refundSettings: {
        autoApproveRefundThreshold: 500, noShowRefundPercent: 0,
    } });
    const responses = await Promise.all([
        saveValidatedSettings({ refundSettings: { autoApproveRefundThreshold: 100 } }),
        saveValidatedSettings({ refundSettings: { noShowRefundPercent: 50 } }),
    ]);
    for (const response of responses) assert.equal(response.code, 200);
    const state = { "refundSettings.autoApproveRefundThreshold": 500, "refundSettings.noShowRefundPercent": 0 };
    for (const call of settingsWrite.mock.calls) {
        const write = call.arguments[1];
        assert.equal(Object.keys(write).length, 1);
        Object.assign(state, write);
    }
    assert.equal(state["refundSettings.autoApproveRefundThreshold"], 100);
    assert.equal(state["refundSettings.noShowRefundPercent"], 50);
});

it("partial cancellation policy saves only update requested leaves, keeping tiers atomic", async () => {
    const { settingsWrite } = prepare({});
    const tiers = [{ hoursBefore: 48, refundPercent: 100 }, { hoursBefore: 24, refundPercent: 50 }];
    const response = await saveValidatedSettings({ refundSettings: { cancellationPolicy: { tiers } } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], {
        "refundSettings.cancellationPolicy.tiers": tiers,
    });
});

it("merged cancellation policy validation still rejects invalid partial changes", async () => {
    const { settingsWrite } = prepare({});
    const response = await saveValidatedSettings({ refundSettings: { cancellationPolicy: {
        tiers: [{ hoursBefore: 48, refundPercent: 50 }, { hoursBefore: 24, refundPercent: 100 }],
    } } });
    assert.equal(response.code, 400);
    assert.equal(settingsWrite.mock.callCount(), 0);
});

it("zero penalty multipliers charge zero for hourly and daily policies", () => {
    for (const chargingUnit of ["Hour", "Day"]) {
        const result = computeLatePenalty({ penaltySettings: { chargingUnit, rateType: "multiplier", rateMultiplier: 0 },
            expectedReturnAt: new Date("2026-11-01T00:00:00Z"),
            actualReturnAt: new Date("2026-11-02T01:00:00Z"), dailyRate: 2400 });
        assert.equal(result.rate, 0);
        assert.equal(result.amount, 0);
        assert.ok(result.chargedUnits > 0);
    }
});

it("overlapping booking section saves only write their requested fields", async () => {
    // Both requests read the same snapshot, as happens during overlapping saves.
    const { settingsWrite } = prepare({ bookingSettings: {
        turnaroundBufferMinutes: 120,
        pickupHours: { earliestTime: "08:00", latestTime: "18:00" },
    } });
    const responses = await Promise.all([
        saveValidatedSettings({ bookingSettings: { turnaroundBufferMinutes: 180 } }),
        saveValidatedSettings({ bookingSettings: { pickupHours: {
            earliestTime: "09:00", latestTime: "17:00",
        } } }),
    ]);
    for (const response of responses) assert.equal(response.code, 200);
    const writes = settingsWrite.mock.calls.map((call) => call.arguments[1]);
    assert.ok(writes.some((write) => JSON.stringify(write) ===
        JSON.stringify({ "bookingSettings.turnaroundBufferMinutes": 180 })));
    assert.ok(writes.some((write) => JSON.stringify(write) === JSON.stringify({
        "bookingSettings.pickupHours.earliestTime": "09:00",
        "bookingSettings.pickupHours.latestTime": "17:00",
    })));
});

it("partial booking option saves do not restore unrequested sibling fields", async () => {
    const { settingsWrite } = prepare({});
    const response = await saveValidatedSettings({ bookingSettings: {
        offRoadVehicles: { showNotice: false },
    } });
    assert.equal(response.code, 200);
    assert.deepEqual(settingsWrite.mock.calls[0].arguments[1], {
        "bookingSettings.offRoadVehicles.showNotice": false,
    });
});

for (const limit of [1.5, -1]) {
    it(`refuses an invalid booking limit (${limit}) before writing`, async () => {
        const { settingsWrite } = prepare({});
        const response = await saveValidatedSettings({ customerBookingSettings: { maxConcurrentBookings: limit } });
        assert.equal(response.code, 400);
        assert.equal(response.body.errors[0].path, "customerBookingSettings.maxConcurrentBookings");
        assert.equal(settingsWrite.mock.callCount(), 0);
    });
}

for (const rate of [1000001, -1, "invalid"]) {
    it(`refuses an invalid driver rate (${rate}) before writing`, async () => {
        const { settingsWrite } = prepare({});
        const response = await saveValidatedSettings({ driverPricingSettings: { globalDailyRate: rate } });
        assert.equal(response.code, 400);
        assert.equal(response.body.errors[0].path, "driverPricingSettings.globalDailyRate");
        assert.equal(settingsWrite.mock.callCount(), 0);
    });
}

it("accepts zero as an unlimited booking cap and positive whole-number limits", async () => {
    const { settingsWrite } = prepare({});
    for (const limit of [0, 1, 2]) {
        const response = await saveValidatedSettings({ customerBookingSettings: { maxConcurrentBookings: limit } });
        assert.equal(response.code, 200);
    }
    assert.equal(settingsWrite.mock.callCount(), 3);
});

it("accepts and normalizes valid driver rates at the allowed boundaries", async () => {
    const { settingsWrite } = prepare({});
    for (const rate of [0, "250.50", 1000000]) {
        const response = await saveValidatedSettings({ driverPricingSettings: { globalDailyRate: rate } });
        assert.equal(response.code, 200);
        assert.equal(response.body.data.driverPricingSettings.globalDailyRate, Number(rate));
    }
    assert.equal(settingsWrite.mock.callCount(), 3);
});
