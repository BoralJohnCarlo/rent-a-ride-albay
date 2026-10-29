import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchRentals,
    fetchRentalById,
    createNewRental,
    updateExistingRental,
    processExistingRentalPickup,
    processExistingRentalReturn,
    reassignExistingRentalDriver,
    addExistingRentalDamageIssue,
    addExistingRentalCharge,
    addExistingRentalAdjustment,
    recordExistingRentalPayment,
    verifyExistingRentalPayment,
    recordExistingRentalRefund,
    holdExistingRentalSecurityDeposit,
    deductExistingRentalSecurityDeposit,
    releaseExistingRentalSecurityDeposit,
    updateExistingRentalVehicleOutcome,
    completeExistingRental,
    completeExistingRentalAsCustomer,
    addExistingRentalOperationalEvent,
    waiveExistingRentalPenalty,
    adjustExistingRentalPenalty,
    addExistingRentalPenaltyNote,
    applyExistingRentalPenalty,
    fetchEarlyReturnCredits,
    approveExistingEarlyReturnCredit,
    rejectExistingEarlyReturnCredit,
} from "../../services/rentalService";

import {
    fetchCustomerRefunds,
    fetchCustomerRefundById,
    removeCustomerRefund as removeExistingCustomerRefund,
    requestCustomerRefund as submitCustomerRefundRequest,
} from "../../services/refundService";


const initialState = {
    rentals: [],

    selectedRental: null,

    refunds: [],

    selectedRefund: null,

    refundPagination: {
        total: 0,
        page: 1,
        limit: 20,
        pages: 0,
    },

    earlyReturnCredits: [],

    earlyReturnSummary: null,

    earlyReturnPagination: {
        total: 0,
        page: 1,
        limit: 20,
        pages: 0,
    },

    loading: false,
    error: null,

    includeCompleted: true,
};


export const getRentals = createAsyncThunk(
    "rental/getRentals",
    async (
        includeCompleted = true,
        { rejectWithValue }
    ) => {
        try {
            return await fetchRentals(
                includeCompleted
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch rentals."
            );
        }
    }
);


export const getRentalById =
    createAsyncThunk(
        "rental/getRentalById",
        async (
            rentalId,
            { rejectWithValue }
        ) => {
            try {
                return await fetchRentalById(
                    rentalId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch rental."
                );
            }
        }
    );


export const createRental =
    createAsyncThunk(
        "rental/createRental",
        // A booking id, or { bookingId, releaseEarly }.
        async (
            arg,
            { rejectWithValue }
        ) => {
            const { bookingId, releaseEarly = false } =
                typeof arg === "object" && arg !== null
                    ? arg
                    : { bookingId: arg };

            try {
                return await createNewRental(
                    bookingId,
                    { releaseEarly }
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to create rental."
                );
            }
        }
    );


export const updateRental =
    createAsyncThunk(
        "rental/updateRental",
        async (
            {
                rentalId,
                rentalData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingRental(
                    rentalId,
                    rentalData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to update rental."
                );
            }
        }
    );


export const processRentalPickup =
    createAsyncThunk(
        "rental/processRentalPickup",
        async (
            {
                rentalId,
                pickupData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await processExistingRentalPickup(
                    rentalId,
                    pickupData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to process rental pickup."
                );
            }
        }
    );


export const processRentalReturn =
    createAsyncThunk(
        "rental/processRentalReturn",
        async (
            {
                rentalId,
                returnData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await processExistingRentalReturn(
                    rentalId,
                    returnData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to process rental return."
                );
            }
        }
    );


export const reassignRentalDriver =
    createAsyncThunk(
        "rental/reassignRentalDriver",
        async (
            {
                rentalId,
                newDriver,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await reassignExistingRentalDriver(
                    rentalId,
                    newDriver,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reassign rental driver."
                );
            }
        }
    );


export const addRentalDamageIssue =
    createAsyncThunk(
        "rental/addRentalDamageIssue",
        async (
            {
                rentalId,
                damageData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await addExistingRentalDamageIssue(
                    rentalId,
                    damageData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to add rental damage issue."
                );
            }
        }
    );


export const addRentalCharge =
    createAsyncThunk(
        "rental/addRentalCharge",
        async (
            {
                rentalId,
                chargeData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await addExistingRentalCharge(
                    rentalId,
                    chargeData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to add rental charge."
                );
            }
        }
    );


export const addRentalAdjustment =
    createAsyncThunk(
        "rental/addRentalAdjustment",
        async (
            {
                rentalId,
                adjustmentData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await addExistingRentalAdjustment(
                    rentalId,
                    adjustmentData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to add rental adjustment."
                );
            }
        }
    );


