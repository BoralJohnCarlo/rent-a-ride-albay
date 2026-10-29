import createError from "../utils/createError.js";

import Booking from "../models/Booking.js";
import Vehicle from "../models/Vehicle.js";

import {
    VEHICLE_STATUS,
    VEHICLE_MAINTENANCE_MODE,
} from "../constants/vehicleConstants.js";
import {
    BOOKING_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
    BOOKING_VEHICLE_CONFLICT_CAUSE,
} from "../constants/bookingConstants.js";

import {
    getMaintenanceWindow,
    computeMaintenanceUntil,
    formatMaintenanceDate,
} from "../utils/vehicleMaintenance.js";

import { getTurnaroundBufferMs } from "./settingsService.js";
import { isOutOnRental } from "./bookingConflictService.js";
import { notifyAdmins, notifyUser } from "./notificationService.js";

/*
 * Vehicle maintenance windows (Vehicle.maintenance) and the bookings they
 * run into. A vehicle under maintenance stays listed; only its window is
 * unbookable (utils/vehicleMaintenance.js). Bookings already holding those
 * dates are flagged as maintenance conflicts for an admin to act on — the
 * customer is then offered another vehicle or a full refund (bookingService).
 */

const EMPTY_MAINTENANCE = Object.freeze({
    mode: null,
    startedAt: null,
    until: null,
    days: null,
    reason: "",
    setBy: null,
    setAt: null,
    rental: null,
});

/* Bookings not picked up yet — the ones a maintenance window can strand. */
const UNPICKED_BOOKING_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

const vehicleLabel = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "The vehicle";

const describeWindowEnd = (until) =>
    until
        ? `until ${formatMaintenanceDate(until)}`
        : "with no end date (off road)";

const overlapQuery = (window) => ({
    endDate: { $gt: new Date(window.start) },
    ...(Number.isFinite(window.end)
        ? { startDate: { $lt: new Date(window.end) } }
        : {}),
});

/* Unpicked bookings of this vehicle inside the window, soonest first. */
const findBookingsInWindow = (vehicleId, window) =>
    Booking.find({
        vehicle: vehicleId,
        status: { $in: UNPICKED_BOOKING_STATUSES },
        ...overlapQuery(window),
    })
        .select(
            "bookingCode customer startDate endDate status maintenanceConflict"
        )
        .populate("customer", "firstName lastName")
        .sort({ startDate: 1 });

const toConflictSummary = (booking) => ({
    _id: booking._id,
    bookingCode: booking.bookingCode,
    status: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    customerName:
        [booking.customer?.firstName, booking.customer?.lastName]
            .filter(Boolean)
            .join(" ") || "Customer",
    conflictStatus: booking.maintenanceConflict?.status ?? null,
});

/*
 * Where a vehicle's status goes once it's back in service: out with the
 * next customer, held for an approved booking, blocked by an expired
 * registration, or simply available.
 */
const resolveInServiceStatus = async (vehicle) => {
    if (await isOutOnRental("vehicle", vehicle._id)) {
        return VEHICLE_STATUS.RENTED;
    }

    if (
        await Booking.exists({
            vehicle: vehicle._id,
            status: BOOKING_STATUS.APPROVED,
        })
    ) {
        return VEHICLE_STATUS.RESERVED;
    }

    const licenseExpiration = vehicle.compliance?.licenseExpiration;

    if (licenseExpiration && new Date(licenseExpiration) <= new Date()) {
        return VEHICLE_STATUS.EXPIRED_REGISTRATION;
    }

    return VEHICLE_STATUS.AVAILABLE;
};

const notifyOperator = async (vehicle, { title, message, variant }) => {
    if (!vehicle?.operator) {
        return;
    }

    try {
        await notifyUser(vehicle.operator, {
            type: "Vehicle Maintenance",
            title,
            message,
            variant,
            category: "Vehicle",
            metadata: {
                relatedId: vehicle._id,
                relatedModel: "Vehicle",
            },
        });
    } catch (notificationError) {
        console.error(
            `Failed to notify the operator of vehicle ${vehicle._id} about maintenance:`,
            notificationError
        );
    }
};

/*
 * Conflicts that no longer hold — the maintenance ended, was shortened past
 * the booking, or the booking moved off this vehicle or ended — are cleared.
 * Ones still in the window get its latest end date. A customer who was
 * already asked to choose is told their booking now stands.
 */
