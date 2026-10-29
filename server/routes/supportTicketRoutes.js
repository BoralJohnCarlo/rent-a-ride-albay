import express from "express";
import rateLimit from "express-rate-limit";

import {
    create,
    getMine,
    getAll,
    getOne,
    reply,
    markRead,
    getUnread,
    getContext,
    updateStatus,
} from "../controllers/supportTicketController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createTicketValidator,
    ticketIdValidator,
    replyValidator,
    updateStatusValidator,
} from "../validators/supportTicketValidator.js";

const router = express.Router();

/*
 * Runs AFTER protect, keyed by the signed-in user rather than IP - a chat
 * sends many short messages, so the budget is generous but still stops a
 * runaway client from flooding the admin inbox.
 */
const supportMessageRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => `support:${req.user._id}`,
    message: {
        success: false,
        message: "You're sending messages too quickly. Please wait a moment.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const newConversationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `support-new:${req.user._id}`,
    message: {
        success: false,
        message: "You've started several conversations recently. Please continue in an existing one or try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post(
    "/",
    protect,
    authorize("customer"),
    newConversationRateLimiter,
    createTicketValidator,
    create
);

router.get(
    "/mine",
    protect,
    authorize("customer"),
    getMine
);

router.get(
    "/unread-count",
    protect,
    authorize("customer", "admin"),
    getUnread
);

router.get(
    "/",
    protect,
    authorize("admin"),
    getAll
);

router.get(
    "/:id",
    protect,
    authorize("customer", "admin"),
    ticketIdValidator,
    getOne
);

router.get(
    "/:id/context",
    protect,
    authorize("admin"),
    ticketIdValidator,
    getContext
);

router.post(
    "/:id/replies",
    protect,
    authorize("customer", "admin"),
    supportMessageRateLimiter,
    replyValidator,
    reply
);

router.post(
    "/:id/read",
    protect,
    authorize("customer", "admin"),
    ticketIdValidator,
    markRead
);

router.patch(
    "/:id/status",
    protect,
    authorize("admin"),
    updateStatusValidator,
    updateStatus
);

export default router;
