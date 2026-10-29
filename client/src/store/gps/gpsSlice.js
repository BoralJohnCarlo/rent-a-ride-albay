import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    byVehicleId: {},
};

/*
 * Only ever holds the latest realtime telemetry per vehicle - not a
 * historical array. History belongs to the backend/API (a later
 * milestone), not Redux.
 */
const gpsSlice = createSlice({
    name: "gps",

    initialState,

    reducers: {
        telemetryReceived: (state, action) => {
            const payload = action.payload;

            if (!payload?.vehicleId) {
                return;
            }

            // Keep any heartbeat-only lastSeenAt that is newer than this
            // position (e.g. a REST seed landing after a live heartbeat).
            const previousLastSeenAt =
                state.byVehicleId[payload.vehicleId]?.lastSeenAt;

            state.byVehicleId[payload.vehicleId] = previousLastSeenAt
                ? { ...payload, lastSeenAt: previousLastSeenAt }
                : payload;
        },

        // Communication without a new position (gps:heartbeat) - updates
        // only when the tracker was last heard from, never the coordinates.
        heartbeatReceived: (state, action) => {
            const { vehicleId, lastSeenAt } = action.payload || {};

            if (!vehicleId || !lastSeenAt) {
                return;
            }

            const current = state.byVehicleId[vehicleId];

            if (
                current?.lastSeenAt &&
                new Date(current.lastSeenAt) >= new Date(lastSeenAt)
            ) {
                return;
            }

            state.byVehicleId[vehicleId] = {
                ...(current || { vehicleId }),
                lastSeenAt,
            };
        },

        vehicleTrackingCleared: (state, action) => {
            delete state.byVehicleId[action.payload];
        },
    },
});

export const {
    telemetryReceived,
    heartbeatReceived,
    vehicleTrackingCleared,
} = gpsSlice.actions;

export const selectVehicleTelemetry = (vehicleId) => (state) =>
    state.gps.byVehicleId[vehicleId] || null;

export default gpsSlice.reducer;
