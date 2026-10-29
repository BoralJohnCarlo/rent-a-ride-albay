import {
    useCallback,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    createReview,
    getVehicleReviews,
    getDriverReviews,
    getRentalReview,
    fetchAdminReviews,
    fetchVehicleRating,
    fetchDriverRating,
    clearReviewError,
    clearSelectedReview,
} from "../../store/reviews/reviewSlice";

const useReview = () => {
    const dispatch = useDispatch();

    const {
        reviews,
        selectedReview,
        averageRating,
        reviewCount,
        loading,
        error,
    } = useSelector(
        (state) => state.reviews
    );

    const submitReview = useCallback(
        ({ bookingOrRentalId, reviewData }) =>
            dispatch(
                createReview({
                    bookingOrRentalId,
                    reviewData,
                })
            ).unwrap(),
        [dispatch]
    );

    const fetchVehicleReviews = useCallback(
        (vehicleId) =>
            dispatch(
                getVehicleReviews(vehicleId)
            ).unwrap(),
        [dispatch]
    );

    const fetchDriverReviews = useCallback(
        (driverId) =>
            dispatch(
                getDriverReviews(driverId)
            ).unwrap(),
        [dispatch]
    );

    const fetchRentalReview = useCallback(
        (rentalId) =>
            dispatch(
                getRentalReview(rentalId)
            ).unwrap(),
        [dispatch]
    );

    const fetchAllReviews = useCallback(
        () =>
            dispatch(
                fetchAdminReviews()
            ).unwrap(),
        [dispatch]
    );

    const fetchVehicleAverageRating =
        useCallback(
            (vehicleId) =>
                dispatch(
                    fetchVehicleRating(
                        vehicleId
                    )
                ).unwrap(),
            [dispatch]
        );

    const fetchDriverAverageRating =
        useCallback(
            (driverId) =>
                dispatch(
                    fetchDriverRating(
                        driverId
                    )
                ).unwrap(),
            [dispatch]
        );

    const clearError = useCallback(
        () =>
            dispatch(
                clearReviewError()
            ),
        [dispatch]
    );

    const clearSelected = useCallback(
        () =>
            dispatch(
                clearSelectedReview()
            ),
        [dispatch]
    );

    return {
        reviews,
        selectedReview,
        averageRating,
        reviewCount,
        loading,
        error,

        submitReview,
        fetchVehicleReviews,
        fetchDriverReviews,
        fetchRentalReview,
        fetchAllReviews,
        fetchVehicleAverageRating,
        fetchDriverAverageRating,

        clearError,
        clearSelected,
    };
};

export default useReview;
