import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchBookings,
    fetchBookingById,
    createNewBooking,
    updateExistingBooking,
    approveExistingBooking,
    rejectExistingBooking,
    cancelExistingBooking,
    expireExistingBooking,
    markExistingBookingNoShow,
    requestExistingBookingExtension,
    approveExistingBookingExtension,
    rejectExistingBookingExtension,
    cancelExistingBookingExtension,
} from "../../services/bookingService";


const initialState = {
    bookings: [],

    selectedBooking: null,

    loading: false,
    error: null,

    ownerUserId: null,
    requestIds: {},
    pendingRequests: {},
    selectionRevision: 0,
    selectedBookingId: null,

    filters: {
        customer: "",
        vehicle: "",
        driver: "",
        status: "",
        driverOption: "",
    },
};


export const getBookings = createAsyncThunk(
    "booking/getBookings",
    async (
        filters = {},
        { rejectWithValue }
    ) => {
        try {
            return await fetchBookings(
                filters
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch bookings."
            );
        }
    }
);


export const getBookingById =
    createAsyncThunk(
        "booking/getBookingById",
        async (
            bookingId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchBookingById(
                    bookingId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch booking."
                );
            }
        }
    );


export const createBooking =
    createAsyncThunk(
        "booking/createBooking",
        async (
            bookingData,
            { rejectWithValue }
        ) => {
            try {
                return await createNewBooking(
                    bookingData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to create booking."
                );
            }
        }
    );


export const updateBooking =
    createAsyncThunk(
        "booking/updateBooking",
        async (
            {
                bookingId,
                bookingData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingBooking(
                    bookingId,
                    bookingData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to update booking."
                );
            }
        }
    );


export const approveBooking =
    createAsyncThunk(
        "booking/approveBooking",
        async (
            { bookingId, driverId = null },
            { rejectWithValue }
        ) => {
            try {
                return await approveExistingBooking(
                    bookingId,
                    driverId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to approve booking."
                );
            }
        }
    );


export const rejectBooking =
    createAsyncThunk(
        "booking/rejectBooking",
        async (
            {
                bookingId,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await rejectExistingBooking(
                    bookingId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reject booking."
                );
            }
        }
    );


export const cancelBooking =
    createAsyncThunk(
        "booking/cancelBooking",
        async (
            {
                bookingId,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await cancelExistingBooking(
                    bookingId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to cancel booking."
                );
            }
        }
    );


export const expireBooking =
    createAsyncThunk(
        "booking/expireBooking",
        async (
            bookingId,
            { rejectWithValue }
        ) => {
            try {
                return await expireExistingBooking(
                    bookingId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to expire booking."
                );
            }
        }
    );

export const markBookingNoShow =
    createAsyncThunk(
        "booking/markBookingNoShow",
        async (
            { bookingId, ignorePickupBlocker = false },
            { rejectWithValue }
        ) => {
            try {
                return await markExistingBookingNoShow(
                    bookingId,
                    { ignorePickupBlocker }
                );
            } catch (error) {
                const message =
                    error.response?.data
                        ?.message ||
                    "Unable to mark the booking as a no-show.";

                const details =
                    error.response?.data?.errors;

                // Something on our side stopped the pickup: the page asks
                // the admin to confirm before trying again.
                return rejectWithValue(
                    details?.code === "PICKUP_BLOCKED"
                        ? {
                              message,
                              pickupBlocker:
                                  details.pickupBlocker,
                          }
                        : message
                );
            }
        }
    );

    export const requestBookingExtension =
    createAsyncThunk(
        "booking/requestBookingExtension",
        async (
            {
                bookingId,
                extensionData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await requestExistingBookingExtension(
                    bookingId,
                    extensionData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to request booking extension."
                );
            }
        }
    );


export const approveBookingExtension =
    createAsyncThunk(
        "booking/approveBookingExtension",
        async (
            {
                bookingId,
                extensionId,
            },
            { rejectWithValue }
        ) => {
            try {
                return await approveExistingBookingExtension(
                    bookingId,
                    extensionId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to approve booking extension."
                );
            }
        }
    );


export const rejectBookingExtension =
    createAsyncThunk(
        "booking/rejectBookingExtension",
        async (
            {
                bookingId,
                extensionId,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await rejectExistingBookingExtension(
                    bookingId,
                    extensionId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reject booking extension."
                );
            }
        }
    );


export const cancelBookingExtension =
    createAsyncThunk(
        "booking/cancelBookingExtension",
        async (
            {
                bookingId,
                extensionId,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await cancelExistingBookingExtension(
                    bookingId,
                    extensionId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to cancel booking extension."
                );
            }
        }
    );

