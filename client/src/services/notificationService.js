import {
    deleteAllNotifications,
    deleteNotification,
    getNotifications,
    getUnreadCount,
    markAllAsRead,
    markAsRead,
} from "../api/notificationApi";

export const fetchNotifications = async (filters = {}) => {
    // Normalize category to match server PascalCase enum
    const normalizedFilters = { ...filters };
    if (normalizedFilters.category) {
        // Convert to PascalCase: first letter uppercase, rest lowercase
        normalizedFilters.category = 
            normalizedFilters.category.charAt(0).toUpperCase() + 
            normalizedFilters.category.slice(1).toLowerCase();
    }
    return await getNotifications(normalizedFilters);
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
