import {
    getDashboardStats,
    getActivitySummary,
} from "../services/dashboardService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getDashboardData = async (req, res) => {
    try {
        const userRole =
            req.user?.role || "admin";

        const userId =
            req.user?._id || null;

        const data = await getDashboardStats(
            userRole,
            userId
        );

        return successResponse(
            res,
            "Dashboard data retrieved successfully.",
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

export const getActivityCounts = async (req, res) => {
    try {
        const userRole =
            req.user?.role || "admin";

        const userId =
            req.user?._id || null;

        const data = await getActivitySummary(
            userRole,
            userId
        );

        return successResponse(
            res,
            "Activity counts retrieved successfully.",
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
