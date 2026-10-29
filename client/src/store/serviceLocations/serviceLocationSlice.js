import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchServiceLocations,
    fetchEnabledServiceLocations,
    fetchServiceLocationById,
    createNewServiceLocation,
    updateExistingServiceLocation,
    disableServiceLocationAction,
    enableServiceLocationAction,
    deleteServiceLocationAction,
} from "../../services/serviceLocationService";


const initialState = {
    serviceLocations: [],

    selectedServiceLocation: null,

    loading: false,

    error: null,
};


export const getServiceLocations =
    createAsyncThunk(
        "serviceLocation/getServiceLocations",
        async (_, { rejectWithValue }) => {
            try {
                return await fetchServiceLocations();
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch service locations."
                );
            }
        }
    );


export const getEnabledServiceLocations =
    createAsyncThunk(
        "serviceLocation/getEnabledServiceLocations",
        async (_, { rejectWithValue }) => {
            try {
                return await fetchEnabledServiceLocations();
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch enabled service locations."
                );
            }
        }
    );


export const getServiceLocationById =
    createAsyncThunk(
        "serviceLocation/getServiceLocationById",
        async (locationId, { rejectWithValue }) => {
            try {
                return await fetchServiceLocationById(
                    locationId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch service location."
                );
            }
        }
    );


export const createServiceLocation =
    createAsyncThunk(
        "serviceLocation/createServiceLocation",
        async (locationData, { rejectWithValue }) => {
            try {
                return await createNewServiceLocation(
                    locationData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to create service location."
                );
            }
        }
    );


export const updateServiceLocation =
    createAsyncThunk(
        "serviceLocation/updateServiceLocation",
        async (
            { locationId, locationData },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingServiceLocation(
                    locationId,
                    locationData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update service location."
                );
            }
        }
    );


export const disableServiceLocation =
    createAsyncThunk(
        "serviceLocation/disableServiceLocation",
        async (locationId, { rejectWithValue }) => {
            try {
                return await disableServiceLocationAction(
                    locationId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to disable service location."
                );
            }
        }
    );


export const enableServiceLocation =
    createAsyncThunk(
        "serviceLocation/enableServiceLocation",
        async (locationId, { rejectWithValue }) => {
            try {
                return await enableServiceLocationAction(
                    locationId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to enable service location."
                );
            }
        }
    );


export const deleteServiceLocation =
    createAsyncThunk(
        "serviceLocation/deleteServiceLocation",
        async (locationId, { rejectWithValue }) => {
            try {
                return await deleteServiceLocationAction(
                    locationId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to delete service location."
                );
            }
        }
    );


export const clearServiceLocationError =
    createAsyncThunk(
        "serviceLocation/clearServiceLocationError",
        async (_, { rejectWithValue }) => {
            return rejectWithValue(null);
        }
    );


const serviceLocationSlice =
    createSlice({
        name: "serviceLocation",
        initialState,
        reducers: {
            clearError: (state) => {
                state.error = null;
            },

            clearSelectedServiceLocation:
                (state) => {
                    state.selectedServiceLocation =
                        null;
                },
        },
        extraReducers: (builder) => {
            builder
                .addCase(
                    getServiceLocations.pending,
                    (state) => {
                        state.loading = true;
                        state.error = null;
                    }
                )
                .addCase(
                    getServiceLocations.fulfilled,
                    (state, action) => {
                        state.loading = false;
                        state.serviceLocations =
                            action.payload?.data ||
                            [];
                    }
                )
                .addCase(
                    getServiceLocations.rejected,
                    (state, action) => {
                        state.loading = false;
                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getEnabledServiceLocations.pending,
                    (state) => {
                        state.loading = true;
                        state.error = null;
                    }
                )
                .addCase(
                    getEnabledServiceLocations.fulfilled,
                    (state, action) => {
                        state.loading = false;
                        state.serviceLocations =
                            action.payload?.data ||
                            [];
                    }
                )
                .addCase(
                    getEnabledServiceLocations.rejected,
                    (state, action) => {
                        state.loading = false;
                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getServiceLocationById.fulfilled,
                    (state, action) => {
                        state.selectedServiceLocation =
                            action.payload?.data ||
                            null;
                    }
                )

                .addCase(
                    createServiceLocation.fulfilled,
                    (state, action) => {
                        state.serviceLocations.push(
                            action.payload?.data ||
                                {}
                        );
                    }
                )

                .addCase(
                    updateServiceLocation.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.serviceLocations.findIndex(
                                    (loc) =>
                                        loc._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.serviceLocations[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    disableServiceLocation.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.serviceLocations.findIndex(
                                    (loc) =>
                                        loc._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.serviceLocations[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    enableServiceLocation.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.serviceLocations.findIndex(
                                    (loc) =>
                                        loc._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.serviceLocations[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    deleteServiceLocation.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.serviceLocations.findIndex(
                                    (loc) =>
                                        loc._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.serviceLocations[
                                    index
                                ] = updated;
                            }
                        }
                    }
                );
        },
    });


export const {
    clearError,
    clearSelectedServiceLocation,
} = serviceLocationSlice.actions;

export default serviceLocationSlice.reducer;
