import api from "../lib/axios";

export const getDashboardData = async () => {
    const { data } = await api.get("/dashboard");

    return data;
};

export const getActivityCounts = async () => {
    const { data } = await api.get("/dashboard/activity-counts");

    return data;
};
