import {
    getDashboardData,
    getActivityCounts,
} from "../api/dashboardApi";

export const fetchDashboardData = async () => {
    return await getDashboardData();
};

export const fetchActivityCounts = async () => {
    return await getActivityCounts();
};
