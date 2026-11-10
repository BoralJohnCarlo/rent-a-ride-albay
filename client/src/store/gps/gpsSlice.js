import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    byVehicleId: {},
    sessionEnded: false,
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
            if (state.sessionEnded) return;
            const payload = action.payload;

            if (!payload?.vehicleId) {
                return;
            }

            const incomingTime = Date.parse(payload.recordedAt);
            if (!Number.isFinite(incomingTime)) return;

            const previous = state.byVehicleId[payload.vehicleId];
            const previousTime = Date.parse(previous?.recordedAt);
            const lastSeenAt = [previous?.lastSeenAt, previous?.receivedAt, payload.lastSeenAt, payload.receivedAt]
                .filter(value => Number.isFinite(Date.parse(value)))
                .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

            // REST seeds and socket events can arrive in either order. Equal
            // timestamps retain the first position, matching the server.
            const position = previous && Number.isFinite(previousTime) && incomingTime <= previousTime
                ? previous : payload;
            state.byVehicleId[payload.vehicleId] = lastSeenAt
                ? { ...position, lastSeenAt } : position;
        },

        // Communication without a new position (gps:heartbeat) - updates
        // only when the tracker was last heard from, never the coordinates.
        heartbeatReceived: (state, action) => {
            if (state.sessionEnded) return;
            const { vehicleId, lastSeenAt } = action.payload || {};

            if (!vehicleId || !Number.isFinite(Date.parse(lastSeenAt))) {
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
    extraReducers: (builder) => {
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
} = gpsSlice.actions;

export const selectVehicleTelemetry = (vehicleId) => (state) =>
    state.gps.byVehicleId[vehicleId] || null;

export default gpsSlice.reducer;
