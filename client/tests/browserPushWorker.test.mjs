import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/push-sw.js", import.meta.url), "utf8");
const worker = (globals = {}) => {
    const handlers = {};
    const shown = [];
    const opened = [];
    const self = {
        location: { origin: "https://rent.example" },
        addEventListener: (type, handler) => { handlers[type] = handler; },
        registration: { showNotification: async (...args) => shown.push(args) },
        clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) },
    };
    vm.runInNewContext(source, { self, URL, ...globals });
    return { handlers, shown, opened, self };
};

test("a push displays a persistent notification with a stable deduplication tag", async () => {
    const { handlers, shown } = worker();
    let pending;
    handlers.push({ data: { json: () => ({ body: "Important update", tag: "notification-id", url: "/customer/notifications" }) }, waitUntil: (promise) => { pending = promise; } });
    await pending;
    assert.equal(shown.length, 1);
    assert.equal(shown[0][1].tag, "notification-id");
    assert.equal(shown[0][1].data.url, "/customer/notifications");
});

test("clicking a notification opens its same-origin destination", async () => {
    const { handlers, opened } = worker();
    let pending;
    handlers.notificationclick({ notification: { close() {}, data: { url: "/operator/notifications" } }, waitUntil: (promise) => { pending = promise; } });
    await pending;
    assert.deepEqual(opened, ["https://rent.example/operator/notifications"]);
});

test("external notification destinations cannot navigate a browser window", () => {
    const { handlers, opened } = worker();
    handlers.notificationclick({ notification: { close() {}, data: { url: "https://evil.example" } }, waitUntil: () => assert.fail("external navigation scheduled") });
    assert.equal(opened.length, 0);
});

for (const blocked of [false, true]) {
    test(`an important alert still displays when browser receipt storage is ${blocked ? "blocked" : "unavailable"}`, async () => {
        const { handlers, shown } = worker({
            setTimeout, clearTimeout,
            indexedDB: { open() {
                if (!blocked) throw new Error("Storage unavailable");
                const request = { get error() { throw new Error("Cannot read a pending IDB request's error"); } };
                queueMicrotask(() => request.onblocked());
                return request;
            } },
        });
        let pending;
        handlers.push({ data: { json: () => ({ tag: "retry-id", body: "Important update", expiresAt: Date.now() + 60_000 }) }, waitUntil: (promise) => { pending = promise; } });
        await pending;
        assert.equal(shown.length, 1);
        assert.equal(shown[0][1].renotify, false);
    });
}

test("an alert past its delivery window is not displayed", async () => {
    const { handlers, shown } = worker();
    let pending;
    handlers.push({ data: { json: () => ({ tag: "expired", expiresAt: Date.now() - 1000 }) }, waitUntil: (promise) => { pending = promise; } });
    await pending;
    assert.equal(shown.length, 0);
});

for (const stalled of ["read", "write"]) {
    test(`a stalled receipt ${stalled} times out and does not block the next alert`, async (t) => {
        t.mock.timers.enable({ apis: ["setTimeout"] });
        let aborted = 0;
        let closed = 0;
        const database = {
            close() { closed++; },
            transaction() {
                const transaction = {
                    abort() { aborted++; transaction.onabort?.(); },
                    objectStore: () => ({
                        get() {
                            const request = { result: undefined };
                            if (stalled !== "read") queueMicrotask(() => {
                                request.onsuccess?.();
                                queueMicrotask(() => transaction.oncomplete?.());
                            });
                            return request;
                        },
                        put() {}, openCursor: () => ({}),
                    }),
                };
                return transaction;
            },
        };
        const { handlers, shown } = worker({ setTimeout, clearTimeout, indexedDB: { open() {
            const request = { result: database };
            queueMicrotask(() => request.onsuccess());
            return request;
        } } });
        const promises = [];
        for (let i = 0; i < 2; i++) handlers.push({
            data: { json: () => ({ tag: `stalled-${stalled}-${i}`, expiresAt: Date.now() + 60_000 }) },
            waitUntil: (promise) => promises.push(promise),
        });
        for (let step = 0; step < 4; step++) {
            await new Promise(setImmediate);
            t.mock.timers.tick(1500);
        }
        await Promise.all(promises);
        assert.equal(shown.length, 2);
        assert.equal(aborted, 2);
        assert.equal(closed, 2);
    });
}
