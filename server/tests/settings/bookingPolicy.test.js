import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Settings from "../../models/Settings.js";
import ServiceLocation from "../../models/ServiceLocation.js";
import { assertDefaultLocationPolicy } from "../../utils/defaultLocationPolicy.js";
import { updateSettingsValidator } from "../../validators/settingsValidator.js";

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

const prepare = (settings, defaultLocation = locationData) => {
    const session = { withTransaction: async (run) => run(), endSession: async () => {} };
    mock.method(mongoose, "startSession", async () => session);
    mock.method(mongoose.model("BookingCreationGuard"), "updateOne", async () => ({}));
    mock.method(Settings, "findOne", () => query(settings));
    mock.method(ServiceLocation, "findOne", () => query(defaultLocation));
    const settingsWrite = mock.method(Settings, "findOneAndUpdate", (_filter, update) => query({ ...settings, ...update }));
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
