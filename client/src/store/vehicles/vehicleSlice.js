import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchVehicles,
    fetchMyVehicles,
    fetchVehicleCounts,
    fetchVehicleById,
    createNewVehicle,
    updateExistingVehicle,
    archiveExistingVehicle,
    restoreExistingVehicle,
    changeVehicleStatus,
    changeVehicleCondition,
    changeVehicleBooking,
    fetchVehicleAvailability,
    checkVehicleAvailability as checkVehicleAvailabilityService,
    addBlockedVehicleDate as addBlockedVehicleDateService,
    removeBlockedVehicleDate as removeBlockedVehicleDateService,
    changeFeaturedVehicle,
    checkPlateNumberExists,
    checkRegistrationNumberExists,
    renewExistingVehicleRegistration,
    setExistingVehicleRegistrationAvailability,
    fetchVehicleRegistrationRenewalEligibility,
    requestExistingVehicleRegistrationRenewalAttempt,
    grantExistingVehicleRegistrationRenewalAttempt,
} from "../../services/vehicleService";

const initialState = {
    vehicles: [],

    counts: {
        active: 0,
        archived: 0,
        total: 0,
        company: 0,
        consigned: 0,
    },

    selectedVehicle: null,

    availability: null,

    availabilityCheck: null,

    registrationRenewalEligibility: null,

    loading: false,
    error: null,

    filters: {
        search: "",
        status: "",
        vehicleType: "",
        brand: "",
        category: "",
        isFeatured: "",
    },
};

export const getVehicles = createAsyncThunk(
    "vehicle/getVehicles",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchVehicles(filters);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch vehicles."
            );
        }
    }
);

export const getMyVehicles = createAsyncThunk(
    "vehicle/getMyVehicles",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchMyVehicles(filters);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch your vehicles."
            );
        }
    }
);

export const getVehicleCounts = createAsyncThunk(
    "vehicle/getVehicleCounts",
    async (filters = {}, { rejectWithValue }) => {
        try {
            return await fetchVehicleCounts(filters);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch vehicle counts."
            );
        }
    }
);

export const getVehicleById = createAsyncThunk(
    "vehicle/getVehicleById",
    async (vehicleId, { rejectWithValue }) => {
        try {
            return await fetchVehicleById(
                vehicleId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch vehicle."
            );
        }
    }
);

/*
 * Check Plate Number Exists
 *
 * Check if a plate number already exists in the database.
 */
export const checkPlateNumberAvailability = createAsyncThunk(
    "vehicle/checkPlateNumberAvailability",
    async (arg, { rejectWithValue }) => {
        const { plateNumber, excludeId } =
            typeof arg === "string" ? { plateNumber: arg } : arg || {};

        try {
            const response = await checkPlateNumberExists(
                plateNumber,
                excludeId
            );
            return response;
        } catch (error) {
            const responseData = error.response?.data;
            return rejectWithValue({
                message: responseData?.message || "Unable to check plate number.",
            });
        }
    }
);

/*
 * Check Registration Number Exists
 *
 * Check if a registration number already exists in the database.
 */
export const checkRegistrationNumberAvailability = createAsyncThunk(
    "vehicle/checkRegistrationNumberAvailability",
    async (arg, { rejectWithValue }) => {
        const { registrationNumber, excludeId } =
            typeof arg === "string" ? { registrationNumber: arg } : arg || {};

        try {
            const response = await checkRegistrationNumberExists(
                registrationNumber,
                excludeId
            );
            return response;
        } catch (error) {
            const responseData = error.response?.data;
            return rejectWithValue({
                message: responseData?.message || "Unable to check registration number.",
            });
        }
    }
);

/*
 * Create Vehicle
 *
 * Preserve the backend validation details so the
 * Vehicle dialog/form can display field-level errors.
 */
export const createVehicle = createAsyncThunk(
    "vehicle/createVehicle",
    async (
        vehicleData,
        { rejectWithValue }
    ) => {
        try {
            return await createNewVehicle(
                vehicleData
            );
        } catch (error) {
            const responseData =
                error.response?.data;

            return rejectWithValue({
                message:
                    responseData?.message ||
                    "Unable to create vehicle.",

                errors:
                    responseData?.errors ?? [],
            });
        }
    }
);

/*
 * Update Vehicle
 *
 * Preserve the backend validation details so the
 * Vehicle dialog/form can display field-level errors.
 */
export const updateVehicle = createAsyncThunk(
    "vehicle/updateVehicle",
    async (
        { vehicleId, vehicleData },
        { rejectWithValue }
    ) => {
        try {
            return await updateExistingVehicle(
                vehicleId,
                vehicleData
            );
        } catch (error) {
            const responseData =
                error.response?.data;

            return rejectWithValue({
                message:
                    responseData?.message ||
                    "Unable to update vehicle.",

                errors:
                    responseData?.errors ?? [],
            });
        }
    }
);

