import Notification from "../models/Notification.js";

import {
    getNotificationsByUser,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
} from "../services/notificationService.js";

export const getNotifications = async (req, res) => {
    try {
        const { read, category, search, page = 1, limit = 20 } = req.query;

        // Validate and sanitize pagination parameters
        const currentPage = Math.max(1, parseInt(page) || 1);
        const limitPerPage = Math.min(100, Math.max(1, parseInt(limit)) || 20);
        const skip = (currentPage - 1) * limitPerPage;

        const { notifications, total } = await getNotificationsByUser(req.user._id, {
            read: read !== undefined ? read === "true" : undefined,
            category,
            search,
            limit: limitPerPage,
            skip,
        });

        res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total,
                pages: Math.ceil(total / limitPerPage),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch notifications.",
            error: error.message,
        });
    }
};

export const getUnreadNotificationCount = async (req, res) => {
    try {
        const count = await getUnreadCount(req.user._id);

        res.status(200).json({
            success: true,
            data: { count },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch unread count.",
            error: error.message,
        });
    }
};

export const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await markAsRead(id, req.user._id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found.",
            });
        }

        res.status(200).json({
            success: true,
            data: notification,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to mark notification as read.",
            error: error.message,
        });
    }
};

export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const result = await markAllAsRead(req.user._id);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read.",
            error: error.message,
        });
    }
};

export const removeNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await deleteNotification(id, req.user._id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found.",
            });
        }

        res.status(200).json({
            success: true,
            data: notification,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete notification.",
            error: error.message,
        });
    }
};

export const removeAllNotifications = async (req, res) => {
    try {
        const result = await deleteAllNotifications(req.user._id);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete all notifications.",
            error: error.message,
        });
    }
};
