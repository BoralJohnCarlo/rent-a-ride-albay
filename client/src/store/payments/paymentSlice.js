import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchPayments,
    fetchPaymentById,
    createNewPayment,
    verifyExistingPayment,
    cancelExistingPayment,
    createNewCheckout,
    reconcileExistingPayment,
    reconcileExistingPaymentRefund,
    sendExistingPaymentRefund,
    completeExistingPaymentRefund,
} from "../../services/paymentService";


const initialState = {
    payments: [],

    selectedPayment: null,

    loading: false,
    error: null,
};


export const getPayments = createAsyncThunk(
    "payment/getPayments",
    async (
        filters = {},
        { rejectWithValue }
    ) => {
        try {
            return await fetchPayments(
                filters
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch payments."
            );
        }
    }
);


export const getPaymentById =
    createAsyncThunk(
        "payment/getPaymentById",
        async (
            paymentId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchPaymentById(
                    paymentId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch payment."
                );
            }
        }
    );


export const createPayment =
    createAsyncThunk(
        "payment/createPayment",
        async (
            {
                bookingId,
                paymentMethod,
            },
            { rejectWithValue }
        ) => {
            try {
                return await createNewPayment(
                    bookingId,
                    paymentMethod
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to create payment."
                );
            }
        }
    );


export const verifyPayment =
    createAsyncThunk(
        "payment/verifyPayment",
        async (
            { paymentId, force = false },
            { rejectWithValue }
        ) => {
            try {
                return await verifyExistingPayment(
                    paymentId,
                    force
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to verify payment."
                );
            }
        }
    );


export const cancelPayment =
    createAsyncThunk(
        "payment/cancelPayment",
        async (
            paymentId,
            { rejectWithValue }
        ) => {
            try {
                return await cancelExistingPayment(
                    paymentId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to cancel payment."
                );
            }
        }
    );


export const createCheckout =
    createAsyncThunk(
        "payment/createCheckout",
        async (
            { paymentId, force = false },
            { rejectWithValue }
        ) => {
            try {
                return await createNewCheckout(
                    paymentId,
                    force
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to create checkout session."
                );
            }
        }
    );


export const reconcilePayment =
    createAsyncThunk(
        "payment/reconcilePayment",
        async (
            paymentId,
            { rejectWithValue }
        ) => {
            try {
                return await reconcileExistingPayment(
                    paymentId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reconcile payment."
                );
            }
        }
    );


export const reconcileRefund =
    createAsyncThunk(
        "payment/reconcileRefund",
        async (
            paymentId,
            { rejectWithValue }
        ) => {
            try {
                return await reconcileExistingPaymentRefund(
                    paymentId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reconcile refund."
                );
            }
        }
    );


export const sendRefund =
    createAsyncThunk(
        "payment/sendRefund",
        async (
            paymentId,
            { rejectWithValue }
        ) => {
            try {
                return await sendExistingPaymentRefund(
                    paymentId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to send refund."
                );
            }
        }
    );


export const completeRefund =
    createAsyncThunk(
        "payment/completeRefund",
        async (
            { paymentId, succeeded, notes },
            { rejectWithValue }
        ) => {
            try {
                return await completeExistingPaymentRefund(
                    paymentId,
                    { succeeded, notes }
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to complete refund."
                );
            }
        }
    );


const updatePaymentInState = (
    state,
    action
) => {
    const updatedPayment =
        action.payload?.data;

    if (!updatedPayment) {
        return;
    }

    state.payments =
        state.payments.map(
            (payment) =>
                payment._id ===
                updatedPayment._id
                    ? updatedPayment
                    : payment
        );

    state.selectedPayment =
        updatedPayment;
};


const paymentSlice = createSlice({
    name: "payment",

    initialState,

    reducers: {
        clearPaymentError: (state) => {
            state.error = null;
        },

        clearSelectedPayment: (state) => {
            state.selectedPayment = null;
        },

        resetPaymentState: (state) => {
            state.payments = [];
            state.selectedPayment = null;
            state.loading = false;
            state.error = null;
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(
                getPayments.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getPayments.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.payments =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getPayments.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getPaymentById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getPaymentById.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedPayment =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getPaymentById.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedPayment =
                        null;
                }
            )


            .addCase(
                createPayment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createPayment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const payment =
                        action.payload?.data;

                    if (payment) {
                        state.payments.unshift(
                            payment
                        );

                        state.selectedPayment =
                            payment;
                    }
                }
            )

            .addCase(
                createPayment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                verifyPayment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                verifyPayment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updatePaymentInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                verifyPayment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                cancelPayment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                cancelPayment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updatePaymentInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                cancelPayment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                createCheckout.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createCheckout.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const checkoutData =
                        action.payload?.data;

                    if (checkoutData) {
                        state.selectedPayment =
                            checkoutData.payment;
                    }
                }
            )

            .addCase(
                createCheckout.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            /*
             * Reconcile runs as a background poll; it must not toggle the
             * shared `loading` flag or the result page will flicker.
             */
            .addCase(
                reconcilePayment.fulfilled,
                (state, action) => {
                    state.error = null;

                    const updatedPayment =
                        action.payload?.data
                            ?.payment;

                    if (!updatedPayment) {
                        return;
                    }

                    state.selectedPayment =
                        updatedPayment;

                    state.payments =
                        state.payments.map(
                            (payment) =>
                                payment._id ===
                                updatedPayment._id
                                    ? updatedPayment
                                    : payment
                        );
                }
            )

            .addCase(
                reconcilePayment.rejected,
                (state, action) => {
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                reconcileRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                reconcileRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updatePaymentInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                reconcileRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                sendRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                sendRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updatePaymentInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                sendRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                completeRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                completeRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updatePaymentInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                completeRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
});


export const {
    clearPaymentError,
    clearSelectedPayment,
    resetPaymentState,
} = paymentSlice.actions;


export default paymentSlice.reducer;
