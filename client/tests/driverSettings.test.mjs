import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeDriverSettings, buildDriverSettingsPatch } from "../src/utils/driverSettings.js";

const source = readFileSync(new URL("../src/pages/admin/settings/DriverSettings.jsx", import.meta.url), "utf8");

test("failed driver loading stays blocked and retry uses server values", async () => {
    const effect = source.slice(source.indexOf("        let active = true;"), source.indexOf("    }, [getSettings, loadAttempt]);"));
    let state, draft, baseline;
    const run = new Function("getSettings", "setLoadState", "setLocalSettings", "setSavedSettings", "normalizeDriverSettings", effect);
    const load = (unwrap) => run(() => ({ unwrap }), (value) => state = value,
        (value) => draft = value, (value) => baseline = value, normalizeDriverSettings);
    load(async () => { throw "offline"; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(draft, undefined);
    load(async () => ({ data: { driverPricingSettings: { globalDailyRate: 500 } } }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(draft.driverPricingSettings.globalDailyRate, 500);
    assert.equal(draft.driverAssignmentSettings.motorcycleDriversEnabled, true);
    assert.deepEqual(buildDriverSettingsPatch(draft, baseline), {});
});

test("driver form edits are blocked while saving and before loading", () => {
    const handlers = source.slice(source.indexOf("    const handleToggle ="), source.indexOf("    const handleSave ="));
    for (const [loadState, submitting, expected] of [["error", false, 0], ["ready", true, 0], ["ready", false, 3]]) {
        let changes = 0;
        const api = new Function("loadState", "submitting", "setLocalSettings", `${handlers}; return {handleToggle,handleMotorcycleDriversToggle,handlePricingChange};`)(loadState, submitting, () => changes++);
        api.handleToggle("requireAdminDriverAssignment");
        api.handleMotorcycleDriversToggle();
        api.handlePricingChange("mode", "individual");
        assert.equal(changes, expected);
    }
});

test("stale editors only send their changes, including zero and false", () => {
    const baseline = normalizeDriverSettings({ driverPricingSettings: { globalDailyRate: 500 } });
    const first = { ...baseline, driverPricingSettings: { ...baseline.driverPricingSettings, globalDailyRate: 0 } };
    const second = { ...baseline, driverAssignmentSettings: { ...baseline.driverAssignmentSettings, motorcycleDriversEnabled: false } };
    assert.deepEqual(buildDriverSettingsPatch(first, baseline), { driverPricingSettings: { globalDailyRate: 0 } });
    assert.deepEqual(buildDriverSettingsPatch(second, baseline), { driverAssignmentSettings: { motorcycleDriversEnabled: false } });
});

test("driver save refreshes its draft and baseline from the authoritative response", async () => {
    const handler = source.slice(source.indexOf("    const handleSave ="), source.indexOf("    const requireAdminDriverAssignment ="));
    const baseline = normalizeDriverSettings({ driverPricingSettings: { globalDailyRate: 500 } });
    const draft = { ...baseline, driverAssignmentSettings: { ...baseline.driverAssignmentSettings, motorcycleDriversEnabled: false } };
    let local, saved, sent;
    const authoritative = { ...draft, driverPricingSettings: { mode: "global", globalDailyRate: 100 } };
    const save = new Function("loadState", "submitting", "localSettings", "savedSettings", "buildDriverSettingsPatch", "normalizeDriverSettings",
        "setSubmitting", "updateSettings", "setLocalSettings", "setSavedSettings", "toast", `${handler};return handleSave;`)(
        "ready", false, draft, baseline, buildDriverSettingsPatch, normalizeDriverSettings, () => {},
        (patch) => { sent = patch; return { unwrap: async () => ({ data: authoritative }) }; },
        (value) => local = value, (value) => saved = value, { success() {}, error(error) { throw new Error(error); } });
    await save();
    assert.deepEqual(sent, { driverAssignmentSettings: { motorcycleDriversEnabled: false } });
    assert.equal(local.driverPricingSettings.globalDailyRate, 100);
    assert.deepEqual(buildDriverSettingsPatch(local, saved), {});
});
