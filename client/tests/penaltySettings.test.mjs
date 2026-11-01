import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/pages/admin/settings/PenaltySettings.jsx", import.meta.url), "utf8");

test("failed penalty loading stays blocked and retry loads actual settings", async () => {
    const effect = source.slice(source.indexOf("        let active = true;"), source.indexOf("    }, [getSettings, loadAttempt]);"));
    let state, local;
    const run = new Function("getSettings", "setLoadState", "setLocalSettings", effect);
    run(() => ({ unwrap: async () => { throw "offline"; } }), (v) => state = v, (v) => local = v);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    assert.equal(local, undefined);
    run(() => ({ unwrap: async () => ({ data: { penaltySettings: { rateMultiplier: 0 } } }) }), (v) => state = v, (v) => local = v);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.equal(local.penaltySettings.rateMultiplier, 0);
});

test("penalty draft edits are ignored before load and during save", () => {
    const handler = source.slice(source.indexOf("    const handleChange ="), source.indexOf("    const handleSave ="));
    for (const [loadState, saving, expected] of [["error", false, 0], ["ready", true, 0], ["ready", false, 1]]) {
        let changes = 0;
        const change = new Function("loadState", "saving", "setLocalSettings", `${handler};return handleChange;`)(loadState, saving, () => changes++);
        change("maximumCap", 500);
        assert.equal(changes, expected);
    }
});

test("multiplier input and saved terms preserve zero", () => {
    const input = source.slice(source.indexOf('id="rate-multiplier"'), source.indexOf('id="maximum-cap"'));
    const conversion = input.match(/Number\(\s*event\s*\.target\s*\.value\s*\)/)[0];
    assert.equal(new Function("event", `return ${conversion};`)({ target: { value: "0" } }), 0);
    assert.equal(input.includes("|| 1"), false);
    const server = readFileSync(new URL("../../server/services/legalDocumentService.js", import.meta.url), "utf8");
    const expression = server.match(/rateMultiplier: (Number\(settings\?\.penaltySettings\?\.rateMultiplier[^\n]+)/)[1].replace(/,$/, "");
    assert.equal(new Function("settings", `return ${expression};`)({ penaltySettings: { rateMultiplier: 0 } }), 0);
});

test("history failure is distinct from empty success and retries use fresh records", async () => {
    const effect = source.slice(source.indexOf("        let historyActive = true;"), source.indexOf("    }, [fetchRentals, historyLoadAttempt]);"));
    let state, records = [{ rentalCode: "old" }];
    const run = new Function("fetchRentals", "setHistoryLoadState", "setHistoryRentals", effect);
    const load = (unwrap) => run(() => ({ unwrap }), (value) => state = value, (value) => records = value);
    load(async () => { throw new Error("offline"); });
    assert.equal(state, "loading");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
    load(async () => ({ data: [] }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "ready");
    assert.deepEqual(records, []);
    load(async () => ({ data: [{ rentalCode: "fresh" }] }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(records[0].rentalCode, "fresh");
    load(async () => ({ data: null }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "error");
});

test("history ignores responses after unmount", async () => {
    const effect = source.slice(source.indexOf("        let historyActive = true;"), source.indexOf("    }, [fetchRentals, historyLoadAttempt]);"));
    let finish, records, state;
    const pending = new Promise((resolve) => { finish = resolve; });
    const cleanup = new Function("fetchRentals", "setHistoryLoadState", "setHistoryRentals", effect)(
        () => ({ unwrap: () => pending }), (value) => state = value, (value) => records = value);
    cleanup();
    finish({ data: [] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(state, "loading");
    assert.equal(records, undefined);
});
