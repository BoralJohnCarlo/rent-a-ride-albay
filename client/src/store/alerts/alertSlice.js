import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchAlerts,
    markAlertAsRead,
    resolveExistingAlert,
} from "../../services/alertService";

const initialState = {
    alerts: [],
    loading: false,
    error: null,
};

export const getAlerts = createAsyncThunk(
    "alerts/getAlerts",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchAlerts(params);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch alerts."
            );
        }
    }
);

export const readAlert = createAsyncThunk(
    "alerts/readAlert",
    async (alertId, { rejectWithValue }) => {
        try {
            return await markAlertAsRead(alertId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to mark alert as read."
            );
        }
    }
);

export const resolveAlert = createAsyncThunk(
    "alerts/resolveAlert",
    async (alertId, { rejectWithValue }) => {
        try {
            return await resolveExistingAlert(alertId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to resolve alert."
            );
        }
    }
);

const upsertAlert = (state, alert) => {
    const index = state.alerts.findIndex(
        (existing) => existing._id === alert._id
    );

    if (index === -1) {
        state.alerts.unshift(alert);
    } else {
        state.alerts[index] = alert;
    }
};

const alertSlice = createSlice({
    name: "alerts",

    initialState,

    reducers: {
        clearAlertError: (state) => {
            state.error = null;
        },

        // Realtime alerts:new - de-duplicated by _id so a socket event for
        // an alert this client already has (e.g. from its own REST fetch)
        // never creates a second entry.
        alertReceived: (state, action) => {
            const alert = action.payload;

            if (!alert?._id) {
                return;
            }

            const exists = state.alerts.some(
                (existing) => existing._id === alert._id
            );

            if (!exists) {
                state.alerts.unshift(alert);
            }
        },

        // Realtime alerts:resolved - updates the matching alert in place
        // (e.g. GPS_LOST auto-resolving once gpsFix recovers) so the list
        // reflects it without a page refresh.
        alertResolvedRealtime: (state, action) => {
            const alert = action.payload;

            if (!alert?._id) {
                return;
            }

            const index = state.alerts.findIndex(
                (existing) => existing._id === alert._id
            );

            if (index !== -1) {
                state.alerts[index] = alert;
            }
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(getAlerts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getAlerts.fulfilled, (state, action) => {
                state.loading = false;
                state.alerts = action.payload?.data ?? [];
            })

            .addCase(getAlerts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(readAlert.fulfilled, (state, action) => {
                const updated = action.payload?.data;

                if (updated) {
                    upsertAlert(state, updated);
                }
            })

            .addCase(readAlert.rejected, (state, action) => {
                state.error = action.payload;
            })

            .addCase(resolveAlert.fulfilled, (state, action) => {
                const updated = action.payload?.data;

                if (updated) {
                    upsertAlert(state, updated);
                }
            })

            .addCase(resolveAlert.rejected, (state, action) => {
                state.error = action.payload;
            });
    },
});

export const {
    clearAlertError,
    alertReceived,
    alertResolvedRealtime,
} = alertSlice.actions;

export default alertSlice.reducer;
