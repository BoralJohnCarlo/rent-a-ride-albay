import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchFavorites,
    toggleVehicleFavorite,
    verifyFavorite,
} from "../../services/favoriteService";


const initialState = {
    favorites: [],

    favoriteIds: [],

    loading: false,
    error: null,
};

export const getFavorites =
    createAsyncThunk(
        "favorite/getFavorites",
        async (_, { rejectWithValue }) => {
            try {
                return await fetchFavorites();
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch favorites."
                );
            }
        }
    );


export const addOrRemoveFavorite =
    createAsyncThunk(
        "favorite/addOrRemoveFavorite",
        async (
            vehicleId,
            { rejectWithValue }
        ) => {
            try {
                return await toggleVehicleFavorite(
                    vehicleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to update favorite."
                );
            }
        }
    );


export const checkVehicleFavorite =
    createAsyncThunk(
        "favorite/checkVehicleFavorite",
        async (
            vehicleId,
            { rejectWithValue }
        ) => {
            try {
                return await verifyFavorite(
                    vehicleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to check favorite status."
                );
            }
        }
    );


const favoriteSlice = createSlice({
    name: "favorite",

    initialState,

    reducers: {
        clearFavoriteError(
            state
        ) {
            state.error =
                null;
        },

        clearFavorites(
            state
        ) {
            state.favorites =
                [];

            state.favoriteIds =
                [];

            state.error =
                null;
        },

        setFavoriteIds(
            state,
            action
        ) {
            state.favoriteIds =
                action.payload;
        },
    },

    extraReducers:
        (builder) => {
            builder

                .addCase(
                    getFavorites.pending,
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
                    getFavorites.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        state.favorites =
                            action.payload
                                ?.data ||
                            [];

                        state.favoriteIds =
                            state.favorites
                                .map(
                                    (
                                        vehicle
                                    ) =>
                                        vehicle._id ??
                                        vehicle.id
                                )
                                .filter(
                                    Boolean
                                );
                    }
                )

                .addCase(
                    getFavorites.rejected,
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
                    addOrRemoveFavorite.pending,
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
                    addOrRemoveFavorite.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        const responseData =
                            action.payload
                                ?.data ||
                            {};

                        const vehicle =
                            responseData.vehicle;

                        if (
                            responseData
                                .isFavorited
                        ) {
                            if (
                                vehicle &&
                                !state.favorites.some(
                                    (
                                        fav
                                    ) =>
                                        (fav._id ??
                                            fav.id) ===
                                        (vehicle
                                            ._id ??
                                            vehicle
                                                .id)
                                )
                            ) {
                                state.favorites.unshift(
                                    vehicle
                                );
                            }
                        } else {
                            state.favorites =
                                state.favorites.filter(
                                    (
                                        fav
                                    ) =>
                                        (fav._id ??
                                            fav.id) !==
                                        action.meta
                                            .arg
                                );
                        }

                        state.favoriteIds =
                            state.favorites
                                .map(
                                    (
                                        fav
                                    ) =>
                                        fav._id ??
                                        fav.id
                                )
                                .filter(
                                    Boolean
                                );
                    }
                )

                .addCase(
                    addOrRemoveFavorite.rejected,
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
                    checkVehicleFavorite.pending,
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
                    checkVehicleFavorite.fulfilled,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            null;

                        const vehicleId =
                            action.meta
                                .arg;

                        const isFavorited =
                            action.payload
                                ?.data
                                ?.isFavorited ||
                            false;

                        if (
                            isFavorited &&
                            !state.favoriteIds.includes(
                                vehicleId
                            )
                        ) {
                            state.favoriteIds.unshift(
                                vehicleId
                            );
                        } else if (
                            !isFavorited
                        ) {
                            state.favoriteIds =
                                state.favoriteIds.filter(
                                    (
                                        id
                                    ) =>
                                        id !==
                                        vehicleId
                                );
                        }
                    }
                )

                .addCase(
                    checkVehicleFavorite.rejected,
                    (
                        state,
                        action
                    ) => {
                        state.loading =
                            false;

                        state.error =
                            action.payload;
                    }
                );
        },
});

export const {
    clearFavoriteError,
    clearFavorites,
    setFavoriteIds,
} = favoriteSlice.actions;

export default favoriteSlice.reducer;
