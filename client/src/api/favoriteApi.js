import api from "../lib/axios";

export const getFavorites = async () => {
    const { data } = await api.get("/favorites");

    return data;
};

export const toggleFavorite = async (vehicleId) => {
    const { data } = await api.post(
        `/favorites/${vehicleId}/toggle`
    );

    return data;
};

export const checkFavorite = async (vehicleId) => {
    const { data } = await api.get(
        `/favorites/${vehicleId}/check`
    );

    return data;
};
