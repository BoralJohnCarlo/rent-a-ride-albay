import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getPendingVehicles, getMyPendingVehicles } from "../../api/pendingVehicleApi.js";
import { getPendingVehicleCounts } from "../../api/pendingVehicleApi.js";

export const fetchPendingVehicles = createAsyncThunk(
  "pendingVehicles/fetchPendingVehicles",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await getPendingVehicles(params);
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const fetchMyPendingVehicles = createAsyncThunk(
  "pendingVehicles/fetchMyPendingVehicles",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await getMyPendingVehicles(params);
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const fetchPendingVehicleCounts = createAsyncThunk(
  "pendingVehicles/fetchPendingVehicleCounts",
  async (_, { rejectWithValue }) => {
    try {
      return await getPendingVehicleCounts();
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const initialState = {
    pendingVehicles: [],
    loading: false,
    success: false,
    error: null,
    pagination: {
        total: 0,
        page: 1,
        pages: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc"
    },
    counts: {
        total: 0,
        pending_review: 0,
        under_inspection: 0,
        approved: 0,
        rejected: 0
    }
};

const pendingVehiclesSlice = createSlice({
    name: "pendingVehicles",
    initialState,
    reducers: {
        clearPendingVehicles: (state) => {
            state.pendingVehicles = [];
            state.loading = false;
            state.success = false;
            state.error = null;
        },
        clearPendingVehicleCounts: (state) => {
            state.counts = {
                total: 0,
                pending_review: 0,
                under_inspection: 0,
                approved: 0,
                rejected: 0
            };
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPendingVehicles.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPendingVehicles.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.pendingVehicles = action.payload.data || [];
                state.pagination = {
                    ...state.pagination,
                    total: action.payload.pagination?.total || 0,
                    pages: action.payload.pagination?.pages || 1,
                    limit: action.payload.pagination?.limit || 20
                };
            })
            .addCase(fetchPendingVehicles.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchMyPendingVehicles.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMyPendingVehicles.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.pendingVehicles = action.payload.data || [];
                state.pagination = {
                    ...state.pagination,
                    total: action.payload.pagination?.total || 0,
                    pages: action.payload.pagination?.pages || 1,
                    limit: action.payload.pagination?.limit || 20
                };
            })
            .addCase(fetchMyPendingVehicles.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            })
            .addCase(fetchPendingVehicleCounts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchPendingVehicleCounts.fulfilled, (state, action) => {
                state.loading = false;
                state.success = true;
                state.counts = action.payload.data || initialState.counts;
            })
            .addCase(fetchPendingVehicleCounts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || action.error.message;
            });
    }
});

export const { clearPendingVehicles, clearPendingVehicleCounts } = pendingVehiclesSlice.actions;
export default pendingVehiclesSlice.reducer;