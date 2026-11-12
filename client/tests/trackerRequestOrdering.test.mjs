import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import gpsReducer, { telemetryReceived } from "../src/store/gps/gpsSlice.js";

// Exercise the real tracker reducer while isolating its network service.
// No HTTP calls should occur in these Redux lifecycle tests.
const sliceUrl = new URL("../src/store/trackers/trackerSlice.js", import.meta.url).href;
const services = ["fetchTrackers", "createNewTracker", "assignExistingTracker", "unassignExistingTracker",
    "disableExistingTracker", "enableExistingTracker", "regenerateExistingTrackerKey", "updateExistingTracker"];
const stubUrl = "data:text/javascript," + encodeURIComponent(services.map(name =>
    `export const ${name} = async () => { throw new Error("Unexpected network request"); };`).join("\n"));
const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === sliceUrl && specifier === "../../services/trackerService") {
        return { url: stubUrl, shortCircuit: true };
    }
    return next(specifier, context);
} });
const { default: trackerReducer } = await import(sliceUrl);
hooks.deregister();

const pending = requestId => ({ type: "tracker/getTrackers/pending", meta: { requestId } });
const fulfilled = (requestId, tracker = "new") => ({ type: "tracker/getTrackers/fulfilled", meta: { requestId },
    payload: { data: [{ _id: tracker, vehicle: "v", deviceKey: "must-not-be-cached" }] } });
const rejected = requestId => ({ type: "tracker/getTrackers/rejected", meta: { requestId }, payload: "Old request failed" });

for (const [name, reducer] of [["tracker", trackerReducer], ["GPS", gpsReducer]]) {
    test(name + " settles the latest failure without falling back to an older response", () => {
        let state = reducer(undefined, pending("old"));
        state = reducer(state, pending("new"));
        state = reducer(state, rejected("new"));
        const failed = state;
        assert.deepEqual(reducer(state, fulfilled("old", "old")), failed);
        assert.equal(state.trackerListRequestId, null);
        if (name === "tracker") {
            assert.equal(state.loading, false);
            assert.equal(state.error, "Old request failed");
        }
    });

    test(name + " keeps a pending read usable when a mutation fails", () => {
        let state = reducer(undefined, pending("read"));
        state = reducer(state, { type: "tracker/assignTracker/rejected", payload: "Assignment failed" });
        state = reducer(state, fulfilled("read"));
        if (name === "tracker") assert.equal(state.trackers[0]._id, "new");
        else assert.equal(state.assignedTrackerByVehicleId.v, "new");
    });

    test(name + " ignores older list responses and stale errors", () => {
        let state = reducer(undefined, pending("old"));
        state = reducer(state, pending("new"));
        const waiting = state;
        state = reducer(state, fulfilled("old", "old"));
        state = reducer(state, rejected("old"));
        assert.deepEqual(state, waiting);
        state = reducer(state, fulfilled("new"));
        const latest = state;
        assert.deepEqual(reducer(state, fulfilled("old", "old")), latest);
        assert.deepEqual(reducer(state, rejected("old")), latest);
        if (name === "tracker") {
            assert.equal(state.trackers[0]._id, "new");
            assert.equal(state.trackers[0].deviceKey, undefined);
            assert.equal(state.loading, false);
            assert.equal(state.error, null);
        } else assert.equal(state.assignedTrackerByVehicleId.v, "new");
    });

    for (const mutation of ["assignTracker", "unassignTracker", "registerTracker", "disableTracker", "enableTracker", "updateTracker", "regenerateTrackerKey"]) {
        test(name + " invalidates an in-flight list after " + mutation, () => {
            let state = reducer(undefined, pending("old"));
            state = reducer(state, { type: "tracker/" + mutation + "/fulfilled",
                payload: { data: { _id: "new", vehicle: mutation === "unassignTracker" ? null : "v" } } });
            const changed = state;
            assert.deepEqual(reducer(state, fulfilled("old", "old")), changed);
            assert.deepEqual(reducer(state, rejected("old")), changed);
            // A fresh read after the mutation still works.
            state = reducer(state, pending("after"));
            state = reducer(state, fulfilled("after"));
            if (name === "tracker") assert.equal(state.trackers[0]._id, "new");
            else assert.equal(state.assignedTrackerByVehicleId.v, "new");
        });
    }

    test(name + " cannot refill a new session from an old list response", () => {
        let state = reducer(undefined, pending("previous-session"));
        state = reducer(state, { type: "auth/sessionEnded" });
        state = reducer(state, { type: "auth/login/fulfilled" });
        const cleared = state;
        assert.deepEqual(reducer(state, fulfilled("previous-session", "old")), cleared);
    });
}

test("a delayed list cannot discard the replacement's cached location", () => {
    let state = gpsReducer(undefined, pending("old-list"));
    state = gpsReducer(state, { type: "tracker/assignTracker/fulfilled", payload: { data: { _id: "new", vehicle: "v" } } });
    state = gpsReducer(state, telemetryReceived({ vehicleId: "v", trackerId: "new", latitude: 14, longitude: 124,
        recordedAt: "2026-11-12T01:00:00Z", receivedAt: "2026-11-12T01:00:00Z" }));
    state = gpsReducer(state, fulfilled("old-list", "old"));
    assert.equal(state.assignedTrackerByVehicleId.v, "new");
    assert.equal(state.byVehicleId.v.latitude, 14);
});
