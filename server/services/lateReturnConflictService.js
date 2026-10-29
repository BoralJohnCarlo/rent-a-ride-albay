import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import Settings from "../models/Settings.js";
import Vehicle from "../models/Vehicle.js";

import {
    BOOKING_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
    BOOKING_VEHICLE_CONFLICT_CAUSE,
    LATE_RETURN_HEADS_UP_HOURS,
    LATE_RETURN_MIN_RESPONSE_MINUTES,
} from "../constants/bookingConstants.js";
import { RENTAL_STATUS } from "../constants/rentalConstants.js";

import { getExpectedReturnAt } from "../utils/rentalTiming.js";
import { formatMaintenanceDate } from "../utils/vehicleMaintenance.js";

import { getPickupReference } from "./cancellationPolicyService.js";
import { isOutOnRental } from "./bookingConflictService.js";
import {
    getTurnaroundBufferMs,
    resolveRefundSettings,
} from "./settingsService.js";
import {
    hasRecentNotification,
    notifyAdmins,
    notifyUser,
} from "./notificationService.js";

/*
 * Late returns: rental 1 isn't back by its due-back time, and the same
 * vehicle is booked for someone else soon after. Those bookings get a
 * vehicle conflict (Booking.maintenanceConflict, cause LateReturn) that runs
 * through the same options as maintenance — another vehicle or a full
 * refund — plus waiting for the vehicle. The stages:
 *
 * 1. Heads-up (Detected): rental 1 is overdue and a booking's pickup is
 *    within LATE_RETURN_HEADS_UP_HOURS. Its customer, admins, the vehicle's
 *    partner and the late renter are told.
 * 2. Options (AwaitingCustomer): the vehicle can no longer be back and
 *    turned around by the pickup time (now + buffer passes the pickup), so
 *    the options go out automatically. Deadline: pickup + no-show grace.
 * 3. Cleared: the vehicle came back before the booking was resolved — it
 *    goes ahead as booked (the rental re-times to the actual hand-over).
 *
 * Choosing another vehicle, waiting and the refunds live in bookingService
 * (they need its pricing and cancellation code); this module never imports
 * it, so rentalService can call reconcileLateReturnConflicts on return.
 */

const HOUR_MS = 60 * 60 * 1000;

const UNPICKED_BOOKING_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

const vehicleLabel = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "vehicle";

const withPlate = (vehicle) =>
    `${vehicleLabel(vehicle)}${
        vehicle?.plateNumber ? ` (${vehicle.plateNumber})` : ""
    }`;

const pickupOf = (booking) =>
    getPickupReference(booking.startDate) || new Date(booking.startDate);

const isLateReturnConflict = (conflict) =>
    conflict?.cause === BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN;

const isActive = (conflict) =>
    BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(conflict?.status);

/* "3 hr 20 min" — how late a rental is (or was). */
export const describeLateness = (fromMs, toMs) => {
    const minutes = Math.max(0, Math.round((toMs - fromMs) / 60000));
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const rest = minutes % 60;

    return (
        [
            days ? `${days} day${days === 1 ? "" : "s"}` : null,
            hours ? `${hours} hr` : null,
            rest && !days ? `${rest} min` : null,
        ]
            .filter(Boolean)
            .join(" ") || "less than a minute"
    );
};

const getNoShowGraceHours = async () => {
    const settings = await Settings.findOne().select("refundSettings").lean();

    return resolveRefundSettings(settings?.refundSettings).noShowGraceHours;
};

/*
 * The customer's deadline once options are out: the pickup time plus the
 * no-show grace (when an on-time customer would be a no-show), but never
 * less than LATE_RETURN_MIN_RESPONSE_MINUTES from now.
 */
export const getLateReturnRespondBy = (booking, graceHours, now = Date.now()) =>
    new Date(
        Math.max(
            pickupOf(booking).getTime() + graceHours * HOUR_MS,
            now + LATE_RETURN_MIN_RESPONSE_MINUTES * 60 * 1000
        )
    );

const notifyCustomer = (booking, notification) =>
    notifyUser(booking.customer, {
        type: "Late Return Conflict",
        category: "Booking",
        variant: "warning",
        metadata: {
            relatedId: booking._id,
            relatedModel: "Booking",
        },
        ...notification,
    });

const notifyPartner = async (vehicle, notification) => {
    if (!vehicle?.operator) {
        return;
    }

    await notifyUser(vehicle.operator, {
        type: "Late Return Conflict",
        category: "Booking",
        variant: "warning",
        metadata: {
            relatedId: vehicle._id,
            relatedModel: "Vehicle",
        },
        ...notification,
    });
};

