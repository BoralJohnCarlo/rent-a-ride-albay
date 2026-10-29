import api from "../lib/axios";

export const getStatistics = async (period = "30d") => {
    const { data } = await api.get(
        "/statistics",
        {
            params: { period },
        }
    );

    return data;
};

/* Admin-only: top performing (period) and best-rated (all-time) vehicles. */
export const getVehicleLeaderboard = async ({
    period = "30d",
    limit = 5,
} = {}) => {
    const { data } = await api.get(
        "/statistics/vehicle-leaderboard",
        {
            params: { period, limit },
        }
    );

    return data;
};