const invalidateRead = (state, type) => {
    const id = state.requestIds[type];
    if (id) delete state.pendingRequests[id];
    delete state.requestIds[type];
    state.loading = Object.keys(state.pendingRequests).length > 0;
};

const bookingSlice = createSlice({
    name: "booking",

    initialState,

    reducers: {
        clearBookingError: (state) => {
            state.error = null;
        },

        clearSelectedBooking: (state) => {
            state.selectedBooking = null;
            state.selectedBookingId = null;
            state.selectionRevision += 1;
            invalidateRead(state, "booking/getBookingById");
        },

        setBookingFilters: (
            state,
            action
        ) => {
            invalidateRead(state, "booking/getBookings");
            state.bookings = [];
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetBookingFilters: (state) => {
            invalidateRead(state, "booking/getBookings");
            state.bookings = [];
            state.filters = {
                customer: "",
                vehicle: "",
                driver: "",
                status: "",
                driverOption: "",
            };
        },
    },

    extraReducers: (builder) => {
        const reads = [getBookings, getBookingById];
        const mutations = [createBooking, updateBooking, approveBooking, rejectBooking,
            cancelBooking, expireBooking, markBookingNoShow, requestBookingExtension,
            approveBookingExtension, rejectBookingExtension, cancelBookingExtension];
        for (const thunk of [...reads, ...mutations]) {
            const type = thunk.typePrefix;
            const isRead = reads.includes(thunk);
            builder.addCase(thunk.pending, (state, action) => {
                if (isRead) invalidateRead(state, type);
                if (thunk === getBookingById) {
                    state.selectedBooking = null;
                    state.selectedBookingId = action.meta.arg;
                    state.selectionRevision += 1;
                }
                state.requestIds[type] = action.meta.requestId;
                state.pendingRequests[action.meta.requestId] = {
                    type, selectionRevision: state.selectionRevision,
                };
                state.loading = true;
                state.error = null;
            });
            builder.addCase(thunk.fulfilled, (state, action) => {
                const pending = state.pendingRequests[action.meta.requestId];
                if (!pending || (isRead && state.requestIds[type] !== action.meta.requestId)) return;
                delete state.pendingRequests[action.meta.requestId];
                if (state.requestIds[type] === action.meta.requestId) delete state.requestIds[type];
                state.loading = Object.keys(state.pendingRequests).length > 0;
                state.error = null;
                const data = action.payload?.data;
                if (thunk === getBookings) {
                    state.bookings = data ?? [];
                } else if (thunk === getBookingById) {
                    state.selectedBooking = data ?? null;
                } else if (data) {
                    // A list started before a successful mutation cannot undo it.
                    invalidateRead(state, getBookings.typePrefix);
                    if (thunk === createBooking) {
                        state.bookings = [data, ...state.bookings.filter(booking => booking._id !== data._id)];
                    } else {
                        state.bookings = state.bookings.map(booking => booking._id === data._id ? data : booking);
                    }
                    const sameSelection = String(state.selectedBookingId || state.selectedBooking?._id || "") === String(data._id);
                    if (sameSelection || (thunk === createBooking && pending.selectionRevision === state.selectionRevision)) {
                        invalidateRead(state, getBookingById.typePrefix);
                        state.selectedBooking = data;
                        state.selectedBookingId = data._id;
                    }
                }
            });
            builder.addCase(thunk.rejected, (state, action) => {
                if (!state.pendingRequests[action.meta.requestId] || (isRead && state.requestIds[type] !== action.meta.requestId)) return;
                delete state.pendingRequests[action.meta.requestId];
                if (state.requestIds[type] === action.meta.requestId) delete state.requestIds[type];
                state.loading = Object.keys(state.pendingRequests).length > 0;
                state.error = typeof action.payload === "string" ? action.payload : action.payload?.message ?? null;
                if (thunk === getBookingById) state.selectedBooking = null;
            });
        }
        for (const type of ["auth/logout/fulfilled", "auth/sessionEnded", "auth/getCurrentUser/rejected", "auth/login/rejected"]) {
            builder.addCase(type, () => initialState);
        }
        for (const type of ["auth/login/fulfilled", "auth/getCurrentUser/fulfilled"]) {
            builder.addCase(type, (state, action) => {
                const id = action.payload?.data?._id ?? action.payload?.data?.id;
                const ownerUserId = id ? String(id) : null;
                if (type === "auth/login/fulfilled" || state.ownerUserId !== ownerUserId) return { ...initialState, ownerUserId };
            });
        }
    },
});


export const {
    clearBookingError,
    clearSelectedBooking,
    setBookingFilters,
    resetBookingFilters,
} = bookingSlice.actions;


export default bookingSlice.reducer;
