import {
    deleteAllNotifications,
    deleteNotification,
    getNotifications,
    getUnreadCount,
    markAllAsRead,
    markAsRead,
} from "../api/notificationApi";

export const fetchNotifications = async (filters = {}) => {
    return await getNotifications(filters);
};

export const fetchUnreadCount = async () => {
    return await getUnreadCount();
};

export const markNotificationAsRead = async (notificationId) => {
    return await markAsRead(notificationId);
};

export const markAllNotificationsAsRead = async () => {
    return await markAllAsRead();
};

export const removeNotification = async (notificationId) => {
    return await deleteNotification(notificationId);
};

export const removeAllNotifications = async () => {
    return await deleteAllNotifications();
};
