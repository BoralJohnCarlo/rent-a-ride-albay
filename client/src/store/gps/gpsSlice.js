import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    byVehicleId: {},
    assignedTrackerByVehicleId: {},
    trackerListRequestId: null,
    sessionEnded: false,
};

/*
 * Only ever holds the latest realtime telemetry per vehicle - not a
 * historical array. History belongs to the backend/API (a later
 * milestone), not Redux.
 */
// Fix observations have their own chronology and never replace coordinates.
const mergeFix = (target, incoming) => {
    const observed = Date.parse(incoming.gpsFixUpdatedAt ?? incoming.receivedAt);
    const current = Date.parse(target.gpsFixUpdatedAt ?? target.receivedAt);
    if (typeof incoming.gpsFix === "boolean" && Number.isFinite(observed) &&
        (!Number.isFinite(current) || observed > current)) {
        target.gpsFix = incoming.gpsFix;
        target.gpsFixUpdatedAt = incoming.gpsFixUpdatedAt ?? incoming.receivedAt;
    }
};

const communicationTime = (value) => Math.max(
    ...[value?.lastSeenAt, value?.receivedAt].map(Date.parse).filter(Number.isFinite),
    -Infinity
);
const differentTracker = (a, b) => a?.trackerId && b?.trackerId && a.trackerId !== b.trackerId;
const hasAssignment = (state, vehicleId) => Object.hasOwn(state.assignedTrackerByVehicleId, vehicleId);
const matchesAssignment = (state, payload) =>
    !hasAssignment(state, payload.vehicleId) ||
    (state.assignedTrackerByVehicleId[payload.vehicleId] !== null &&
        state.assignedTrackerByVehicleId[payload.vehicleId] === payload.trackerId);

const setAssignment = (state, vehicleId, trackerId) => {
    state.assignedTrackerByVehicleId[vehicleId] = trackerId;
    const cached = state.byVehicleId[vehicleId];
    if (cached && cached.trackerId !== trackerId) delete state.byVehicleId[vehicleId];
};

const updateTrackerAssignment = (state, tracker) => {
    if (!tracker?._id) return;
    const id = String(tracker._id);
    const vehicleId = tracker.vehicle ? String(tracker.vehicle) : null;
    for (const [vehicle, assigned] of Object.entries(state.assignedTrackerByVehicleId)) {
        if (assigned === id && vehicle !== vehicleId) setAssignment(state, vehicle, null);
    }
    if (vehicleId) setAssignment(state, vehicleId, id);
};

