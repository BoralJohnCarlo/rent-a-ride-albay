import Notification from "../models/Notification.js";
import User from "../models/User.js";

import { BOOKING_CODE_PREFIX } from "../constants/bookingConstants.js";
import { RENTAL_CODE_PREFIX } from "../constants/rentalConstants.js";

import { sendEmailInBackground } from "./emailService.js";
import { appLink, renderEmail } from "../utils/emailTemplates.js";

/*
 * Customers never see internal booking/rental codes (BK-…, RN-…): they know
 * their trips by vehicle and dates. Messages are shared with admins and
 * operators, who do use the codes, so customer copies are reworded here —
 * the one place every notification passes through.
 */
const CODE = `(?:${BOOKING_CODE_PREFIX}|${RENTAL_CODE_PREFIX})\\d+`;

const CODE_REWRITES = [
    // "(BK-0012)", "(rental RN-0005)" → dropped.
    [new RegExp(`\\s*\\((?:booking |rental )?${CODE}\\)`, "g"), ""],
    // "Your booking BK-0012" → "Your booking".
    [new RegExp(`\\b(Your|your) (booking|rental) ${CODE}`, "g"), "$1 $2"],
    // "for rental RN-0005" → "for your rental".
    [
        new RegExp(`\\b(for|of|on|to|from|with) (booking|rental) ${CODE}`, "g"),
        "$1 your $2",
    ],
    // Sentence start / elsewhere.
    [new RegExp(`\\bBooking ${CODE}`, "g"), "Your booking"],
    [new RegExp(`\\bRental ${CODE}('s)?`, "g"), "Your rental$1"],
    [new RegExp(`\\bbooking ${CODE}`, "g"), "your booking"],
    [new RegExp(`\\brental ${CODE}('s)?`, "g"), "your rental$1"],
    // Anything left.
    [new RegExp(`\\s*${CODE}`, "g"), ""],
];

export const stripReferenceCodes = (text) =>
    typeof text === "string"
        ? CODE_REWRITES.reduce(
              (result, [pattern, replacement]) =>
                  result.replace(pattern, replacement),
              text
          )
        : text;

const findRecipient = (userId) =>
    User.findById(userId).select("role email firstName").lean();

/*
 * Where a customer's email button points when the caller didn't pick one:
 * the booking it's about, or their bookings list.
 */
const defaultCustomerActionPath = (metadata) =>
    metadata?.relatedModel === "Booking" && metadata?.relatedId
        ? `/customer/bookings/${metadata.relatedId}`
        : "/customer/bookings";

/*
 * The optional email copy of a notification. A caller opts in per event with
 * `email` on the notification data — most notices stay in-app only:
 *   email: true            → the title and message, with a button to the booking
 *   email: { subject, heading, paragraphs, rows, actionLabel, actionPath,
 *            footnote }     → any of these override the defaults
 * Sent in the background; a mail failure never fails the notification.
 */
const sendNotificationEmail = (
    recipient,
    { title, message, metadata, email },
    forCustomer
) => {
    if (!email || !recipient?.email) {
        return;
    }

    const options = email === true ? {} : email;
    const clean = (text) =>
        forCustomer ? stripReferenceCodes(text) : text;

    const actionPath =
        options.actionPath ??
        (forCustomer ? defaultCustomerActionPath(metadata) : null);

    const actionUrl = actionPath ? appLink(actionPath) : null;

    const rendered = renderEmail({
        subject: clean(options.subject || title),
        heading: clean(options.heading || title),
        greetingName: recipient.firstName || "there",
        paragraphs: (options.paragraphs
            ? [].concat(options.paragraphs)
            : [message]
        ).map(clean),
        rows: (options.rows || []).map(([label, value]) => [
            label,
            typeof value === "string" ? clean(value) : value,
        ]),
        action: actionUrl
            ? {
                  label: options.actionLabel || "View in Rent-A-Ride Albay",
                  url: actionUrl,
              }
            : null,
        footnote: options.footnote,
    });

    sendEmailInBackground(
        { to: recipient.email, ...rendered },
        `"${title}" email`
    );
};

