import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import {
    createAvailabilityRequest,
    getMyAvailabilityRequests,
    getAvailabilityRequests,
    approveAvailabilityRequest,
    rejectAvailabilityRequest,
    cancelAvailabilityRequest,
} from "../../api/vehicleAvailabilityRequestApi.js";

export const submitAvailabilityRequest = createAsyncThunk(
    "vehicleAvailabilityRequests/submit",
    async (payload, { rejectWithValue }) => {
        try {
            return await createAvailabilityRequest(payload);
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

export const fetchMyAvailabilityRequests = createAsyncThunk(
    "vehicleAvailabilityRequests/fetchMine",
    async (params = {}, { rejectWithValue }) => {
        try {
            return await getMyAvailabilityRequests(params);
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

export const fetchAvailabilityRequests = createAsyncThunk(
    "vehicleAvailabilityRequests/fetchAll",
    async (params = {}, { rejectWithValue }) => {
        try {
            return await getAvailabilityRequests(params);
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

export const approveAvailabilityRequestHandler = createAsyncThunk(
    "vehicleAvailabilityRequests/approve",
    async ({ id, remarks }, { rejectWithValue }) => {
        try {
            return await approveAvailabilityRequest(
                id,
                remarks
            );
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

export const rejectAvailabilityRequestHandler = createAsyncThunk(
    "vehicleAvailabilityRequests/reject",
    async ({ id, rejectionReason }, { rejectWithValue }) => {
        try {
            return await rejectAvailabilityRequest(
                id,
                rejectionReason
            );
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

export const cancelAvailabilityRequestHandler = createAsyncThunk(
    "vehicleAvailabilityRequests/cancel",
    async (id, { rejectWithValue }) => {
        try {
            return await cancelAvailabilityRequest(id);
        } catch (err) {
            return rejectWithValue(
                err.response?.data || err.message
            );
        }
    }
);

const initialState = {
    requests: [],
    loading: false,
    success: false,
    error: null,
};

const replaceOrPrepend = (requests, updated) => {
    const index = requests.findIndex(
        (request) => request._id === updated._id
    );

    if (index === -1) {
        return [updated, ...requests];
    }

    const next = [...requests];
    next[index] = updated;
    return next;
};

const vehicleAvailabilityRequestsSlice = createSlice({
    name: "vehicleAvailabilityRequests",
    initialState,
    reducers: {
        clearAvailabilityRequests: (state) => {
            state.requests = [];
            state.loading = false;
            state.success = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(submitAvailabilityRequest.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(submitAvailabilityRequest.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.requests = [
                    action.payload.data,
                    ...state.requests,
                ];
            })
            .addCase(submitAvailabilityRequest.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchMyAvailabilityRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMyAvailabilityRequests.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.requests = action.payload.data || [];
            })
            .addCase(fetchMyAvailabilityRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchAvailabilityRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAvailabilityRequests.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.requests = action.payload.data || [];
            })
            .addCase(fetchAvailabilityRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(approveAvailabilityRequestHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.requests = replaceOrPrepend(
                    state.requests,
                    action.payload.data
                );
            })
            .addCase(approveAvailabilityRequestHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(rejectAvailabilityRequestHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.requests = replaceOrPrepend(
                    state.requests,
                    action.payload.data
                );
            })
            .addCase(rejectAvailabilityRequestHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(cancelAvailabilityRequestHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.requests = replaceOrPrepend(
                    state.requests,
                    action.payload.data
                );
            })
            .addCase(cancelAvailabilityRequestHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    },
});

export const { clearAvailabilityRequests } =
    vehicleAvailabilityRequestsSlice.actions;

export default vehicleAvailabilityRequestsSlice.reducer;
