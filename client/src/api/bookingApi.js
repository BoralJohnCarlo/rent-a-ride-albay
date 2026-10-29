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
    bookingId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/approve`
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

export const expireBooking = async (
    bookingId
) => {
    const { data } = await api.patch(
        `/bookings/${bookingId}/expire`
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