export const reconcileMaintenanceConflicts = async (vehicleId) => {
    const vehicle = await Vehicle.findById(vehicleId)
        .select("brand model status maintenance")
        .lean();

    const window = getMaintenanceWindow(vehicle);

    // Late-return conflicts clear on the vehicle's return instead
    // (lateReturnConflictService.reconcileLateReturnConflicts).
    const active = await Booking.find({
        "maintenanceConflict.vehicle": vehicleId,
        "maintenanceConflict.cause": {
            $ne: BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
        },
        "maintenanceConflict.status": {
            $in: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
        },
    });

    for (const booking of active) {
        const stillInWindow =
            window &&
            String(booking.vehicle) === String(vehicleId) &&
            UNPICKED_BOOKING_STATUSES.includes(booking.status) &&
            new Date(booking.startDate).getTime() < window.end &&
            new Date(booking.endDate).getTime() > window.start;

        if (stillInWindow) {
            await Booking.updateOne(
                { _id: booking._id },
                {
                    $set: {
                        "maintenanceConflict.maintenanceMode": window.mode,
                        "maintenanceConflict.maintenanceUntil": window.until,
                    },
                }
            );

            continue;
        }

        const wasAwaitingCustomer =
            booking.maintenanceConflict.status ===
            BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER;

        const cleared = await Booking.findOneAndUpdate(
            {
                _id: booking._id,
                "maintenanceConflict.status":
                    booking.maintenanceConflict.status,
            },
            {
                $set: {
                    "maintenanceConflict.status":
                        BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED,
                    "maintenanceConflict.resolvedAt": new Date(),
                    "maintenanceConflict.resolvedByRole": "system",
                    "maintenanceConflict.resolutionNote":
                        "The vehicle's maintenance no longer overlaps this booking, so it goes ahead as booked.",
                },
            },
            { new: true }
        );

        if (
            cleared &&
            wasAwaitingCustomer &&
            UNPICKED_BOOKING_STATUSES.includes(cleared.status)
        ) {
            try {
                await notifyUser(cleared.customer, {
                    type: "booking",
                    title: "Your Booking Is Back On",
                    message: `Good news: the ${vehicleLabel(
                        vehicle
                    )} is ready in time for your rental on ${formatMaintenanceDate(
                        cleared.startDate
                    )}. Your booking stands as made, and there's nothing you need to do.`,
                    variant: "success",
                    category: "Booking",
                    metadata: {
                        relatedId: cleared._id,
                        relatedModel: "Booking",
                    },
                });
            } catch (notificationError) {
                console.error(
                    `Failed to tell the customer of booking ${cleared._id} its conflict cleared:`,
                    notificationError
                );
            }
        }
    }
};

/*
 * Flags every unpicked booking inside the vehicle's maintenance window that
 * isn't flagged yet, and alerts admins about the new ones. Returns all the
 * bookings in the window (new and already flagged). Best-effort alerting.
 */
