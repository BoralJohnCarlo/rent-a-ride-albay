import test from "node:test";
import assert from "node:assert/strict";
import reducer, { telemetryReceived, heartbeatReceived } from "../src/store/gps/gpsSlice.js";
import { acquireGpsSubscription } from "../src/utils/gpsSubscription.js";

const reading = (minute, extras = {}) => ({ vehicleId: "vehicle-1", latitude: minute, longitude: 123,
    recordedAt: `2026-11-10T01:${String(minute).padStart(2, "0")}:00Z`, receivedAt: `2026-11-10T01:${String(minute).padStart(2, "0")}:01Z`, ...extras });
const seed = () => reducer(undefined, telemetryReceived(reading(20)));

test("delayed REST seeds and equal timestamps cannot replace the live position", () => {
    let state = seed();
    state = reducer(state, telemetryReceived(reading(10, { receivedAt: "2026-11-10T02:00:00Z" })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
    assert.equal(state.byVehicleId["vehicle-1"].lastSeenAt, "2026-11-10T02:00:00Z");
    state = reducer(state, telemetryReceived(reading(20, { latitude: 99 })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
    state = reducer(state, telemetryReceived(reading(21)));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 21);
    assert.equal(state.byVehicleId["vehicle-1"].lastSeenAt, "2026-11-10T02:00:00Z");
});

test("heartbeats preserve position, survive REST seeding and ignore invalid dates", () => {
    let state = reducer(undefined, heartbeatReceived({ vehicleId: "vehicle-1", lastSeenAt: "2026-11-10T02:00:00Z" }));
    state = reducer(state, telemetryReceived(reading(10)));
    assert.equal(state.byVehicleId["vehicle-1"].lastSeenAt, "2026-11-10T02:00:00Z");
    const previous = state;
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", lastSeenAt: "invalid" }));
    state = reducer(state, telemetryReceived(reading(30, { recordedAt: "invalid" })));
    assert.deepEqual(state, previous);
});

test("logout, expiry and new login clear GPS memory; failed logout retains the session", () => {
    for (const type of ["auth/logout/fulfilled", "auth/sessionEnded", "auth/getCurrentUser/rejected", "auth/login/fulfilled"]) {
        assert.deepEqual(reducer(seed(), { type }).byVehicleId, {});
    }
    assert.deepEqual(reducer(seed(), { type: "auth/logout/rejected" }), seed());
});

test("late responses cannot refill the GPS cache after sign-out; a new session can track", () => {
    let state = reducer(seed(), { type: "auth/sessionEnded" });
    state = reducer(state, telemetryReceived(reading(21)));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", lastSeenAt: "2026-11-10T03:00:00Z" }));
    assert.deepEqual(state.byVehicleId, {});
    state = reducer(state, { type: "auth/getCurrentUser/fulfilled", payload: { data: { _id: "new-user" } } });
    state = reducer(state, telemetryReceived(reading(22)));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 22);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
const fixture = () => {
    const socket = {};
    const pending = [];
    const leaves = [];
    const acquire = () => acquireGpsSubscription(socket, "vehicle-1", () => new Promise(resolve => pending.push(resolve)), id => leaves.push(id));
    return { acquire, pending, leaves };
};

test("a subscription acknowledged after unmount is left again", async () => {
    const f = fixture();
    const release = f.acquire();
    await flush();
    release();
    f.pending[0]({ success: true });
    await flush();
    assert.equal(f.leaves.length, 2);
    release();
    assert.equal(f.leaves.length, 2, "cleanup is idempotent");
});

test("rapid remount and out-of-order acknowledgements do not evict the new consumer", async () => {
    const f = fixture();
    const first = f.acquire(); await flush(); first();
    const second = f.acquire(); await flush();
    f.pending[1]({ success: true }); await flush();
    f.pending[0]({ success: true }); await flush();
    assert.equal(f.leaves.length, 1, "old acknowledgement left the active room");
    second();
    assert.equal(f.leaves.length, 2);
});

test("overlapping consumers retain their subscription until the last one leaves", async () => {
    const f = fixture();
    const first = f.acquire(), second = f.acquire(); await flush();
    assert.equal(f.pending.length, 1);
    f.pending[0]({ success: true }); await flush();
    first(); assert.equal(f.leaves.length, 0);
    second(); assert.equal(f.leaves.length, 1);
});

test("a failed subscription does not prevent a later mount from subscribing", async () => {
    const f = fixture();
    const first = f.acquire(); await flush();
    f.pending[0]({ success: false }); await flush(); first();
    const second = f.acquire(); await flush();
    assert.equal(f.pending.length, 2);
    f.pending[1]({ success: true }); await flush(); second();
});
