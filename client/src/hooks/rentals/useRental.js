import {
    useCallback,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getRentals,
    getRentalById,
    createRental,
    updateRental,
    processRentalPickup,
    processRentalReturn,
    reassignRentalDriver,
    addRentalDamageIssue,
    addRentalCharge,
    addRentalAdjustment,
    recordRentalPayment,
    verifyRentalPayment,
    recordRentalRefund,
    holdRentalSecurityDeposit,
    deductRentalSecurityDeposit,
    releaseRentalSecurityDeposit,
    updateRentalVehicleOutcome,
    completeRental,
    customerCompleteRental,
    requestCustomerRefund,
    deleteCustomerRefund,
    addRentalOperationalEvent,
    waiveRentalPenalty,
    adjustRentalPenalty,
    addRentalPenaltyNote,
    applyRentalPenalty,
    getEarlyReturnCredits,
    approveEarlyReturnCredit,
    rejectEarlyReturnCredit,
    clearRentalError,
    clearSelectedRental,
    setIncludeCompleted,
    resetRentalState,
} from "../../store/rentals/rentalSlice";

const useRental = () => {
    const dispatch = useDispatch();

    const {
        rentals,
        selectedRental,
        loading,
        error,
        includeCompleted,
        earlyReturnCredits,
        earlyReturnSummary,
        earlyReturnPagination,
    } = useSelector(
        (state) => state.rentals
    );

    const fetchRentals = useCallback(
        (
            includeCompletedValue = true
        ) => {
            return dispatch(
                getRentals(
                    includeCompletedValue
                )
            );
        },
        [dispatch]
    );

    const fetchRentalById = useCallback(
        (rentalId) => {
            return dispatch(
                getRentalById(rentalId)
            );
        },
        [dispatch]
    );

    const addRental = useCallback(
        (bookingId, { releaseEarly = false } = {}) => {
            return dispatch(
                createRental({ bookingId, releaseEarly })
            );
        },
        [dispatch]
    );

    const editRental = useCallback(
        (rentalId, rentalData) => {
            return dispatch(
                updateRental({
                    rentalId,
                    rentalData,
                })
            );
        },
        [dispatch]
    );

    const processPickup = useCallback(
        (rentalId, pickupData) => {
            return dispatch(
                processRentalPickup({
                    rentalId,
                    pickupData,
                })
            );
        },
        [dispatch]
    );

    const processReturn = useCallback(
        (rentalId, returnData) => {
            return dispatch(
                processRentalReturn({
                    rentalId,
                    returnData,
                })
            );
        },
        [dispatch]
    );

    const reassignDriver = useCallback(
        (
            rentalId,
            newDriver,
            reason = ""
        ) => {
            return dispatch(
                reassignRentalDriver({
                    rentalId,
                    newDriver,
                    reason,
                })
            );
        },
        [dispatch]
    );

    const addDamageIssue = useCallback(
        (rentalId, damageData) => {
            return dispatch(
                addRentalDamageIssue({
                    rentalId,
                    damageData,
                })
            );
        },
        [dispatch]
    );

    const addCharge = useCallback(
        (rentalId, chargeData) => {
            return dispatch(
                addRentalCharge({
                    rentalId,
                    chargeData,
                })
            );
        },
        [dispatch]
    );

    const addAdjustment = useCallback(
        (rentalId, adjustmentData) => {
            return dispatch(
                addRentalAdjustment({
                    rentalId,
                    adjustmentData,
                })
            );
        },
        [dispatch]
    );

    const recordPayment = useCallback(
        (rentalId, paymentData) => {
            return dispatch(
                recordRentalPayment({
                    rentalId,
                    paymentData,
                })
            );
        },
        [dispatch]
    );

    const verifyPayment = useCallback(
        (
            rentalId,
            paymentId,
            status,
            rejectionReason = ""
        ) => {
            return dispatch(
                verifyRentalPayment({
                    rentalId,
                    paymentId,
                    status,
                    rejectionReason,
                })
            );
        },
        [dispatch]
    );

    const recordRefund = useCallback(
        (rentalId, refundData) => {
            return dispatch(
                recordRentalRefund({
                    rentalId,
                    refundData,
                })
            );
        },
        [dispatch]
    );

    const holdSecurityDeposit =
        useCallback(
            (rentalId) => {
                return dispatch(
                    holdRentalSecurityDeposit(
                        rentalId
                    )
                );
            },
            [dispatch]
        );

    const deductSecurityDeposit =
        useCallback(
            (
                rentalId,
                amount,
                reason
            ) => {
                return dispatch(
                    deductRentalSecurityDeposit(
                        {
                            rentalId,
                            amount,
                            reason,
                        }
                    )
                );
            },
            [dispatch]
        );

    const releaseSecurityDeposit =
        useCallback(
            (rentalId) => {
                return dispatch(
                    releaseRentalSecurityDeposit(
                        rentalId
                    )
                );
            },
            [dispatch]
        );

    const updateVehicleOutcome =
        useCallback(
            (
                rentalId,
                vehicleOutcome,
                maintenancePlan = null
            ) => {
                return dispatch(
                    updateRentalVehicleOutcome(
                        {
                            rentalId,
                            vehicleOutcome,
                            maintenancePlan,
                        }
                    )
                );
            },
            [dispatch]
        );

    const completeExistingRental =
        useCallback(
            (
                rentalId,
                notes = "",
                overrideOutstandingBalance = false
            ) => {
                return dispatch(
                    completeRental({
                        rentalId,
                        notes,
                        overrideOutstandingBalance,
                    })
                );
            },
            [dispatch]
        );

    const completeAsCustomer =
        useCallback(
            (rentalId) => {
                return dispatch(
                    customerCompleteRental(
                        rentalId
                    )
                );
            },
            [dispatch]
        );

    const submitRefundRequest =
        useCallback(
            (rentalId, refundData) => {
                return dispatch(
                    requestCustomerRefund({
                        rentalId,
                        refundData,
                    })
                );
            },
            [dispatch]
        );

    const withdrawRefundRequest =
        useCallback(
            (refundId) => {
                return dispatch(
                    deleteCustomerRefund(
                        refundId
                    )
                );
            },
            [dispatch]
        );

    const addOperationalEvent =
        useCallback(
            (
                rentalId,
                eventData
            ) => {
                return dispatch(
                    addRentalOperationalEvent({
                        rentalId,
                        eventData,
                    })
                );
            },
            [dispatch]
        );

    const waivePenalty = useCallback(
        ({ rentalId, reason = "" }) => {
            return dispatch(
                waiveRentalPenalty({
                    rentalId,
                    reason,
                })
            );
        },
        [dispatch]
    );

    const adjustPenalty = useCallback(
        ({
            rentalId,
            newAmount,
            reason = "",
        }) => {
            return dispatch(
                adjustRentalPenalty({
                    rentalId,
                    newAmount,
                    reason,
                })
            );
        },
        [dispatch]
    );

    const addPenaltyNote = useCallback(
        ({ rentalId, reason = "" }) => {
            return dispatch(
                addRentalPenaltyNote({
                    rentalId,
                    reason,
                })
            );
        },
        [dispatch]
    );

    const applyPenalty = useCallback(
        ({ rentalId, reason = "" }) => {
            return dispatch(
                applyRentalPenalty({
                    rentalId,
                    reason,
                })
            );
        },
        [dispatch]
    );

    const fetchEarlyReturnCredits = useCallback(
        (filters = {}) => {
            return dispatch(
                getEarlyReturnCredits(filters)
            );
        },
        [dispatch]
    );

    const approveEarlyReturn = useCallback(
        (rentalId, unusedDays) => {
            return dispatch(
                approveEarlyReturnCredit({
                    rentalId,
                    unusedDays,
                })
            );
        },
        [dispatch]
    );

    const rejectEarlyReturn = useCallback(
        (rentalId, note = "") => {
            return dispatch(
                rejectEarlyReturnCredit({
                    rentalId,
                    note,
                })
            );
        },
        [dispatch]
    );

    const updateIncludeCompleted =
        useCallback(
            (value) => {
                dispatch(
                    setIncludeCompleted(
                        value
                    )
                );
            },
            [dispatch]
        );

    const resetState = useCallback(
        () => {
            dispatch(
                resetRentalState()
            );
        },
        [dispatch]
    );

    const clearError = useCallback(
        () => {
            dispatch(
                clearRentalError()
            );
        },
        [dispatch]
    );

    const clearSelected = useCallback(
        () => {
            dispatch(
                clearSelectedRental()
            );
        },
        [dispatch]
    );

    return {
        rentals,
        selectedRental,
        loading,
        error,
        includeCompleted,

        fetchRentals,
        fetchRentalById,
        addRental,
        editRental,

        processPickup,
        processReturn,
        reassignDriver,

        addDamageIssue,
        addCharge,
        addAdjustment,

        recordPayment,
        verifyPayment,
        recordRefund,

        holdSecurityDeposit,
        deductSecurityDeposit,
        releaseSecurityDeposit,

        updateVehicleOutcome,
        completeExistingRental,
        completeAsCustomer,
        submitRefundRequest,
        withdrawRefundRequest,
        addOperationalEvent,

        waivePenalty,
        adjustPenalty,
        addPenaltyNote,
        applyPenalty,

        earlyReturnCredits,
        earlyReturnSummary,
        earlyReturnPagination,
        fetchEarlyReturnCredits,
        approveEarlyReturn,
        rejectEarlyReturn,

        updateIncludeCompleted,

        resetState,
        clearError,
        clearSelected,
    };
};

export default useRental;