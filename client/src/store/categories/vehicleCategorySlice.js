import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchVehicleCategories,
    fetchVehicleCategoryById,
    createNewVehicleCategory,
    updateExistingVehicleCategory,
    changeVehicleCategoryStatus,
    removeVehicleCategory,
} from "../../services/vehicleCategoryService";

const initialState = {
    vehicleCategories: [],
    selectedVehicleCategory: null,

    loading: false,
    error: null,

    filters: {
        search: "",
        status: "",
        vehicleType: "",
    },
};

export const getVehicleCategories = createAsyncThunk(
    "vehicleCategory/getVehicleCategories",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchVehicleCategories(
                filters
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch vehicle categories."
            );
        }
    }
);

export const getVehicleCategoryById =
    createAsyncThunk(
        "vehicleCategory/getVehicleCategoryById",
        async (
            categoryId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchVehicleCategoryById(
                    categoryId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch vehicle category."
                );
            }
        }
    );

export const createVehicleCategory =
    createAsyncThunk(
        "vehicleCategory/createVehicleCategory",
        async (
            categoryData,
            { rejectWithValue }
        ) => {
            try {
                return await createNewVehicleCategory(
                    categoryData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to create vehicle category."
                );
            }
        }
    );

export const updateVehicleCategory =
    createAsyncThunk(
        "vehicleCategory/updateVehicleCategory",
        async (
            {
                categoryId,
                categoryData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingVehicleCategory(
                    categoryId,
                    categoryData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update vehicle category."
                );
            }
        }
    );

export const updateVehicleCategoryStatus =
    createAsyncThunk(
        "vehicleCategory/updateVehicleCategoryStatus",
        async (
            {
                categoryId,
                status,
            },
            { rejectWithValue }
        ) => {
            try {
                return await changeVehicleCategoryStatus(
                    categoryId,
                    status
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update vehicle category status."
                );
            }
        }
    );

export const deleteVehicleCategory =
    createAsyncThunk(
        "vehicleCategory/deleteVehicleCategory",
        async (
            categoryId,
            { rejectWithValue }
        ) => {
            try {
                await removeVehicleCategory(
                    categoryId
                );

                return categoryId;
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to delete vehicle category."
                );
            }
        }
    );

const vehicleCategorySlice = createSlice({
    name: "vehicleCategory",

    initialState,

    reducers: {
        clearVehicleCategoryError: (state) => {
            state.error = null;
        },

        clearSelectedVehicleCategory: (
            state
        ) => {
            state.selectedVehicleCategory =
                null;
        },

        setVehicleCategoryFilters: (
            state,
            action
        ) => {
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetVehicleCategoryFilters: (
            state
        ) => {
            state.filters = {
                search: "",
                status: "",
                vehicleType: "",
            };
        },
    },

    extraReducers: (builder) => {
        // Get Vehicle Categories

        builder

            .addCase(
                getVehicleCategories.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getVehicleCategories.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.vehicleCategories =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getVehicleCategories.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Get Vehicle Category By ID

            .addCase(
                getVehicleCategoryById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getVehicleCategoryById.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedVehicleCategory =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getVehicleCategoryById.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedVehicleCategory =
                        null;
                }
            )

            // Create Vehicle Category

            .addCase(
                createVehicleCategory.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createVehicleCategory.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const vehicleCategory =
                        action.payload?.data;

                    if (
                        vehicleCategory
                    ) {
                        state.vehicleCategories.unshift(
                            vehicleCategory
                        );

                        state.selectedVehicleCategory =
                            vehicleCategory;
                    }
                }
            )

            .addCase(
                createVehicleCategory.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Vehicle Category

            .addCase(
                updateVehicleCategory.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicleCategory.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedCategory =
                        action.payload?.data;

                    if (
                        !updatedCategory
                    ) {
                        return;
                    }

                    state.vehicleCategories =
                        state.vehicleCategories.map(
                            (
                                vehicleCategory
                            ) =>
                                vehicleCategory._id ===
                                updatedCategory._id
                                    ? updatedCategory
                                    : vehicleCategory
                        );

                    state.selectedVehicleCategory =
                        updatedCategory;
                }
            )

            .addCase(
                updateVehicleCategory.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Vehicle Category Status

            .addCase(
                updateVehicleCategoryStatus.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicleCategoryStatus.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedCategory =
                        action.payload?.data;

                    if (!updatedCategory) {
                        return;
                    }

                    state.vehicleCategories =
                        state.vehicleCategories.map(
                            (
                                vehicleCategory
                            ) =>
                                vehicleCategory._id ===
                                updatedCategory._id
                                    ? updatedCategory
                                    : vehicleCategory
                        );

                    if (
                        state
                            .selectedVehicleCategory
                            ?._id ===
                        updatedCategory._id
                    ) {
                        state.selectedVehicleCategory =
                            updatedCategory;
                    }
                }
            )

            .addCase(
                updateVehicleCategoryStatus.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Delete Vehicle Category

            .addCase(
                deleteVehicleCategory.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                deleteVehicleCategory.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.vehicleCategories =
                        state.vehicleCategories.filter(
                            (
                                vehicleCategory
                            ) =>
                                vehicleCategory._id !==
                                action.payload
                        );

                    if (
                        state
                            .selectedVehicleCategory
                            ?._id ===
                        action.payload
                    ) {
                        state.selectedVehicleCategory =
                            null;
                    }
                }
            )

            .addCase(
                deleteVehicleCategory.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )
    },
});

export const {
    clearVehicleCategoryError,
    clearSelectedVehicleCategory,
    setVehicleCategoryFilters,
    resetVehicleCategoryFilters,
} = vehicleCategorySlice.actions;

export default vehicleCategorySlice.reducer;