/*
 * Stage 2: sends the customer their options (another vehicle at no extra
 * cost, waiting, or a full refund) with a deadline. Automatic once the
 * vehicle can't be ready in time; an admin can also send them early
 * (`actorId`). Returns the updated booking, or null if it was already
 * moved on by another request.
 */
export const openLateReturnOptions = async (
    booking,
    { actorId = null, graceHours = null } = {}
) => {
    const grace = graceHours ?? (await getNoShowGraceHours());
    const respondBy = getLateReturnRespondBy(booking, grace);

    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            status: { $in: UNPICKED_BOOKING_STATUSES },
            "maintenanceConflict.cause": BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
            "maintenanceConflict.status":
                BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
        },
        {
            $set: {
                "maintenanceConflict.status":
                    BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
                "maintenanceConflict.optionsSentAt": new Date(),
                "maintenanceConflict.optionsSentBy": actorId,
                "maintenanceConflict.respondBy": respondBy,
                ...(actorId ? { "audit.updatedBy": actorId } : {}),
            },
            $push: {
                statusHistory: {
                    status: booking.status,
                    changedBy: actorId,
                    reason: "Late return: options sent",
                    notes: `${
                        actorId ? "An admin" : "The system"
                    } asked the customer to choose another vehicle (no extra cost), wait for this one, or a full refund by ${formatMaintenanceDate(
                        respondBy
                    )}.`,
                },
            },
        },
        { returnDocument: "after" }
    );

    if (!updated) {
        return null;
    }

    const vehicle = await Vehicle.findById(updated.vehicle)
        .select("brand model")
        .lean();

    try {
        await notifyCustomer(updated, {
            title: "Action Needed: Your Vehicle Is Running Late",
            message: `The ${vehicleLabel(
                vehicle
            )} you booked for ${formatMaintenanceDate(
                pickupOf(updated)
            )} won't be back in time — the previous renter still hasn't returned it. Open your booking to choose: switch to another vehicle for the same dates at no extra cost (if it's cheaper, you get the difference back), wait for this one, or cancel for a full refund. Please choose by ${formatMaintenanceDate(
                respondBy
            )}. If you don't and the vehicle still isn't back by then, your booking is cancelled and refunded in full automatically.`,
            email: {
                subject: "Action needed: your rental vehicle is running late",
                actionLabel: "Choose an option",
            },
        });
    } catch (notificationError) {
        console.error(
            `Failed to send late-return options for booking ${updated._id}:`,
            notificationError
        );
    }

    return updated;
};

/*
 * Stage 1 for one booking: flags it (heads-up) unless it's already flagged
 * for this late return, or has a maintenance conflict (which takes
 * precedence). Returns true when newly flagged.
 */
const flagBooking = async (booking, rental, vehicle, dueBackAt) => {
    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            status: { $in: UNPICKED_BOOKING_STATUSES },
            $or: [
                { maintenanceConflict: null },
                {
                    "maintenanceConflict.status": {
                        $nin: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
                    },
                },
            ],
        },
        {
            $set: {
                maintenanceConflict: {
                    status: BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
                    cause: BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
                    vehicle: rental.vehicle,
                    blockingRental: rental._id,
                    dueBackAt,
                    detectedAt: new Date(),
                },
            },
            $push: {
                statusHistory: {
                    status: booking.status,
                    changedBy: null,
                    reason: "Late return: vehicle at risk",
                    notes: `The vehicle's previous rental (${rental.rentalCode}) was due back ${formatMaintenanceDate(
                        dueBackAt
                    )} and hasn't been returned. The customer was warned; options go out automatically if it can't be ready in time.`,
                },
            },
        },
        { returnDocument: "after" }
    );

    if (!updated) {
        return false;
    }

    try {
        await notifyCustomer(updated, {
            title: "Heads-up: Your Vehicle Is Running Late",
            message: `The ${vehicleLabel(
                vehicle
            )} you booked for ${formatMaintenanceDate(
                pickupOf(updated)
            )} is still out with its previous renter, who was due to return it ${formatMaintenanceDate(
                dueBackAt
            )}. We're working to get it back and ready for you. If it can't be ready in time, we'll send you your options right away: another vehicle at no extra cost, waiting for this one, or a full refund. You don't need to do anything yet — and if you'd rather not wait to find out, you can cancel now for a full refund.`,
            email: {
                subject: "Heads-up: your rental vehicle may be late",
                actionLabel: "View my booking",
            },
        });
    } catch (notificationError) {
        console.error(
            `Failed to send a late-return heads-up for booking ${updated._id}:`,
            notificationError
        );
    }

    return true;
};

