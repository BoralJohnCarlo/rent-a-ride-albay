import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { pushStep, withPushDeadline } from "../src/utils/pushDeadline.js";
import { createPushCoordinator, withPushSubscriptionLock } from "../src/utils/pushCoordinator.js";
import { stopBrowserPushOnLogout } from "../src/utils/pushCleanup.js";

// Exercise the actual service with isolated browser/API substitutes.
const source = (await readFile(new URL("../src/services/browserPush.js", import.meta.url), "utf8"))
    .replace(/^import .*;\r?\n/gm, "").replaceAll("export const ", "const ") +
    "\nglobalThis.service = {getBrowserPushState, enableBrowserPush, disableBrowserPush};";
const fixture = (overrides = {}) => {
    const calls = [];
    let active = true;
    const subscription = {
        endpoint: "https://fcm.googleapis.com/wp/test",
        options: { applicationServerKey: new Uint8Array(65).fill(1) },
        toJSON: () => ({ endpoint: subscription.endpoint, keys: {} }),
        unsubscribe: async () => { calls.push("unsubscribe"); active = false; return true; },
        ...overrides.subscription,
    };
    const worker = { pushManager: {
        getSubscription: async () => active ? subscription : null,
        subscribe: async () => { calls.push("subscribe"); active = true; return subscription; },
        ...overrides.pushManager,
    } };
    const api = {
        get: async () => ({ data: { enabled: true, publicKey: "key" } }),
        post: async () => { calls.push("post"); return { data: { subscribed: true } }; },
        delete: async () => { calls.push("delete"); return {}; },
        ...overrides.api,
    };
    const browser = {
        getRegistration: async () => worker, register: async () => { calls.push("register"); return worker; },
        ready: Promise.resolve(worker), ...overrides.browser,
    };
    const context = {
        api, pushStep, withPushDeadline, Uint8Array, atob,
        withPushSubscriptionLock: overrides.coordinator || createPushCoordinator(() => null),
        navigator: { serviceWorker: browser },
        window: { isSecureContext: true, Notification: {}, PushManager: {} },
        Notification: { permission: "granted", requestPermission: async () => "granted", ...overrides.permission },
    };
    vm.runInNewContext(source, context);
    return { ...context.service, calls, subscription, browser };
};
const flush = () => new Promise(setImmediate);
const advance = async (t, ms) => { await flush(); t.mock.timers.tick(ms); await flush(); };
const publicKey = Buffer.alloc(65, 1).toString("base64url");

test("a stalled settings HTTP request times out and receives an abort signal", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let options;
    const service = fixture({ api: { get: (_url, config) => { options = config; return new Promise(() => {}); } } });
    const result = assert.rejects(service.getBrowserPushState(), /too long/i);
    await advance(t, 12_000);
    await result;
    assert.equal(options.timeout, 8000);
    assert.equal(options.signal.aborted, true);
});

test("stalled browser discovery times out", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const service = fixture({ browser: { getRegistration: () => new Promise(() => {}) } });
    const result = assert.rejects(service.getBrowserPushState(), /too long/i);
    await advance(t, 12_000);
    await result;
});

test("a service worker that never becomes ready releases Enable and cannot save later", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let becomeReady;
    const service = fixture({ browser: { ready: new Promise((resolve) => { becomeReady = resolve; }) } });
    const result = assert.rejects(service.enableBrowserPush(publicKey), /too long/i);
    await advance(t, 30_000);
    await result;
    becomeReady({ pushManager: { getSubscription: async () => null } });
    await flush();
    assert.equal(service.calls.includes("post"), false);
});

test("a dismissed-late permission prompt cannot register after Enable times out", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let permit;
    const service = fixture({ permission: { requestPermission: () => new Promise((resolve) => { permit = resolve; }) } });
    const result = assert.rejects(service.enableBrowserPush(publicKey), /too long/i);
    await advance(t, 30_000);
    await result;
    permit("granted");
    await flush();
    assert.equal(service.calls.includes("register"), false);
});

test("server cleanup failure does not prevent local unsubscribe", async () => {
    const service = fixture({ api: { delete: async () => { throw new Error("offline"); } } });
    const result = await service.disableBrowserPush();
    assert.equal(result.localDisabled, true);
    assert.equal(result.serverDisabled, false);
    assert.ok(service.calls.includes("unsubscribe"));
    assert.match(result.message, /Server cleanup could not be confirmed/);
});

test("local cleanup failure does not prevent server revocation", async () => {
    const service = fixture({ subscription: { unsubscribe: async () => { throw new Error("browser error"); } } });
    const result = await service.disableBrowserPush();
    assert.equal(result.localDisabled, false);
    assert.equal(result.serverDisabled, true);
    assert.ok(service.calls.includes("delete"));
});

test("Disable settles after a stalled server request while preserving confirmed local success", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const service = fixture({ api: { delete: () => new Promise(() => {}) } });
    const pending = service.disableBrowserPush();
    await advance(t, 8000);
    const result = await pending;
    assert.equal(result.localDisabled, true);
    assert.equal(result.serverDisabled, false);
});

