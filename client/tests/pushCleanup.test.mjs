import test from "node:test";
import assert from "node:assert/strict";
import { stopBrowserPushOnLogout } from "../src/utils/pushCleanup.js";
const browser = (t, value) => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { configurable: true, value });
    t.after(() => Object.defineProperty(globalThis, "navigator", previous));
};

test("logout unsubscribes this browser and dismisses existing desktop notifications", async (t) => {
    const calls = [];
    browser(t, { serviceWorker: { getRegistration: async () => ({
        pushManager: { getSubscription: async () => ({ unsubscribe: async () => calls.push("unsubscribe") }) },
        getNotifications: async () => [{ close: () => calls.push("close") }],
    }) } });
    await stopBrowserPushOnLogout();
    assert.deepEqual(calls, ["unsubscribe", "close"]);
});

test("browser cleanup failure does not reject logout", async (t) => {
    browser(t, { serviceWorker: { getRegistration: async () => { throw new Error("browser unavailable"); } } });
    await assert.doesNotReject(stopBrowserPushOnLogout());
});

test("a stuck browser API does not block logout", async (t) => {
    browser(t, { serviceWorker: { getRegistration: () => new Promise(() => {}) } });
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cleanup = stopBrowserPushOnLogout();
    t.mock.timers.tick(1500);
    await cleanup;
});
