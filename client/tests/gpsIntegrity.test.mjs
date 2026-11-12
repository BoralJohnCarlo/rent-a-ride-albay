import test from "node:test";
import assert from "node:assert/strict";
import reducer, { telemetryReceived, heartbeatReceived, vehicleTrackerAssignmentsReceived } from "../src/store/gps/gpsSlice.js";
import { acquireGpsSubscription, subscribeGpsAndRefresh } from "../src/utils/gpsSubscription.js";

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

test("fix-only heartbeats survive stale REST seeds without changing position", () => {
    let state = reducer(undefined, telemetryReceived(reading(20, { gpsFix: true })));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", lastSeenAt: "2026-11-10T02:00:00Z",
        gpsFix: false, gpsFixUpdatedAt: "2026-11-10T02:00:00Z" }));
    state = reducer(state, telemetryReceived(reading(20, { gpsFix: true })));
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, false);
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", lastSeenAt: "2026-11-10T03:00:00Z",
        gpsFix: true, gpsFixUpdatedAt: "2026-11-10T03:00:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, true);
});

test("each successful reconnect refreshes after joining; cancelled and rejected joins do not fetch", async () => {
    const events = [];
    const join = async () => { events.push("join"); return { success: true }; };
    const refresh = async () => { events.push("refresh"); };
    await subscribeGpsAndRefresh("vehicle-1", join, refresh, () => true);
    await subscribeGpsAndRefresh("vehicle-1", join, refresh, () => true);
    assert.deepEqual(events, ["join", "refresh", "join", "refresh"]);
    events.length = 0;
    await subscribeGpsAndRefresh("vehicle-1", join, refresh, () => false);
    await subscribeGpsAndRefresh("vehicle-1", async () => ({ success: false }), refresh, () => true);
    assert.deepEqual(events, ["join"]);
});

test("a fix heartbeat arriving before the REST position is preserved", () => {
    let state = reducer(undefined, heartbeatReceived({ vehicleId: "vehicle-1",
        lastSeenAt: "2026-11-10T02:00:00Z", gpsFix: false, gpsFixUpdatedAt: "2026-11-10T02:00:00Z" }));
    state = reducer(state, telemetryReceived(reading(20, { gpsFix: true })));
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, false);
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
});


test("replacement tracker heartbeats clear old coordinates and reject delayed old seeds", () => {
    let state = reducer(undefined, telemetryReceived(reading(20, { trackerId: "old", gpsFix: true })));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", trackerId: "new",
        lastSeenAt: "2026-11-10T02:00:00Z", gpsFix: false, gpsFixUpdatedAt: "2026-11-10T02:00:00Z" }));
    let current = state.byVehicleId["vehicle-1"];
    assert.equal(current.trackerId, "new");
    assert.equal(current.latitude, undefined);
    assert.equal(current.longitude, undefined);
    assert.equal(current.gpsFix, false);
    state = reducer(state, telemetryReceived(reading(20, { trackerId: "old", gpsFix: true })));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", trackerId: "old", lastSeenAt: "2026-11-10T01:59:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].latitude, undefined);
    // The replacement's valid earlier device timestamp must not be compared
    // with the old device's clock. Its own heartbeat fix remains authoritative.
    state = reducer(state, telemetryReceived(reading(10, { trackerId: "new", gpsFix: true })));
    current = state.byVehicleId["vehicle-1"];
    assert.equal(current.latitude, 10);
    assert.equal(current.trackerId, "new");
    assert.equal(current.gpsFix, false);
});

test("first heartbeats retain tracker identity and stale foreign events cannot replace it", () => {
    let state = reducer(undefined, heartbeatReceived({ vehicleId: "vehicle-1", trackerId: "new", lastSeenAt: "2026-11-10T02:00:00Z" }));
    state = reducer(state, telemetryReceived(reading(20, { trackerId: "old" })));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].latitude, undefined);
});

