import express from "express";

import {
    getNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    removeNotification,
    removeAllNotifications,
} from "../controllers/notificationController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);

router.get("/unread-count", getUnreadNotificationCount);

router.put("/:id/read", markNotificationAsRead);

router.put("/read-all", markAllNotificationsAsRead);

router.delete("/:id", removeNotification);

router.delete("/", removeAllNotifications);

export default router;