/*
 * Sweep (every 10 minutes): finds overdue rentals, flags the bookings they
 * put at risk (heads-up), sends options once a booking's vehicle can't be
 * ready in time, and alerts admins, the partner and the late renter.
 */
export const detectLateReturnConflicts = async () => {
    const now = Date.now();

    const rentals = await Rental.find({
        status: RENTAL_STATUS.ONGOING,
        "return.date": null,
    })
        .select(
            "rentalCode booking customer vehicle bookingPeriod actualEndDate extensions"
        )
        .lean();

    const overdue = rentals
        .map((rental) => ({ rental, dueBackAt: getExpectedReturnAt(rental) }))
        .filter(({ dueBackAt }) => dueBackAt && dueBackAt.getTime() < now);

    if (!overdue.length) {
        return;
    }

    const [bufferMs, graceHours] = await Promise.all([
        getTurnaroundBufferMs(),
        getNoShowGraceHours(),
    ]);

    for (const { rental, dueBackAt } of overdue) {
        try {
            const bookings = await Booking.find({
                vehicle: rental.vehicle,
                _id: { $ne: rental.booking },
                status: { $in: UNPICKED_BOOKING_STATUSES },
                startDate: {
                    $lte: new Date(now + LATE_RETURN_HEADS_UP_HOURS * HOUR_MS),
                },
                endDate: { $gt: new Date(now) },
            })
                .select("bookingCode customer vehicle status startDate endDate maintenanceConflict")
                .sort({ startDate: 1 });

            if (!bookings.length) {
                continue;
            }

            const vehicle = await Vehicle.findById(rental.vehicle)
                .select("brand model plateNumber operator")
                .lean();

            const newlyFlagged = [];
            const optionsSent = [];

            for (const booking of bookings) {
                const conflict = booking.maintenanceConflict;

                // Maintenance already owns this booking's conflict.
                if (isActive(conflict) && !isLateReturnConflict(conflict)) {
                    continue;
                }

                let status = isActive(conflict) ? conflict.status : null;

                if (!status) {
                    if (!(await flagBooking(booking, rental, vehicle, dueBackAt))) {
                        continue;
                    }

                    newlyFlagged.push(booking);
                    status = BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED;
                }

                // Can it still be back and turned around by pickup?
                if (
                    status === BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED &&
                    now + bufferMs > pickupOf(booking).getTime()
                ) {
                    const sent = await openLateReturnOptions(booking, {
                        graceHours,
                    });

                    if (sent) {
                        optionsSent.push(sent);
                    }
                }
            }

            const overdueFor = describeLateness(dueBackAt.getTime(), now);
            const list = (items) =>
                items
                    .slice(0, 6)
                    .map(
                        (booking) =>
                            `${booking.bookingCode} (pickup ${formatMaintenanceDate(
                                pickupOf(booking)
                            )})`
                    )
                    .join(", ") +
                (items.length > 6 ? ` and ${items.length - 6} more` : "");

            if (newlyFlagged.length) {
                await notifyAdmins({
                    type: "Late Return Conflict",
                    title: "Late Return Puts Bookings at Risk",
                    message: `Rental ${rental.rentalCode} on the ${withPlate(
                        vehicle
                    )} was due back ${formatMaintenanceDate(
                        dueBackAt
                    )} (${overdueFor} ago) and hasn't been returned. ${
                        newlyFlagged.length
                    } upcoming booking(s) on it are at risk: ${list(
                        newlyFlagged
                    )}. Their customers were warned. If the vehicle can't be back and turned around in time, they're sent their options automatically (another vehicle at no extra cost, waiting, or a full refund). Contact the renter now, or open a booking to move or refund it yourself.`,
                    variant: "warning",
                    category: "Booking",
                    metadata: {
                        reference: rental.rentalCode,
                        relatedId: rental.booking,
                        relatedModel: "Booking",
                    },
                });

                await notifyPartner(vehicle, {
                    title: "Your Vehicle Is Overdue",
                    message: `Your ${withPlate(
                        vehicle
                    )} was due back from rental ${rental.rentalCode} ${formatMaintenanceDate(
                        dueBackAt
                    )} and hasn't been returned. ${
                        newlyFlagged.length
                    } upcoming booking(s) on it may be affected; we'll offer those customers another vehicle, waiting, or a full refund if needed.`,
                });
            }

            if (optionsSent.length) {
                await notifyAdmins({
                    type: "Late Return Conflict",
                    title: "Late Return: Customers Sent Their Options",
                    message: `The ${withPlate(
                        vehicle
                    )} (rental ${rental.rentalCode}) still isn't back and can't be ready in time for ${list(
                        optionsSent
                    )}. Those customers were sent their options automatically. Bookings with no choice by the deadline are refunded in full if the vehicle still isn't back.`,
                    variant: "warning",
                    category: "Booking",
                    metadata: {
                        reference: rental.rentalCode,
                        relatedId: rental.booking,
                        relatedModel: "Booking",
                    },
                });
            }

            // Nudge the late renter (at most every 12 hours): someone's waiting.
            if (
                !(await hasRecentNotification({
                    recipient: rental.customer,
                    type: "Late Return Impact",
                    relatedId: rental.booking,
                    since: new Date(now - 12 * HOUR_MS),
                }))
            ) {
                await notifyUser(rental.customer, {
                    type: "Late Return Impact",
                    title: "Please Return Your Vehicle Now",
                    message: `Your rental of the ${vehicleLabel(
                        vehicle
                    )} was due back ${formatMaintenanceDate(
                        dueBackAt
                    )}, and another customer's booking of the same vehicle starts ${formatMaintenanceDate(
                        pickupOf(bookings[0])
                    )}. Please return it as soon as possible — late penalties keep adding up, and costs caused by the delay may be charged to your rental.`,
                    variant: "error",
                    category: "Rental",
                    metadata: {
                        relatedId: rental.booking,
                        relatedModel: "Booking",
                    },
                    email: {
                        subject: "Please return your rental vehicle now",
                        actionPath: `/customer/bookings/${rental.booking}`,
                        actionLabel: "View my rental",
                    },
                });
            }
        } catch (sweepError) {
            console.error(
                `Late-return check failed for rental ${rental?._id}:`,
                sweepError
            );
        }
    }
};