test("a replacement position does not inherit the old tracker's fix or clock", () => {
    let state = reducer(undefined, telemetryReceived(reading(30, { trackerId: "old", gpsFix: false })));
    state = reducer(state, telemetryReceived(reading(10, { trackerId: "new", gpsFix: true, receivedAt: "2026-11-10T02:00:00Z" })));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10);
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, true);
});

test("a second mounted consumer retries a failed join without evicting the first", async () => {
    const f = fixture();
    const first = f.acquire(); await flush();
    f.pending[0]({ success: false }); await flush();
    const second = f.acquire(); await flush();
    assert.equal(f.pending.length, 2);
    f.pending[1]({ success: true }); await flush();
    first(); assert.equal(f.leaves.length, 0);
    second(); assert.equal(f.leaves.length, 1);
});

test("failed and thrown joins retry with backoff, then stop after success", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let calls = 0;
    const release = acquireGpsSubscription({}, "vehicle-1", async () => {
        calls++;
        if (calls === 1) throw new Error("temporary network failure");
        return { success: calls >= 3 };
    }, () => {});
    try {
        await flush(); assert.equal(calls, 1);
        t.mock.timers.tick(999); await flush(); assert.equal(calls, 1);
        t.mock.timers.tick(1); await flush(); assert.equal(calls, 2);
        t.mock.timers.tick(1999); await flush(); assert.equal(calls, 2);
        t.mock.timers.tick(1); await flush(); assert.equal(calls, 3);
        t.mock.timers.tick(60000); await flush(); assert.equal(calls, 3);
    } finally { release(); }
});

test("retries use a remaining consumer and are cancelled when the last screen leaves", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = {};
    let firstCalls = 0, secondCalls = 0;
    let resolveFirst;
    const first = acquireGpsSubscription(socket, "vehicle-1", () => {
        firstCalls++;
        return new Promise(resolve => { resolveFirst = resolve; });
    }, () => {});
    const second = acquireGpsSubscription(socket, "vehicle-1", async () => {
        secondCalls++;
        return { success: false };
    }, () => {});
    await flush(); first(); resolveFirst({ success: false }); await flush();
    t.mock.timers.tick(1000); await flush();
    assert.equal(firstCalls, 1);
    assert.equal(secondCalls, 1);
    second();
    t.mock.timers.tick(60000); await flush();
    assert.equal(secondCalls, 1);
});

