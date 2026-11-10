import Booking from "../models/Booking.js";
import { BOOKING_STATUS } from "../constants/bookingConstants.js";
import { getPickupReference } from "./cancellationPolicyService.js";
import { hasRecentNotification, notifyUser } from "./notificationService.js";
import { pickupReminderDue } from "../utils/pickupReminder.js";

// One reminder per approved booking and pickup date; a reschedule may need a new one.
export const sendPickupReminders = async () => {
    const now = new Date();
    const bookings = await Booking.find({
        status: BOOKING_STATUS.APPROVED,
        startDate: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), $lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) },
    }).select("customer startDate").lean();
    for (const booking of bookings) {
        if (!pickupReminderDue(booking.startDate, now)) continue;
        const type = `Pickup Reminder ${getPickupReference(booking.startDate).toISOString()}`;
        if (await hasRecentNotification({ recipient: booking.customer, type, relatedId: booking._id })) continue;
        await notifyUser(booking.customer, {
            dedupeKey: `pickup:${booking._id}:${getPickupReference(booking.startDate).toISOString()}`,
            type, title: "Upcoming Pickup", category: "Booking",
            message: "Your approved booking starts within 24 hours. Check your booking for pickup details and required documents.",
            metadata: { relatedModel: "Booking", relatedId: booking._id },
        });
    }
};
