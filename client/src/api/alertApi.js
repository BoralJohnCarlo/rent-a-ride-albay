import api from "../lib/axios";

export const getAlerts = async (params = {}) => {
    const { data } = await api.get("/alerts", { params });

    return data;
};

export const getActiveAlerts = async (params = {}) => {
    const { data } = await api.get("/alerts/active", { params });

    return data;
};

export const getAlertById = async (alertId) => {
    const { data } = await api.get(`/alerts/${alertId}`);

    return data;
};

export const readAlert = async (alertId) => {
    const { data } = await api.patch(`/alerts/${alertId}/read`);

    return data;
};

export const resolveAlert = async (alertId) => {
    const { data } = await api.patch(`/alerts/${alertId}/resolve`);

    return data;
};
