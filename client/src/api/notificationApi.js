import api from "../lib/axios";

export const getNotifications = async (params = {}) => {
    const { data } = await api.get("/notifications", {
        params,
    });

    return data;
};

export const getUnreadCount = async () => {
    const { data } = await api.get("/notifications/unread-count");

    return data;
};

export const markAsRead = async (notificationId) => {
    const { data } = await api.put(
        `/notifications/${notificationId}/read`
    );

    return data;
};

export const markAllAsRead = async () => {
    const { data } = await api.put("/notifications/read-all");

    return data;
};

export const deleteNotification = async (notificationId) => {
    const { data } = await api.delete(
        `/notifications/${notificationId}`
    );

    return data;
};

export const deleteAllNotifications = async () => {
    const { data } = await api.delete("/notifications/");

    return data;
};
