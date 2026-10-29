import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchRefunds,
    approveRefundRequest,
    rejectRefundRequest,
    settleRefundRequest,
} from "../../services/refundService";

const initialState = {
    refunds: [],
    pagination: null,
    summary: null,
    selectedRefund: null,
    loading: false,
    error: null,
};

export const getRefunds = createAsyncThunk(
    "refund/getRefunds",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchRefunds(filters);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch refunds."
            );
        }
    }
);

export const approveRefund = createAsyncThunk(
    "refund/approveRefund",
    async ({ rentalId, refundId, amount }, { rejectWithValue }) => {
        try {
            return await approveRefundRequest(rentalId, refundId, amount);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to approve refund request."
            );
        }
    }
);

export const rejectRefund = createAsyncThunk(
    "refund/rejectRefund",
    async ({ rentalId, refundId, note }, { rejectWithValue }) => {
        try {
            return await rejectRefundRequest(rentalId, refundId, note);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to reject refund request."
            );
        }
    }
);

export const settleRefund = createAsyncThunk(
    "refund/settleRefund",
    async (
        { rentalId, refundId, succeeded, notes },
        { rejectWithValue }
    ) => {
        try {
            return await settleRefundRequest(rentalId, refundId, {
                succeeded,
                notes,
            });
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to settle refund."
            );
        }
    }
);

const patchRefundStatus = (state, refundId, status) => {
    state.refunds = state.refunds.map((refund) =>
        refund._id === refundId
            ? {
                  ...refund,
                  status,
                  processedAt: new Date().toISOString(),
              }
            : refund
    );
};

const refundSlice = createSlice({
    name: "refund",

    initialState,

    reducers: {
        clearRefundError: (state) => {
            state.error = null;
        },

        clearSelectedRefund: (state) => {
            state.selectedRefund = null;
        },

        resetRefundState: (state) => {
            state.refunds = [];
            state.pagination = null;
            state.summary = null;
            state.selectedRefund = null;
            state.loading = false;
            state.error = null;
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(getRefunds.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(
                getRefunds.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.refunds = action.payload?.data ?? [];
                    state.pagination =
                        action.payload?.pagination ?? null;
                    state.summary =
                        action.payload?.summary ?? null;
                }
            )

            .addCase(
                getRefunds.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            )

            .addCase(approveRefund.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(
                approveRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    patchRefundStatus(
                        state,
                        action.meta.arg.refundId,
                        "Approved"
                    );
                }
            )

            .addCase(
                approveRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            )

            .addCase(rejectRefund.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(
                rejectRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    patchRefundStatus(
                        state,
                        action.meta.arg.refundId,
                        "Rejected"
                    );
                }
            )

            .addCase(
                rejectRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            )

            .addCase(settleRefund.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(
                settleRefund.fulfilled,
                (state, action) => {
                    state.loading = false;

                    const { refundId, succeeded, notes } =
                        action.meta.arg;

                    state.refunds = state.refunds.map((refund) =>
                        refund._id === refundId
                            ? {
                                  ...refund,
                                  gatewayStatus:
                                      succeeded === false
                                          ? "failed"
                                          : "succeeded",
                                  settledAt: new Date().toISOString(),
                                  settlementNote: notes || "",
                              }
                            : refund
                    );
                }
            )

            .addCase(
                settleRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error = action.payload;
                }
            );
    },
});

export const {
    clearRefundError,
    clearSelectedRefund,
    resetRefundState,
} = refundSlice.actions;

export default refundSlice.reducer;