export const recordRentalPayment =
    createAsyncThunk(
        "rental/recordRentalPayment",
        async (
            {
                rentalId,
                paymentData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await recordExistingRentalPayment(
                    rentalId,
                    paymentData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to record rental payment."
                );
            }
        }
    );


export const verifyRentalPayment =
    createAsyncThunk(
        "rental/verifyRentalPayment",
        async (
            {
                rentalId,
                paymentId,
                status,
                rejectionReason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await verifyExistingRentalPayment(
                    rentalId,
                    paymentId,
                    status,
                    rejectionReason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to verify rental payment."
                );
            }
        }
    );


export const recordRentalRefund =
    createAsyncThunk(
        "rental/recordRentalRefund",
        async (
            {
                rentalId,
                refundData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await recordExistingRentalRefund(
                    rentalId,
                    refundData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to record rental refund."
                );
            }
        }
    );


export const holdRentalSecurityDeposit =
    createAsyncThunk(
        "rental/holdRentalSecurityDeposit",
        async (
            rentalId,
            { rejectWithValue }
        ) => {
            try {
                return await holdExistingRentalSecurityDeposit(
                    rentalId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to hold security deposit."
                );
            }
        }
    );


export const deductRentalSecurityDeposit =
    createAsyncThunk(
        "rental/deductRentalSecurityDeposit",
        async (
            {
                rentalId,
                amount,
                reason,
            },
            { rejectWithValue }
        ) => {
            try {
                return await deductExistingRentalSecurityDeposit(
                    rentalId,
                    amount,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to deduct security deposit."
                );
            }
        }
    );


export const releaseRentalSecurityDeposit =
    createAsyncThunk(
        "rental/releaseRentalSecurityDeposit",
        async (
            rentalId,
            { rejectWithValue }
        ) => {
            try {
                return await releaseExistingRentalSecurityDeposit(
                    rentalId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to release security deposit."
                );
            }
        }
    );


export const updateRentalVehicleOutcome =
    createAsyncThunk(
        "rental/updateRentalVehicleOutcome",
        async (
            {
                rentalId,
                vehicleOutcome,
                maintenancePlan = null,
            },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingRentalVehicleOutcome(
                    rentalId,
                    vehicleOutcome,
                    maintenancePlan
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to update vehicle outcome."
                );
            }
        }
    );


export const completeRental =
    createAsyncThunk(
        "rental/completeRental",
        async (
            {
                rentalId,
                notes,
                overrideOutstandingBalance = false,
            },
            { rejectWithValue }
        ) => {
            try {
                return await completeExistingRental(
                    rentalId,
                    notes,
                    overrideOutstandingBalance
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to complete rental."
                );
            }
        }
    );


export const customerCompleteRental =
    createAsyncThunk(
        "rental/customerCompleteRental",
        async (
            rentalId,
            { rejectWithValue }
        ) => {
            try {
                return await completeExistingRentalAsCustomer(
                    rentalId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to mark this trip as completed."
                );
            }
        }
    );


export const addRentalOperationalEvent =
    createAsyncThunk(
        "rental/addRentalOperationalEvent",
        async (
            {
                rentalId,
                eventData,
            },
            { rejectWithValue }
        ) => {
            try {
                return await addExistingRentalOperationalEvent(
                    rentalId,
                    eventData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to add rental operational event."
                );
            }
        }
    );


export const waiveRentalPenalty =
    createAsyncThunk(
        "rental/waiveRentalPenalty",
        async (
            { rentalId, reason = "" },
            { rejectWithValue }
        ) => {
            try {
                return await waiveExistingRentalPenalty(
                    rentalId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to waive rental penalty."
                );
            }
        }
    );


export const adjustRentalPenalty =
    createAsyncThunk(
        "rental/adjustRentalPenalty",
        async (
            {
                rentalId,
                newAmount,
                reason = "",
            },
            { rejectWithValue }
        ) => {
            try {
                return await adjustExistingRentalPenalty(
                    rentalId,
                    newAmount,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to adjust rental penalty."
                );
            }
        }
    );


export const addRentalPenaltyNote =
    createAsyncThunk(
        "rental/addRentalPenaltyNote",
        async (
            { rentalId, reason = "" },
            { rejectWithValue }
        ) => {
            try {
                return await addExistingRentalPenaltyNote(
                    rentalId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to add rental penalty note."
                );
            }
        }
    );


export const applyRentalPenalty =
    createAsyncThunk(
        "rental/applyRentalPenalty",
        async (
            { rentalId, reason = "" },
            { rejectWithValue }
        ) => {
            try {
                return await applyExistingRentalPenalty(
                    rentalId,
                    reason
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to apply rental penalty."
                );
            }
}
        );


