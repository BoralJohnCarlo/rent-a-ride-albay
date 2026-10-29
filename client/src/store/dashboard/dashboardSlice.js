import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import { fetchDashboardData } from "../../services/dashboardService";

const initialState = {
    stats: [],
    revenue: {
        total: 0,
        growth: 0,
        period: "This Month",
    },
    fleetSummary: {
        available: 0,
        reserved: 0,
        rented: 0,
        maintenance: 0,
    },
    recentBookings: [],
    recentPayments: [],
    loading: false,
    error: null,
};

export const getDashboardData = createAsyncThunk(
    "dashboard/getDashboardData",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchDashboardData();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch dashboard data."
            );
        }
    }
);

const dashboardSlice = createSlice({
    name: "dashboard",
    initialState,
    reducers: {
        clearDashboardError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder

            .addCase(
                getDashboardData.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getDashboardData.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const payload =
                        action.payload?.data;

                    if (payload) {
                        state.stats = payload.stats || [];
                        state.revenue = payload.revenue || initialState.revenue;
                        state.fleetSummary = payload.fleetSummary || initialState.fleetSummary;
                        state.recentBookings = payload.recentBookings || [];
                        state.recentPayments = payload.recentPayments || [];
                    }
                }
            )

            .addCase(
                getDashboardData.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            );
    },
});

export const {
    clearDashboardError,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
