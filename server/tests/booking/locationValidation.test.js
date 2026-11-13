import assert from "node:assert/strict";
import { it } from "node:test";
import { validationResult } from "express-validator";
import { createBookingValidator, updateBookingValidator } from "../../validators/bookingValidator.js";

const validate = async (validators, location) => {
    const request = {
        params: { bookingId: "507f1f77bcf86cd799439011" },
        body: { pickupLocation: { ...location }, returnLocation: { ...location } },
    };
    for (const validator of validators) await validator.run(request);
    // Unrelated required booking fields are outside these location tests.
    return validationResult(request).array().filter(error =>
        /^(pickup|return)Location\./.test(error.path));
};

for (const [mode, validators] of [["create", createBookingValidator], ["update", updateBookingValidator]]) {
    const custom = { type: "Custom", address: "Camalig, Albay", serviceLocationId: null };
    it(`${mode} accepts custom map locations without a saved location ID`, async () => {
        assert.deepEqual(await validate(validators, { ...custom, latitude: 13.18, longitude: 123.65 }), []);
    });
    it(`${mode} rejects coordinates beyond the map boundaries on both sides`, async () => {
        for (const sign of [-1, 1]) {
            const errors = await validate(validators, { ...custom, latitude: sign * 91, longitude: sign * 181 });
            assert.deepEqual(errors.map(error => error.path).sort(), [
                "pickupLocation.latitude", "pickupLocation.longitude",
                "returnLocation.latitude", "returnLocation.longitude",
            ]);
        }
    });
    it(`${mode} accepts zero, boundary coordinates, and numeric coordinate strings`, async () => {
        for (const [latitude, longitude] of [[0, 0], [-90, -180], [90, 180], ["13.18", "123.65"]]) {
            assert.deepEqual(await validate(validators, { ...custom, latitude, longitude }), []);
        }
    });
    it(`${mode} still rejects malformed saved location IDs`, async () => {
        const errors = await validate(validators, { ...custom, serviceLocationId: "invalid", latitude: 13, longitude: 123 });
        assert.deepEqual(errors.map(error => error.path).sort(), [
            "pickupLocation.serviceLocationId", "returnLocation.serviceLocationId",
        ]);
    });
}
