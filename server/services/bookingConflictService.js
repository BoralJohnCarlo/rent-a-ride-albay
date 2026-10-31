import createError from "../utils/createError.js";

import Booking from "../models/Booking.js";
import Driver from "../models/Driver.js";
import Rental from "../models/Rental.js";

import {
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

import { RENTAL_STATUS } from "../constants/rentalConstants.js";
import { DRIVER_AVAILABILITY } from "../constants/driverConstants.js";

import { getTurnaroundBufferMs } from "./settingsService.js";

/*
 * Single source of truth for "does this vehicle/driver already have an
 * overlapping booking" - shared by bookingService.js (enforced at booking
 * creation/update/approval/reschedule/extension) and vehicleService.js (the
 * pre-booking availability check and calendar), so they can't drift.
 *
 * Availability is decided by time alone, never by the vehicle's current
 * status: a vehicle out on a rental today can be booked for next week.
 * Two rules make that safe:
 *
 * 1. Turnaround buffer (Settings → Bookings): every booking occupies its own
 *    time plus the buffer on either side, so a rental due back at 2:00 PM
 *    keeps the vehicle (and its driver) unavailable until 4:00 PM with a
 *    2-hour buffer, and the same before a pickup.
 * 2. Still out: a vehicle or driver on a rental that hasn't been returned
 *    stays occupied until it is — even past its due-back time — so nothing
 *    can be booked to start before now + the buffer while it's overdue.
 *
 * Ongoing bookings carry their actual pickup/due-back times (createRental),
 * so rule 1 already covers a rental that's on time.
 */

const toDate = (value) => new Date(value);

/* The window another booking must not touch: [start - buffer, end + buffer). */
const bufferedWindow = (startDate, endDate, bufferMs) => ({
    windowStart: new Date(toDate(startDate).getTime() - bufferMs),
    windowEnd: new Date(toDate(endDate).getTime() + bufferMs),
});

const resolveBufferMs = async (bufferMs) =>
    Number.isFinite(bufferMs) ? bufferMs : getTurnaroundBufferMs();

/*
 * The booking behind an unreturned rental of this vehicle/driver that would
 * still hold it at the requested start (rule 2), or null. Only relevant when
 * the requested window begins before now: a future window is already
 * protected by the rental's own (buffered) due-back time.
 */
const findStillOutConflict = async (
    field,
    id,
    windowStart,
    excludeBookingId,
    session = null
) => {
    if (windowStart.getTime() >= Date.now()) {
        return null;
    }

    const rental = await Rental.findOne({
        [field]: id,
        status: RENTAL_STATUS.ONGOING,
        "return.date": null,
        ...(excludeBookingId
            ? { booking: { $ne: excludeBookingId } }
            : {}),
    })
        .select("booking")
        .session(session)
        .lean();

    if (!rental) {
        return null;
    }

    const booking = await Booking.findById(rental.booking)
        .select("bookingCode startDate endDate status")
        .session(session)
        .lean();

    return booking ? { ...booking, stillOut: true } : null;
};

/*
 * Whether a driver or vehicle is physically out on a rental right now (picked
 * up, not yet returned). A rental that's been returned but not completed yet
 * doesn't count: the vehicle and driver are back.
 */
export const isOutOnRental = (field, id, { excludeBookingId = null, session = null } = {}) =>
    Rental.exists({
        [field]: id,
        status: RENTAL_STATUS.ONGOING,
        "return.date": null,
        ...(excludeBookingId
            ? { booking: { $ne: excludeBookingId } }
            : {}),
    }).session(session);

/*
 * A driver's `availability` flag is set Unavailable while they drive a rental
 * and by an admin (e.g. on leave). Only the second should stop future
 * bookings — time conflicts already cover the first — so an Unavailable
 * driver still counts as bookable while they have an ongoing rental.
 */
export const isDriverBookable = async (driver) =>
    driver.availability === DRIVER_AVAILABILITY.AVAILABLE ||
    Boolean(
        await Rental.exists({
            driver: driver._id,
            status: RENTAL_STATUS.ONGOING,
        })
    );

/*
 * Frees a driver whose booking or rental just ended — unless they're out on
 * another rental that hasn't been returned, which keeps them Unavailable.
 */
export const releaseDriverIfIdle = async (driverId, session = null) => {
    if (!driverId) {
        return;
    }

    if (await isOutOnRental("driver", driverId, { session })) {
        return;
    }

    await Driver.updateOne(
        { _id: driverId },
        { $set: { availability: DRIVER_AVAILABILITY.AVAILABLE } },
        session ? { session } : undefined
    );
};

export const hasBookingConflict = async (
    vehicleId,
    startDate,
    endDate,
    excludeBookingId = null,
    { bufferMs, session = null } = {}
) => {
    const buffer = await resolveBufferMs(bufferMs);
    const { windowStart, windowEnd } = bufferedWindow(
        startDate,
        endDate,
        buffer
    );

    const query = {
        vehicle: vehicleId,

        status: {
            $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
        },

        startDate: {
            $lt: windowEnd,
        },

        endDate: {
            $gt: windowStart,
        },
    };

    if (excludeBookingId) {
        query._id = {
            $ne: excludeBookingId,
        };
    }

    const overlapping = await Booking.findOne(query)
        .select(
            "bookingCode startDate endDate status"
        )
        .session(session)
        .lean();

    return (
        overlapping ??
        findStillOutConflict(
            "vehicle",
            vehicleId,
            windowStart,
            excludeBookingId,
            session
        )
    );
};

/* Customer-facing wording (no booking codes), shared by both ensure* checks. */
const conflictMessage = (subject, conflict, bufferMs) =>
    conflict.stillOut
        ? `${subject} is still out on a rental that hasn't been returned yet, so it can't be booked to start this soon. Please choose a later pickup time.`
        : `${subject} is already booked for part of that time. Rentals need at least ${
              bufferMs / (60 * 60 * 1000)
          } hours between them for cleaning and inspection. Please choose different dates or times.`;

export const ensureNoBookingConflict = async (
    vehicleId,
    startDate,
    endDate,
    excludeBookingId = null,
    { session = null } = {}
) => {
    const bufferMs = await getTurnaroundBufferMs();

    const conflictingBooking =
        await hasBookingConflict(
            vehicleId,
            startDate,
            endDate,
            excludeBookingId,
            { bufferMs, session }
        );

    if (conflictingBooking) {
        throw createError(
            conflictMessage("This vehicle", conflictingBooking, bufferMs),
            409
        );
    }
};

/*
 * Bulk variant of hasBookingConflict / hasDriverBookingConflict for checking
 * many vehicles or drivers against one date range in a single query — used
 * by the public browse/search page and the driver pickers, without issuing
 * one request per card. Returns the ids (as strings) that are taken.
 */
const findWithBookingConflict = async (
    field,
    ids,
    startDate,
    endDate
) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        return new Set();
    }

    const bufferMs = await getTurnaroundBufferMs();
    const { windowStart, windowEnd } = bufferedWindow(
        startDate,
        endDate,
        bufferMs
    );

    const [conflicts, stillOut] = await Promise.all([
        Booking.find({
            [field]: {
                $in: ids,
            },

            status: {
                $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
            },

            startDate: {
                $lt: windowEnd,
            },

            endDate: {
                $gt: windowStart,
            },
        })
            .select(field)
            .lean(),

        windowStart.getTime() < Date.now()
            ? Rental.find({
                  [field]: { $in: ids },
                  status: RENTAL_STATUS.ONGOING,
                  "return.date": null,
              })
                  .select(field)
                  .lean()
            : [],
    ]);

    return new Set(
        [...conflicts, ...stillOut]
            .filter((item) => item[field])
            .map((item) => item[field].toString())
    );
};