/*
 * Stage 3: once the vehicle is back (or a flagged booking ended), its open
 * late-return conflicts are cleared — the booking goes ahead as booked, and
 * its customer is told when the vehicle is ready. Called on return and by
 * the deadline sweep before it refunds anyone.
 */
export const reconcileLateReturnConflicts = async (vehicleId) => {
    const active = await Booking.find({
        "maintenanceConflict.vehicle": vehicleId,
        "maintenanceConflict.cause": BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
        "maintenanceConflict.status": {
            $in: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
        },
    });

    if (!active.length) {
        return;
    }

    const stillOut = await isOutOnRental("vehicle", vehicleId);
    const bufferMs = await getTurnaroundBufferMs();

    const vehicle = await Vehicle.findById(vehicleId)
        .select("brand model plateNumber")
        .lean();

    for (const booking of active) {
        const conflict = booking.maintenanceConflict;
        const ended =
            String(booking.vehicle) !== String(vehicleId) ||
            !UNPICKED_BOOKING_STATUSES.includes(booking.status);

        // Rescheduled well past the heads-up window: if the vehicle is
        // still out by then, the sweep flags it afresh.
        const movedClear =
            !ended &&
            pickupOf(booking).getTime() >
                Date.now() + LATE_RETURN_HEADS_UP_HOURS * HOUR_MS;

        if (movedClear) {
            await Booking.updateOne(
                {
                    _id: booking._id,
                    "maintenanceConflict.status": conflict.status,
                },
                {
                    $set: {
                        "maintenanceConflict.status":
                            BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED,
                        "maintenanceConflict.resolvedAt": new Date(),
                        "maintenanceConflict.resolvedByRole": "system",
                        "maintenanceConflict.resolutionNote":
                            "The booking moved to later dates, clear of the late return.",
                    },
                }
            );

            continue;
        }

        if (stillOut && !ended) {
            continue;
        }

        const blocking = conflict.blockingRental
            ? await Rental.findById(conflict.blockingRental)
                  .select("return")
                  .lean()
            : null;

        const returnedAt = blocking?.return?.date
            ? new Date(blocking.return.date)
            : new Date();
        const readyAt = new Date(returnedAt.getTime() + bufferMs);

        const cleared = await Booking.findOneAndUpdate(
            {
                _id: booking._id,
                "maintenanceConflict.status": conflict.status,
            },
            {
                $set: {
                    "maintenanceConflict.status":
                        BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED,
                    "maintenanceConflict.resolvedAt": new Date(),
                    "maintenanceConflict.resolvedByRole": "system",
                    "maintenanceConflict.vehicleReturnedAt": returnedAt,
                    "maintenanceConflict.resolutionNote": ended
                        ? "The booking ended before the vehicle was returned."
                        : `The vehicle was returned ${formatMaintenanceDate(
                              returnedAt
                          )}, so the booking goes ahead as booked (ready from ${formatMaintenanceDate(
                              readyAt
                          )}).`,
                },
            },
            { returnDocument: "after" }
        );

        if (!cleared || ended) {
            continue;
        }

        const pickupAt = pickupOf(cleared);
        const readyLate = readyAt.getTime() > pickupAt.getTime();

        try {
            await notifyCustomer(cleared, {
                title: "Good News: Your Vehicle Is Back",
                message: readyLate
                    ? `The ${vehicleLabel(
                          vehicle
                      )} has been returned and will be cleaned, checked and ready for you from ${formatMaintenanceDate(
                          readyAt
                      )}. Your booking goes ahead — your rental starts when you pick it up, and you still get the full booked duration from that moment. If that no longer works for you, contact us and we'll help.`
                    : `The ${vehicleLabel(
                          vehicle
                      )} has been returned and will be ready in time for your pickup on ${formatMaintenanceDate(
                          pickupAt
                      )}. Your booking goes ahead as booked — there's nothing you need to do.`,
                variant: "success",
                email: true,
            });

            await notifyAdmins({
                type: "Late Return Conflict",
                title: "Late Return Resolved",
                message: `The ${withPlate(
                    vehicle
                )} was returned ${formatMaintenanceDate(
                    returnedAt
                )}. Booking ${cleared.bookingCode} (pickup ${formatMaintenanceDate(
                    pickupAt
                )}) goes ahead as booked${
                    readyLate
                        ? ` — the vehicle is ready from ${formatMaintenanceDate(
                              readyAt
                          )}, after the booked pickup`
                        : ""
                }.`,
                variant: "success",
                category: "Booking",
                metadata: {
                    reference: cleared.bookingCode,
                    relatedId: cleared._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                `Failed to announce a cleared late-return conflict on booking ${cleared._id}:`,
                notificationError
            );
        }
    }
};

/*
 * Admin: what this booking's (late) rental did to the bookings after it —
 * who was affected, how each was resolved, and what it cost (refunds and
 * free upgrades), so the admin can decide on a penalty charge.
 */
export const getLateReturnImpact = async (bookingId) => {
    const rental = await Rental.findOne({ booking: bookingId })
        .select(
            "rentalCode return bookingPeriod actualEndDate extensions lateReturn vehicle status"
        )
        .lean();

    if (!rental) {
        return null;
    }

    const affected = await Booking.find({
        "maintenanceConflict.blockingRental": rental._id,
    })
        .select("bookingCode customer startDate status maintenanceConflict vehicle")
        .populate("customer", "firstName lastName")
        .populate("vehicle", "brand model plateNumber")
        .sort({ startDate: 1 })
        .lean();

    const dueBackAt = getExpectedReturnAt(rental);
    const returnedAt = rental.return?.date ? new Date(rental.return.date) : null;
    const lateUntil = returnedAt ?? new Date();
    const lateMinutes =
        dueBackAt && lateUntil > dueBackAt
            ? Math.round((lateUntil - dueBackAt) / 60000)
            : 0;

    const rows = affected.map((booking) => {
        const conflict = booking.maintenanceConflict || {};

        return {
            _id: booking._id,
            bookingCode: booking.bookingCode,
            customerName:
                [booking.customer?.firstName, booking.customer?.lastName]
                    .filter(Boolean)
                    .join(" ") || "Customer",
            pickupAt: pickupOf(booking),
            bookingStatus: booking.status,
            conflictStatus: conflict.status,
            // Only conflicts this rental still owns (a later one may have
            // replaced it); the rest are shown for history.
            current: String(conflict.blockingRental) === String(rental._id),
            refundAmount:
                conflict.status === BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED
                    ? Number(conflict.refundAmount || 0)
                    : 0,
            coveredAmount: Number(
                conflict.vehicleChange?.pricing?.coveredAmount || 0
            ),
            newVehicle:
                conflict.status ===
                BOOKING_MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED
                    ? vehicleLabel(booking.vehicle)
                    : null,
        };
    });

    return {
        rentalCode: rental.rentalCode,
        dueBackAt,
        returnedAt,
        stillOut: !returnedAt,
        lateMinutes,
        lateBy: lateMinutes > 0 && dueBackAt
            ? describeLateness(dueBackAt.getTime(), lateUntil.getTime())
            : null,
        lateFeeCharged: Number(rental.lateReturn?.amount ?? 0),
        bookings: rows,
        totals: {
            affected: rows.length,
            refunded: rows.reduce((sum, row) => sum + row.refundAmount, 0),
            covered: rows.reduce((sum, row) => sum + row.coveredAmount, 0),
            open: rows.filter((row) => isActive({ status: row.conflictStatus }))
                .length,
        },
    };
};
