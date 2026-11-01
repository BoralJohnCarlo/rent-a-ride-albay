import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(new URL("../src/pages/admin/settings/ServiceLocations.jsx", import.meta.url), "utf8");
const handler = page.slice(page.indexOf("    const handleRuleSubmit ="), page.indexOf("    const handleGeneralSave ="));

for (const mode of ["create", "edit", "disable", "enable", "delete"]) {
    test(`${mode} rule failure keeps the dialog open and never shows success`, async () => {
        let successes = 0, closed = 0, errors = 0;
        const reject = () => ({ unwrap: async () => { throw "Rejected rule"; } });
        const run = new Function("ruleDialog", "setRuleSubmitting", "toast", "handleRuleClose", "getDistanceFeeRules",
            "createDistanceFeeRule", "updateDistanceFeeRule", "disableDistanceFeeRule", "enableDistanceFeeRule", "deleteDistanceFeeRule",
            `${handler}; return handleRuleSubmit;`)(
            { mode, rule: { _id: "rule" } }, () => {},
            { success: () => successes++, error: () => errors++ }, () => closed++, () => {},
            reject, reject, reject, reject, reject);
        await run({});
        assert.equal(successes, 0);
        assert.equal(closed, 0);
        assert.equal(errors, 1);
    });
}

test("failed policy loading stays blocked and successful retry loads server values", async () => {
    const effect = page.slice(page.indexOf("        let active = true;"), page.indexOf("    }, [getSettings, settingsLoadAttempt]);"));
    let state, local;
    const run = new Function("getSettings", "setSettingsLoadState", "setLocalSettings", effect);
    run(() => ({ unwrap: async () => { throw "offline"; } }), (value) => state = value, (value) => local = value);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(local, undefined);
    run(() => ({ unwrap: async () => ({ data: { allowOnlyDefaultLocation: true } }) }),
        (value) => state = value, (value) => local = value);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(local.allowOnlyDefaultLocation, true);
});

test("location view initializes the existing location", () => {
    const source = readFileSync(new URL("../src/components/forms/ServiceLocationForm.jsx", import.meta.url), "utf8");
    const init = source.slice(source.indexOf("const getInitialState ="), source.indexOf("const ServiceLocationForm ="));
    const call = source.match(/\(\) => (getInitialState\(location, [^\n]+\))/)[1];
    const result = new Function("location", "isEditMode", "isViewMode", "EMPTY_FORM", `${init}; return ${call};`)(
        { name: "Office", region: "Bicol", city: "Legazpi", latitude: 0, longitude: 0 }, false, true, {});
    assert.equal(result.name, "Office");
    assert.equal(result.city, "Legazpi");
    assert.equal(result.latitude, 0);
});

test("fee rule view initializes saved fees and range", () => {
    const source = readFileSync(new URL("../src/components/forms/DistanceFeeRuleForm.jsx", import.meta.url), "utf8");
    const init = source.slice(source.indexOf("const getInitialState ="), source.indexOf("const DistanceFeeRuleForm ="));
    const call = source.match(/\(\) => (getInitialState\(rule, [^\n]+\))/)[1];
    const result = new Function("rule", "isEditMode", "isViewMode", "EMPTY_FORM", `${init}; return ${call};`)(
        { minDistanceKm: 5, maxDistanceKm: 10, pickupFee: 100, returnFee: 150, enabled: false }, false, true, {});
    assert.equal(result.minDistanceKm, 5);
    assert.equal(result.pickupFee, 100);
    assert.equal(result.enabled, false);
});

test("moving a map pin clears stale address fields before lookup completes", () => {
    const source = readFileSync(new URL("../src/components/forms/ServiceLocationForm.jsx", import.meta.url), "utf8");
    const start = source.indexOf("// A new pin invalidates");
    const reset = source.slice(start, source.indexOf("                            try {", start));
    let form = { name: "Office", address: "Old street", region: "Old region", city: "Old city", province: "Old province", barangay: "Old barangay" };
    new Function("setFormData", "coords", reset)((update) => { form = update(form); }, { latitude: 13, longitude: 123 });
    for (const field of ["address", "region", "province", "city", "barangay"]) assert.equal(form[field], "");
    assert.equal(form.name, "Office");
    assert.equal(form.latitude, 13);
});

