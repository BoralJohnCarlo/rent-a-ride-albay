import api from "../lib/axios";

export const getBookings = async (
    params = {}
) => {
    const { data } = await api.get(
        "/bookings",
        {
            params,
        }
    );

    return data;
};

export const getBookingById = async (
    bookingId
) => {
    const { data } = await api.get(
        `/bookings/${bookingId}`
    );

    return data;
};

export const createBooking = async (
    bookingData
) => {
    const { data } = await api.post(
        "/bookings",
        bookingData
    );

    return data;
};

export const updateBooking = async (
    bookingId,
    bookingData
) => {
    const { data } = await api.put(
        `/bookings/${bookingId}`,
        bookingData
    );

    return data;
};

export const approveBooking = async (
    bookingId,
    driverId = null
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/approve`,
        driverId ? { driverId } : {}
    );

    return data;
};

export const rejectBooking = async (
    bookingId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/reject`,
        {
            reason,
        }
    );

    return data;
};

export const cancelBooking = async (
    bookingId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/cancel`,
        {
            reason,
        }
    );

    return data;
};

export const getBookingCancellationPreview = async (
    bookingId
) => {
    const { data } = await api.get(
        `/bookings/${bookingId}/cancellation-preview`
    );

    return data;
};

export const expireBooking = async (
    bookingId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/expire`
    );

    return data;
};

export const markBookingNoShow = async (
    bookingId,
    { ignorePickupBlocker = false } = {}
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/no-show`,
        { ignorePickupBlocker }
    );

    return data;
};

export const requestBookingExtension = async (
    bookingId,
    extensionData
) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/extensions`,
        extensionData
    );

    return data;
};

export const approveBookingExtension = async (
    bookingId,
    extensionId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/extensions/${extensionId}/approve`
    );

    return data;
};

export const rejectBookingExtension = async (
    bookingId,
    extensionId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/extensions/${extensionId}/reject`,
        {
            reason,
        }
    );

    return data;
};

export const cancelBookingExtension = async (
    bookingId,
    extensionId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/extensions/${extensionId}/cancel`,
        {
            reason,
        }
    );

    return data;
};

export const calculateDistanceFeesPreview =
    async (coordinates) => {
        const { data } =
            await api.post(
                "/bookings/calculate-distance-fees",
                coordinates
            );

        return data;
    };
/*
 * Reschedule: move a booking to new dates before pickup. A customer's
 * request waits for admin approval; an admin posting it applies it
 * directly. `preview` prices the dates without saving anything.
 */
/*
 * Maintenance conflicts: the booking's vehicle went under maintenance over
 * its dates. Admins send the customer their options; the customer (or an
 * admin for them) moves to another vehicle or takes a full refund.
 */
export const sendMaintenanceConflictOptions = async (bookingId) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/maintenance-conflict/send-options`
    );

    return data;
};

export const getMaintenanceConflictOptions = async (bookingId) => {
    const { data } = await api.get(
        `/bookings/${bookingId}/maintenance-conflict/options`
    );

    return data;
};

export const changeVehicleForMaintenanceConflict = async (
    bookingId,
    vehicleId
) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/maintenance-conflict/change-vehicle`,
        { vehicleId }
    );

    return data;
};

export const refundMaintenanceConflict = async (bookingId) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/maintenance-conflict/refund`
    );

    return data;
};

// Late return only: keep the booking and wait for the vehicle.
export const waitForLateVehicle = async (bookingId) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/maintenance-conflict/wait`
    );

    return data;
};

// Admin: the bookings this booking's late return affected, and the cost.
export const getLateReturnImpact = async (bookingId) => {
    const { data } = await api.get(
        `/bookings/${bookingId}/late-return-impact`
    );

    return data;
};

export const previewBookingReschedule = async (
    bookingId,
    dates
) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/reschedules/preview`,
        dates
    );

    return data;
};

export const requestBookingReschedule = async (
    bookingId,
    rescheduleData
) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/reschedules`,
        rescheduleData
    );

    return data;
};

export const approveBookingReschedule = async (
    bookingId,
    rescheduleId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/reschedules/${rescheduleId}/approve`
    );

    return data;
};

export const rejectBookingReschedule = async (
    bookingId,
    rescheduleId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/reschedules/${rescheduleId}/reject`,
        { reason }
    );

    return data;
};

export const cancelBookingReschedule = async (
    bookingId,
    rescheduleId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/reschedules/${rescheduleId}/cancel`,
        { reason }
    );

    return data;
};

/* Driver changes before pickup. */

// Admin: swap the driver directly (reason required).
export const changeBookingDriver = async (
    bookingId,
    { driverId, reason }
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/driver`,
        { driverId, reason }
    );

    return data;
};

// Customer: ask for a different driver, optionally naming one.
export const requestDriverChange = async (
    bookingId,
    { reason, preferredDriverId = null }
) => {
    const { data } = await api.post(
        `/bookings/${bookingId}/driver-change-requests`,
        preferredDriverId
            ? { reason, preferredDriverId }
            : { reason }
    );

    return data;
};

export const cancelDriverChangeRequest = async (
    bookingId,
    requestId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/driver-change-requests/${requestId}/cancel`
    );

    return data;
};

// Admin: approve (with the customer's pick unless driverId is given).
export const approveDriverChangeRequest = async (
    bookingId,
    requestId,
    { driverId = null, note = "" } = {}
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/driver-change-requests/${requestId}/approve`,
        driverId ? { driverId, note } : { note }
    );

    return data;
};

export const declineDriverChangeRequest = async (
    bookingId,
    requestId,
    { note = "" } = {}
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/driver-change-requests/${requestId}/decline`,
        { note }
    );

    return data;
};
