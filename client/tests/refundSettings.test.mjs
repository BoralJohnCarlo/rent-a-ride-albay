import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveCancellationPolicy } from "../src/utils/cancellationPolicy.js";
import { buildRefundSettingsPatch, normalizeRefundSettings } from "../src/utils/refundSettingsPatch.js";

const source = readFileSync(new URL("../src/pages/admin/settings/RefundSettings.jsx", import.meta.url), "utf8");

test("failed refund loading stays blocked and retry preserves loaded policy values", async () => {
    const effect = source.slice(source.indexOf("        let active = true;"), source.indexOf("    }, [getSettings, loadAttempt]);"));
    let state, local;
    const run = new Function("getSettings", "setLoadState", "setLocalSettings", "resolveCancellationPolicy", "DEFAULT_NO_SHOW_GRACE_HOURS", "setSavedSettings", "normalizeRefundSettings", effect);
    const load = (unwrap) => run(() => ({ unwrap }), (v) => state = v, (v) => local = v, resolveCancellationPolicy, 4, () => {}, normalizeRefundSettings);
    load(async () => { throw "offline"; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(local, undefined);
    load(async () => ({ data: { refundSettings: { autoApproveRefundThreshold: 100 }, earlyReturnSettings: { enabled: false, voucherValidityMonths: 6 } } }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(local.refundSettings.autoApproveRefundThreshold, 100);
    assert.equal(local.earlyReturnSettings.enabled, false);
    assert.equal(local.earlyReturnSettings.voucherValidityMonths, 6);
    assert.equal(local.earlyReturnSettings.minUnusedDaysToQualify, 1);
});

test("two stale editors saving different refund options preserve both changes", () => {
    const baseline = { refundSettings: { autoApproveRefundThreshold: 500, noShowRefundPercent: 0 }, earlyReturnSettings: { enabled: true } };
    const first = { ...baseline, refundSettings: { ...baseline.refundSettings, autoApproveRefundThreshold: 100 } };
    const second = { ...baseline, refundSettings: { ...baseline.refundSettings, noShowRefundPercent: 50 } };
    const firstPatch = buildRefundSettingsPatch(first, baseline);
    const secondPatch = buildRefundSettingsPatch(second, baseline);
    assert.deepEqual(firstPatch, { refundSettings: { autoApproveRefundThreshold: 100 } });
    assert.deepEqual(secondPatch, { refundSettings: { noShowRefundPercent: 50 } });
    assert.deepEqual({ ...baseline.refundSettings, ...firstPatch.refundSettings, ...secondPatch.refundSettings },
        { autoApproveRefundThreshold: 100, noShowRefundPercent: 50 });
});

test("successful saves refresh both form and baseline from the server response", async () => {
    const handler = source.slice(source.indexOf("    const handleSave = async ("), source.indexOf('    if (loadState === "error")'));
    const baseline = normalizeRefundSettings({});
    const draft = { ...baseline, refundSettings: { ...baseline.refundSettings, noShowRefundPercent: 50 } };
    const authoritative = { refundSettings: { ...draft.refundSettings, autoApproveRefundThreshold: 100 } };
    let displayed, saved, successes = 0;
    const { getCancellationPolicyError } = await import("../src/utils/cancellationPolicy.js");
    const build = new Function("loadState", "saving", "localSettings", "savedSettings", "getCancellationPolicyError",
        "buildRefundSettingsPatch", "setSaving", "updateSettings", "toast", "setSavedSettings", "setLocalSettings", "normalizeRefundSettings",
        `${handler}; return handleSave;`);
    const run = (result) => build("ready", false, draft, baseline, getCancellationPolicyError, buildRefundSettingsPatch,
        () => {}, async () => result, { success: () => successes++, error: () => {} },
        (value) => saved = value, (value) => displayed = value, normalizeRefundSettings)();
    await run({ meta: { requestStatus: "fulfilled" }, payload: { data: authoritative } });
    assert.equal(displayed.refundSettings.autoApproveRefundThreshold, 100);
    assert.equal(saved.refundSettings.autoApproveRefundThreshold, 100);
    assert.equal(displayed.earlyReturnSettings.voucherValidityMonths, 12);
    assert.deepEqual(buildRefundSettingsPatch(displayed, saved), {});
    assert.equal(successes, 1);
    displayed = undefined;
    saved = undefined;
    await run({ meta: { requestStatus: "rejected" } });
    assert.equal(displayed, undefined);
    assert.equal(saved, undefined);
    assert.equal(successes, 1);
    await run({ meta: { requestStatus: "fulfilled" }, payload: {} });
    assert.equal(displayed, undefined);
    assert.equal(saved, undefined);
    assert.equal(successes, 1);
});

test("nested policy patches preserve unrelated fields, empty tiers, false and zero", () => {
    const baseline = { refundSettings: { cancellationPolicy: { approvalGraceHours: 12, fullRefundBeforeApproval: true, tiers: [{ hoursBefore: 24, refundPercent: 50 }] } }, earlyReturnSettings: { enabled: true } };
    const current = { refundSettings: { cancellationPolicy: { ...baseline.refundSettings.cancellationPolicy, approvalGraceHours: 0, tiers: [] } }, earlyReturnSettings: { enabled: false } };
    assert.deepEqual(buildRefundSettingsPatch(current, baseline), {
        refundSettings: { cancellationPolicy: { approvalGraceHours: 0, tiers: [] } }, earlyReturnSettings: { enabled: false },
    });
    assert.deepEqual(buildRefundSettingsPatch(current, current), {});
});

test("refund and early-return edits are blocked during save or failed loading", () => {
    const handlers = source.slice(source.indexOf("    const handleChange ="), source.indexOf("    /*\n     * `updater`"));
    for (const [loadState, saving, expected] of [["error", false, 0], ["ready", true, 0], ["ready", false, 2]]) {
        let changes = 0;
        const api = new Function("loadState", "saving", "setLocalSettings", `${handlers};return {handleChange,handleEarlyReturnChange};`)(loadState, saving, () => changes++);
        api.handleChange("autoApproveRefundThreshold", 500);
        api.handleEarlyReturnChange("enabled", false);
        assert.equal(changes, expected);
    }
});
