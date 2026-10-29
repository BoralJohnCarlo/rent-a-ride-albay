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

const bookingSlice = createSlice({
    name: "booking",

    initialState,

    reducers: {
        clearBookingError: (state) => {
            state.error = null;
        },

        clearSelectedBooking: (state) => {
            state.selectedBooking = null;
        },

        setBookingFilters: (
            state,
            action
        ) => {
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetBookingFilters: (state) => {
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
        builder

            .addCase(
                getBookings.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getBookings.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.bookings =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getBookings.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getBookingById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getBookingById.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedBooking =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getBookingById.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedBooking =
                        null;
                }
            )


            .addCase(
                createBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const booking =
                        action.payload?.data;

                    if (booking) {
                        state.bookings.unshift(
                            booking
                        );

                        state.selectedBooking =
                            booking;
                    }
                }
            )

            .addCase(
                createBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                updateBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                approveBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                approveBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                approveBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                rejectBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                rejectBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                rejectBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                cancelBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                cancelBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                cancelBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                expireBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                expireBooking.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

                        .addCase(
                expireBooking.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                markBookingNoShow.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                markBookingNoShow.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                markBookingNoShow.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        typeof action.payload === "string"
                            ? action.payload
                            : action.payload?.message ?? null;
                }
            )


            .addCase(
                requestBookingExtension.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                requestBookingExtension.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                requestBookingExtension.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                approveBookingExtension.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                approveBookingExtension.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                approveBookingExtension.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                rejectBookingExtension.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                rejectBookingExtension.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                rejectBookingExtension.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                cancelBookingExtension.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                cancelBookingExtension.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedBooking =
                        action.payload?.data;

                    if (!updatedBooking) {
                        return;
                    }

                    state.bookings =
                        state.bookings.map(
                            (booking) =>
                                booking._id ===
                                updatedBooking._id
                                    ? updatedBooking
                                    : booking
                        );

                    state.selectedBooking =
                        updatedBooking;
                }
            )

            .addCase(
                cancelBookingExtension.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
    
});


export const {
    clearBookingError,
    clearSelectedBooking,
    setBookingFilters,
    resetBookingFilters,
} = bookingSlice.actions;


export default bookingSlice.reducer;