export const archiveVehicle = createAsyncThunk(
    "vehicle/archiveVehicle",
    async (
        { vehicleId, archiveReason },
        { rejectWithValue }
    ) => {
        try {
            return await archiveExistingVehicle(
                vehicleId,
                archiveReason
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to archive vehicle."
            );
        }
    }
);

export const restoreVehicle = createAsyncThunk(
    "vehicle/restoreVehicle",
    async (
        vehicleId,
        { rejectWithValue }
    ) => {
        try {
            return await restoreExistingVehicle(
                vehicleId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to restore vehicle."
            );
        }
    }
);

export const updateVehicleStatus =
    createAsyncThunk(
        "vehicle/updateVehicleStatus",
        async (
            { vehicleId, status },
            { rejectWithValue }
        ) => {
            try {
                return await changeVehicleStatus(
                    vehicleId,
                    status
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update vehicle status."
                );
            }
        }
    );

export const updateVehicleCondition =
    createAsyncThunk(
        "vehicle/updateVehicleCondition",
        async (
            { vehicleId, condition },
            { rejectWithValue }
        ) => {
            try {
                return await changeVehicleCondition(
                    vehicleId,
                    condition
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update vehicle condition."
                );
            }
        }
    );

export const updateVehicleBooking =
    createAsyncThunk(
        "vehicle/updateVehicleBooking",
        async (
            { vehicleId, availability },
            { rejectWithValue }
        ) => {
            try {
                return await changeVehicleBooking(
                    vehicleId,
                    availability
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update booking settings."
                );
            }
        }
    );

export const renewVehicleRegistrationThunk =
    createAsyncThunk(
        "vehicle/renewVehicleRegistration",
        async (
            { vehicleId, officialReceipt, expirationDate },
            { rejectWithValue }
        ) => {
            try {
                return await renewExistingVehicleRegistration(
                    vehicleId,
                    { officialReceipt, expirationDate }
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to renew vehicle registration."
                );
            }
        }
    );

export const setVehicleRegistrationAvailabilityThunk =
    createAsyncThunk(
        "vehicle/setVehicleRegistrationAvailability",
        async (
            { vehicleId, availableFrom },
            { rejectWithValue }
        ) => {
            try {
                return await setExistingVehicleRegistrationAvailability(
                    vehicleId,
                    availableFrom
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update vehicle availability."
                );
            }
        }
    );

export const getVehicleRegistrationRenewalEligibilityThunk =
    createAsyncThunk(
        "vehicle/getVehicleRegistrationRenewalEligibility",
        async (vehicleId, { rejectWithValue }) => {
            try {
                return await fetchVehicleRegistrationRenewalEligibility(
                    vehicleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch renewal eligibility."
                );
            }
        }
    );

export const requestVehicleRegistrationRenewalAttemptThunk =
    createAsyncThunk(
        "vehicle/requestVehicleRegistrationRenewalAttempt",
        async (vehicleId, { rejectWithValue }) => {
            try {
                return await requestExistingVehicleRegistrationRenewalAttempt(
                    vehicleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to request a renewal attempt."
                );
            }
        }
    );

export const grantVehicleRegistrationRenewalAttemptThunk =
    createAsyncThunk(
        "vehicle/grantVehicleRegistrationRenewalAttempt",
        async (
            { vehicleId, amount },
            { rejectWithValue }
        ) => {
            try {
                return await grantExistingVehicleRegistrationRenewalAttempt(
                    vehicleId,
                    amount
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to grant a renewal attempt."
                );
            }
        }
    );

export const getVehicleAvailability =
    createAsyncThunk(
        "vehicle/getVehicleAvailability",
        async (
            vehicleId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchVehicleAvailability(
                    vehicleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch vehicle availability."
                );
            }
        }
    );

export const checkVehicleAvailability =
    createAsyncThunk(
        "vehicle/checkVehicleAvailability",
        async (
            {
                vehicleId,
                startDate,
                endDate,
            },
            { rejectWithValue }
        ) => {
            try {
                return await checkVehicleAvailabilityService(
                    vehicleId,
                    startDate,
                    endDate
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to check vehicle availability."
                );
            }
        }
    );

export const addBlockedVehicleDate =
    createAsyncThunk(
        "vehicle/addBlockedVehicleDate",
        async (
            {
                vehicleId,
                blockedDateData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await addBlockedVehicleDateService(
                    vehicleId,
                    blockedDateData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to add blocked vehicle date."
                );
            }
        }
    );

