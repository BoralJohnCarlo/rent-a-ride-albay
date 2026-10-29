import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchTrackers,
    createNewTracker,
    assignExistingTracker,
    unassignExistingTracker,
    disableExistingTracker,
    enableExistingTracker,
    regenerateExistingTrackerKey,
    updateExistingTracker,
} from "../../services/trackerService";

const initialState = {
    trackers: [],
    loading: false,
    error: null,
};

export const getTrackers = createAsyncThunk(
    "tracker/getTrackers",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchTrackers();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch trackers."
            );
        }
    }
);

export const registerTracker = createAsyncThunk(
    "tracker/registerTracker",
    async (trackerData, { rejectWithValue }) => {
        try {
            return await createNewTracker(trackerData);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to register tracker."
            );
        }
    }
);

export const assignTracker = createAsyncThunk(
    "tracker/assignTracker",
    async ({ trackerId, vehicleId }, { rejectWithValue }) => {
        try {
            return await assignExistingTracker(
                trackerId,
                vehicleId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to assign tracker."
            );
        }
    }
);

export const updateTracker = createAsyncThunk(
    "tracker/updateTracker",
    async ({ trackerId, trackerData }, { rejectWithValue }) => {
        try {
            return await updateExistingTracker(
                trackerId,
                trackerData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to update tracker."
            );
        }
    }
);

// Single-tracker actions that respond with the updated tracker.
const createTrackerActionThunk = (type, request, fallbackMessage) =>
    createAsyncThunk(type, async (trackerId, { rejectWithValue }) => {
        try {
            return await request(trackerId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || fallbackMessage
            );
        }
    });

export const unassignTracker = createTrackerActionThunk(
    "tracker/unassignTracker",
    unassignExistingTracker,
    "Unable to unassign tracker."
);

export const disableTracker = createTrackerActionThunk(
    "tracker/disableTracker",
    disableExistingTracker,
    "Unable to disable tracker."
);

export const enableTracker = createTrackerActionThunk(
    "tracker/enableTracker",
    enableExistingTracker,
    "Unable to enable tracker."
);

// Like registerTracker, the response carries a one-time plaintext deviceKey:
// the caller reads it via .unwrap() and only a stripped copy enters state.
export const regenerateTrackerKey = createTrackerActionThunk(
    "tracker/regenerateTrackerKey",
    regenerateExistingTrackerKey,
    "Unable to regenerate device key."
);

// Defensive belt-and-suspenders: only the create and regenerate-key
// responses ever include deviceKey, but this guarantees it can never end up
// in Redux either way.
const stripDeviceKey = (tracker) => {
    if (!tracker) {
        return tracker;
    }

    const rest = { ...tracker };
    delete rest.deviceKey;

    return rest;
};

const setPending = (state) => {
    state.loading = true;
    state.error = null;
};

const setRejected = (state, action) => {
    state.loading = false;
    state.error = action.payload;
};

const replaceUpdatedTracker = (state, action) => {
    state.loading = false;
    state.error = null;

    const updated = stripDeviceKey(action.payload?.data);

    if (updated) {
        state.trackers = state.trackers.map((tracker) =>
            tracker._id === updated._id ? updated : tracker
        );
    }
};

const TRACKER_ACTION_THUNKS = [
    unassignTracker,
    disableTracker,
    enableTracker,
    regenerateTrackerKey,
];

const trackerSlice = createSlice({
    name: "tracker",

    initialState,

    reducers: {
        clearTrackerError: (state) => {
            state.error = null;
        },
    },

    extraReducers: (builder) => {
        builder
            // Get Trackers

            .addCase(getTrackers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getTrackers.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.trackers = (
                    action.payload?.data ?? []
                ).map(stripDeviceKey);
            })

            .addCase(getTrackers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Register Tracker - deliberately does NOT add the created
            // tracker (which includes a one-time plaintext deviceKey) into
            // state.trackers. The calling component reads the deviceKey via
            // .unwrap() and the list is refreshed separately via
            // getTrackers(), whose response never includes it.

            .addCase(registerTracker.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(registerTracker.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })

            .addCase(registerTracker.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Assign Tracker

            .addCase(assignTracker.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(assignTracker.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                const updated = stripDeviceKey(
                    action.payload?.data
                );

                if (updated) {
                    state.trackers = state.trackers.map(
                        (tracker) =>
                            tracker._id === updated._id
                                ? updated
                                : tracker
                    );
                }
            })

            .addCase(assignTracker.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Update Tracker

            .addCase(updateTracker.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(updateTracker.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                const updated = stripDeviceKey(
                    action.payload?.data
                );

                if (updated) {
                    state.trackers = state.trackers.map(
                        (tracker) =>
                            tracker._id === updated._id
                                ? updated
                                : tracker
                    );
                }
            })

            .addCase(updateTracker.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });

        // Unassign / Disable / Enable / Regenerate Key

        TRACKER_ACTION_THUNKS.forEach((thunk) => {
            builder
                .addCase(thunk.pending, setPending)
                .addCase(thunk.fulfilled, replaceUpdatedTracker)
                .addCase(thunk.rejected, setRejected);
        });
    },
});

export const { clearTrackerError } = trackerSlice.actions;

export default trackerSlice.reducer;
