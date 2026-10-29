import api from "../lib/axios";

export const getRentals = async (
    includeCompleted = true
) => {
    const { data } = await api.get(
        "/rentals",
        {
            params: {
                includeCompleted,
            },
        }
    );

    return data;
};

export const getRentalById = async (
    rentalId
) => {
    const { data } = await api.get(
        `/rentals/${rentalId}`
    );

    return data;
};

/*
 * `releaseEarly`: the admin confirmed releasing before the usual window
 * (only honoured while Settings → Bookings → Early Pickup allows it).
 */
export const createRental = async (
    bookingId,
    { releaseEarly = false } = {}
) => {
    const { data } = await api.post(
        "/rentals",
        {
            booking: bookingId,
            ...(releaseEarly ? { releaseEarly: true } : {}),
        }
    );

    return data;
};

export const updateRental = async (
    rentalId,
    rentalData
) => {
    const { data } = await api.put(
        `/rentals/${rentalId}`,
        rentalData
    );

    return data;
};

export const processRentalPickup = async (
    rentalId,
    pickupData
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/pickup`,
        pickupData
    );

    return data;
};

export const processRentalReturn = async (
    rentalId,
    returnData
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/return`,
        returnData
    );

    return data;
};

export const reassignRentalDriver = async (
    rentalId,
    newDriver,
    reason = ""
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/driver`,
        {
            newDriver,
            reason,
        }
    );

    return data;
};

export const addRentalDamageIssue = async (
    rentalId,
    damageData
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/damage-issues`,
        damageData
    );

    return data;
};

export const addRentalCharge = async (
    rentalId,
    chargeData
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/charges`,
        chargeData
    );

    return data;
};

export const addRentalAdjustment = async (
    rentalId,
    adjustmentData
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/adjustments`,
        adjustmentData
    );

    return data;
};

export const recordRentalPayment = async (
    rentalId,
    paymentData
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/payments`,
        paymentData
    );

    return data;
};

export const verifyRentalPayment = async (
    rentalId,
    paymentId,
    status,
    rejectionReason = ""
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/payments/verify`,
        {
            paymentId,
            status,
            rejectionReason,
        }
    );

    return data;
};

export const recordRentalRefund = async (
    rentalId,
    refundData
) => {
    const { data } = await api.post(
        `/refunds/${rentalId}/refunds`,
        refundData
    );

    return data;
};

export const holdRentalSecurityDeposit = async (
    rentalId
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/security-deposit/hold`
    );

    return data;
};

export const deductRentalSecurityDeposit = async (
    rentalId,
    amount,
    reason
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/security-deposit/deduct`,
        {
            amount,
            reason,
        }
    );

    return data;
};

export const releaseRentalSecurityDeposit = async (
    rentalId
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/security-deposit/release`
    );

    return data;
};

// `maintenancePlan`: { mode, days, reason } with a Maintenance outcome.
export const updateRentalVehicleOutcome = async (
    rentalId,
    vehicleOutcome,
    maintenancePlan = null
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/vehicle-outcome`,
        {
            vehicleOutcome,
            ...(maintenancePlan ? { maintenancePlan } : {}),
        }
    );

    return data;
};

export const completeRental = async (
    rentalId,
    notes = "",
    overrideOutstandingBalance = false
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/complete`,
        {
            notes,
            overrideOutstandingBalance,
        }
    );

    return data;
};

export const completeRentalAsCustomer = async (
    rentalId
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/customer-complete`
    );

    return data;
};

export const addRentalOperationalEvent = async (
    rentalId,
    eventData
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/events`,
        eventData
    );

    return data;
};

export const waiveRentalPenalty = async (
    rentalId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/penalty/waive`,
        { reason }
    );

    return data;
};

export const adjustRentalPenalty = async (
    rentalId,
    newAmount,
    reason = ""
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/penalty/adjust`,
        { newAmount, reason }
    );

    return data;
};

export const addRentalPenaltyNote = async (
    rentalId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/rentals/${rentalId}/penalty/note`,
        { reason }
    );

    return data;
};

export const applyRentalPenalty = async (
    rentalId,
    reason = ""
) => {
    const { data } = await api.post(
        `/rentals/${rentalId}/penalty/apply`,
        { reason }
    );

    return data;
};

export const getEarlyReturnCredits = async (
    params = {}
) => {
    const { data } = await api.get(
        "/early-returns",
        {
            params,
        }
    );

    return data;
};

export const approveEarlyReturnCredit = async (
    rentalId,
    unusedDays
) => {
    const { data } = await api.patch(
        `/early-returns/${rentalId}/approve`,
        unusedDays != null ? { unusedDays } : {}
    );

    return data;
};

export const rejectEarlyReturnCredit = async (
    rentalId,
    note = ""
) => {
    const { data } = await api.patch(
        `/early-returns/${rentalId}/reject`,
        { note }
    );

    return data;
};