export const removeBlockedVehicleDate =
    createAsyncThunk(
        "vehicle/removeBlockedVehicleDate",
        async (
            {
                vehicleId,
                blockedDateId,
            },
            { rejectWithValue }
        ) => {
            try {
                return await removeBlockedVehicleDateService(
                    vehicleId,
                    blockedDateId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to remove blocked vehicle date."
                );
            }
        }
    );

export const updateFeaturedVehicle =
    createAsyncThunk(
        "vehicle/updateFeaturedVehicle",
        async (
            { vehicleId, isFeatured },
            { rejectWithValue }
        ) => {
            try {
                return await changeFeaturedVehicle(
                    vehicleId,
                    isFeatured
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update featured vehicle."
                );
            }
        }
    );

const vehicleSlice = createSlice({
    name: "vehicle",

    initialState,

    reducers: {
        clearVehicleError: (state) => {
            state.error = null;
        },

        clearSelectedVehicle: (state) => {
            state.selectedVehicle = null;
        },

        clearVehicleAvailability: (state) => {
            state.availability = null;
            state.availabilityCheck = null;
        },

        /*
         * registrationRenewalEligibility is a single global slot, not
         * keyed by vehicle — without clearing it when RenewRegistrationDialog
         * opens for a different vehicle, the previous vehicle's numbers
         * would briefly flash for the new one until its own fetch resolves.
         */
        clearRegistrationRenewalEligibility: (
            state
        ) => {
            state.registrationRenewalEligibility = null;
        },

        setVehicleFilters: (
            state,
            action
        ) => {
            state.filters = {
                ...state.filters,
                ...action.payload,
            };
        },

        resetVehicleFilters: (state) => {
            state.filters = {
                search: "",
                status: "",
                vehicleType: "",
                brand: "",
                category: "",
                isFeatured: "",
            };
        },
    },

    extraReducers: (builder) => {
        // Check Plate Number Availability

        builder
            .addCase(
                checkPlateNumberAvailability.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                checkPlateNumberAvailability.fulfilled,
                (state) => {
                    state.loading = false;
                    state.error = null;
                }
            )

            .addCase(
                checkPlateNumberAvailability.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload?.message ||
                        "Unable to check plate number.";
                }
            )

            .addCase(
                checkRegistrationNumberAvailability.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                checkRegistrationNumberAvailability.fulfilled,
                (state) => {
                    state.loading = false;
                    state.error = null;
                }
            )

            .addCase(
                checkRegistrationNumberAvailability.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload?.message ||
                        "Unable to check registration number.";
                }
            )

            // Get Vehicles

            .addCase(
                getVehicles.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getVehicles.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;
                    state.vehicles =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getVehicles.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Get My Vehicles (operator)

            .addCase(
                getMyVehicles.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getMyVehicles.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;
                    state.vehicles =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getMyVehicles.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Get Vehicle By ID

            .addCase(
                getVehicleById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getVehicleById.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;
                    state.selectedVehicle =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getVehicleById.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                    state.selectedVehicle =
                        null;
                }
            )

            // Get Vehicle Counts

            .addCase(
                getVehicleCounts.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.counts = {
                        active:
                            action.payload
                                ?.data
                                ?.active ??
                            0,

                        archived:
                            action.payload
                                ?.data
                                ?.archived ??
                            0,

                        total:
                            action.payload
                                ?.data
                                ?.total ??
                            0,

                        company:
                            action.payload
                                ?.data
                                ?.company ??
                            0,

                        consigned:
                            action.payload
                                ?.data
                                ?.consigned ??
                            0,
                    };
                }
            )

            .addCase(
                getVehicleCounts.rejected,
                (state) => {
                    state.counts = {
                        active: 0,
                        archived: 0,
                        total: 0,
                        company: 0,
                        consigned: 0,
                    };
                }
            )

            // Create Vehicle

            .addCase(
                createVehicle.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createVehicle.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const vehicle =
                        action.payload?.data;

                    if (vehicle) {
                        state.vehicles.unshift(
                            vehicle
                        );

                        state.selectedVehicle =
                            vehicle;
                    }
                }
            )

            .addCase(
                createVehicle.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Vehicle

            .addCase(
                updateVehicle.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicle.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                updateVehicle.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Archive Vehicle

            .addCase(
                archiveVehicle.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                archiveVehicle.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                archiveVehicle.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Restore Vehicle

            .addCase(
                restoreVehicle.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                restoreVehicle.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                restoreVehicle.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Vehicle Status

            .addCase(
                updateVehicleStatus.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicleStatus.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                updateVehicleStatus.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Vehicle Condition

            .addCase(
                updateVehicleCondition.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicleCondition.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                updateVehicleCondition.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Booking

            .addCase(
                updateVehicleBooking.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateVehicleBooking.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                updateVehicleBooking.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Renew Vehicle Registration

            .addCase(
                renewVehicleRegistrationThunk.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                renewVehicleRegistrationThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                renewVehicleRegistrationThunk.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Set Vehicle Availability After Renewal

            .addCase(
                setVehicleRegistrationAvailabilityThunk.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                setVehicleRegistrationAvailabilityThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                setVehicleRegistrationAvailabilityThunk.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Get Registration Renewal Eligibility

            .addCase(
                getVehicleRegistrationRenewalEligibilityThunk.pending,
                (state) => {
                    state.error = null;
                }
            )

            .addCase(
                getVehicleRegistrationRenewalEligibilityThunk.fulfilled,
                (state, action) => {
                    state.registrationRenewalEligibility =
                        action.payload?.data ?? null;
                }
            )

            .addCase(
                getVehicleRegistrationRenewalEligibilityThunk.rejected,
                (state, action) => {
                    state.error =
                        action.payload;
                }
            )

            // Request Registration Renewal Attempt

            .addCase(
                requestVehicleRegistrationRenewalAttemptThunk.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                requestVehicleRegistrationRenewalAttemptThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                requestVehicleRegistrationRenewalAttemptThunk.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Grant Registration Renewal Attempt

            .addCase(
                grantVehicleRegistrationRenewalAttemptThunk.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                grantVehicleRegistrationRenewalAttemptThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                grantVehicleRegistrationRenewalAttemptThunk.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Get Vehicle Availability

            .addCase(
                getVehicleAvailability.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getVehicleAvailability.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;
                    state.availability =
                        action.payload
                            ?.data ?? null;
                }
            )

            .addCase(
                getVehicleAvailability.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                    state.availability =
                        null;
                }
            )

            // Check Vehicle Availability

            .addCase(
                checkVehicleAvailability.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                checkVehicleAvailability.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;
                    state.availabilityCheck =
                        action.payload
                            ?.data ?? null;
                }
            )

            .addCase(
                checkVehicleAvailability.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                    state.availabilityCheck =
                        null;
                }
            )

            // Add Blocked Vehicle Date

            .addCase(
                addBlockedVehicleDate.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addBlockedVehicleDate.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;

                    state.availability = {
                        vehicleId:
                            updatedVehicle._id,

                        vehicleCode:
                            updatedVehicle.vehicleCode,

                        status:
                            updatedVehicle.status,

                        bookingEnabled:
                            updatedVehicle
                                .availability
                                ?.bookingEnabled ??
                            false,

                        availableFrom:
                            updatedVehicle
                                .availability
                                ?.availableFrom ??
                            null,

                        blockedDates:
                            updatedVehicle
                                .availability
                                ?.blockedDates ??
                            [],
                    };
                }
            )

            .addCase(
                addBlockedVehicleDate.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Remove Blocked Vehicle Date

            .addCase(
                removeBlockedVehicleDate.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                removeBlockedVehicleDate.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;

                    state.availability = {
                        vehicleId:
                            updatedVehicle._id,

                        vehicleCode:
                            updatedVehicle.vehicleCode,

                        status:
                            updatedVehicle.status,

                        bookingEnabled:
                            updatedVehicle
                                .availability
                                ?.bookingEnabled ??
                            false,

                        availableFrom:
                            updatedVehicle
                                .availability
                                ?.availableFrom ??
                            null,

                        blockedDates:
                            updatedVehicle
                                .availability
                                ?.blockedDates ??
                            [],
                    };
                }
            )

            .addCase(
                removeBlockedVehicleDate.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            // Update Featured Vehicle

            .addCase(
                updateFeaturedVehicle.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateFeaturedVehicle.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error = null;

                    const updatedVehicle =
                        action.payload?.data;

                    if (!updatedVehicle) {
                        return;
                    }

                    state.vehicles =
                        state.vehicles.map(
                            (vehicle) =>
                                vehicle._id ===
                                updatedVehicle._id
                                    ? updatedVehicle
                                    : vehicle
                        );

                    state.selectedVehicle =
                        updatedVehicle;
                }
            )

            .addCase(
                updateFeaturedVehicle.rejected,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
});

export const {
    clearVehicleError,
    clearSelectedVehicle,
    clearVehicleAvailability,
    clearRegistrationRenewalEligibility,
    setVehicleFilters,
    resetVehicleFilters,
} = vehicleSlice.actions;

export default vehicleSlice.reducer;