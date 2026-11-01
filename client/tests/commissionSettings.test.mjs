import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { normalizeCommissionSettings, buildCommissionSettingsPatch, getCommissionSettingsError } from "../src/utils/commissionSettings.js";

const source = readFileSync(new URL("../src/pages/admin/settings/CommissionSettings.jsx", import.meta.url), "utf8");
test("commission loading catches failure and retry sets draft and baseline", async () => {
    const effect = source.slice(source.indexOf("        let active = true;"), source.indexOf("    }, [loadPayoutSettings, loadAttempt]);"));
    let state, local, baseline;
    const run = new Function("loadPayoutSettings", "setLoadState", "setLocalSettings", "setBaseline", "normalizeCommissionSettings", effect);
    const load = (fetch) => run(fetch, (value) => state = value, (value) => local = value, (value) => baseline = value, normalizeCommissionSettings);
    load(async () => { throw "offline"; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(local, undefined);
    load(async () => ({ data: { platformCommissionRate: 15, payoutHoldHours: 72 } }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(local.payoutCurrency, "PHP");
    assert.deepEqual(buildCommissionSettingsPatch(local, baseline), {});
});

test("stale editors send only their changed commission fields", () => {
    const baseline = normalizeCommissionSettings({});
    assert.deepEqual(buildCommissionSettingsPatch({ ...baseline, platformCommissionRate: 0 }, baseline), { platformCommissionRate: 0 });
    assert.deepEqual(buildCommissionSettingsPatch({ ...baseline, payoutHoldHours: 72 }, baseline), { payoutHoldHours: 72 });
    assert.equal(getCommissionSettingsError({ ...baseline, payoutHoldHours: 1e100 }) !== null, true);
    assert.equal(getCommissionSettingsError({ ...baseline, payoutHoldHours: 0, platformCommissionRate: 0 }), null);
});

test("commission form ignores edits during saving or failed loads", () => {
    const handler = source.slice(source.indexOf("    const handleChange ="), source.indexOf("    const handleSave ="));
    for (const [loadState, saving, expected] of [["error", false, 0], ["ready", true, 0], ["ready", false, 1]]) {
        let edits = 0;
        const change = new Function("loadState", "saving", "setLocalSettings", `${handler};return handleChange;`)(loadState, saving, () => edits++);
        change("payoutHoldHours", 72);
        assert.equal(edits, expected);
    }
});
