import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const form = readFileSync(new URL("../src/components/forms/BookingForm.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../../server/services/bookingService.js", import.meta.url), "utf8");
const location = {
    _id: "office", name: "Office", address: "  12 Main Street, Cabangan, Camalig  ",
    barangay: "Cabangan", city: "Camalig", province: "Albay", region: "Bicol",
    latitude: 13.18, longitude: 123.65,
};

for (const [label, variable, source] of [
    ["default selection", "defaultLocation", form.slice(form.indexOf("        const addressParts ="))],
    ["saved selection", "location", form.slice(form.indexOf("    const handleLocationChange ="))],
    ["saved booking", "serviceLocation", service.slice(service.indexOf("const buildBookingLocation ="))],
]) {
    const start = source.indexOf("const addressParts =");
    const end = source.indexOf(";", source.indexOf("const address =", start)) + 1;
    const resolve = new Function(variable, "clientLocation", `${source.slice(start, end)}; return address;`);
    test(`${label} preserves the full street address`, () => {
        assert.equal(resolve(location, {}), "12 Main Street, Cabangan, Camalig");
    });
    test(`${label} falls back to administrative areas when the street address is blank`, () => {
        assert.equal(resolve({ ...location, address: "  " }, {}), "Cabangan, Camalig, Albay, Bicol");
    });
}

const copySource = form.slice(form.indexOf("    const copyPickupToReturn ="), form.indexOf("    const LOCATION_STOPS ="));
const copy = (pickup, update, selectSaved) => new Function(
    "pickupLocation", "hasPickupLocation", "setFormData", "handleLocationChange",
    `${copySource}; return copyPickupToReturn;`,
)(pickup, true, update, selectSaved)();

test("same as pickup copies a confirmed custom address without another network lookup", () => {
    const pickup = { ...location, serviceLocationId: "", type: "Custom", fee: 120 };
    let data = { pickupLocation: pickup, returnLocation: { address: "Old address" }, driverOption: "Self Drive" };
    copy(pickup, update => { data = update(data); }, () => assert.fail("custom location must not select a saved location"));
    assert.deepEqual(data.returnLocation, { ...pickup, fee: 0 });
    assert.notEqual(data.returnLocation, pickup);
    assert.equal(data.pickupLocation, pickup);
    assert.equal(data.driverOption, "Self Drive");
});

test("same as pickup selects saved locations through their return-fee resolver", () => {
    const selected = [];
    copy({ ...location, serviceLocationId: "office" }, () => assert.fail("must use saved location fees"),
        (...args) => selected.push(args));
    assert.deepEqual(selected, [["returnLocation", "office"]]);
});