export const findVehiclesWithBookingConflict = (
    vehicleIds,
    startDate,
    endDate
) =>
    findWithBookingConflict("vehicle", vehicleIds, startDate, endDate);

export const findDriversWithBookingConflict = (
    driverIds,
    startDate,
    endDate
) =>
    findWithBookingConflict("driver", driverIds, startDate, endDate);

export const hasDriverBookingConflict = async (
    driverId,
    startDate,
    endDate,
    excludeBookingId = null,
    { bufferMs, session = null } = {}
) => {
    if (!driverId) {
        return null;
    }

    const buffer = await resolveBufferMs(bufferMs);
    const { windowStart, windowEnd } = bufferedWindow(
        startDate,
        endDate,
        buffer
    );

    /*
     * Same statuses as the vehicle check: every booking that can still happen
     * holds its driver — including a paid one awaiting approval ("Payment
     * Received"), which an explicit Pending/Approved/Ongoing list missed.
     */
    const query = {
        driver: driverId,

        status: {
            $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
        },

        startDate: {
            $lt: windowEnd,
        },

        endDate: {
            $gt: windowStart,
        },
    };

    if (excludeBookingId) {
        query._id = {
            $ne: excludeBookingId,
        };
    }

    const overlapping = await Booking.findOne(query)
        .select(
            "bookingCode startDate endDate status"
        )
        .session(session)
        .lean();

    return (
        overlapping ??
        findStillOutConflict(
            "driver",
            driverId,
            windowStart,
            excludeBookingId,
            session
        )
    );
};

export const ensureNoDriverBookingConflict = async (
    driverId,
    startDate,
    endDate,
    excludeBookingId = null,
    { session = null } = {}
) => {
    if (!driverId) {
        return;
    }

    const bufferMs = await getTurnaroundBufferMs();

    const conflictingBooking =
        await hasDriverBookingConflict(
            driverId,
            startDate,
            endDate,
            excludeBookingId,
            { bufferMs, session }
        );

    if (conflictingBooking) {
        throw createError(
            conflictMessage("The driver", conflictingBooking, bufferMs),
            409
        );
    }
};
