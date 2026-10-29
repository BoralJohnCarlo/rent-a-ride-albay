import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import { fetchStatistics } from "../../services/statisticsService";


const initialState = {
    data: null,

    loading: false,
    error: null,

    /* Only the newest request may write data — switching periods quickly
       must not let an older, slower response overwrite a newer one. */
    latestRequestId: null,
};


export const getStatistics =
    createAsyncThunk(
        "statistics/getStatistics",
        async (
            period = "30d",
            { rejectWithValue }
        ) => {
            try {
                return await fetchStatistics(
                    period
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch statistics."
                );
            }
        }
    );


const statisticsSlice = createSlice({
    name: "statistics",

    initialState,

    reducers: {
        clearStatisticsError: (state) => {
            state.error = null;
        },

        resetStatisticsState: (state) => {
            state.data = null;
            state.loading = false;
            state.error = null;
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(
                getStatistics.pending,
                (state, action) => {
                    state.latestRequestId =
                        action.meta.requestId;
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getStatistics.fulfilled,
                (state, action) => {
                    if (
                        action.meta.requestId !==
                        state.latestRequestId
                    ) {
                        return;
                    }

                    state.loading = false;
                    state.error = null;

                    state.data =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getStatistics.rejected,
                (state, action) => {
                    if (
                        action.meta.requestId !==
                        state.latestRequestId
                    ) {
                        return;
                    }

                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
});


export const {
    clearStatisticsError,
    resetStatisticsState,
} = statisticsSlice.actions;


export default statisticsSlice.reducer;
