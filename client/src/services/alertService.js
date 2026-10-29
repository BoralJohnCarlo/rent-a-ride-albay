import {
    getAlerts,
    getActiveAlerts,
    readAlert,
    resolveAlert,
} from "../api/alertApi";

export const fetchAlerts = async (params) => {
    return await getAlerts(params);
};

export const fetchActiveAlerts = async (params) => {
    return await getActiveAlerts(params);
};

export const markAlertAsRead = async (alertId) => {
    return await readAlert(alertId);
};

export const resolveExistingAlert = async (alertId) => {
    return await resolveAlert(alertId);
};
