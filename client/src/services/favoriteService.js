import {
    getFavorites,
    toggleFavorite,
    checkFavorite,
} from "../api/favoriteApi";

export const fetchFavorites = async () => {
    return await getFavorites();
};

export const toggleVehicleFavorite =
    async (vehicleId) => {
        return await toggleFavorite(
            vehicleId
        );
    };

export const verifyFavorite =
    async (vehicleId) => {
        return await checkFavorite(
            vehicleId
        );
    };