export const getEarlyReturnCredits =
    createAsyncThunk(
        "rental/getEarlyReturnCredits",
        async (
            filters = {},
            { rejectWithValue }
        ) => {
            try {
                return await fetchEarlyReturnCredits(
                    filters
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to fetch early-return credits."
                );
            }
        }
    );


export const approveEarlyReturnCredit =
    createAsyncThunk(
        "rental/approveEarlyReturnCredit",
        async (
            { rentalId, unusedDays },
            { rejectWithValue }
        ) => {
            try {
                return await approveExistingEarlyReturnCredit(
                    rentalId,
                    unusedDays
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to approve early-return credit."
                );
            }
        }
    );


export const rejectEarlyReturnCredit =
    createAsyncThunk(
        "rental/rejectEarlyReturnCredit",
        async (
            { rentalId, note = "" },
            { rejectWithValue }
        ) => {
            try {
                return await rejectExistingEarlyReturnCredit(
                    rentalId,
                    note
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to reject early-return credit."
                );
            }
        }
    );


export const getCustomerRefunds = createAsyncThunk(
    "rental/getCustomerRefunds",
    async (
        { search, page, limit } = {},
        { rejectWithValue }
    ) => {
        try {
            return await fetchCustomerRefunds({
                search,
                page,
                limit,
            });
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch customer refunds."
            );
        }
    }
);


export const getCustomerRefund = createAsyncThunk(
    "rental/getCustomerRefund",
    async (
        id,
        { rejectWithValue }
    ) => {
        try {
            return await fetchCustomerRefundById(id);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch customer refund."
            );
        }
    }
);


export const deleteCustomerRefund = createAsyncThunk(
    "rental/deleteCustomerRefund",
    async (
        id,
        { rejectWithValue }
    ) => {
        try {
            return await removeExistingCustomerRefund(id);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to delete customer refund."
            );
        }
    }
);

export const requestCustomerRefund =
    createAsyncThunk(
        "rental/requestCustomerRefund",
        async (
            { rentalId, refundData },
            { rejectWithValue }
        ) => {
            try {
                return await submitCustomerRefundRequest(
                    rentalId,
                    refundData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        "Unable to submit refund request."
                );
            }
        }
    );


const updateRentalInState = (
    state,
    action
) => {
    const updatedRental =
        action.payload?.data;

    if (!updatedRental) {
        return;
    }

    state.rentals =
        state.rentals.map(
            (rental) =>
                rental._id ===
                updatedRental._id
                    ? updatedRental
                    : rental
        );

    state.selectedRental =
        updatedRental;
};


const patchEarlyReturnCredit = (
    state,
    action
) => {
    const updatedRental =
        action.payload?.data;

    if (!updatedRental?.earlyReturn) {
        return;
    }

    state.earlyReturnCredits =
        state.earlyReturnCredits.map(
            (credit) =>
                credit.rentalId ===
                updatedRental._id
                    ? {
                          ...credit,
                          earlyReturn:
                              updatedRental.earlyReturn,
                      }
                    : credit
        );
};