const gpsSlice = createSlice({
    name: "gps",

    initialState,

    reducers: {
        telemetryReceived: (state, action) => {
            if (state.sessionEnded) return;
            const payload = action.payload;

            if (!payload?.vehicleId) {
                return;
            }
            if (!matchesAssignment(state, payload)) return;

            const incomingTime = Date.parse(payload.recordedAt);
            // A persisted fix-only snapshot has no device position timestamp.
            const fixOnly = payload.recordedAt == null && payload.latitude == null && payload.longitude == null &&
                Number.isFinite(communicationTime(payload));
            if (!Number.isFinite(incomingTime) && !fixOnly) return;

            let previous = state.byVehicleId[payload.vehicleId];
            if (differentTracker(previous, payload)) {
                // A delayed seed/event from the replaced device must not
                // resurrect its position after the replacement was observed.
                if (!hasAssignment(state, payload.vehicleId) && communicationTime(payload) <= communicationTime(previous)) return;
                previous = null;
            }
            const previousTime = Date.parse(previous?.recordedAt);
            const lastSeenAt = [previous?.lastSeenAt, previous?.receivedAt, payload.lastSeenAt, payload.receivedAt]
                .filter(value => Number.isFinite(Date.parse(value)))
                .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

            // REST seeds and socket events can arrive in either order. Equal
            // timestamps retain the first position, matching the server.
            const position = previous && Number.isFinite(previousTime) && (fixOnly || incomingTime <= previousTime)
                ? previous : payload;
            const merged = { ...position, ...(lastSeenAt ? { lastSeenAt } : {}) };
            if (previous) mergeFix(merged, previous);
            mergeFix(merged, payload);
            state.byVehicleId[payload.vehicleId] = merged;
        },

        // Communication without a new position (gps:heartbeat) - updates
        // only when the tracker was last heard from, never the coordinates.
        heartbeatReceived: (state, action) => {
            if (state.sessionEnded) return;
            const { vehicleId, lastSeenAt } = action.payload || {};

            if (!vehicleId || !Number.isFinite(Date.parse(lastSeenAt))) {
                return;
            }
            if (!matchesAssignment(state, action.payload)) return;

            let current = state.byVehicleId[vehicleId];
            if (differentTracker(current, action.payload)) {
                if (!hasAssignment(state, vehicleId) && Date.parse(lastSeenAt) <= communicationTime(current)) return;
                current = { vehicleId, trackerId: action.payload.trackerId };
                state.byVehicleId[vehicleId] = current;
            }
            if (current) mergeFix(current, action.payload);

            if (
                current?.lastSeenAt &&
                new Date(current.lastSeenAt) >= new Date(lastSeenAt)
            ) {
                return;
            }

            state.byVehicleId[vehicleId] = {
                ...(current || { vehicleId, trackerId: action.payload.trackerId ?? null }),
                lastSeenAt,
            };
            mergeFix(state.byVehicleId[vehicleId], action.payload);
        },

        vehicleTrackingCleared: (state, action) => {
            delete state.byVehicleId[action.payload];
        },

        // Authoritative fleet assignments, independent of either device's clock.
        vehicleTrackerAssignmentsReceived: (state, action) => {
            if (state.sessionEnded) return;
            for (const { vehicleId, trackerId } of action.payload) {
                setAssignment(state, String(vehicleId), trackerId == null ? null : String(trackerId));
            }
        },
    },
    extraReducers: (builder) => {
        builder.addCase("tracker/getTrackers/pending", (state, action) => {
            if (!state.sessionEnded) state.trackerListRequestId = action.meta.requestId;
        });
        builder.addCase("tracker/getTrackers/fulfilled", (state, action) => {
            if (state.sessionEnded) return;
            if (!action.meta?.requestId || state.trackerListRequestId !== action.meta.requestId) return;
            state.trackerListRequestId = null;
            const trackers = action.payload?.data;
            if (!Array.isArray(trackers)) return;
            const next = new Map(trackers.filter(tracker => tracker.vehicle)
                .map(tracker => [String(tracker.vehicle), String(tracker._id)]));
            const vehicles = new Set([...Object.keys(state.byVehicleId),
                ...Object.keys(state.assignedTrackerByVehicleId), ...next.keys()]);
            for (const vehicle of vehicles) setAssignment(state, vehicle, next.get(vehicle) ?? null);
        });
        builder.addCase("tracker/getTrackers/rejected", (state, action) => {
            if (action.meta?.requestId === state.trackerListRequestId) state.trackerListRequestId = null;
        });
        for (const type of ["tracker/assignTracker/fulfilled", "tracker/unassignTracker/fulfilled", "tracker/registerTracker/fulfilled"]) {
            builder.addCase(type, (state, action) => {
                if (!state.sessionEnded) {
                    state.trackerListRequestId = null;
                    updateTrackerAssignment(state, action.payload?.data);
                }
            });
        }
        for (const type of ["tracker/disableTracker/fulfilled", "tracker/enableTracker/fulfilled", "tracker/updateTracker/fulfilled", "tracker/regenerateTrackerKey/fulfilled"]) {
            builder.addCase(type, state => { state.trackerListRequestId = null; });
        }
        for (const type of ["auth/logout/fulfilled", "auth/sessionEnded", "auth/getCurrentUser/rejected"]) {
            builder.addCase(type, () => ({ ...initialState, sessionEnded: true }));
        }
        builder.addCase("auth/login/fulfilled", () => initialState);
        builder.addCase("auth/getCurrentUser/fulfilled", (state, action) => {
            if (!action.payload?.data) return { ...initialState, sessionEnded: true };
            state.sessionEnded = false;
        });
    },
});

export const {
    telemetryReceived,
    heartbeatReceived,
    vehicleTrackingCleared,
    vehicleTrackerAssignmentsReceived,
} = gpsSlice.actions;

export const selectVehicleTelemetry = (vehicleId) => (state) =>
    state.gps.byVehicleId[vehicleId] || null;

export default gpsSlice.reducer;
