import createError from "../utils/createError.js";

import Driver from "../models/Driver.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";

import { RENTAL_STATUS } from "../constants/rentalConstants.js";

import { getDriverRatingSummaries } from "./reviewService.js";
import { findDriversWithBookingConflict } from "./bookingConflictService.js";

import { validLicenseFilter } from "../utils/driverLicense.js";

import {
    DRIVER_STATUS,
    DRIVER_AVAILABILITY,
    DRIVER_CODE_PREFIX,
} from "../constants/driverConstants.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

const generateDriverCode = async () => {
    const prefix = DRIVER_CODE_PREFIX;

    const latestDriver = await Driver.findOne({
        driverCode: {
            $regex: `^${prefix}\\d+$`,
        },
    })
        .sort({ driverCode: -1 })
        .select("driverCode")
        .lean();

    let nextNumber = 1;

    if (latestDriver?.driverCode) {
        const currentNumber = Number(
            latestDriver.driverCode.replace(
                prefix,
                ""
            )
        );

        if (!Number.isNaN(currentNumber)) {
            nextNumber = currentNumber + 1;
        }
    }

    return `${prefix}${String(nextNumber).padStart(
        4,
        "0"
    )}`;
};

const checkDriverDuplicates = async ({
    email,
    licenseNumber,
    excludeDriverId = null,
}) => {
    const conditions = [];

    if (email) {
        conditions.push({
            email: email.toLowerCase().trim(),
        });
    }

    if (licenseNumber) {
        conditions.push({
            "license.licenseNumber":
                licenseNumber.trim(),
        });
    }

    if (!conditions.length) {
        return;
    }

    const query = {
        $or: conditions,
    };

    if (excludeDriverId) {
        query._id = {
            $ne: excludeDriverId,
        };
    }

    const existingDriver =
        await Driver.findOne(query)
            .select(
                "_id email license.licenseNumber"
            )
            .lean();

    if (!existingDriver) {
        return;
    }

    if (
        email &&
        existingDriver.email ===
            email.toLowerCase().trim()
    ) {
        throw createError(
            "Driver email already exists.",
            409
        );
    }

    if (
        licenseNumber &&
        existingDriver.license
            ?.licenseNumber ===
            licenseNumber.trim()
    ) {
        throw createError(
            "Driver's license number already exists.",
            409
        );
    }
};

/*
 * Every booking that still holds this driver: anything not finished or ended
 * without a trip — including a paid one awaiting approval and a trip that's
 * running past its due-back time — plus the booking behind any rental they
 * took over by reassignment (Rental.driver changes, the booking may not).
 */
const findActiveDriverBookings = async (
    driverId
) => {
    const [bookings, ongoingRentals] = await Promise.all([
        Booking.find({
            driver: driverId,

            status: {
                $nin: [
                    ...BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
                    BOOKING_STATUS.COMPLETED,
                ],
            },
        })
            .select(
                "bookingCode status startDate endDate vehicle"
            )
            .populate("vehicle", "brand model plateNumber")
            .sort({
                startDate: 1,
            })
            .lean(),

        Rental.find({
            driver: driverId,
            status: RENTAL_STATUS.ONGOING,
        })
            .select("booking")
            .lean(),
    ]);

    const listed = new Set(
        bookings.map((booking) => String(booking._id))
    );

    const missing = ongoingRentals
        .map((rental) => rental.booking)
        .filter(
            (bookingId) =>
                bookingId && !listed.has(String(bookingId))
        );

    if (missing.length === 0) {
        return bookings;
    }

    const takenOver = await Booking.find({
        _id: { $in: missing },
    })
        .select("bookingCode status startDate endDate vehicle")
        .populate("vehicle", "brand model plateNumber")
        .lean();

    return [...bookings, ...takenOver].sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );
};

