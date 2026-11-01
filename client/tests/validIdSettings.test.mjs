import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeValidIdSettings, buildValidIdSettingsPatch } from "../src/utils/validIdSettings.js";

const source = readFileSync(new URL("../src/pages/admin/settings/ValidIdRenewalSettings.jsx", import.meta.url), "utf8");

test("failed valid ID loading stays blocked and retry refreshes draft and baseline", async () => {
    const effect = source.slice(source.indexOf("        let active = true;"), source.indexOf("    }, [getSettings, loadAttempt]);"));
    let state, draft, baseline;
    const run = new Function("getSettings", "setLoadState", "setLocalSettings", "setSavedSettings", "normalizeValidIdSettings", effect);
    const load = (unwrap) => run(() => ({ unwrap }), (value) => state = value,
        (value) => draft = value, (value) => baseline = value, normalizeValidIdSettings);
    load(async () => { throw "offline"; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(draft, undefined);
    load(async () => ({ data: { validIdRenewalSettings: { maxAttempts: 5 } } }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(draft.validIdRenewalSettings.maxAttempts, 5);
    assert.equal(draft.validIdExpirationSettings.firstReminderDays, 30);
    assert.deepEqual(buildValidIdSettingsPatch(draft, baseline), {});
});

test("valid ID form ignores edits during saves and failed loads", () => {
    const handlers = source.slice(source.indexOf("    const handleSwitchChange ="), source.indexOf("    const handleSave ="));
    for (const [loadState, saving, expected] of [["error", false, 0], ["ready", true, 0], ["ready", false, 3]]) {
        let edits = 0;
        const api = new Function("loadState", "saving", "setLocalSettings", `${handlers};return {handleSwitchChange,handleExpirationNumberChange,handleChange};`)(loadState, saving, () => edits++);
        api.handleSwitchChange("enabled", { target: { checked: true } });
        api.handleExpirationNumberChange("firstReminderDays", 60);
        api.handleChange("maxAttempts", 5);
        assert.equal(edits, expected);
    }
});

test("stale valid ID editors send only independent changes", () => {
    const baseline = normalizeValidIdSettings({});
    const first = { ...baseline, validIdRenewalSettings: { ...baseline.validIdRenewalSettings, maxAttempts: 5 } };
    const second = { ...baseline, validIdExpirationSettings: { ...baseline.validIdExpirationSettings, enabled: true } };
    assert.deepEqual(buildValidIdSettingsPatch(first, baseline), { validIdRenewalSettings: { maxAttempts: 5 } });
    assert.deepEqual(buildValidIdSettingsPatch(second, baseline), { validIdExpirationSettings: { enabled: true } });
});
