import {
    getBookings,
    getBookingById,
    createBooking,
    updateBooking,
    approveBooking,
    rejectBooking,
    cancelBooking,
    getBookingCancellationPreview,
    expireBooking,
    markBookingNoShow,
    requestBookingExtension,
    approveBookingExtension,
    rejectBookingExtension,
    cancelBookingExtension,
} from "../api/bookingApi";

export const fetchBookings = async (
    filters = {}
) => {
    return await getBookings(filters);
};

export const fetchBookingById = async (
    bookingId
) => {
    return await getBookingById(bookingId);
};

export const createNewBooking = async (
    bookingData
) => {
    return await createBooking(
        bookingData
    );
};

export const updateExistingBooking = async (
    bookingId,
    bookingData
) => {
    return await updateBooking(
        bookingId,
        bookingData
    );
};

export const approveExistingBooking = async (
    bookingId,
    driverId = null
) => {
    return await approveBooking(
        bookingId,
        driverId
    );
};

export const rejectExistingBooking = async (
    bookingId,
    reason = ""
) => {
    return await rejectBooking(
        bookingId,
        reason
    );
};

export const cancelExistingBooking = async (
    bookingId,
    reason = ""
) => {
    return await cancelBooking(
        bookingId,
        reason
    );
};

export const fetchBookingCancellationPreview = async (
    bookingId
) => {
    return await getBookingCancellationPreview(
        bookingId
    );
};

export const expireExistingBooking = async (
    bookingId
) => {
    return await expireBooking(
        bookingId
    );
};

export const markExistingBookingNoShow = async (
    bookingId,
    options
) => {
    return await markBookingNoShow(
        bookingId,
        options
    );
};

export const requestExistingBookingExtension =
    async (
        bookingId,
        extensionData
    ) => {
        return await requestBookingExtension(
            bookingId,
            extensionData
        );
    };

export const approveExistingBookingExtension =
    async (
        bookingId,
        extensionId
    ) => {
        return await approveBookingExtension(
            bookingId,
            extensionId
        );
    };

export const rejectExistingBookingExtension =
    async (
        bookingId,
        extensionId,
        reason = ""
    ) => {
        return await rejectBookingExtension(
            bookingId,
            extensionId,
            reason
        );
    };

export const cancelExistingBookingExtension =
    async (
        bookingId,
        extensionId,
        reason = ""
    ) => {
        return await cancelBookingExtension(
            bookingId,
            extensionId,
            reason
        );
    };