/* For the admin's "this driver has upcoming bookings" warning. */
export const getUpcomingDriverBookings = async (driverId) => {
    const driver = await Driver.exists({ _id: driverId });

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    return findActiveDriverBookings(driverId);
};

/*
 * Optional trip dates for the driver pickers. Invalid or missing → null,
 * which lists drivers without any "busy" marks.
 */
const parseTripWindow = ({ startDate, endDate } = {}) => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (
        !start ||
        !end ||
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        return null;
    }

    return { start, end };
};

/* Adds `busy: true` to drivers already booked during the trip window. */
const markBusyDrivers = async (drivers, window) => {
    if (!window || drivers.length === 0) {
        return drivers;
    }

    const busy = await findDriversWithBookingConflict(
        drivers.map((driver) => driver._id),
        window.start,
        window.end
    );

    return drivers.map((driver) => ({
        ...driver,
        busy: busy.has(String(driver._id)),
    }));
};

/*
 * Only the driver's own daily rate is stored. Blank/absent → null, which
 * means "use the global driver rate" (see driverPricingService).
 */
const normalizeDriverPricing = (pricing) => {
    const raw = pricing?.dailyRate;

    if (raw === undefined || raw === null || raw === "") {
        return { dailyRate: null };
    }

    const dailyRate = Number(raw);

    if (!Number.isFinite(dailyRate) || dailyRate < 0) {
        throw createError(
            "The driver's daily rate must be a non-negative number.",
            400
        );
    }

    return { dailyRate: Math.round(dailyRate * 100) / 100 };
};

export const createDriver = async (
    data,
    currentUserId
) => {
    const {
        firstName,
        lastName,
        email,
        phoneNumber,
        alternativeContact,
        profileImage,
        address,
        license,
        uploadedDocuments,
        emergencyContact,
        status,
        availability,
        schedule,
        pricing,
    } = data;

    const driverPricing = normalizeDriverPricing(pricing);

    await checkDriverDuplicates({
        email,
        licenseNumber:
            license?.licenseNumber,
    });

    const driverCode =
        await generateDriverCode();

    try {
        const driver =
            await Driver.create({
                driverCode,

                firstName,
                lastName,
                email,
                phoneNumber,
                alternativeContact:
                    alternativeContact ?? "",
                profileImage:
                    profileImage ?? "",

                address,
                license,
                uploadedDocuments,
                emergencyContact,

                status:
                    status ??
                    DRIVER_STATUS.ACTIVE,

                availability:
                    availability ??
                    DRIVER_AVAILABILITY.AVAILABLE,

                schedule,

                pricing: driverPricing,

                audit: {
                    createdBy: currentUserId,
                },
            });

        return driver;
    } catch (error) {
        if (error?.code === 11000) {
            if (
                error.keyPattern?.email
            ) {
                throw createError(
                    "Driver email already exists.",
                    409
                );
            }

            if (
                error.keyPattern?.[
                    "license.licenseNumber"
                ]
            ) {
                throw createError(
                    "Driver's license number already exists.",
                    409
                );
            }

            if (
                error.keyPattern?.driverCode
            ) {
                throw createError(
                    "Driver code already exists.",
                    409
                );
            }
        }

        throw error;
    }
};

/*
 * Drivers that can be picked for a future booking: Available ones, plus
 * those marked Unavailable only because they're on a rental right now — the
 * booking's own time/buffer checks decide whether they're free for it. A
 * driver an admin made Unavailable (no ongoing rental) stays out.
 * Mirrors isDriverBookable in bookingConflictService.
 */
const bookableDriverFilter = async () => {
    const onRental = await Rental.distinct("driver", {
        status: RENTAL_STATUS.ONGOING,
        driver: { $ne: null },
    });

    return {
        $or: [
            { availability: DRIVER_AVAILABILITY.AVAILABLE },
            { _id: { $in: onRental } },
        ],
    };
};