export const createNotification = async ({
    recipient,
    type,
    title,
    message,
    variant = "info",
    category,
    metadata = {},
    email = null,
}) => {
    try {
        const recipientUser = await findRecipient(recipient);
        const forCustomer = recipientUser?.role === "customer";

        const notification = await Notification.create({
            recipient,
            type,
            title: forCustomer ? stripReferenceCodes(title) : title,
            message: forCustomer ? stripReferenceCodes(message) : message,
            variant,
            category,
            metadata: forCustomer
                ? {
                      ...metadata,
                      // The item shows the reference; codes stay internal.
                      reference: new RegExp(`^${CODE}$`).test(
                          metadata?.reference ?? ""
                      )
                          ? undefined
                          : metadata?.reference,
                  }
                : metadata,
        });

        sendNotificationEmail(
            recipientUser,
            { title, message, metadata, email },
            forCustomer
        );

        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error);

        return null;
    }
};

export const getNotificationsByUser = async (userId, { read, category, search, limit = 20, skip = 0 } = {}) => {
    const query = { recipient: userId };

    if (read !== undefined) {
        query.read = read;
    }

    if (category) {
        // Normalize category to PascalCase for consistent matching
        query.category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    }

    if (search) {
        // Escape special regex characters to prevent injection and ReDoS
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { title: new RegExp(escapedSearch, "i") },
            { message: new RegExp(escapedSearch, "i") },
        ];
    }

    let notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await Notification.countDocuments(query);

    return { notifications, total };
};

export const getUnreadCount = async (userId) => {
    return Notification.countDocuments({ recipient: userId, read: false });
};

export const markAsRead = async (notificationId, userId) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
    });

    if (!notification) {
        return null;
    }

    notification.read = true;

    await notification.save();

    return notification;
};

export const markAllAsRead = async (userId) => {
    const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true }
    );

    return result;
};

export const deleteNotification = async (notificationId, userId) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
    });

    if (!notification) {
        return null;
    }

    await notification.deleteOne();

    return notification;
};

export const deleteAllNotifications = async (userId) => {
    const result = await Notification.deleteMany({ recipient: userId });

    return result;
};

const buildAdminNotification = async (data) => {
    const admins = await import("../models/User.js").then((m) =>
        m.default.find({ role: "admin" }).select("_id")
    );

    const notifications = [];

    for (const admin of admins) {
        const notification = await createNotification({
            recipient: admin._id,
            ...data,
        });

        if (notification) {
            notifications.push(notification);
        }
    }

    return notifications;
};

const buildRoleNotification = async (roles, data) => {
    const users = await import("../models/User.js").then((m) =>
        m.default.find({ role: { $in: roles } }).select("_id")
    );

    const notifications = [];

    for (const user of users) {
        const notification = await createNotification({
            recipient: user._id,
            ...data,
        });

        if (notification) {
            notifications.push(notification);
        }
    }

    return notifications;
};

export const notifyAdmins = async (data) => buildAdminNotification(data);

export const notifyOperators = async (data) =>
    buildRoleNotification(["operator"], data);

export const notifyCustomers = async (data) =>
    buildRoleNotification(["customer"], data);

export const notifyUser = async (userId, data) =>
    createNotification({ recipient: userId, ...data });

export const notifyUsers = async (userIds, data) => {
    const notifications = [];

    for (const userId of userIds) {
        const notification = await createNotification({
            recipient: userId,
            ...data,
        });

        if (notification) {
            notifications.push(notification);
        }
    }

    return notifications;
};

/*
 * True when a notification of the given type already exists for this recipient
 * (optionally scoped to a related entity and/or a time window). Used by
 * scheduled reminders to avoid re-sending the same notice. Without a
 * recipient it checks everyone — e.g. an alert already sent to the admins.
 */
export const hasRecentNotification = async ({
    recipient,
    type,
    relatedId,
    since,
}) => {
    const query = { type };

    if (recipient) {
        query.recipient = recipient;
    }

    if (relatedId) {
        query["metadata.relatedId"] = relatedId;
    }

    if (since) {
        query.createdAt = { $gte: since };
    }

    const existing = await Notification.findOne(query).select("_id").lean();

    return Boolean(existing);
};
