import {
    useCallback,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getBookings,
    getBookingById,
    createBooking,
    updateBooking,
    approveBooking,
    rejectBooking,
    cancelBooking,
    expireBooking,
    markBookingNoShow,
    requestBookingExtension,
    approveBookingExtension,
    rejectBookingExtension,
    cancelBookingExtension,
    clearBookingError,
    clearSelectedBooking,
    setBookingFilters,
    resetBookingFilters,
} from "../../store/bookings";



const useBooking = () => {
    const dispatch = useDispatch();

    const {
        bookings,
        selectedBooking,
        loading,
        error,
        filters,
    } = useSelector(
        (state) => state.bookings
    );


    const fetchBookings = useCallback(
    (bookingFilters = {}) => {
        return dispatch(
            getBookings(bookingFilters)
        );
    },
    [dispatch]
);


    const fetchBookingById = useCallback(
        (bookingId) => {
            return dispatch(
                getBookingById(bookingId)
            );
        },
        [dispatch]
    );


    const addBooking = (
        bookingData
    ) => {
        return dispatch(
            createBooking(bookingData)
        );
    };


    const editBooking = (
        bookingId,
        bookingData
    ) => {
        return dispatch(
            updateBooking({
                bookingId,
                bookingData,
            })
        );
    };


    const approveExistingBooking = ({
        bookingId,
        driverId = null,
    }) => {
        return dispatch(
            approveBooking({
                bookingId,
                driverId,
            })
        );
    };


    const rejectExistingBooking = (
        bookingId,
        reason = ""
    ) => {
        return dispatch(
            rejectBooking({
                bookingId,
                reason,
            })
        );
    };


    const cancelExistingBooking = (
        bookingId,
        reason = ""
    ) => {
        return dispatch(
            cancelBooking({
                bookingId,
                reason,
            })
        );
    };


    const expireExistingBooking = (
        bookingId
    ) => {
        return dispatch(
            expireBooking(bookingId)
        );
    };

    const markExistingBookingNoShow = (
        bookingId,
        { ignorePickupBlocker = false } = {}
    ) => {
        return dispatch(
            markBookingNoShow({
                bookingId,
                ignorePickupBlocker,
            })
        );
    };

        const requestExistingBookingExtension = (
        bookingId,
        extensionData
    ) => {
        return dispatch(
            requestBookingExtension({
                bookingId,
                extensionData,
            })
        );
    };


    const approveExistingBookingExtension = (
        bookingId,
        extensionId
    ) => {
        return dispatch(
            approveBookingExtension({
                bookingId,
                extensionId,
            })
        );
    };


    const rejectExistingBookingExtension = (
        bookingId,
        extensionId,
        reason = ""
    ) => {
        return dispatch(
            rejectBookingExtension({
                bookingId,
                extensionId,
                reason,
            })
        );
    };


    const cancelExistingBookingExtension = (
        bookingId,
        extensionId,
        reason = ""
    ) => {
        return dispatch(
            cancelBookingExtension({
                bookingId,
                extensionId,
                reason,
            })
        );
    };


    const clearError = () => {
        dispatch(clearBookingError());
    };


    const clearSelected = useCallback(() => {
        dispatch(clearSelectedBooking());
    }, [dispatch]);


    const updateFilters = (
        filterUpdates
    ) => {
        dispatch(
            setBookingFilters(
                filterUpdates
            )
        );
    };


    const resetFilters = () => {
        dispatch(
            resetBookingFilters()
        );
    };


    return {
        bookings,
        selectedBooking,
        loading,
        error,
        filters,

        fetchBookings,
        fetchBookingById,
        addBooking,
        editBooking,
        approveExistingBooking,
        rejectExistingBooking,
        cancelExistingBooking,
        expireExistingBooking,
        markExistingBookingNoShow,

        requestExistingBookingExtension,
        approveExistingBookingExtension,
        rejectExistingBookingExtension,
        cancelExistingBookingExtension,

        clearError,
        clearSelected,

        updateFilters,
        resetFilters,
    };
};


export default useBooking;