const rentalSlice = createSlice({
    name: "rental",

    initialState,

    reducers: {
        clearRentalError: (state) => {
            state.error = null;
        },

        clearSelectedRental: (state) => {
            state.selectedRental = null;
        },

        setIncludeCompleted: (
            state,
            action
        ) => {
            state.includeCompleted =
                action.payload;
        },

        resetRentalState: (state) => {
            state.rentals = [];
            state.selectedRental = null;
            state.earlyReturnCredits = [];
            state.earlyReturnSummary = null;
            state.earlyReturnPagination = {
                total: 0,
                page: 1,
                limit: 20,
                pages: 0,
            };
            state.loading = false;
            state.error = null;
            state.includeCompleted = true;
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(
                getRentals.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getRentals.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.rentals =
                        action.payload?.data ??
                        [];
                }
            )

            .addCase(
                getRentals.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getRentalById.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getRentalById.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedRental =
                        action.payload?.data ??
                        null;
                }
            )

            .addCase(
                getRentalById.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedRental =
                        null;
                }
            )


            .addCase(
                createRental.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                createRental.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const rental =
                        action.payload?.data;

                    if (rental) {
                        state.rentals.unshift(
                            rental
                        );

                        state.selectedRental =
                            rental;
                    }
                }
            )

            .addCase(
                createRental.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateRental.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateRental.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                updateRental.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                processRentalPickup.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                processRentalPickup.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                processRentalPickup.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                processRentalReturn.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                processRentalReturn.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                processRentalReturn.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                reassignRentalDriver.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                reassignRentalDriver.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                reassignRentalDriver.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                addRentalDamageIssue.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addRentalDamageIssue.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                addRentalDamageIssue.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                addRentalCharge.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addRentalCharge.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                addRentalCharge.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                addRentalAdjustment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addRentalAdjustment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                addRentalAdjustment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                recordRentalPayment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                recordRentalPayment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                recordRentalPayment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                verifyRentalPayment.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                verifyRentalPayment.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                verifyRentalPayment.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                recordRentalRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                recordRentalRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                recordRentalRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                holdRentalSecurityDeposit.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                holdRentalSecurityDeposit.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                holdRentalSecurityDeposit.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                deductRentalSecurityDeposit.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                deductRentalSecurityDeposit.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                deductRentalSecurityDeposit.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                releaseRentalSecurityDeposit.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                releaseRentalSecurityDeposit.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                releaseRentalSecurityDeposit.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                updateRentalVehicleOutcome.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                updateRentalVehicleOutcome.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                updateRentalVehicleOutcome.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                completeRental.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                completeRental.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                completeRental.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                customerCompleteRental.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                customerCompleteRental.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                customerCompleteRental.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                addRentalOperationalEvent.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addRentalOperationalEvent.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                addRentalOperationalEvent.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                waiveRentalPenalty.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                waiveRentalPenalty.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                waiveRentalPenalty.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                adjustRentalPenalty.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                adjustRentalPenalty.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                adjustRentalPenalty.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                addRentalPenaltyNote.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                addRentalPenaltyNote.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                addRentalPenaltyNote.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                applyRentalPenalty.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                applyRentalPenalty.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                applyRentalPenalty.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getEarlyReturnCredits.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getEarlyReturnCredits.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.earlyReturnCredits =
                        action.payload?.data ?? [];
                    state.earlyReturnSummary =
                        action.payload?.summary ??
                        null;
                    state.earlyReturnPagination =
                        action.payload
                            ?.pagination ??
                        state.earlyReturnPagination;
                }
            )

            .addCase(
                getEarlyReturnCredits.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                approveEarlyReturnCredit.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                approveEarlyReturnCredit.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    patchEarlyReturnCredit(
                        state,
                        action
                    );
                }
            )

            .addCase(
                approveEarlyReturnCredit.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )

            .addCase(
                rejectEarlyReturnCredit.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                rejectEarlyReturnCredit.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    patchEarlyReturnCredit(
                        state,
                        action
                    );
                }
            )

            .addCase(
                rejectEarlyReturnCredit.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getCustomerRefunds.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getCustomerRefunds.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.refunds =
                        action.payload?.data ?? [];

                    if (
                        action.payload?.pagination
                    ) {
                        state.refundPagination =
                            action.payload.pagination;
                    }
                }
            )

            .addCase(
                getCustomerRefunds.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                getCustomerRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                getCustomerRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    state.selectedRefund =
                        action.payload?.data ??
                        action.payload ??
                        null;
                }
            )

            .addCase(
                getCustomerRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;

                    state.selectedRefund =
                        null;
                }
            )


            .addCase(
                deleteCustomerRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                deleteCustomerRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    const removedId =
                        action.meta?.arg;

                    if (removedId) {
                        state.refunds =
                            state.refunds.filter(
                                (refund) =>
                                    refund._id !==
                                    removedId
                            );

                        if (
                            state.selectedRefund?._id ===
                            removedId
                        ) {
                            state.selectedRefund = null;
                        }

                        const nextTotal = Math.max(
                            0,
                            (state.refundPagination?.total ?? 0) - 1
                        );

                        const limit =
                            state.refundPagination?.limit ?? 20;

                        state.refundPagination = {
                            ...state.refundPagination,
                            total: nextTotal,
                            pages: Math.ceil(nextTotal / limit),
                        };
                    }
                }
            )

            .addCase(
                deleteCustomerRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            )


            .addCase(
                requestCustomerRefund.pending,
                (state) => {
                    state.loading = true;
                    state.error = null;
                }
            )

            .addCase(
                requestCustomerRefund.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.error = null;

                    updateRentalInState(
                        state,
                        action
                    );
                }
            )

            .addCase(
                requestCustomerRefund.rejected,
                (state, action) => {
                    state.loading = false;
                    state.error =
                        action.payload;
                }
            );
    },
});


export const {
    clearRentalError,
    clearSelectedRental,
    setIncludeCompleted,
    resetRentalState,
} = rentalSlice.actions;


export default rentalSlice.reducer;