test("manual address changes invalidate the pin while unrelated edits preserve it", () => {
    const source = readFileSync(new URL("../src/components/forms/ServiceLocationForm.jsx", import.meta.url), "utf8");
    const handlers = source.slice(source.indexOf("    const handleSelectChange ="), source.indexOf("    const missingRequiredCoordinates ="));
    const original = { region: "Bicol", province: "Albay", city: "Legazpi", barangay: "Old", address: "Old street", latitude: 13, longitude: 123 };
    let data;
    const api = new Function("setFormData", `${handlers}; return {handleSelectChange, handleChange};`)((update) => { data = update(data); });
    for (const field of ["region", "province", "city", "barangay"]) {
        data = { ...original };
        api.handleSelectChange(field)({ target: { value: "Changed" } });
        assert.equal(data.latitude, "");
        assert.equal(data.longitude, "");
    }
    data = { ...original };
    api.handleChange({ target: { name: "address", value: "New street", type: "text" } });
    assert.equal(data.latitude, "");
    for (const field of ["name", "pickupFee"]) {
        data = { ...original };
        api.handleChange({ target: { name: field, value: "Changed", type: "text" } });
        assert.equal(data.latitude, 13);
    }
    data = { ...original };
    api.handleSelectChange("city")({ target: { value: original.city } });
    assert.equal(data.latitude, 13);
});

test("coordinate requirement applies to enabled distance-priced locations and accepts zero", () => {
    const source = readFileSync(new URL("../src/components/forms/ServiceLocationForm.jsx", import.meta.url), "utf8");
    const check = source.slice(source.indexOf("    const missingRequiredCoordinates ="), source.indexOf("    const handleSubmit ="));
    const required = new Function("coordinatesRequired", "formData", `${check}; return missingRequiredCoordinates;`);
    assert.equal(required(true, { enabled: true, latitude: "", longitude: "" }), true);
    assert.equal(required(false, { enabled: true, latitude: "", longitude: "" }), false);
    assert.equal(required(true, { enabled: false, latitude: "", longitude: "" }), false);
    assert.equal(required(true, { enabled: true, latitude: 0, longitude: 0 }), false);
});

test("manual lookup recovery can confirm the retained pin without erasing address fields", () => {
    const source = readFileSync(new URL("../src/components/forms/ServiceLocationForm.jsx", import.meta.url), "utf8");
    const fragment = source.slice(source.indexOf("    const handleSelectChange ="), source.indexOf("    const missingRequiredCoordinates ="));
    const pin = { latitude: 0, longitude: 123 };
    let form = { ...pin, enabled: true, region: "", province: "", city: "", address: "" };
    const busy = { current: false };
    const api = new Function("setFormData", "selectedPin", "loading", "isViewMode", "mapLoadingRef",
        `${fragment}; return {handleSelectChange, handleChange, confirmSelectedPin};`)(
        (update) => { form = update(form); }, pin, false, false, busy);
    for (const [field, value] of [["region", "Bicol"], ["province", "Albay"], ["city", "Legazpi"]]) {
        api.handleSelectChange(field)({ target: { value } });
    }
    api.handleChange({ target: { name: "address", value: "Manually completed street", type: "text" } });
    assert.equal(form.latitude, "");
    busy.current = true;
    api.confirmSelectedPin();
    assert.equal(form.latitude, "");
    busy.current = false;
    api.confirmSelectedPin();
    assert.equal(form.latitude, 0);
    assert.equal(form.longitude, 123);
    assert.equal(form.city, "Legazpi");
    assert.equal(form.address, "Manually completed street");
    api.handleChange({ target: { name: "address", value: "Another street", type: "text" } });
    assert.equal(form.latitude, "");
});
