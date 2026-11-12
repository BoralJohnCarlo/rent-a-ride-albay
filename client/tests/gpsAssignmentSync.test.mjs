import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { listenForGpsAssignmentChanges } from "../src/utils/gpsAssignmentSync.js";
import reducer, { telemetryReceived, vehicleTrackerAssignmentsReceived } from "../src/store/gps/gpsSlice.js";
const flush = () => new Promise(resolve => setImmediate(resolve));
const reading = trackerId => ({ vehicleId: "v", trackerId, latitude: 13, longitude: 123,
    recordedAt: "2026-11-11T01:00:00Z", receivedAt: "2026-11-11T01:00:00Z" });

test("remote replacement triggers an authoritative reload before accepting its position", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter();
    let state = reducer(undefined, vehicleTrackerAssignmentsReceived([{ vehicleId: "v", trackerId: "old" }]));
    let calls = 0;
    const stop = listenForGpsAssignmentChanges(socket, () => state.assignedTrackerByVehicleId, async () => {
        calls++;
        state = reducer(state, vehicleTrackerAssignmentsReceived([{ vehicleId: "v", trackerId: "new" }]));
        state = reducer(state, telemetryReceived(reading("new")));
    });
    state = reducer(state, telemetryReceived(reading("new")));
    assert.equal(state.byVehicleId.v, undefined);
    socket.emit("gps:telemetry", reading("new"));
    t.mock.timers.tick(150); await flush();
    assert.equal(calls, 1);
    assert.equal(state.byVehicleId.v.trackerId, "new");
    state = reducer(state, telemetryReceived({ ...reading("old"), receivedAt: "2026-11-11T03:00:00Z" }));
    assert.equal(state.byVehicleId.v.trackerId, "new");
    stop();
});

test("reconnect and assignment notifications reload without waiting for telemetry", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0;
    const stop = listenForGpsAssignmentChanges(socket, () => ({ v: "old" }), async () => { calls++; });
    socket.emit("gps:assignment-changed", {});
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 0);
    socket.emit("gps:assignment-changed", { vehicleId: "v" });
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 1);
    socket.emit("connect");
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 2);
    stop();
});

test("first assignment is refreshed even when the vehicle has no cached tracker entry", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0;
    const stop = listenForGpsAssignmentChanges(socket, () => ({}), async () => { calls++; });
    socket.emit("gps:assignment-changed", { vehicleId: "newly-assigned" });
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 1);
    socket.emit("gps:heartbeat", { vehicleId: "newly-assigned", trackerId: "new" });
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 2);
    stop();
});

test("event bursts coalesce and changes during a request cause one followup", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0, complete;
    const stop = listenForGpsAssignmentChanges(socket, () => ({ v: "old" }), () => {
        calls++; return new Promise(resolve => { complete = resolve; });
    });
    for (let i = 0; i < 20; i++) socket.emit("gps:heartbeat", { vehicleId: "v", trackerId: "new" });
    t.mock.timers.tick(150); await flush(); assert.equal(calls, 1);
    socket.emit("gps:assignment-changed", { vehicleId: "v" });
    complete(); await flush(); t.mock.timers.tick(150); await flush(); assert.equal(calls, 2);
    complete(); await flush(); stop();
    socket.emit("connect"); t.mock.timers.tick(1000); await flush(); assert.equal(calls, 2);
    assert.equal(socket.listenerCount("gps:telemetry"), 0);
});

test("cleanup cancels pending refreshes and failures can retry on reconnect", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0;
    const stop = listenForGpsAssignmentChanges(socket, () => ({ v: "old" }), async () => {
        calls++; if (calls === 1) throw new Error("temporary failure");
    });
    socket.emit("connect"); t.mock.timers.tick(150); await flush();
    socket.emit("connect"); t.mock.timers.tick(1000); await flush(); assert.equal(calls, 2);
    socket.emit("connect"); stop(); t.mock.timers.tick(150); await flush(); assert.equal(calls, 2);
});

test("failed refreshes retry without events, cap delays, and reset after success", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0, fail = true;
    const stop = listenForGpsAssignmentChanges(socket, () => ({}), async () => {
        calls++;
        if (fail && calls % 2) throw new Error("temporary failure");
        return !fail;
    });
    socket.emit("gps:assignment-changed", { vehicleId: "v" });
    t.mock.timers.tick(150); await flush();
    for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
        const previous = calls;
        t.mock.timers.tick(delay - 1); await flush(); assert.equal(calls, previous);
        t.mock.timers.tick(1); await flush(); assert.equal(calls, previous + 1);
    }
    fail = false;
    t.mock.timers.tick(30000); await flush();
    const successfulCalls = calls;
    t.mock.timers.tick(60000); await flush(); assert.equal(calls, successfulCalls);
    fail = true;
    socket.emit("gps:assignment-changed", { vehicleId: "v" });
    t.mock.timers.tick(150); await flush();
    t.mock.timers.tick(1000); await flush(); assert.equal(calls, successfulCalls + 2);
    stop();
    t.mock.timers.tick(60000); await flush(); assert.equal(calls, successfulCalls + 2);
});

test("cleanup during a failing request prevents retries", async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new EventEmitter(); let calls = 0, reject;
    const stop = listenForGpsAssignmentChanges(socket, () => ({}), () => {
        calls++;
        return new Promise((resolve, fail) => { reject = fail; });
    });
    socket.emit("connect"); t.mock.timers.tick(150); await flush();
    stop(); reject(new Error("temporary failure")); await flush();
    t.mock.timers.tick(60000); await flush(); assert.equal(calls, 1);
});
