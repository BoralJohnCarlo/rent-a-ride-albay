import createError from "../utils/createError.js";

import Consignment from "../models/Consignment.js";
import InspectionSetting from "../models/InspectionSetting.js";
import PendingRegistration from "../models/PendingRegistration.js";
import PendingVehicle from "../models/PendingVehicle.js";

import {
    CONSIGNMENT_STATUS,
    INSPECTION_STATUS,
} from "../constants/consignmentConstants.js";

/*
 * Who holds an inspection slot ("YYYY-MM-DD" date + "HH:mm" time):
 *  - a consignment whose inspection hasn't happened yet,
 *  - a partner's registration vehicle still awaiting review, and
 *  - a partner registration still waiting on email verification (the
 *    pending record expires on its own, which releases the slot).
 */
const consignmentHolds = (extra = {}) => ({
    "application.inspection.scheduledDate": { $nin: ["", null] },
    "application.inspection.status": INSPECTION_STATUS.PENDING,
    "application.status": {
        $in: [
            CONSIGNMENT_STATUS.PENDING,
            CONSIGNMENT_STATUS.UNDER_REVIEW,
        ],
    },
    ...extra,
});

const pendingVehicleHolds = (extra = {}) => ({
    "inspection.scheduledDate": { $nin: ["", null] },
    status: "pending_review",
    ...extra,
});

const pendingRegistrationHolds = (extra = {}) => ({
    "inspectionSlot.date": { $nin: ["", null] },
    role: "operator",
    emailVerificationExpires: { $gt: new Date() },
    ...extra,
});

/* Bookings per slot, keyed "date|time". */
export const getBookedInspectionCounts = async () => {
    const [consignments, vehicles, registrations] = await Promise.all([
        Consignment.aggregate([
            { $match: consignmentHolds() },
            {
                $group: {
                    _id: {
                        date: "$application.inspection.scheduledDate",
                        time: "$application.inspection.scheduledTime",
                    },
                    count: { $sum: 1 },
                },
            },
        ]),
        PendingVehicle.aggregate([
            { $match: pendingVehicleHolds() },
            {
                $group: {
                    _id: {
                        date: "$inspection.scheduledDate",
                        time: "$inspection.scheduledTime",
                    },
                    count: { $sum: 1 },
                },
            },
        ]),
        PendingRegistration.aggregate([
            { $match: pendingRegistrationHolds() },
            {
                $group: {
                    _id: {
                        date: "$inspectionSlot.date",
                        time: "$inspectionSlot.time",
                    },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    const counts = new Map();

    [...consignments, ...vehicles, ...registrations].forEach((entry) => {
        const key = `${entry._id.date}|${entry._id.time}`;
        counts.set(key, (counts.get(key) || 0) + entry.count);
    });

    return counts;
};

/*
 * Validate a requested date+time against the admin-managed inspection slots
 * and their per-slot capacity. `exclude*` leaves the caller's own booking out
 * of the count when it is moving or re-submitting it.
 */
export const assertInspectionSlotAvailable = async (
    date,
    time,
    { excludeConsignmentId, excludeRegistrationEmail } = {}
) => {
    if (!date || !time) {
        throw createError(
            "An inspection date and time are required.",
            400
        );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(`${date}T00:00:00`) < today) {
        throw createError(
            "The selected inspection date is in the past.",
            400
        );
    }

    const setting = await InspectionSetting.getInstance();

    if ((setting.disabledDates || []).includes(date)) {
        throw createError(
            "The selected inspection date is unavailable.",
            400
        );
    }

    const daySlot = (setting.inspectionSlots || []).find(
        (slot) => slot.date === date && slot.enabled !== false
    );

    const timeSlot = daySlot?.timeSlots?.find(
        (ts) => ts.time === time
    );

    if (!timeSlot) {
        throw createError(
            "The selected inspection slot is no longer offered.",
            400
        );
    }

    const [consignments, vehicles, registrations] = await Promise.all([
        Consignment.countDocuments(
            consignmentHolds({
                "application.inspection.scheduledDate": date,
                "application.inspection.scheduledTime": time,
                ...(excludeConsignmentId && {
                    _id: { $ne: excludeConsignmentId },
                }),
            })
        ),
        PendingVehicle.countDocuments(
            pendingVehicleHolds({
                "inspection.scheduledDate": date,
                "inspection.scheduledTime": time,
            })
        ),
        PendingRegistration.countDocuments(
            pendingRegistrationHolds({
                "inspectionSlot.date": date,
                "inspectionSlot.time": time,
                ...(excludeRegistrationEmail && {
                    email: { $ne: excludeRegistrationEmail },
                }),
            })
        ),
    ]);

    if (
        consignments + vehicles + registrations >=
        (timeSlot.maxAppointments || 1)
    ) {
        throw createError(
            "That inspection slot is fully booked. Please choose another.",
            409
        );
    }

    return timeSlot;
};
