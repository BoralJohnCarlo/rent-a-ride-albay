import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    getPayoutRequests,
    getPayoutRequestById,
    getPayoutRequestsByOperator,
    getOperatorPayoutSummary,
    getPayoutStats,
    approvePayout,
    rejectPayout,
    markPayoutAsPaid,
    cancelPayout,
    getPayoutSettings,
    updatePayoutSettings,
    createPayoutRequest,
} from "../../api/payoutApi.js";

export const fetchPayoutRequests = createAsyncThunk(
    "payouts/fetchPayoutRequests",
    async (params = {}, { rejectWithValue }) => {
        try {
            return await getPayoutRequests(params);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const fetchPayoutRequestsByOperator = createAsyncThunk(
    "payouts/fetchPayoutRequestsByOperator",
    async (params = {}, { rejectWithValue }) => {
        try {
            return await getPayoutRequestsByOperator(params);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const fetchOperatorPayoutSummary = createAsyncThunk(
    "payouts/fetchOperatorPayoutSummary",
    async (_, { rejectWithValue }) => {
        try {
            return await getOperatorPayoutSummary();
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const fetchPayoutStats = createAsyncThunk(
    "payouts/fetchPayoutStats",
    async (_, { rejectWithValue }) => {
        try {
            return await getPayoutStats();
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const fetchPayoutSettings = createAsyncThunk(
    "payouts/fetchPayoutSettings",
    async (_, { rejectWithValue }) => {
        try {
            return await getPayoutSettings();
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const updatePayoutSettingsHandler = createAsyncThunk(
    "payouts/updatePayoutSettings",
    async (settingsData, { rejectWithValue }) => {
        try {
            return await updatePayoutSettings(settingsData);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const fetchPayoutRequestById = createAsyncThunk(
    "payouts/fetchPayoutRequestById",
    async (id, { rejectWithValue }) => {
        try {
            return await getPayoutRequestById(id);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const approvePayoutHandler = createAsyncThunk(
    "payouts/approvePayout",
    async (id, { rejectWithValue }) => {
        try {
            return await approvePayout(id);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const rejectPayoutHandler = createAsyncThunk(
    "payouts/rejectPayout",
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            return await rejectPayout(id, reason);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const markPayoutAsPaidHandler = createAsyncThunk(
    "payouts/markPayoutAsPaid",
    async ({ id, paidVia }, { rejectWithValue }) => {
        try {
            return await markPayoutAsPaid(id, paidVia);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const cancelPayoutHandler = createAsyncThunk(
    "payouts/cancelPayout",
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            return await cancelPayout(id, reason);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

export const createPayoutRequestHandler = createAsyncThunk(
    "payouts/createPayoutRequest",
    async (payoutData, { rejectWithValue }) => {
        try {
            return await createPayoutRequest(payoutData);
        } catch (err) {
            return rejectWithValue(err.response?.data || err.message);
        }
    }
);

const initialState = {
    payoutRequests: [],
    payoutRequest: null,
    loading: false,
    success: false,
    error: null,
    pagination: {
        total: 0,
        page: 1,
        pages: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc"
    },
    summary: {
        totalEarned: 0,
        totalPaid: 0,
        totalPending: 0,
        totalScheduled: 0,
        totalCancelled: 0,
    },
    stats: {
        byStatus: {},
        total: { count: 0, amount: 0 }
    },
    settings: {
        platformCommissionRate: 10,
        payoutCurrency: "PHP",
        payoutHoldHours: 24,
    }
};

const payoutsSlice = createSlice({
    name: "payouts",
    initialState,
    reducers: {
        clearPayoutRequests: (state) => {
            state.payoutRequests = [];
            state.loading = false;
            state.success = false;
            state.error = null;
        },
        clearPayoutRequest: (state) => {
            state.payoutRequest = null;
            state.loading = false;
            state.success = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPayoutRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayoutRequests.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.payoutRequests = action.payload.payouts || [];
                state.pagination = {
                    ...state.pagination,
                    total: action.payload.pagination?.total || 0,
                    pages: action.payload.pagination?.pages || 1,
                    limit: action.payload.pagination?.limit || 10
                };
            })
            .addCase(fetchPayoutRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchPayoutRequestsByOperator.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPayoutRequestsByOperator.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.payoutRequests = action.payload.payouts || [];
                state.pagination = {
                    ...state.pagination,
                    total: action.payload.pagination?.total || 0,
                    pages: action.payload.pagination?.pages || 1,
                    limit: action.payload.pagination?.limit || 10
                };
            })
            .addCase(fetchPayoutRequestsByOperator.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchOperatorPayoutSummary.fulfilled, (state, action) => {
                state.summary = action.payload.data || initialState.summary;
            })
            .addCase(fetchOperatorPayoutSummary.rejected, (state, action) => {
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchPayoutStats.fulfilled, (state, action) => {
                state.stats = action.payload.data || initialState.stats;
            })
            .addCase(fetchPayoutStats.rejected, (state, action) => {
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchPayoutSettings.fulfilled, (state, action) => {
                state.settings = action.payload.data || initialState.settings;
            })
            .addCase(fetchPayoutSettings.rejected, (state, action) => {
                state.error = action.payload || action.error.message;
            })
            .addCase(updatePayoutSettingsHandler.fulfilled, (state, action) => {
                state.settings = action.payload.data || state.settings;
            })
            .addCase(updatePayoutSettingsHandler.rejected, (state, action) => {
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchPayoutRequestById.fulfilled, (state, action) => {
                state.payoutRequest = action.payload.data || null;
            })
            .addCase(fetchPayoutRequestById.rejected, (state, action) => {
                state.error = action.payload || action.error.message;
            })
            .addCase(approvePayoutHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                const updatedPayout = action.payload.data;
                // Update in lists
                const index = state.payoutRequests.findIndex(p => p._id === updatedPayout._id);
                if (index !== -1) {
                    state.payoutRequests[index] = updatedPayout;
                }
                if (state.payoutRequest && state.payoutRequest._id === updatedPayout._id) {
                    state.payoutRequest = updatedPayout;
                }
            })
            .addCase(approvePayoutHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(rejectPayoutHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                const updatedPayout = action.payload.data;
                // Update in lists
                const index = state.payoutRequests.findIndex(p => p._id === updatedPayout._id);
                if (index !== -1) {
                    state.payoutRequests[index] = updatedPayout;
                }
                if (state.payoutRequest && state.payoutRequest._id === updatedPayout._id) {
                    state.payoutRequest = updatedPayout;
                }
            })
            .addCase(rejectPayoutHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(markPayoutAsPaidHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                const updatedPayout = action.payload.data;
                // Update in lists
                const index = state.payoutRequests.findIndex(p => p._id === updatedPayout._id);
                if (index !== -1) {
                    state.payoutRequests[index] = updatedPayout;
                }
                if (state.payoutRequest && state.payoutRequest._id === updatedPayout._id) {
                    state.payoutRequest = updatedPayout;
                }
            })
            .addCase(markPayoutAsPaidHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(cancelPayoutHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                const updatedPayout = action.payload.data;
                // Update in lists
                const index = state.payoutRequests.findIndex(p => p._id === updatedPayout._id);
                if (index !== -1) {
                    state.payoutRequests[index] = updatedPayout;
                }
                if (state.payoutRequest && state.payoutRequest._id === updatedPayout._id) {
                    state.payoutRequest = updatedPayout;
                }
            })
            .addCase(cancelPayoutHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(createPayoutRequestHandler.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createPayoutRequestHandler.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.payoutRequests.unshift(action.payload.data);
            })
            .addCase(createPayoutRequestHandler.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    }
});

export const { clearPayoutRequests, clearPayoutRequest } = payoutsSlice.actions;
export default payoutsSlice.reducer;