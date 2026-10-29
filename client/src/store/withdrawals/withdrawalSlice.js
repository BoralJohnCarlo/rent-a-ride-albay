import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    submitWithdrawal,
    fetchMyWithdrawals,
    fetchAllWithdrawals,
} from "../../services/withdrawalService";

const initialState = {
    withdrawals: [],
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    },
    loading: false,
    error: null,
};

export const createWithdrawal = createAsyncThunk(
    "withdrawals/createWithdrawal",
    async (withdrawalData, { rejectWithValue }) => {
        try {
            return await submitWithdrawal(
                withdrawalData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to submit withdrawal request."
            );
        }
    }
);

export const getMyWithdrawals = createAsyncThunk(
    "withdrawals/getMyWithdrawals",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchMyWithdrawals(params);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch your withdrawals."
            );
        }
    }
);

export const getAllWithdrawals = createAsyncThunk(
    "withdrawals/getAllWithdrawals",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchAllWithdrawals(params);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch withdrawals."
            );
        }
    }
);

const applyListPayload = (state, action) => {
    state.loading = false;
    state.error = null;
    state.withdrawals = action.payload?.data ?? [];
    state.pagination =
        action.payload?.pagination ?? state.pagination;
};

const withdrawalSlice = createSlice({
    name: "withdrawals",
    initialState,
    reducers: {
        clearWithdrawalError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(createWithdrawal.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createWithdrawal.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                const withdrawal = action.payload?.data;
                if (withdrawal) {
                    state.withdrawals.unshift(withdrawal);
                }
            })
            .addCase(createWithdrawal.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getMyWithdrawals.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getMyWithdrawals.fulfilled, applyListPayload)
            .addCase(getMyWithdrawals.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getAllWithdrawals.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getAllWithdrawals.fulfilled, applyListPayload)
            .addCase(getAllWithdrawals.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const {
    clearWithdrawalError,
} = withdrawalSlice.actions;

export default withdrawalSlice.reducer;
