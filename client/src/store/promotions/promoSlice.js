import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchVouchers,
    fetchVoucherById,
    createNewVoucher,
    updateExistingVoucher,
    deleteExistingVoucher,
    fetchAvailableVouchers,
    applyExistingVoucher,
} from "../../services/voucherService";


const initialState = {
    vouchers: [],

    selectedVoucher: null,

    availableVouchers: [],

    appliedVoucher: null,

    loading: false,
    error: null,

    filters: {
        status: "",
        type: "",
        search: "",
    },
};


export const getVouchers =
    createAsyncThunk(
        "voucher/getVouchers",
        async (
            filters = {},
            { rejectWithValue }
        ) => {
            try {
                return (
                    await fetchVouchers(
                        filters
                    )
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                    "Unable to fetch vouchers."
                );
            }
        }
    );


export const getVoucherById =
    createAsyncThunk(
        "voucher/getVoucherById",
        async (
            voucherId,
            { rejectWithValue }
        ) => {
            try {
                return (
                    await fetchVoucherById(
                        voucherId
                    )
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                    "Unable to fetch voucher."
                );
            }
        }
    );


export const createVoucher =
    createAsyncThunk(
        "voucher/createVoucher",
        async (
            voucherData,
            { rejectWithValue }
        ) => {
            try {
                return (
                    await createNewVoucher(
                        voucherData
                    )
                );
            } catch (error) {
                const responseData =
                    error.response?.data;

                return rejectWithValue({
                    message:
                        responseData?.message ||
                        "Unable to create voucher.",

                    errors:
                        responseData?.errors ??
                        [],
                });
            }
        }
    );


export const updateVoucher =
    createAsyncThunk(
        "voucher/updateVoucher",
        async (
            {
                voucherId,
                voucherData,
            },
            { rejectWithValue }
        ) => {
            try {
                return (
                    await updateExistingVoucher(
                        voucherId,
                        voucherData
                    )
                );
            } catch (error) {
                const responseData =
                    error.response?.data;

                return rejectWithValue({
                    message:
                        responseData?.message ||
                        "Unable to update voucher.",

                    errors:
                        responseData?.errors ??
                        [],
                });
            }
        }
    );


export const deleteVoucher =
    createAsyncThunk(
        "voucher/deleteVoucher",
        async (
            voucherId,
            { rejectWithValue }
        ) => {
            try {
                return (
                    await deleteExistingVoucher(
                        voucherId
                    )
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                    "Unable to delete voucher."
                );
            }
        }
    );


export const getAvailableVouchers =
    createAsyncThunk(
        "voucher/getAvailableVouchers",
        async (_, { rejectWithValue }) => {
            try {
                return (
                    await fetchAvailableVouchers()
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch available vouchers."
                );
            }
        }
    );


export const applyVoucher =
    createAsyncThunk(
        "voucher/applyVoucher",
        async (
            {
                code,
                pricing,
            },
            { rejectWithValue }
        ) => {
            try {
                return (
                    await applyExistingVoucher(
                        code,
                        pricing
                    )
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                    "Voucher cannot be applied."
                );
            }
        }
    );


const voucherSlice = createSlice({
    name: "voucher",

    initialState,

    reducers: {
        clearVoucherError(
            state
        ) {
            state.error =
                null;
        },

        clearSelectedVoucher(
            state
        ) {
            state.selectedVoucher =
                null;
        },

        clearAppliedVoucher(
            state
        ) {
            state.voucherRequestId = null;
            state.appliedVoucher =
                null;

            state.error =
                null;
        },

        setVoucherFilters(
            state,
            action
        ) {
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetVoucherFilters(
            state
        ) {
            state.filters = {
                status: "",
                type: "",
                search: "",
            };
        },
    },

    extraReducers:
        (builder) => {
            builder

                .addCase(
                    getVouchers.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    getVouchers.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        state.vouchers =
                            action.payload
                                ?.data ||
                            [];
                    }
                )

                .addCase(
                    getVouchers.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getVoucherById.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    getVoucherById.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        state.selectedVoucher =
                            action.payload
                                ?.data ||
                            null;
                    }
                )

                .addCase(
                    getVoucherById.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    createVoucher.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    createVoucher.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        const newVoucher =
                            action.payload
                                ?.data;

                        if (newVoucher) {
                            state.vouchers.unshift(
                                newVoucher
                            );
                        }
                    }
                )

                .addCase(
                    createVoucher.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    updateVoucher.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    updateVoucher.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        const updatedVoucher =
                            action.payload
                                ?.data;

                        if (updatedVoucher) {
                            state.vouchers =
                                state.vouchers.map(
                                    (voucher) =>
                                        voucher._id ===
                                        updatedVoucher._id
                                            ? updatedVoucher
                                            : voucher
                                );

                            if (
                                state.selectedVoucher
                                    ?._id ===
                                updatedVoucher._id
                            ) {
                                state.selectedVoucher =
                                    updatedVoucher;
                            }
                        }
                    }
                )

                .addCase(
                    updateVoucher.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    deleteVoucher.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    deleteVoucher.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        const deletedVoucherId =
                            action.meta
                                .arg;

                        state.vouchers =
                            state.vouchers.filter(
                                (voucher) =>
                                    voucher._id !==
                                    deletedVoucherId
                            );

                        if (
                            state.selectedVoucher
                                ?._id ===
                            deletedVoucherId
                        ) {
                            state.selectedVoucher =
                                null;
                        }
                    }
                )

                .addCase(
                    deleteVoucher.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getAvailableVouchers.pending,
                    (
                        state
                    ) => {
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    getAvailableVouchers.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        state.availableVouchers =
                            action.payload
                                ?.data ||
                            [];
                    }
                )

                .addCase(
                    getAvailableVouchers.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    applyVoucher.pending,
                    (
                        state, action
                    ) => {
                        state.voucherRequestId = action.meta.requestId;
                        state.loading =
                            true;

                        state.error =
                            null;
                    }
                )

                .addCase(
                    applyVoucher.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        if (state.voucherRequestId !== action.meta.requestId) return;
                        state.loading =
                            false;

                        state.error =
                            null;

                        state.appliedVoucher =
                            action.payload
                                ?.data ||
                            null;
                    }
                )

                .addCase(
                    applyVoucher.rejected,
                    (
                        state,
                        action
                    ) => {
                        if (state.voucherRequestId !== action.meta.requestId) return;
                        state.loading =
                            false;

                        if (action.meta.aborted) return;

                        state.error =
                            action.payload;

                        state.appliedVoucher =
                            null;
                    }
                );
        },
});


export const {
    clearVoucherError,
    clearSelectedVoucher,
    clearAppliedVoucher,
    setVoucherFilters,
    resetVoucherFilters,
} = voucherSlice.actions;

export default voucherSlice.reducer;
