import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchDrivers,
    fetchDriverById,
    createNewDriver,
    updateExistingDriver,
    archiveExistingDriver,
    restoreExistingDriver,
    changeDriverStatus,
    changeDriverAvailability,
} from "../../services/driverService";


const initialState = {
    drivers: [],

    selectedDriver: null,

    loading: false,
    error: null,

    filters: {
        search: "",
        status: "",
        availability: "",
        licenseType: "",
    },
};


export const getDrivers = createAsyncThunk(
    "driver/getDrivers",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchDrivers(filters);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch drivers."
            );
        }
    }
);


export const getDriverById = createAsyncThunk(
    "driver/getDriverById",
    async (driverId, { rejectWithValue }) => {
        try {
            return await fetchDriverById(
                driverId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch driver."
            );
        }
    }
);


export const createDriver = createAsyncThunk(
    "driver/createDriver",
    async (driverData, { rejectWithValue }) => {
        try {
            return await createNewDriver(
                driverData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to create driver."
            );
        }
    }
);


export const updateDriver = createAsyncThunk(
    "driver/updateDriver",
    async (
        { driverId, driverData },
        { rejectWithValue }
    ) => {
        try {
            return await updateExistingDriver(
                driverId,
                driverData
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to update driver."
            );
        }
    }
);


export const archiveDriver = createAsyncThunk(
    "driver/archiveDriver",
    async (
        { driverId, reason },
        { rejectWithValue }
    ) => {
        try {
            return await archiveExistingDriver(
                driverId,
                reason
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to archive driver."
            );
        }
    }
);


export const restoreDriver = createAsyncThunk(
    "driver/restoreDriver",
    async (driverId, { rejectWithValue }) => {
        try {
            return await restoreExistingDriver(
                driverId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to restore driver."
            );
        }
    }
);


export const updateDriverStatus =
    createAsyncThunk(
        "driver/updateDriverStatus",
        async (
            { driverId, status },
            { rejectWithValue }
        ) => {
            try {
                return await changeDriverStatus(
                    driverId,
                    status
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update driver status."
                );
            }
        }
    );


export const updateDriverAvailability =
    createAsyncThunk(
        "driver/updateDriverAvailability",
        async (
            {
                driverId,
                availability,
            },
            { rejectWithValue }
        ) => {
            try {
                return await changeDriverAvailability(
                    driverId,
                    availability
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update driver availability."
                );
            }
        }
    );


const driverSlice = createSlice({
    name: "driver",

    initialState,

    reducers: {
        clearDriverError: (state) => {
            state.error = null;
        },

        clearSelectedDriver: (state) => {
            state.selectedDriver = null;
        },

        setDriverFilters: (
            state,
            action
        ) => {
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetDriverFilters: (state) => {
            state.filters = {
                search: "",
                status: "",
                availability: "",
                licenseType: "",
            };
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(
                getDrivers.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getDrivers.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.drivers =
                        action.payload?.data ?? [];
                }
            )

            .addCase(
                getDrivers.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getDriverById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getDriverById.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedDriver =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getDriverById.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedDriver =
                        null;
                }
            )


            .addCase(
                createDriver.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createDriver.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const driver =
                        action.payload?.data;

                    if (driver) {
                        state.drivers.unshift(
                            driver
                        );

                        state.selectedDriver =
                            driver;
                    }
                }
            )

            .addCase(
                createDriver.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateDriver.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateDriver.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedDriver =
                        action.payload?.data;

                    if (!updatedDriver) {
                        return;
                    }

                    state.drivers =
                        state.drivers.map(
                            (driver) =>
                                driver._id ===
                                updatedDriver._id
                                    ? updatedDriver
                                    : driver
                        );

                    state.selectedDriver =
                        updatedDriver;
                }
            )

            .addCase(
                updateDriver.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                archiveDriver.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                archiveDriver.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedDriver =
                        action.payload?.data;

                    if (!updatedDriver) {
                        return;
                    }

                    state.drivers =
                        state.drivers.map(
                            (driver) =>
                                driver._id ===
                                updatedDriver._id
                                    ? updatedDriver
                                    : driver
                        );

                    state.selectedDriver =
                        updatedDriver;
                }
            )

            .addCase(
                archiveDriver.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                restoreDriver.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                restoreDriver.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedDriver =
                        action.payload?.data;

                    if (!updatedDriver) {
                        return;
                    }

                    state.drivers =
                        state.drivers.map(
                            (driver) =>
                                driver._id ===
                                updatedDriver._id
                                    ? updatedDriver
                                    : driver
                        );

                    state.selectedDriver =
                        updatedDriver;
                }
            )

            .addCase(
                restoreDriver.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateDriverStatus.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateDriverStatus.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedDriver =
                        action.payload?.data;

                    if (!updatedDriver) {
                        return;
                    }

                    state.drivers =
                        state.drivers.map(
                            (driver) =>
                                driver._id ===
                                updatedDriver._id
                                    ? updatedDriver
                                    : driver
                        );

                    state.selectedDriver =
                        updatedDriver;
                }
            )

            .addCase(
                updateDriverStatus.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateDriverAvailability.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateDriverAvailability.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedDriver =
                        action.payload?.data;

                    if (!updatedDriver) {
                        return;
                    }

                    state.drivers =
                        state.drivers.map(
                            (driver) =>
                                driver._id ===
                                updatedDriver._id
                                    ? updatedDriver
                                    : driver
                        );

                    state.selectedDriver =
                        updatedDriver;
                }
            )

            .addCase(
                updateDriverAvailability.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
});


export const {
    clearDriverError,
    clearSelectedDriver,
    setDriverFilters,
    resetDriverFilters,
} = driverSlice.actions;


export default driverSlice.reducer;