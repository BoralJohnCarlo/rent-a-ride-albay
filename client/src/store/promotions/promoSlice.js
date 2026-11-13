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

    ownerUserId: null,
    requestIds: {},

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
            delete state.requestIds.applyVoucher;
            state.loading = Object.keys(state.requestIds).length > 0;
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
                    (state, action) => {
                        state.requestIds.getVouchers = action.meta.requestId;
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
                        if (state.requestIds.getVouchers !== action.meta.requestId) return;
                        delete state.requestIds.getVouchers;
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
                        if (state.requestIds.getVouchers !== action.meta.requestId) return;
                        delete state.requestIds.getVouchers;
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getVoucherById.pending,
                    (state, action) => {
                        state.requestIds.getVoucherById = action.meta.requestId;
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
                        if (state.requestIds.getVoucherById !== action.meta.requestId) return;
                        delete state.requestIds.getVoucherById;
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
                        if (state.requestIds.getVoucherById !== action.meta.requestId) return;
                        delete state.requestIds.getVoucherById;
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    createVoucher.pending,
                    (state, action) => {
                        state.requestIds.createVoucher = action.meta.requestId;
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
                        if (state.requestIds.createVoucher !== action.meta.requestId) return;
                        delete state.requestIds.createVoucher;
                        // A response from before this change must not restore stale data.
                        delete state.requestIds.getVouchers;
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
                        if (state.requestIds.createVoucher !== action.meta.requestId) return;
                        delete state.requestIds.createVoucher;
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    updateVoucher.pending,
                    (state, action) => {
                        state.requestIds.updateVoucher = action.meta.requestId;
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
                        if (state.requestIds.updateVoucher !== action.meta.requestId) return;
                        delete state.requestIds.updateVoucher;
                        // A response from before this change must not restore stale data.
                        delete state.requestIds.getVouchers;
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
                        if (state.requestIds.updateVoucher !== action.meta.requestId) return;
                        delete state.requestIds.updateVoucher;
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    deleteVoucher.pending,
                    (state, action) => {
                        state.requestIds.deleteVoucher = action.meta.requestId;
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
                        if (state.requestIds.deleteVoucher !== action.meta.requestId) return;
                        delete state.requestIds.deleteVoucher;
                        // A response from before this change must not restore stale data.
                        delete state.requestIds.getVouchers;
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
                        if (state.requestIds.deleteVoucher !== action.meta.requestId) return;
                        delete state.requestIds.deleteVoucher;
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getAvailableVouchers.pending,
                    (state, action) => {
                        state.requestIds.getAvailableVouchers = action.meta.requestId;
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
                        if (state.requestIds.getAvailableVouchers !== action.meta.requestId) return;
                        delete state.requestIds.getAvailableVouchers;
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
                        if (state.requestIds.getAvailableVouchers !== action.meta.requestId) return;
                        delete state.requestIds.getAvailableVouchers;
                        state.availableVouchers = [];
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
                        state.requestIds.applyVoucher = action.meta.requestId;
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
                        if (state.requestIds.applyVoucher !== action.meta.requestId) return;
                        delete state.requestIds.applyVoucher;
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
                        if (state.requestIds.applyVoucher !== action.meta.requestId) return;
                        delete state.requestIds.applyVoucher;
                        state.loading =
                            false;

                        if (action.meta.aborted) return;

                        state.error =
                            action.payload;

                        state.appliedVoucher =
                            null;
                    }
                )
                .addMatcher(
                    (action) => action.type.startsWith("voucher/") &&
                        /\/(pending|fulfilled|rejected)$/.test(action.type),
                    (state) => {
                        // A list response must not enable checkout while voucher validation is pending.
                        state.loading = Object.keys(state.requestIds).length > 0;
                    }
                )
                .addMatcher(
                    (action) => ["auth/logout/fulfilled", "auth/sessionEnded",
                        "auth/getCurrentUser/rejected", "auth/login/rejected"].includes(action.type),
                    () => initialState
                )
                .addMatcher(
                    (action) => ["auth/login/fulfilled", "auth/getCurrentUser/fulfilled"].includes(action.type),
                    (state, action) => {
                        const user = action.payload?.data;
                        const id = user?._id ?? user?.id;
                        const ownerUserId = id ? String(id) : null;
                        if (state.ownerUserId !== ownerUserId) {
                            return { ...initialState, ownerUserId };
                        }
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
