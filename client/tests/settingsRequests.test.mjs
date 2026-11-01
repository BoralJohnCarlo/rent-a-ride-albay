import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { configureStore, createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { queueSettingsRequest } from "../src/utils/settingsRequestQueue.js";

const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
};

test("overlapping saves and a read finish in order without restoring an old snapshot", async () => {
    const first = deferred();
    const calls = [];
    let saved = { buffer: 120, pickup: "08:00" };
    const context = {
        createSlice, createAsyncThunk, queueSettingsRequest,
        DEFAULT_CANCELLATION_POLICY: {},
        fetchSettings: async () => { calls.push("read"); return { data: { ...saved } }; },
        updateSettingsAction: async (changes) => {
            calls.push(changes.buffer ? "buffer" : "pickup");
            if (changes.buffer) await first.promise;
            saved = { ...saved, ...changes };
            return { data: { ...saved } };
        },
    };
    const source = readFileSync(new URL("../src/store/settings/settingsSlice.js", import.meta.url), "utf8")
        .replace(/import[\s\S]*?from\s+"[^"]+";/g, "")
        .replace(/export const /g, "const ")
        .replace("export default settingsSlice.reducer;",
            "globalThis.api = { reducer: settingsSlice.reducer, getSettings, updateSettings };");
    vm.createContext(context);
    vm.runInContext(source, context);
    const { api } = context;
    const store = configureStore({ reducer: api.reducer });
    const buffer = store.dispatch(api.updateSettings({ buffer: 180 }));
    const pickup = store.dispatch(api.updateSettings({ pickup: "09:00" }));
    const read = store.dispatch(api.getSettings());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, ["buffer"]);
    assert.equal(store.getState().loading, true);
    first.resolve();
    await Promise.all([buffer.unwrap(), pickup.unwrap(), read.unwrap()]);
    assert.deepEqual(calls, ["buffer", "pickup", "read"]);
    assert.equal(store.getState().settings.buffer, 180);
    assert.equal(store.getState().settings.pickup, "09:00");
    assert.equal(store.getState().loading, false);
    assert.equal(store.getState().pendingRequests, 0);
});

test("failed settings requests do not block retries", async () => {
    const failed = queueSettingsRequest(async () => { throw new Error("offline"); });
    const retry = queueSettingsRequest(async () => "saved");
    await assert.rejects(failed, /offline/);
    assert.equal(await retry, "saved");
});

test("booking-hour examples distinguish tomorrow from several days later", () => {
    const source = readFileSync(new URL("../src/pages/admin/settings/BookingSettings.jsx", import.meta.url), "utf8");
    const formatSource = source.slice(source.indexOf("function formatClock("), source.indexOf("export default BookingSettings;"));
    const format = new Function(`${formatSource}; return formatClock;`)();
    assert.equal(format(570), "9:30 AM");
    assert.equal(format(1440 + 570), "9:30 AM the next day");
    assert.equal(format(4 * 1440 + 570), "9:30 AM in 4 days");
});
