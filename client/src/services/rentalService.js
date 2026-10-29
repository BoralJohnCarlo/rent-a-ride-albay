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
    completeRentalAsCustomer,
    addRentalOperationalEvent,
    waiveRentalPenalty,
    adjustRentalPenalty,
    addRentalPenaltyNote,
    applyRentalPenalty,
    getEarlyReturnCredits,
    approveEarlyReturnCredit,
    rejectEarlyReturnCredit,
} from "../api/rentalApi";


export const fetchRentals = async (
    includeCompleted = true
) => {
    return await getRentals(
        includeCompleted
    );
};


export const fetchRentalById = async (
    rentalId
) => {
    return await getRentalById(
        rentalId
    );
};


export const createNewRental = async (
    bookingId,
    options = {}
) => {
    return await createRental(
        bookingId,
        options
    );
};


export const updateExistingRental = async (
    rentalId,
    rentalData
) => {
    return await updateRental(
        rentalId,
        rentalData
    );
};


export const processExistingRentalPickup =
    async (
        rentalId,
        pickupData
    ) => {
        return await processRentalPickup(
            rentalId,
            pickupData
        );
    };


export const processExistingRentalReturn =
    async (
        rentalId,
        returnData
    ) => {
        return await processRentalReturn(
            rentalId,
            returnData
        );
    };


export const reassignExistingRentalDriver =
    async (
        rentalId,
        newDriver,
        reason = ""
    ) => {
        return await reassignRentalDriver(
            rentalId,
            newDriver,
            reason
        );
    };


export const addExistingRentalDamageIssue =
    async (
        rentalId,
        damageData
    ) => {
        return await addRentalDamageIssue(
            rentalId,
            damageData
        );
    };


export const addExistingRentalCharge =
    async (
        rentalId,
        chargeData
    ) => {
        return await addRentalCharge(
            rentalId,
            chargeData
        );
    };


export const addExistingRentalAdjustment =
    async (
        rentalId,
        adjustmentData
    ) => {
        return await addRentalAdjustment(
            rentalId,
            adjustmentData
        );
    };


export const recordExistingRentalPayment =
    async (
        rentalId,
        paymentData
    ) => {
        return await recordRentalPayment(
            rentalId,
            paymentData
        );
    };


export const verifyExistingRentalPayment =
    async (
        rentalId,
        paymentId,
        status,
        rejectionReason = ""
    ) => {
        return await verifyRentalPayment(
            rentalId,
            paymentId,
            status,
            rejectionReason
        );
    };


export const recordExistingRentalRefund =
    async (
        rentalId,
        refundData
    ) => {
        return await recordRentalRefund(
            rentalId,
            refundData
        );
    };


export const holdExistingRentalSecurityDeposit =
    async (
        rentalId
    ) => {
        return await holdRentalSecurityDeposit(
            rentalId
        );
    };


export const deductExistingRentalSecurityDeposit =
    async (
        rentalId,
        amount,
        reason
    ) => {
        return await deductRentalSecurityDeposit(
            rentalId,
            amount,
            reason
        );
    };


export const releaseExistingRentalSecurityDeposit =
    async (
        rentalId
    ) => {
        return await releaseRentalSecurityDeposit(
            rentalId
        );
    };


export const updateExistingRentalVehicleOutcome =
    async (
        rentalId,
        vehicleOutcome,
        maintenancePlan = null
    ) => {
        return await updateRentalVehicleOutcome(
            rentalId,
            vehicleOutcome,
            maintenancePlan
        );
    };


export const completeExistingRental =
    async (
        rentalId,
        notes = "",
        overrideOutstandingBalance = false
    ) => {
        return await completeRental(
            rentalId,
            notes,
            overrideOutstandingBalance
        );
    };


export const completeExistingRentalAsCustomer =
    async (
        rentalId
    ) => {
        return await completeRentalAsCustomer(
            rentalId
        );
    };


export const addExistingRentalOperationalEvent =
    async (
        rentalId,
        eventData
    ) => {
        return await addRentalOperationalEvent(
            rentalId,
            eventData
        );
    };

export const waiveExistingRentalPenalty =
    async (rentalId, reason = "") => {
        return await waiveRentalPenalty(
            rentalId,
            reason
        );
    };

export const adjustExistingRentalPenalty =
    async (
        rentalId,
        newAmount,
        reason = ""
    ) => {
        return await adjustRentalPenalty(
            rentalId,
            newAmount,
            reason
        );
    };

export const addExistingRentalPenaltyNote =
    async (rentalId, reason = "") => {
        return await addRentalPenaltyNote(
            rentalId,
            reason
        );
    };

export const applyExistingRentalPenalty =
    async (rentalId, reason = "") => {
        return await applyRentalPenalty(
            rentalId,
            reason
        );
    };

export const fetchEarlyReturnCredits =
    async (params = {}) => {
        return await getEarlyReturnCredits(
            params
        );
    };

export const approveExistingEarlyReturnCredit =
    async (rentalId, unusedDays) => {
        return await approveEarlyReturnCredit(
            rentalId,
            unusedDays
        );
    };

export const rejectExistingEarlyReturnCredit =
    async (rentalId, note = "") => {
        return await rejectEarlyReturnCredit(
            rentalId,
            note
        );
    };