/*
 * Bookable drivers for the customer's driver picker, each with its rating
 * summary and completed-trip count (same numbers as the public profile) so
 * the picker can sort by "Top rated" / "Most trips" without a request per
 * driver.
 */
export const getAvailableDrivers = async (tripDates = {}) => {
    const window = parseTripWindow(tripDates);

    const drivers = await Driver.find({
        status: DRIVER_STATUS.ACTIVE,
        "archive.isArchived": false,
        // A license that runs out before the trip ends can't be booked.
        ...validLicenseFilter(window?.end),
        ...(await bookableDriverFilter()),
    })
        .sort({
            firstName: 1,
            lastName: 1,
        })
        .select("_id firstName lastName driverCode profileImage pricing.dailyRate")
        .lean();

    if (drivers.length === 0) {
        return drivers;
    }

    const driverIds = drivers.map((driver) => driver._id);

    const [ratings, tripCounts] = await Promise.all([
        getDriverRatingSummaries(driverIds),
        Rental.aggregate([
            {
                $match: {
                    driver: { $in: driverIds },
                    status: RENTAL_STATUS.COMPLETED,
                },
            },
            {
                $group: {
                    _id: "$driver",
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    const tripsByDriver = new Map(
        tripCounts.map((row) => [String(row._id), row.count])
    );

    return markBusyDrivers(
        drivers.map((driver) => ({
            ...driver,
            rating: ratings.get(String(driver._id)) ?? {
                averageRating: 0,
                reviewCount: 0,
            },
            completedTrips: tripsByDriver.get(String(driver._id)) ?? 0,
        })),
        window
    );
};

export const getDrivers = async ({
    includeArchived = false,
    status,
    availability,
    startDate,
    endDate,
} = {}) => {
    const window = parseTripWindow({ startDate, endDate });

    const filter = {};

    if (!includeArchived) {
        filter["archive.isArchived"] =
            false;
    }

    if (status) {
        filter.status = status;
    }

    // "BOOKABLE": free for a future booking (see bookableDriverFilter),
    // with a license valid through the trip (or today, without dates).
    if (availability === "BOOKABLE") {
        Object.assign(
            filter,
            await bookableDriverFilter(),
            validLicenseFilter(window?.end)
        );
    } else if (availability) {
        filter.availability = availability;
    }

    const drivers = await Driver.find(filter)
        .sort({
            createdAt: -1,
        })
        .lean();

    return availability === "BOOKABLE"
        ? markBusyDrivers(drivers, window)
        : drivers;
};

export const getDriver = async (
    driverId
) => {
    const driver = await Driver.findById(
        driverId
    ).lean();

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    return driver;
};

/*
 * What a customer sees about a driver: identity, what they're licensed to
 * drive, and their track record. Internal fields (driver code, status,
 * current availability, contact details) stay out of the response.
 */
export const getPublicDriverProfile = async (
    driverId
) => {
    const driver = await Driver.findOne({
        _id: driverId,
        "archive.isArchived": false,
    })
        .select(
            "firstName lastName profileImage license.licenseType license.restrictionCodes createdAt"
        )
        .lean();

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    // A rental's driver is whoever finished the trip (reassignments update it).
    const completedTrips = await Rental.countDocuments({
        driver: driver._id,
        status: RENTAL_STATUS.COMPLETED,
    });

    return {
        ...driver,
        completedTrips,
    };
};

export const updateDriver = async (
    driverId,
    data,
    currentUserId
) => {
    const driver = await Driver.findById(
        driverId
    );

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    if (driver.archive?.isArchived) {
        throw createError(
            "Archived drivers cannot be edited.",
            400
        );
    }

    await checkDriverDuplicates({
        email:
            data.email ??
            driver.email,
        licenseNumber:
            data.license?.licenseNumber ??
            driver.license?.licenseNumber,
        excludeDriverId: driverId,
    });

    const allowedFields = [
        "firstName",
        "lastName",
        "email",
        "phoneNumber",
        "alternativeContact",
        "profileImage",
        "address",
        "license",
        "uploadedDocuments",
        "emergencyContact",
        "schedule",
    ];

    allowedFields.forEach((field) => {
        if (data[field] !== undefined) {
            driver[field] = data[field];
        }
    });

    // Changing a rate never re-prices existing bookings: each booking keeps
    // the driver rate it was priced with.
    if (data.pricing !== undefined) {
        driver.pricing = normalizeDriverPricing(data.pricing);
    }

    driver.audit.updatedBy =
        currentUserId;

    try {
        await driver.save();
    } catch (error) {
        if (error?.code === 11000) {
            if (
                error.keyPattern?.email
            ) {
                throw createError(
                    "Driver email already exists.",
                    409
                );
            }

            if (
                error.keyPattern?.[
                    "license.licenseNumber"
                ]
            ) {
                throw createError(
                    "Driver's license number already exists.",
                    409
                );
            }
        }

        throw error;
    }

    return driver;
};

export const updateDriverStatus = async (
    driverId,
    status,
    currentUserId
) => {
    const driver = await Driver.findById(
        driverId
    );

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    if (driver.archive?.isArchived) {
        throw createError(
            "Archived drivers cannot have their status changed.",
            400
        );
    }

    driver.status = status;

    if (
        status === DRIVER_STATUS.SUSPENDED ||
        status === DRIVER_STATUS.INACTIVE
    ) {
        driver.availability =
            DRIVER_AVAILABILITY.UNAVAILABLE;
    }

    if (
        status === DRIVER_STATUS.ACTIVE &&
        driver.availability ===
            DRIVER_AVAILABILITY.UNAVAILABLE
    ) {
        driver.availability =
            DRIVER_AVAILABILITY.AVAILABLE;
    }

    driver.audit.updatedBy =
        currentUserId;

    await driver.save();

    return driver;
};

export const updateDriverAvailability =
    async (
        driverId,
        availability,
        currentUserId
    ) => {
        const driver =
            await Driver.findById(
                driverId
            );

        if (!driver) {
            throw createError(
                "Driver not found.",
                404
            );
        }

        if (driver.archive?.isArchived) {
            throw createError(
                "Archived drivers cannot have their availability changed.",
                400
            );
        }

        if (
            driver.status !==
            DRIVER_STATUS.ACTIVE
        ) {
            throw createError(
                "Only active drivers can have their availability changed.",
                400
            );
        }

        driver.availability =
            availability;

        driver.audit.updatedBy =
            currentUserId;

        await driver.save();

        return driver;
    };

export const archiveDriver = async (
    driverId,
    reason,
    currentUserId
) => {
    const driver = await Driver.findById(
        driverId
    );

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    if (driver.archive?.isArchived) {
        throw createError(
            "Driver is already archived.",
            400
        );
    }

    const activeBookings =
        await findActiveDriverBookings(
            driverId
        );

    if (activeBookings.length > 0) {
        throw createError(
            `Driver cannot be archived because they have ${activeBookings.length} active or upcoming booking${activeBookings.length > 1 ? "s" : ""}.`,
            400
        );
    }

    driver.archive = {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: currentUserId,
        reason:
            reason?.trim() ?? "",
    };

    driver.availability =
        DRIVER_AVAILABILITY.UNAVAILABLE;

    await driver.save();

    return driver;
};

export const restoreDriver = async (
    driverId,
    currentUserId
) => {
    const driver = await Driver.findById(
        driverId
    );

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    if (!driver.archive?.isArchived) {
        throw createError(
            "Driver is not archived.",
            400
        );
    }

    driver.archive = {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        reason: "",
    };

    driver.status =
        DRIVER_STATUS.ACTIVE;

    driver.availability =
        DRIVER_AVAILABILITY.AVAILABLE;

    driver.audit.updatedBy =
        currentUserId;

    await driver.save();

    return driver;
};