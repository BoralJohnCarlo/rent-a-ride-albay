import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchMyWallet,
    fetchOperatorWallet,
} from "../../services/walletService";

const initialState = {
    wallet: null,
    transactions: [],
    pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    },
    loading: false,
    error: null,
};

export const getMyWallet = createAsyncThunk(
    "wallets/getMyWallet",
    async (params, { rejectWithValue }) => {
        try {
            return await fetchMyWallet(params);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch your wallet."
            );
        }
    }
);

export const getOperatorWallet = createAsyncThunk(
    "wallets/getOperatorWallet",
    async (
        { operatorId, params },
        { rejectWithValue }
    ) => {
        try {
            return await fetchOperatorWallet(
                operatorId,
                params
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch operator wallet."
            );
        }
    }
);

const applyWalletPayload = (state, action) => {
    state.loading = false;
    state.error = null;
    state.wallet = action.payload?.data?.wallet ?? null;
    state.transactions =
        action.payload?.data?.transactions ?? [];
    state.pagination =
        action.payload?.pagination ?? state.pagination;
};

const walletSlice = createSlice({
    name: "wallets",
    initialState,
    reducers: {
        clearWalletError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getMyWallet.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getMyWallet.fulfilled, applyWalletPayload)
            .addCase(getMyWallet.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getOperatorWallet.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(
                getOperatorWallet.fulfilled,
                applyWalletPayload
            )
            .addCase(
                getOperatorWallet.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            );
    },
});

export const { clearWalletError } = walletSlice.actions;

export default walletSlice.reducer;
