import Notification from "../models/Notification.js";

export const persistNotification = async (data) => {
    try {
        return await Notification.create({ ...data, pushPending: true });
    } catch (error) {
        // Only suppress the specific idempotency conflict, not unrelated errors.
        if (data.dedupeKey && error.code === 11000 && error.keyPattern?.dedupeKey) return null;
        throw error;
    }
};

const dismissal = {
    dismissed: true, read: true, pushPending: false,
    title: "Dismissed reminder", message: "Dismissed reminder", metadata: {},
};

export const removeNotificationRecord = async (id, recipient) => {
    const notification = await Notification.findOne({ _id: id, recipient, dismissed: { $ne: true } });
    if (!notification) return null;
    if (notification.dedupeKey) {
        // Keep only the reminder receipt, so deletion cannot make it recur.
        await Notification.updateOne({ _id: id, recipient }, { $set: dismissal });
    } else await notification.deleteOne();
    return notification;
};

export const removeAllNotificationRecords = async (recipient) => {
    const retained = await Notification.updateMany({ recipient, dedupeKey: { $type: "string" }, dismissed: { $ne: true } }, { $set: dismissal });
    const removed = await Notification.deleteMany({ recipient, dedupeKey: { $not: { $type: "string" } } });
    return { deletedCount: retained.modifiedCount + removed.deletedCount };
};