export const flagMaintenanceConflicts = async (vehicle, actorId = null) => {
    await reconcileMaintenanceConflicts(vehicle._id);

    const window = getMaintenanceWindow(vehicle);

    if (!window) {
        return [];
    }

    const bookings = await findBookingsInWindow(vehicle._id, window);
    const newlyFlagged = [];

    for (const booking of bookings) {
        const conflict = booking.maintenanceConflict;

        // An open late-return conflict is replaced: maintenance keeps the
        // vehicle out for the whole window, so waiting won't help.
        const alreadyFlagged =
            conflict &&
            BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
                conflict.status
            ) &&
            conflict.cause !== BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN &&
            String(conflict.vehicle) === String(vehicle._id);

        if (alreadyFlagged) {
            continue;
        }

        await Booking.updateOne(
            { _id: booking._id },
            {
                $set: {
                    maintenanceConflict: {
                        status: BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
                        vehicle: vehicle._id,
                        maintenanceMode: window.mode,
                        maintenanceUntil: window.until,
                        detectedAt: new Date(),
                    },
                },
                $push: {
                    statusHistory: {
                        status: booking.status,
                        changedBy: actorId,
                        reason: "Vehicle maintenance conflict",
                        notes: `The vehicle was put under maintenance ${describeWindowEnd(
                            window.until
                        )}, overlapping this booking. The customer will be offered another vehicle or a full refund.`,
                    },
                },
            }
        );

        booking.maintenanceConflict = {
            status: BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
        };

        newlyFlagged.push(booking);
    }

    if (newlyFlagged.length) {
        const list = newlyFlagged
            .slice(0, 8)
            .map(
                (booking) =>
                    `${booking.bookingCode} (${formatMaintenanceDate(
                        booking.startDate
                    )})`
            )
            .join(", ");

        const more =
            newlyFlagged.length > 8
                ? ` and ${newlyFlagged.length - 8} more`
                : "";

        try {
            await notifyAdmins({
                type: "Maintenance Conflict",
                title: "Bookings Hit by Maintenance",
                message: `${vehicleLabel(vehicle)}${
                    vehicle.plateNumber ? ` (${vehicle.plateNumber})` : ""
                } is under maintenance ${describeWindowEnd(
                    window.until
                )}, overlapping ${newlyFlagged.length} booking(s): ${list}${more}. Open each booking and send the customer their options — another vehicle for the same dates, or a full refund.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    relatedId: vehicle._id,
                    relatedModel: "Vehicle",
                },
            });
        } catch (notificationError) {
            console.error(
                `Failed to alert admins about maintenance conflicts on vehicle ${vehicle._id}:`,
                notificationError
            );
        }
    }

    return bookings.map(toConflictSummary);
};

const resolveStartAt = (from) => {
    const start = from ? new Date(from) : new Date();

    return Number.isNaN(start.getTime()) ? new Date() : start;
};

/*
 * What putting this vehicle under maintenance would run into, without
 * saving: the window and the bookings inside it (for the admin dialogs).
 */
export const previewVehicleMaintenance = async (
    vehicleId,
    { mode, days = null, from = null }
) => {
    const vehicle = await Vehicle.findById(vehicleId).select("_id").lean();

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    const startedAt = resolveStartAt(from);
    const until = computeMaintenanceUntil(mode, startedAt, {
        days: days === null || days === undefined ? null : Number(days),
        bufferMs: await getTurnaroundBufferMs(),
    });

    const window = {
        mode,
        start: startedAt.getTime(),
        end: until ? until.getTime() : Infinity,
        until,
    };

    const bookings =
        window.end > Date.now()
            ? await findBookingsInWindow(vehicleId, window)
            : [];

    return {
        mode,
        startedAt,
        until,
        conflicts: bookings.map(toConflictSummary),
    };
};

/*
 * Puts a vehicle under maintenance from `from` (default now). `setStatus`
 * also switches its status to Maintenance right away — for an admin acting
 * on the vehicle itself. A return outcome leaves the status to the rental's
 * completion, but the window applies at once. Flags the bookings it hits.
 */
export const applyVehicleMaintenance = async (
    vehicleId,
    {
        mode,
        days = null,
        reason = "",
        from = null,
        rentalId = null,
        setStatus = true,
    },
    actorId = null
) => {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    if (vehicle.status === VEHICLE_STATUS.ARCHIVED) {
        throw createError(
            "Archived vehicles can't be put under maintenance.",
            400
        );
    }

    if (
        setStatus &&
        !rentalId &&
        (await isOutOnRental("vehicle", vehicle._id))
    ) {
        throw createError(
            "This vehicle is out on a rental right now. Set its maintenance when it comes back, from the rental's return outcome.",
            409
        );
    }

    const startedAt = resolveStartAt(from);
    const count =
        mode === VEHICLE_MAINTENANCE_MODE.EXTENDED ? Number(days) : null;

    const until = computeMaintenanceUntil(mode, startedAt, {
        days: count,
        bufferMs: await getTurnaroundBufferMs(),
    });

    const previousStatus = vehicle.status;

    const maintenance = {
        mode,
        startedAt,
        until,
        days: count,
        reason: String(reason || "").slice(0, 500),
        setBy: actorId,
        setAt: new Date(),
        rental: rentalId,
    };

    const window = getMaintenanceWindow({ ...vehicle.toObject(), maintenance });

    const changes = {};

    if (!window) {
        // Already over (e.g. a turnaround counted from a return long ago).
        changes.maintenance = { ...EMPTY_MAINTENANCE };

        if (vehicle.status === VEHICLE_STATUS.MAINTENANCE) {
            changes.status = await resolveInServiceStatus(vehicle);
        }
    } else {
        changes.maintenance = maintenance;

        if (
            setStatus &&
            ![
                VEHICLE_STATUS.RENTED,
                VEHICLE_STATUS.PICKUP_IN_PROGRESS,
            ].includes(vehicle.status)
        ) {
            changes.status = VEHICLE_STATUS.MAINTENANCE;
        }
    }

    // A targeted update: the rest of the listing isn't re-validated.
    await Vehicle.updateOne({ _id: vehicle._id }, { $set: changes });

    vehicle.set(changes);

    const conflicts = await flagMaintenanceConflicts(vehicle, actorId);

    if (window && mode !== VEHICLE_MAINTENANCE_MODE.TURNAROUND) {
        await notifyOperator(vehicle, {
            title: "Vehicle Under Maintenance",
            message: `Your ${vehicleLabel(vehicle)}${
                vehicle.plateNumber ? ` (${vehicle.plateNumber})` : ""
            } is under maintenance ${describeWindowEnd(
                window.until
            )}. It stays listed, but customers can't book it for those dates.${
                conflicts.length
                    ? ` ${conflicts.length} upcoming booking(s) are affected; their customers will be offered another vehicle or a full refund.`
                    : ""
            }`,
            variant: "warning",
        });
    }

    return {
        vehicle,
        conflicts,
        previousStatus,
    };
};

/*
 * Ends a vehicle's maintenance now: back in service, its status restored,
 * and conflicts that no longer hold are cleared. With `rentalId`, only
 * maintenance set by that rental's return outcome is ended.
 */
export const clearVehicleMaintenance = async (
    vehicleId,
    { rentalId = null, notifyBackInService = false } = {}
) => {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    if (
        rentalId &&
        String(vehicle.maintenance?.rental ?? "") !== String(rentalId)
    ) {
        return vehicle;
    }

    const hadMaintenance =
        Boolean(vehicle.maintenance?.mode) ||
        vehicle.status === VEHICLE_STATUS.MAINTENANCE;

    const changes = { maintenance: { ...EMPTY_MAINTENANCE } };

    if (vehicle.status === VEHICLE_STATUS.MAINTENANCE) {
        changes.status = await resolveInServiceStatus(vehicle);
    }

    await Vehicle.updateOne({ _id: vehicle._id }, { $set: changes });

    vehicle.set(changes);

    await reconcileMaintenanceConflicts(vehicle._id);

    if (hadMaintenance && notifyBackInService) {
        await notifyOperator(vehicle, {
            title: "Vehicle Back in Service",
            message: `Your ${vehicleLabel(vehicle)}${
                vehicle.plateNumber ? ` (${vehicle.plateNumber})` : ""
            } is back in service and can be booked again.`,
            variant: "success",
        });
    }

    return vehicle;
};

/*
 * Sweep: maintenance windows that have run out (turnaround and day-count
 * maintenance) end on their own. Off-road maintenance only ends by hand.
 */
export const endExpiredVehicleMaintenance = async () => {
    const vehicles = await Vehicle.find({
        "maintenance.mode": {
            $in: [
                VEHICLE_MAINTENANCE_MODE.TURNAROUND,
                VEHICLE_MAINTENANCE_MODE.EXTENDED,
            ],
        },
        "maintenance.until": { $lte: new Date() },
    })
        .select("_id brand model plateNumber maintenance")
        .lean();

    for (const vehicle of vehicles) {
        try {
            const extended =
                vehicle.maintenance.mode ===
                VEHICLE_MAINTENANCE_MODE.EXTENDED;

            await clearVehicleMaintenance(vehicle._id, {
                notifyBackInService: extended,
            });

            if (extended) {
                await notifyAdmins({
                    type: "Vehicle Maintenance",
                    title: "Vehicle Back in Service",
                    message: `${vehicleLabel(vehicle)}${
                        vehicle.plateNumber ? ` (${vehicle.plateNumber})` : ""
                    } finished its scheduled maintenance and can be booked again.`,
                    variant: "success",
                    category: "Vehicle",
                    metadata: {
                        relatedId: vehicle._id,
                        relatedModel: "Vehicle",
                    },
                });
            }
        } catch (sweepError) {
            console.error(
                `Failed to end maintenance for vehicle ${vehicle._id}:`,
                sweepError
            );
        }
    }
};
