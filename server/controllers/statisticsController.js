import { getStatisticsData } from "../services/statisticsService.js";
import { getVehicleLeaderboard as getVehicleLeaderboardData } from "../services/vehicleLeaderboardService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getStatistics = async (req, res) => {
    try {
        const period = req.query.period || "30d";

        const userRole =
            req.user?.role || "admin";

        const userId =
            req.user?._id || null;

        const data = await getStatisticsData(
            period,
            userRole,
            userId
        );

        return successResponse(
            res,
            "Statistics retrieved successfully.",
            data
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/* Admin dashboard leaderboard: top performing and best-rated vehicles. */
export const getVehicleLeaderboard = async (req, res) => {
    try {
        const data = await getVehicleLeaderboardData({
            period: req.query.period,
            limit: req.query.limit,
        });

        return successResponse(
            res,
            "Vehicle leaderboard retrieved successfully.",
            data
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};
