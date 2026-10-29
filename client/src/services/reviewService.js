import {
    createReview as createReviewApi,
    getVehicleReviews,
    getDriverReviews,
    getRentalReview,
    getAllReviews,
    getVehicleAverageRating,
    getDriverAverageRating,
    uploadReviewImage as uploadReviewImageApi,
} from "../api/reviewApi";

export const submitReview = async (
    bookingOrRentalId,
    reviewData
) => {
    return await createReviewApi(
        bookingOrRentalId,
        reviewData
    );
};

export const fetchVehicleReviews = async (
    vehicleId
) => {
    return await getVehicleReviews(vehicleId);
};

export const fetchDriverReviews = async (
    driverId
) => {
    return await getDriverReviews(driverId);
};

export const fetchRentalReview = async (
    rentalId
) => {
    return await getRentalReview(rentalId);
};

export const fetchAllReviews = async () => {
    return await getAllReviews();
};

export const fetchVehicleAverageRating =
    async (vehicleId) => {
        return await getVehicleAverageRating(
            vehicleId
        );
    };

export const fetchDriverAverageRating =
    async (driverId) => {
        return await getDriverAverageRating(
            driverId
        );
    };

export const uploadReviewImage =
    async (file) => {
        return await uploadReviewImageApi(
            file
        );
    };
