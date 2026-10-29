import api from "../lib/axios";

export const createReview = async (
    bookingOrRentalId,
    reviewData
) => {
    const { data } = await api.post(
        `/reviews/${bookingOrRentalId}`,
        reviewData
    );

    return data;
};

export const getVehicleReviews = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/reviews/vehicles/${vehicleId}`
    );

    return data;
};

export const getDriverReviews = async (
    driverId
) => {
    const { data } = await api.get(
        `/reviews/drivers/${driverId}`
    );

    return data;
};

export const getRentalReview = async (
    rentalId
) => {
    const { data } = await api.get(
        `/reviews/rentals/${rentalId}`
    );

    return data;
};

export const getAllReviews = async () => {
    const { data } = await api.get("/reviews");

    return data;
};

export const getVehicleAverageRating = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/reviews/vehicles/${vehicleId}/average`
    );

    return data;
};

export const getDriverAverageRating = async (
    driverId
) => {
    const { data } = await api.get(
        `/reviews/drivers/${driverId}/average`
    );

    return data;
};