test("Disable settles after a stalled browser unsubscribe while preserving confirmed server success", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const service = fixture({ subscription: { unsubscribe: () => new Promise(() => {}) } });
    const pending = service.disableBrowserPush();
    await advance(t, 4000);
    const result = await pending;
    assert.equal(result.localDisabled, false);
    assert.equal(result.serverDisabled, true);
});

test("Disable reports failure when neither cleanup succeeds", async () => {
    const service = fixture({ subscription: { unsubscribe: async () => false }, api: { delete: async () => { throw new Error("offline"); } } });
    await assert.rejects(service.disableBrowserPush(), /Could not confirm notifications are disabled/);
});

test("Enable rollback cannot hang or replace the original save error", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const service = fixture({ pushManager: { getSubscription: async () => null },
        subscription: { unsubscribe: () => new Promise(() => {}) },
        api: { post: async () => { throw new Error("save failed"); } } });
    const result = assert.rejects(service.enableBrowserPush(publicKey), /save failed/);
    await advance(t, 2000);
    await result;
});

const delayedUnsubscribe = (coordinator) => {
    let active;
    let finish;
    let saves = 0;
    const old = {
        endpoint: "https://fcm.googleapis.com/wp/old", options: { applicationServerKey: new Uint8Array(65).fill(1) },
        toJSON: () => ({ endpoint: old.endpoint }),
        unsubscribe: () => new Promise((resolve) => { finish = () => { active = null; resolve(true); }; }),
    };
    const fresh = { ...old, endpoint: "https://fcm.googleapis.com/wp/fresh", toJSON: () => ({ endpoint: fresh.endpoint }) };
    active = old;
    const service = fixture({ coordinator,
        pushManager: { getSubscription: async () => active, subscribe: async () => { active = fresh; return fresh; } },
        api: { post: async () => { saves++; return {}; } },
    });
    return { service, complete: () => finish(), active: () => active, saves: () => saves, fresh };
};

test("late unsubscribe completion cannot undo re-enable after Disable times out", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const state = delayedUnsubscribe();
    const disabling = state.service.disableBrowserPush();
    await advance(t, 4000);
    const disabled = await disabling;
    assert.equal(disabled.localDisabled, false);
    assert.equal(disabled.serverDisabled, true);
    const enabling = state.service.enableBrowserPush(publicKey);
    await flush();
    assert.equal(state.saves(), 0, "Enable must not save the subscription still being removed");
    state.complete();
    await enabling;
    assert.equal(state.saves(), 1);
    assert.equal(state.active(), state.fresh, "Enable creates a fresh subscription after the old operation settles");
});

test("Enable times out safely if old cleanup never settles; a cancelled queued Enable cannot run later", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const state = delayedUnsubscribe();
    const disabling = state.service.disableBrowserPush();
    await advance(t, 4000);
    await disabling;
    const timedOut = assert.rejects(state.service.enableBrowserPush(publicKey), /too long/i);
    await advance(t, 30_000);
    await timedOut;
    state.complete();
    await flush();
    assert.equal(state.saves(), 0, "an expired queued action must not register later");
    await state.service.enableBrowserPush(publicKey);
    assert.equal(state.active(), state.fresh);
    assert.equal(state.saves(), 1);
});

test("late logout cleanup uses the same gate and cannot unsubscribe the next login's subscription", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const state = delayedUnsubscribe(withPushSubscriptionLock);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: state.service.browser } });
    t.after(() => Object.defineProperty(globalThis, "navigator", descriptor));
    const logout = stopBrowserPushOnLogout();
    await advance(t, 1500);
    await logout;
    const enabling = state.service.enableBrowserPush(publicKey);
    await flush();
    assert.equal(state.saves(), 0);
    state.complete();
    await enabling;
    assert.equal(state.active(), state.fresh);
    assert.equal(state.saves(), 1);
});

test("a timed-out failed-save rollback cannot remove a later successful subscription", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let active = null;
    let complete;
    let saves = 0;
    let subscriptions = 0;
    const service = fixture({ pushManager: {
        getSubscription: async () => active,
        subscribe: async () => {
            const subscription = { endpoint: `https://fcm.googleapis.com/wp/${++subscriptions}`, options: { applicationServerKey: new Uint8Array(65).fill(1) },
                toJSON: () => ({ endpoint: subscription.endpoint }),
                unsubscribe: () => new Promise((resolve) => { complete = () => { active = null; resolve(true); }; }),
            };
            active = subscription;
            return subscription;
        },
    }, api: { post: async () => { if (++saves === 1) throw new Error("first save failed"); return {}; } } });
    const failed = assert.rejects(service.enableBrowserPush(publicKey), /first save failed/);
    await advance(t, 2000);
    await failed;
    const next = service.enableBrowserPush(publicKey);
    await flush();
    assert.equal(saves, 1);
    complete();
    await next;
    assert.equal(subscriptions, 2);
    assert.equal(active.endpoint, "https://fcm.googleapis.com/wp/2");
    assert.equal(saves, 2);
});
