import assert from "node:assert/strict";
import { it } from "node:test";
import { validationResult } from "express-validator";
import { createBookingValidator } from "../../validators/bookingValidator.js";

const location = () => ({
    serviceLocationId: "507f1f77bcf86cd799439011",
    type: "Office",
    address: "Legazpi City",
    latitude: null,
    longitude: null,
});

const validate = async (overrides = {}) => {
    const req = { body: {
        vehicle: "507f1f77bcf86cd799439012",
        driverOption: "Without Driver",
        startDate: "2030-11-04T08:00:00+08:00",
        endDate: "2030-11-05T08:00:00+08:00",
        termsAccepted: true,
        termsVersionId: "507f1f77bcf86cd799439013",
        pickupLocation: location(),
        returnLocation: location(),
        paymentMethod: "GCASH",
        expectedPricing: { totalAmount: 2500, upfrontAmount: 500 },
        ...overrides,
    } };
    for (const validator of createBookingValidator) await validator.run(req);
    return validationResult(req).array();
};

it("accepts saved pickup and return locations without coordinates", async () => {
    assert.deepEqual(await validate(), []);
});

it("accepts custom locations with numeric coordinates", async () => {
    const custom = { ...location(), serviceLocationId: null, latitude: 13.14, longitude: 123.74 };
    assert.deepEqual(await validate({ pickupLocation: custom, returnLocation: { ...custom } }), []);
});

it("still rejects nonnumeric coordinates on either location", async () => {
    for (const section of ["pickupLocation", "returnLocation"]) {
        for (const field of ["latitude", "longitude"]) {
            const errors = await validate({ [section]: { ...location(), [field]: "invalid" } });
            assert.ok(errors.some((error) => error.path === `${section}.${field}`));
        }
    }
});

it("still requires terms acceptance and valid saved location IDs", async () => {
    const errors = await validate({
        termsAccepted: false,
        pickupLocation: { ...location(), serviceLocationId: "invalid" },
    });
    assert.ok(errors.some((error) => error.path === "termsAccepted"));
    assert.ok(errors.some((error) => error.path === "pickupLocation.serviceLocationId"));
});

it("requires the customer's reviewed booking amounts", async () => {
    for (const expectedPricing of [undefined, null, [], {}, { totalAmount: "2500", upfrontAmount: 500 },
        { totalAmount: 2500, upfrontAmount: -1 }]) {
        const errors = await validate({ expectedPricing });
        assert.ok(errors.some((error) => error.path.startsWith("expectedPricing")));
    }
});
