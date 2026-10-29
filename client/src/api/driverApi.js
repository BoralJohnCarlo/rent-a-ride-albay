import api from "../lib/axios";

// Optional { startDate, endDate } (ISO): drivers booked then come back busy.
export const getAvailableDrivers = async (
    params = {}
) => {
    const { data } = await api.get(
        "/drivers/available",
        {
            params,
        }
    );

    return data;
};

// Bookings that still hold this driver (for the suspend/unavailable warning).
export const getDriverUpcomingBookings = async (
    driverId
) => {
    const { data } = await api.get(
        `/drivers/${driverId}/upcoming-bookings`
    );

    return data;
};

export const getDrivers = async (
    params = {}
) => {
    const { data } = await api.get(
        "/drivers",
        {
            params,
        }
    );

    return data;
};

export const getDriverById = async (
    driverId
) => {
    const { data } = await api.get(
        `/drivers/${driverId}`
    );

    return data;
};

export const getPublicDriverProfile = async (
    driverId
) => {
    const { data } = await api.get(
        `/drivers/${driverId}/public`
    );

    return data;
};

export const createDriver = async (
    driverData
) => {
    const { data } = await api.post(
        "/drivers",
        driverData
    );

    return data;
};

export const updateDriver = async (
    driverId,
    driverData
) => {
    const { data } = await api.put(
        `/drivers/${driverId}`,
        driverData
    );

    return data;
};

export const updateDriverStatus = async (
    driverId,
    status
) => {
    const { data } = await api.patch(
        `/drivers/${driverId}/status`,
        {
            status,
        }
    );

    return data;
};

export const updateDriverAvailability =
    async (
        driverId,
        availability
    ) => {
        const { data } = await api.patch(
            `/drivers/${driverId}/availability`,
            {
                availability,
            }
        );

        return data;
    };

export const archiveDriver = async (
    driverId,
    reason = ""
) => {
    const { data } = await api.patch(
        `/drivers/${driverId}/archive`,
        {
            reason,
        }
    );

    return data;
};

export const restoreDriver = async (
    driverId
) => {
    const { data } = await api.patch(
        `/drivers/${driverId}/restore`
    );

    return data;
};