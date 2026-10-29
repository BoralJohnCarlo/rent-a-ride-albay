import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    submitReview,
    fetchVehicleReviews,
    fetchDriverReviews,
    fetchRentalReview,
    fetchAllReviews,
    fetchVehicleAverageRating,
    fetchDriverAverageRating,
} from "../../services/reviewService";

const initialState = {
    reviews: [],
    selectedReview: null,
    averageRating: 0,
    reviewCount: 0,
    loading: false,
    error: null,
};

export const createReview = createAsyncThunk(
    "review/createReview",
    async (
        { bookingOrRentalId, reviewData },
        { rejectWithValue }
    ) => {
        try {
            return await submitReview(
                bookingOrRentalId,
                reviewData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to submit review."
            );
        }
    }
);

export const getVehicleReviews = createAsyncThunk(
    "review/getVehicleReviews",
    async (
        vehicleId,
        { rejectWithValue }
    ) => {
        try {
            return await fetchVehicleReviews(
                vehicleId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch vehicle reviews."
            );
        }
    }
);

export const getDriverReviews = createAsyncThunk(
    "review/getDriverReviews",
    async (
        driverId,
        { rejectWithValue }
    ) => {
        try {
            return await fetchDriverReviews(
                driverId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch driver reviews."
            );
        }
    }
);

export const getRentalReview = createAsyncThunk(
    "review/getRentalReview",
    async (
        rentalId,
        { rejectWithValue }
    ) => {
        try {
            return await fetchRentalReview(
                rentalId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch rental review."
            );
        }
    }
);

export const fetchAdminReviews = createAsyncThunk(
    "review/fetchAdminReviews",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchAllReviews();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch reviews."
            );
        }
    }
);

export const fetchVehicleRating = createAsyncThunk(
    "review/fetchVehicleRating",
    async (
        vehicleId,
        { rejectWithValue }
    ) => {
        try {
            return await fetchVehicleAverageRating(
                vehicleId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch vehicle rating."
            );
        }
    }
);

export const fetchDriverRating =
    createAsyncThunk(
        "review/fetchDriverRating",
        async (
            driverId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchDriverAverageRating(
                    driverId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        error.message ||
                        "Unable to fetch driver rating."
                );
            }
        }
    );

const reviewSlice = createSlice({
    name: "review",
    initialState,
    reducers: {
        clearReviewError: (state) => {
            state.error = null;
        },
        clearSelectedReview: (state) => {
            state.selectedReview = null;
        },
    },
    extraReducers: (builder) => {
        builder

            .addCase(createReview.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createReview.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.selectedReview = action.payload?.data ?? null;
                state.reviews.unshift(
                    action.payload?.data ?? null
                );
            })
            .addCase(createReview.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getVehicleReviews.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.reviews = action.payload?.data ?? [];
            })
            .addCase(getVehicleReviews.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getDriverReviews.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.reviews = action.payload?.data ?? [];
            })
            .addCase(getDriverReviews.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getRentalReview.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.selectedReview = action.payload?.data ?? null;
            })
            .addCase(getRentalReview.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(fetchAdminReviews.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.reviews = action.payload?.data ?? [];
            })
            .addCase(fetchAdminReviews.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(fetchVehicleRating.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                const payload = action.payload?.data ?? action.payload ?? {};
                state.averageRating = payload.averageRating ?? 0;
                state.reviewCount = payload.reviewCount ?? 0;
            })
            .addCase(fetchVehicleRating.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(fetchDriverRating.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                const payload = action.payload?.data ?? action.payload ?? {};
                state.averageRating = payload.averageRating ?? 0;
                state.reviewCount = payload.reviewCount ?? 0;
            })
            .addCase(fetchDriverRating.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const {
    clearReviewError,
    clearSelectedReview,
} = reviewSlice.actions;

export default reviewSlice.reducer;