test("fix-only REST snapshots restore loss without inventing a position", () => {
    let state = reducer(undefined, telemetryReceived({ vehicleId: "vehicle-1", trackerId: "tracker-1",
        latitude: null, longitude: null, recordedAt: null, gpsFix: false,
        receivedAt: "2026-11-10T01:00:00Z", lastSeenAt: "2026-11-10T02:00:00Z", gpsFixUpdatedAt: "2026-11-10T02:00:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, false);
    assert.equal(state.byVehicleId["vehicle-1"].latitude, null);
    state = reducer(state, telemetryReceived(reading(20, { trackerId: "tracker-1", gpsFix: true })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, false);
    state = reducer(state, telemetryReceived({ vehicleId: "vehicle-1", trackerId: "tracker-1",
        latitude: null, longitude: null, recordedAt: null, gpsFix: false, receivedAt: "2026-11-10T01:00:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 20);
});


test("admin assignment accepts a replacement with an older AIKA contact and rejects the old device", () => {
    let state = reducer(undefined, { type: "tracker/getTrackers/pending", meta: { requestId: "initial-list" } });
    state = reducer(state, { type: "tracker/getTrackers/fulfilled", meta: { requestId: "initial-list" }, payload: { data: [
        { _id: "old", vehicle: "vehicle-1" }, { _id: "new", vehicle: null },
    ] } });
    state = reducer(state, telemetryReceived(reading(30, { trackerId: "old", gpsFix: false })));
    state = reducer(state, { type: "tracker/assignTracker/fulfilled", payload: { data: { _id: "new", vehicle: "vehicle-1" } } });
    assert.equal(state.byVehicleId["vehicle-1"], undefined);
    state = reducer(state, telemetryReceived(reading(10, { trackerId: "new", gpsFix: true, source: "aika" })));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10);
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, true);
    // Even a later arrival/contact cannot restore the replaced tracker.
    state = reducer(state, telemetryReceived(reading(40, { trackerId: "old" })));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", trackerId: "old", lastSeenAt: "2026-11-10T04:00:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10);
    state = reducer(state, telemetryReceived(reading(9, { trackerId: "new" })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10, "same-device chronology remains enforced");
});

test("fleet assignments accept older-contact replacement heartbeats without old coordinates", () => {
    let state = reducer(undefined, telemetryReceived(reading(30, { trackerId: "old" })));
    state = reducer(state, vehicleTrackerAssignmentsReceived([{ vehicleId: "vehicle-1", trackerId: "new" }]));
    state = reducer(state, heartbeatReceived({ vehicleId: "vehicle-1", trackerId: "new", lastSeenAt: "2026-11-10T01:10:00Z",
        gpsFix: false, gpsFixUpdatedAt: "2026-11-10T01:10:00Z" }));
    assert.equal(state.byVehicleId["vehicle-1"].trackerId, "new");
    assert.equal(state.byVehicleId["vehicle-1"].gpsFix, false);
    assert.equal(state.byVehicleId["vehicle-1"].latitude, undefined);
    state = reducer(state, telemetryReceived(reading(30, { trackerId: "old" })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, undefined);
    state = reducer(state, telemetryReceived(reading(10, { trackerId: "new" })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10);
});

test("unassignment and reassignment clear obsolete caches and refuse late packets", () => {
    let state = reducer(undefined, { type: "tracker/getTrackers/pending", meta: { requestId: "initial-list" } });
    state = reducer(state, { type: "tracker/getTrackers/fulfilled", meta: { requestId: "initial-list" }, payload: { data: [{ _id: "tracker", vehicle: "vehicle-1" }] } });
    state = reducer(state, telemetryReceived(reading(20, { trackerId: "tracker" })));
    state = reducer(state, { type: "tracker/unassignTracker/fulfilled", payload: { data: { _id: "tracker", vehicle: null } } });
    state = reducer(state, telemetryReceived(reading(21, { trackerId: "tracker" })));
    assert.equal(state.byVehicleId["vehicle-1"], undefined);
    state = reducer(state, { type: "tracker/assignTracker/fulfilled", payload: { data: { _id: "tracker", vehicle: "vehicle-2" } } });
    state = reducer(state, telemetryReceived(reading(10, { vehicleId: "vehicle-2", trackerId: "tracker" })));
    assert.equal(state.byVehicleId["vehicle-2"].latitude, 10);
    assert.equal(state.assignedTrackerByVehicleId["vehicle-1"], null);
});

test("tracker list refresh invalidates old device data and logout clears assignment memory", () => {
    let state = reducer(undefined, telemetryReceived(reading(30, { trackerId: "old" })));
    state = reducer(state, { type: "tracker/getTrackers/pending", meta: { requestId: "refresh-list" } });
    state = reducer(state, { type: "tracker/getTrackers/fulfilled", meta: { requestId: "refresh-list" }, payload: { data: [{ _id: "new", vehicle: "vehicle-1" }] } });
    assert.equal(state.byVehicleId["vehicle-1"], undefined);
    state = reducer(state, telemetryReceived(reading(10, { trackerId: "new" })));
    assert.equal(state.byVehicleId["vehicle-1"].latitude, 10);
    state = reducer(state, { type: "auth/sessionEnded" });
    state = reducer(state, vehicleTrackerAssignmentsReceived([{ vehicleId: "vehicle-1", trackerId: "old" }]));
    state = reducer(state, { type: "tracker/getTrackers/pending", meta: { requestId: "refresh-list" } });
    state = reducer(state, { type: "tracker/getTrackers/fulfilled", meta: { requestId: "refresh-list" }, payload: { data: [{ _id: "old", vehicle: "vehicle-1" }] } });
    assert.deepEqual(state.assignedTrackerByVehicleId, {});
});
