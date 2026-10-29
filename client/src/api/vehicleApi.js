import api from "../lib/axios";

export const getVehicles = async (params = {}) => {
    const { data } = await api.get(
        "/vehicles",
        {
            params,
        }
    );

    return data;
};

export const getMyVehicles = async (params = {}) => {
    const { data } = await api.get(
        "/vehicles/mine",
        {
            params,
        }
    );

    return data;
};

export const getVehicleCounts = async (
    params = {}
) => {
    const { data } = await api.get(
        "/vehicles/counts",
        {
            params,
        }
    );

    return data;
};

/*
 * Admin only: { [vehicleId]: { current, next, upcomingCount } } — the rental
 * each vehicle is out on and its next confirmed booking.
 */
export const getVehicleBookingSchedule = async () => {
    const { data } = await api.get(
        "/vehicles/booking-schedule"
    );

    return data;
};

export const getVehicleById = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}`
    );

    return data;
};

export const createVehicle = async (
    vehicleData
) => {
    const { data } = await api.post(
        "/vehicles",
        vehicleData
    );

    return data;
};

export const updateVehicle = async (
    vehicleId,
    vehicleData
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}`,
        vehicleData
    );

    return data;
};

export const archiveVehicle = async (
    vehicleId,
    archiveReason = ""
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/archive`,
        {
            archiveReason,
        }
    );

    return data;
};

export const restoreVehicle = async (
    vehicleId
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/restore`
    );

    return data;
};

export const updateVehicleStatus = async (
    vehicleId,
    status
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/status`,
        {
            status,
        }
    );

    return data;
};

/*
 * Maintenance: { mode: "Turnaround" | "Extended" | "OffRoad", days, reason }.
 * The vehicle stays listed; only the maintenance window is unbookable.
 * Returns { vehicle, conflicts } (the bookings inside the window).
 */
export const setVehicleMaintenance = async (
    vehicleId,
    { mode, days = null, reason = "" }
) => {
    const { data } = await api.put(
        `/vehicles/${vehicleId}/maintenance`,
        { mode, days, reason }
    );

    return data;
};

export const endVehicleMaintenance = async (vehicleId) => {
    const { data } = await api.delete(
        `/vehicles/${vehicleId}/maintenance`
    );

    return data;
};

/* The window and the bookings it would hit, without saving. */
export const previewVehicleMaintenance = async (
    vehicleId,
    { mode, days = null, from = null }
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/maintenance/preview`,
        {
            params: {
                mode,
                days: days ?? undefined,
                from: from ?? undefined,
            },
        }
    );

    return data;
};

export const updateVehicleCondition = async (
    vehicleId,
    condition
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/condition`,
        {
            condition,
        }
    );

    return data;
};

export const updateVehicleBooking = async (
    vehicleId,
    availability
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/booking`,
        availability
    );

    return data;
};

export const getVehicleAvailability = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability`
    );

    return data;
};

export const checkVehicleAvailability = async (
    vehicleId,
    startDate,
    endDate,
    driverId = null
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability/check`,
        {
            params: {
                startDate,
                endDate,
                driver: driverId || undefined,
            },
        }
    );

    return data;
};

export const checkVehiclesAvailabilityBulk = async (
    vehicleIds,
    startDate,
    endDate
) => {
    const { data } = await api.post(
        "/vehicles/availability/check-bulk",
        {
            vehicleIds,
            startDate,
            endDate,
        }
    );

    return data;
};

/*
 * Which pickup times work for a rental between two Manila "YYYY-MM-DD"
 * dates (return at the same time): { times: [{ time: "14:30", available }] }.
 */
export const getVehiclePickupTimes = async (
    vehicleId,
    startDate,
    endDate,
    driverId = null
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability/pickup-times`,
        {
            params: {
                startDate,
                endDate,
                driver: driverId || undefined,
            },
        }
    );

    return data;
};

export const getVehicleAvailabilityCalendar = async (
    vehicleId,
    startDate,
    endDate
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability/calendar`,
        {
            params: {
                startDate,
                endDate,
            },
        }
    );

    return data;
};

export const addVehicleBlockedDate = async (
    vehicleId,
    blockedDateData
) => {
    const { data } = await api.post(
        `/vehicles/${vehicleId}/blocked-dates`,
        blockedDateData
    );

    return data;
};

export const removeVehicleBlockedDate = async (
    vehicleId,
    blockedDateId
) => {
    const { data } = await api.delete(
        `/vehicles/${vehicleId}/blocked-dates/${blockedDateId}`
    );

    return data;
};

export const updateFeaturedVehicle = async (
    vehicleId,
    isFeatured
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/featured`,
        {
            isFeatured,
        }
    );

    return data;
};

export const uploadVehicleImage = async (
    file
) => {
    const formData = new FormData();

    formData.append("image", file);

    const { data } = await api.post(
        "/vehicles/upload-image",
        formData,
        {
            headers: {
                "Content-Type":
                    undefined,
            },
        }
    );

    return data;
};

export const checkPlateNumberExists = async (
    plateNumber,
    excludeId
) => {
    const { data } = await api.get(
        "/vehicles/check-plate",
        {
            params: { plateNumber, excludeId },
        }
    );

    return data;
};

export const checkRegistrationNumberExists = async (
    registrationNumber,
    excludeId
) => {
    const { data } = await api.get(
        "/vehicles/check-registration",
        {
            params: { registrationNumber, excludeId },
        }
    );

    return data;
};

export const renewVehicleRegistration = async (
    vehicleId,
    { officialReceipt, expirationDate }
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/renew-registration`,
        { officialReceipt, expirationDate }
    );

    return data;
};

export const setVehicleRegistrationAvailability = async (
    vehicleId,
    availableFrom
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/registration-availability`,
        { availableFrom }
    );

    return data;
};

export const getVehicleRegistrationRenewalEligibility = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/registration-renewal-eligibility`
    );

    return data;
};

export const requestVehicleRegistrationRenewalAttempt = async (
    vehicleId
) => {
    const { data } = await api.post(
        `/vehicles/${vehicleId}/request-registration-renewal-attempt`
    );

    return data;
};

export const grantVehicleRegistrationRenewalAttempt = async (
    vehicleId,
    amount = 1
) => {
    const { data } = await api.post(
        `/vehicles/${vehicleId}/grant-registration-renewal-attempt`,
        { amount }
    );

    return data;
};