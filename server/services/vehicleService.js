import mongoose from "mongoose";

import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";

import createError from "../utils/createError.js";

import {
    notifyAdmins,
    notifyUser,
    hasRecentNotification,
} from "./notificationService.js";

import {
    VEHICLE_STATUS,
    VEHICLE_OWNERSHIP,
    VEHICLE_CODE_PREFIX,
    MAX_VEHICLE_IMAGES,
    MIN_VEHICLE_IMAGES,
    VEHICLE_MAINTENANCE_MODE,
} from "../constants/vehicleConstants.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

import {
    RENTAL_STATUS,
} from "../constants/rentalConstants.js";

import {
    hasBookingConflict,
    hasDriverBookingConflict,
    findVehiclesWithBookingConflict,
} from "./bookingConflictService.js";

import { releaseTrackersForVehicle } from "./trackerService.js";

import {
    getBookingSettings,
    getOffRoadVehicleSettings,
    getTurnaroundBufferMs,
} from "./settingsService.js";

import {
    getEarliestPickupMs,
    getPickupSlotMinutes,
} from "../utils/bookingHours.js";

import { BUSINESS_TIMEZONE } from "../utils/businessTime.js";

import {
    getMaintenanceWindow,
    overlapsMaintenance,
    describeMaintenanceBlock,
    toPublicMaintenance,
} from "../utils/vehicleMaintenance.js";

import {
    applyVehicleMaintenance,
    clearVehicleMaintenance,
} from "./vehicleMaintenanceService.js";

/* "Oct 1, 2026, 2:00 PM" in Philippine time. */
const formatManilaDateTime = (value) =>
    new Date(value).toLocaleString("en-PH", {
        timeZone: BUSINESS_TIMEZONE,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/*
 * An archived vehicle must never keep a GPS tracker (or its active GPS
 * alerts). Best-effort: a tracker cleanup failure must not undo an archive
 * that already succeeded - ingestion and the offline sweep both refuse
 * archived vehicles regardless.
 */
const releaseTrackersOnArchive = async (vehicleId, archivedBy = null) => {
    try {
        await releaseTrackersForVehicle(vehicleId, archivedBy);
    } catch (error) {
        console.error(
            "Failed to release GPS tracker from archived vehicle:",
            error
        );
    }
};

const ensureVehicleCodeAvailable = async (
    vehicleCode,
    excludeVehicleId = null
) => {
    const query = {
        vehicleCode,
    };

    if (excludeVehicleId) {
        query._id = {
            $ne: excludeVehicleId,
        };
    }

    const existingVehicle = await Vehicle.findOne(query);

    if (existingVehicle) {
        throw new Error("Vehicle code already exists.");
    }
};

/*
 * `excludeVehicleId`, when a valid ObjectId, is left out of the match
 * entirely otherwise — editing a vehicle without touching its own plate/
 * registration number must not flag it as a duplicate of itself, which is
 * exactly what happened before this existed (every edit failed this check
 * on step one, since the vehicle's own plate always "already exists").
 */
const checkPlateNumberExists = async (
    plateNumber,
    excludeVehicleId = null
) => {
    if (!plateNumber || typeof plateNumber !== "string") {
        return { exists: false };
    }

    const normalizedPlate = plateNumber.trim().toUpperCase();

    if (!normalizedPlate) {
        return { exists: false };
    }

    const query = {
        plateNumber: {
            $regex: `^${normalizedPlate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
        },
    };

    if (
        excludeVehicleId &&
        mongoose.Types.ObjectId.isValid(excludeVehicleId)
    ) {
        query._id = { $ne: excludeVehicleId };
    }

    const existingVehicle = await Vehicle.findOne(query);

    return { exists: !!existingVehicle };
};

const checkRegistrationNumberExists = async (
    registrationNumber,
    excludeVehicleId = null
) => {
    if (!registrationNumber || typeof registrationNumber !== "string") {
        return { exists: false };
    }

    const normalizedReg = registrationNumber.trim().toUpperCase();

    if (!normalizedReg) {
        return { exists: false };
    }

    const query = {
        registrationNumber: {
            $regex: `^${normalizedReg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
        },
    };

    if (
        excludeVehicleId &&
        mongoose.Types.ObjectId.isValid(excludeVehicleId)
    ) {
        query._id = { $ne: excludeVehicleId };
    }

    const existingVehicle = await Vehicle.findOne(query);

    return { exists: !!existingVehicle };
};

const generateVehicleCode = async () => {
    const latestVehicle =
        await Vehicle.findOne({
            vehicleCode: {
                $regex: `^${VEHICLE_CODE_PREFIX}\\d+$`,
            },
        })
            .sort({
                vehicleCode: -1,
        })
            .select("vehicleCode");

    if (!latestVehicle) {
        return `${VEHICLE_CODE_PREFIX}0001`;
    }

    const currentNumber = Number(
        latestVehicle.vehicleCode.replace(
            VEHICLE_CODE_PREFIX,
            ""
        )
    );

    if (Number.isNaN(currentNumber)) {
        return `${VEHICLE_CODE_PREFIX}0001`;
    }

    const nextNumber = currentNumber + 1;

    return `${VEHICLE_CODE_PREFIX}${String(
        nextNumber
    ).padStart(4, "0")}`;
};

const validateVehiclePricing = (pricing) => {
    if (!pricing) {
        return;
    }

    const {
        dailyRate,
        reservationFee,
    } = pricing;

    const parsedDailyRate =
        Number(dailyRate);

    const parsedReservationFee =
        Number(reservationFee);

    if (
        dailyRate === null ||
        dailyRate === undefined ||
        reservationFee === null ||
        reservationFee === undefined ||
        !Number.isFinite(parsedDailyRate) ||
        !Number.isFinite(parsedReservationFee)
    ) {
        throw new Error(
            "Daily rate and reservation fee must be valid numbers."
        );
    }

    if (
        parsedDailyRate < 0 ||
        parsedReservationFee < 0
    ) {
        throw new Error(
            "Daily rate and reservation fee must be non-negative numbers."
        );
    }

    if (
        parsedReservationFee >
        parsedDailyRate
    ) {
        throw new Error(
            "Reservation fee cannot be greater than the daily rate."
        );
    }
};

const validateSecurityDeposit = (
    securityDeposit
) => {
    if (!securityDeposit) {
        return;
    }

    const {
        enabled,
        amount,
    } = securityDeposit;

    if (
        enabled !== undefined &&
        typeof enabled !== "boolean"
    ) {
        throw new Error(
            "Security deposit enabled must be true or false."
        );
    }

    if (
        amount !== undefined &&
        (
            !Number.isFinite(
                Number(amount)
            ) ||
            Number(amount) < 0
        )
    ) {
        throw new Error(
            "Security deposit amount must be a valid non-negative number."
        );
    }

    if (
        enabled === true &&
        (
            amount === undefined ||
            Number(amount) <= 0
        )
    ) {
        throw new Error(
            "Security deposit amount must be greater than 0 when security deposit is enabled."
        );
    }

    if (
        enabled === false &&
        amount !== undefined &&
        Number(amount) !== 0
    ) {
        throw new Error(
            "Security deposit amount must be 0 when security deposit is disabled."
        );
    }
};
const validateVehicleImages = (
    images = []
) => {
    if (!Array.isArray(images)) {
        throw new Error("Images must be an array.");
    }

    if (images.length < MIN_VEHICLE_IMAGES) {
        throw new Error(
            `A vehicle must have at least ${MIN_VEHICLE_IMAGES} image.`
        );
    }

    if (images.length > MAX_VEHICLE_IMAGES) {
        throw new Error(
            `A vehicle can only have up to ${MAX_VEHICLE_IMAGES} images.`
        );
    }

    const primaryImages = images.filter(
        (image) => image.isPrimary
    );

    if (primaryImages.length !== 1) {
        throw new Error(
            "A vehicle must have exactly one primary image."
        );
    }

    const publicIds = new Set();

    for (const image of images) {
        if (!image.url || !image.publicId) {
            throw new Error(
                "Each image must include a URL and public ID."
            );
        }

        if (publicIds.has(image.publicId)) {
            throw new Error(
                "Duplicate image public IDs are not allowed."
            );
        }

        publicIds.add(image.publicId);
    }
};

const validateBlockedDateRange = (
    startDate,
    endDate
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        throw new Error(
            "Blocked dates must be valid dates."
        );
    }

    if (start >= end) {
        throw new Error(
            "Blocked date start must be before the end date."
        );
    }

    return {
        start,
        end,
    };
};

const hasBlockedDateConflict = (
    blockedDates = [],
    startDate,
    endDate,
    excludeBlockedDateId = null
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return blockedDates.some((blockedDate) => {
        if (
            excludeBlockedDateId &&
            blockedDate._id?.toString() ===
                excludeBlockedDateId.toString()
        ) {
            return false;
        }

        const blockedStart = new Date(
            blockedDate.startDate
        );

        const blockedEnd = new Date(
            blockedDate.endDate
        );

        return (
            start < blockedEnd &&
            end > blockedStart
        );
    });
};

const ensureNoActiveVehicleCommitments = async (
    vehicleId
) => {
    const [booking, rental] = await Promise.all([
        Booking.findOne({
            vehicle: vehicleId,
            status: {
                $in: [
                    BOOKING_STATUS.APPROVED,
                    BOOKING_STATUS.ONGOING,
                ],
            },
        })
            .select("bookingCode")
            .lean(),
        Rental.findOne({
            vehicle: vehicleId,
            status: RENTAL_STATUS.ONGOING,
        })
            .select("rentalCode")
            .lean(),
    ]);

    if (rental) {
        throw new Error(
            `Vehicle has an ongoing rental (${rental.rentalCode}).`
        );
    }

    if (booking) {
        throw new Error(
            `Vehicle has an active booking (${booking.bookingCode}).`
        );
    }
};

const findVehicleById = async (vehicleId) => {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
        throw new Error("Vehicle not found.");
    }

    return vehicle;
};

// `getAll` / `getById` are public catalog endpoints, so the operator is
// populated with display-only fields — never contact details.
const OPERATOR_PUBLIC_FIELDS = "firstName lastName";

const getPopulatedVehicle = async (
    vehicleId
) => {
    return Vehicle.findById(vehicleId)
        .populate("operator", OPERATOR_PUBLIC_FIELDS)
        .populate("category");
};

const saveVehicle = async (vehicle) => {
    await vehicle.save();

    return await getPopulatedVehicle(vehicle._id);
};

const buildVehicleFilters = (filters = {}) => {
    const query = {};

    if (filters.status) {
        // One status, or several comma-separated ("Available,Rented").
        const statuses = String(filters.status)
            .split(",")
            .map((status) => status.trim())
            .filter(Boolean);

        query.status =
            statuses.length > 1
                ? { $in: statuses }
                : statuses[0];
    } else {
        query.status = {
            $ne: VEHICLE_STATUS.ARCHIVED,
        };
    }

    if (filters.vehicleType) {
        query.vehicleType = filters.vehicleType;
    }

    if (filters.brand) {
        query.brand = filters.brand;
    }

    if (filters.category) {
        query.category = filters.category;
    }

    if (filters.ownership) {
        query.ownership = filters.ownership;
    }

    if (filters.operator) {
        query.operator = filters.operator;
    }

    if (filters.isFeatured !== undefined) {
        query.isFeatured = filters.isFeatured;
    }

    return query;
};

/*
 * Builds a new documents.history array from an existing one plus a set of
 * {type, image} entries to record — used any time an OR or CR is set
 * (vehicle creation, consignment approval, admin edit, registration
 * renewal), so a superseded document is never silently discarded. Skips an
 * entry with no url/publicId, and skips one already recorded under the
 * same type+publicId so re-saving an unchanged document doesn't duplicate.
 */
const appendDocumentHistoryEntries = (
    existingHistory,
    entries
) => {
    const history = [
        ...(existingHistory || []),
    ];

    entries.forEach(({ type, image }) => {
        if (
            !image?.url ||
            !image?.publicId
        ) {
            return;
        }

        const alreadyRecorded = history.some(
            (entry) =>
                entry.type === type &&
                entry.publicId === image.publicId
        );

        if (alreadyRecorded) {
            return;
        }

        history.push({
            type,
            url: image.url,
            publicId: image.publicId,
            originalName:
                image.originalName || "",
            uploadedAt: new Date(),
        });
    });

    return history;
};

const createVehicle = async (vehicleData) => {
    vehicleData.vehicleCode =
        await generateVehicleCode();

    validateVehiclePricing(
        vehicleData.pricing
    );

    validateSecurityDeposit(
        vehicleData.securityDeposit
    );

    validateVehicleImages(
        vehicleData.images
    );

    await ensureVehicleCodeAvailable(
        vehicleData.vehicleCode
    );

    if (
        vehicleData.documents?.officialReceipt ||
        vehicleData.documents
            ?.certificateOfRegistration
    ) {
        vehicleData.documents = {
            ...vehicleData.documents,
            history: appendDocumentHistoryEntries(
                [],
                [
                    {
                        type: "officialReceipt",
                        image: vehicleData.documents
                            .officialReceipt,
                    },
                    {
                        type: "certificateOfRegistration",
                        image: vehicleData.documents
                            .certificateOfRegistration,
                    },
                ]
            ),
        };
    }

    const vehicle = await Vehicle.create(
        vehicleData
    );

    return await getPopulatedVehicle(
        vehicle._id
    );
};

const getVehicles = async (
    filters = {},
    sort = { createdAt: -1 }
) => {
    const query = buildVehicleFilters(filters);

    return await Vehicle.find(query)
        .populate("operator", OPERATOR_PUBLIC_FIELDS)
        .populate("category")
        .sort(sort);
};

const getVehicleCounts = async (filters = {}) => {
    const ownershipQuery =
        buildVehicleFilters(filters);

    const [
        active,
        archived,
        total,
        company,
        consigned,
    ] = await Promise.all([
        Vehicle.countDocuments({
            status: {
                $ne: VEHICLE_STATUS.ARCHIVED,
            },
        }),

        Vehicle.countDocuments({
            status:
                VEHICLE_STATUS.ARCHIVED,
        }),

        Vehicle.countDocuments(
            ownershipQuery
        ),

        Vehicle.countDocuments({
            ...ownershipQuery,
            ownership:
                VEHICLE_OWNERSHIP.COMPANY,
        }),

        Vehicle.countDocuments({
            ...ownershipQuery,
            ownership:
                VEHICLE_OWNERSHIP.CONSIGNED,
        }),
    ]);

    return {
        active,
        archived,
        total,
        company,
        consigned,
    };
};

/*
 * Admin fleet table's "Next Booking" column: per vehicle, the rental it's
 * out on (if any) and the earliest confirmed booking still ahead of it.
 * Unpaid (Pending) bookings aren't counted — they can lapse in minutes.
 * Kept off the public GET /vehicles so booking dates never leak there.
 */
const UPCOMING_BOOKING_STATUSES = [
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

const getVehicleBookingSchedule = async () => {
    const now = new Date();

    const [ongoing, upcoming] = await Promise.all([
        Booking.find({ status: BOOKING_STATUS.ONGOING })
            .select("vehicle startDate endDate dueBackDate")
            .lean(),

        Booking.find({
            status: { $in: UPCOMING_BOOKING_STATUSES },
            endDate: { $gt: now },
        })
            .select("vehicle status startDate endDate")
            .sort({ startDate: 1 })
            .lean(),
    ]);

    const schedule = {};

    const entryFor = (vehicleId) => {
        const key = String(vehicleId);

        schedule[key] ??= {
            current: null,
            next: null,
            upcomingCount: 0,
        };

        return schedule[key];
    };

    ongoing.forEach((booking) => {
        if (!booking.vehicle) {
            return;
        }

        entryFor(booking.vehicle).current = {
            startDate: booking.startDate,
            dueBackDate:
                booking.dueBackDate ?? booking.endDate,
        };
    });

    // Sorted by startDate, so the first one seen per vehicle is the next.
    upcoming.forEach((booking) => {
        if (!booking.vehicle) {
            return;
        }

        const entry = entryFor(booking.vehicle);

        entry.upcomingCount += 1;
        entry.next ??= {
            status: booking.status,
            startDate: booking.startDate,
            endDate: booking.endDate,
        };
    });

    return schedule;
};

const getVehicleById = async (vehicleId) => {
    await findVehicleById(vehicleId);

    return await getPopulatedVehicle(vehicleId);
};

const updateVehicle = async (
    vehicleId,
    updateData
) => {
    const vehicle = await findVehicleById(vehicleId);

    if (updateData.pricing) {
        validateVehiclePricing({
            ...vehicle.pricing.toObject(),
            ...updateData.pricing,
        });
    }

    if (updateData.securityDeposit) {
    validateSecurityDeposit({
        ...vehicle.securityDeposit.toObject(),
        ...updateData.securityDeposit,
    });

    }

    if (updateData.images) {
        validateVehicleImages(updateData.images);
    }

    if (updateData.specifications) {
        vehicle.specifications = {
            ...vehicle.specifications.toObject(),
            ...updateData.specifications,
        };
    }

    if (updateData.pricing) {
        vehicle.pricing = {
            ...vehicle.pricing.toObject(),
            ...updateData.pricing,
        };
    }

    if (updateData.securityDeposit) {
        vehicle.securityDeposit = {
            ...vehicle.securityDeposit.toObject(),
            ...updateData.securityDeposit,
        };
    }

    if (updateData.description) {
        vehicle.description = {
            ...vehicle.description.toObject(),
            ...updateData.description,
        };
    }

    if (updateData.metrics) {
        vehicle.metrics = {
            ...vehicle.metrics.toObject(),
            ...updateData.metrics,
        };
    }

    if (updateData.availability) {
        vehicle.availability = {
            ...vehicle.availability.toObject(),
            ...updateData.availability,
        };
    }

     if (updateData.compliance) {
         vehicle.compliance = {
             ...vehicle.compliance.toObject(),
             ...updateData.compliance,
         };
     }

     if (updateData.documents) {
         const previousDocuments =
             vehicle.documents.toObject();

         vehicle.documents = {
             ...previousDocuments,
             ...updateData.documents,
             /*
              * Backfills the document being replaced into history first
              * (in case this vehicle predates document history tracking
              * and it was never recorded), then the new one — so editing
              * a vehicle's OR/CR here never silently loses the old one,
              * same as registration renewal.
              */
             history: appendDocumentHistoryEntries(
                 previousDocuments.history,
                 [
                     {
                         type: "officialReceipt",
                         image:
                             previousDocuments.officialReceipt,
                     },
                     {
                         type: "officialReceipt",
                         image: updateData.documents
                             .officialReceipt,
                     },
                     {
                         type: "certificateOfRegistration",
                         image:
                             previousDocuments.certificateOfRegistration,
                     },
                     {
                         type: "certificateOfRegistration",
                         image: updateData.documents
                             .certificateOfRegistration,
                     },
                 ]
             ),
         };
     }

     if (updateData.gps) {
        vehicle.gps = {
            ...vehicle.gps.toObject(),
            ...updateData.gps,
        };
    }

    if (updateData.archive) {
        vehicle.archive = {
            ...vehicle.archive.toObject(),
            ...updateData.archive,
        };
    }

    if (updateData.audit) {
        vehicle.audit = {
            ...vehicle.audit.toObject(),
            ...updateData.audit,
        };
    }

    const nestedFields = [
        "specifications",
        "pricing",
        "securityDeposit",
        "description",
        "metrics",
        "availability",
        "compliance",
        "documents",
        "gps",
        "archive",
        "audit",
    ];

    for (const [key, value] of Object.entries(updateData)) {
        if (!nestedFields.includes(key)) {
            vehicle[key] = value;
        }
    }

    return await saveVehicle(vehicle);
};

/*
 * Archiving takes a vehicle off the platform for good, so it mustn't strand
 * anyone: a customer holding a booking that can still happen (they'd find an
 * unpickable vehicle — or be marked a no-show) or a rental that's still open.
 * Those are resolved first: cancelled/rejected (refunded) or completed.
 */
const ensureVehicleHasNoLiveBookings = async (vehicleId) => {
    const liveBooking = await Booking.findOne({
        vehicle: vehicleId,
        status: {
            $nin: [
                ...BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
                BOOKING_STATUS.COMPLETED,
            ],
        },
    })
        .select("bookingCode status")
        .lean();

    if (liveBooking) {
        throw createError(
            `This vehicle still has an active booking (${liveBooking.bookingCode}, ${liveBooking.status}). Complete, cancel or reject its bookings before archiving it.`,
            409
        );
    }
};

/* Bookings not picked up yet — the ones an availability change can strand. */
const UNPICKED_BOOKING_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

/*
 * Blocking dates (or moving "available from" later) over bookings customers
 * already hold would leave them turning up to a vehicle that can't be
 * released — and their booking wrongly heading for a no-show. Refused, as
 * a partner's availability request already is: those bookings are resolved
 * first (cancelled — full refund — or rescheduled).
 */
const ensureNoBookingsStranded = async (
    vehicleId,
    { start, end, statuses, action }
) => {
    const bookings = await Booking.find({
        vehicle: vehicleId,
        status: { $in: statuses },
        startDate: { $lt: end },
        endDate: { $gt: start },
    })
        .select("bookingCode")
        .sort({ startDate: 1 })
        .limit(5)
        .lean();

    if (bookings.length) {
        throw createError(
            `Can't ${action}: it overlaps booking(s) ${bookings
                .map((booking) => booking.bookingCode)
                .join(", ")}. Cancel, reject or reschedule them first.`,
            409
        );
    }
};

/*
 * A vehicle just went out of service (maintenance, expired registration,
 * bookings disabled) while customers still hold bookings that haven't been
 * picked up. Nothing moves those bookings on their own — approval is refused
 * and pickup fails — so tell the admins which ones to cancel (full refund) or
 * reschedule, before the customer turns up. `reason` completes "…because the
 * vehicle ___". Best-effort; never throws.
 */
const alertAdminsOfStrandedBookings = async (vehicleId, reason) => {
    try {
        const bookings = await Booking.find({
            vehicle: vehicleId,
            status: {
                $in: [
                    BOOKING_STATUS.PENDING,
                    BOOKING_STATUS.PAYMENT_RECEIVED,
                    BOOKING_STATUS.APPROVED,
                ],
            },
        })
            .select("bookingCode startDate")
            .sort({ startDate: 1 })
            .lean();

        if (!bookings.length) {
            return;
        }

        const vehicle = await Vehicle.findById(vehicleId)
            .select("brand model plateNumber")
            .lean();

        const vehicleName =
            [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
            "A vehicle";

        const list = bookings
            .map(
                (booking) =>
                    `${booking.bookingCode} (${formatManilaDateTime(
                        booking.startDate
                    )})`
            )
            .join(", ");

        await notifyAdmins({
            type: "Vehicle Out Of Service",
            title: "Upcoming Bookings Affected",
            message: `${vehicleName}${
                vehicle?.plateNumber ? ` (${vehicle.plateNumber})` : ""
            } ${reason}, but ${bookings.length} booking(s) not yet picked up still use it: ${list}. Cancel them (the customer is refunded in full) or reschedule them once it's back.`,
            variant: "warning",
            category: "Booking",
            metadata: {
                relatedId: vehicleId,
                relatedModel: "Vehicle",
            },
        });
    } catch (alertError) {
        console.error(
            `Failed to alert admins about bookings on out-of-service vehicle ${vehicleId}:`,
            alertError
        );
    }
};

const archiveVehicle = async (
    vehicleId,
    archivedBy,
    archiveReason = ""
) => {
    const vehicle = await findVehicleById(vehicleId);

    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw new Error(
            "Vehicle is already archived."
        );
    }

    await ensureVehicleHasNoLiveBookings(vehicle._id);

    vehicle.status = VEHICLE_STATUS.ARCHIVED;

    vehicle.archive = {
        ...vehicle.archive.toObject(),
        archivedAt: new Date(),
        archivedBy,
        archiveReason,
    };

    const savedVehicle = await saveVehicle(vehicle);

    await releaseTrackersOnArchive(vehicle._id, archivedBy);

    return savedVehicle;
};

const restoreVehicle = async (vehicleId) => {
    const vehicle = await findVehicleById(vehicleId);

    if (
        vehicle.status !==
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw new Error(
            "Only archived vehicles can be restored."
        );
    }

    vehicle.status = VEHICLE_STATUS.AVAILABLE;

    vehicle.archive = {
        ...vehicle.archive.toObject(),
        archivedAt: null,
        archivedBy: null,
        archiveReason: "",
    };

    return await saveVehicle(vehicle);
};

/*
 * `maintenance` ({ mode, days, reason }) only matters when setting
 * Maintenance: the vehicle stays listed and only the maintenance window is
 * unbookable (see vehicleMaintenanceService). Without one it's off road (no
 * end date), as Maintenance always was. Leaving Maintenance ends it.
 */
const updateVehicleStatus = async (
    vehicleId,
    status,
    { maintenance = null, actorId = null } = {}
) => {
    const vehicle = await findVehicleById(vehicleId);

    if (status === VEHICLE_STATUS.MAINTENANCE) {
        const { vehicle: updated } = await applyVehicleMaintenance(
            vehicle._id,
            {
                mode:
                    maintenance?.mode || VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
                days: maintenance?.days ?? null,
                reason: maintenance?.reason ?? "",
                setStatus: true,
            },
            actorId
        );

        return updated;
    }

    if (
        status === VEHICLE_STATUS.ARCHIVED &&
        vehicle.status !== VEHICLE_STATUS.ARCHIVED
    ) {
        await ensureVehicleHasNoLiveBookings(vehicle._id);
    }

    const previousStatus = vehicle.status;
    const hadMaintenance =
        previousStatus === VEHICLE_STATUS.MAINTENANCE ||
        Boolean(vehicle.maintenance?.mode);

    vehicle.status = status;

    if (hadMaintenance) {
        vehicle.maintenance = {};
    }

    const savedVehicle = await saveVehicle(vehicle);

    // This endpoint can also archive (VEHICLE_STATUS_VALUES includes it).
    if (status === VEHICLE_STATUS.ARCHIVED) {
        await releaseTrackersOnArchive(vehicle._id);
    }

    // Conflicts with the maintenance that just ended no longer hold.
    if (hadMaintenance) {
        await clearVehicleMaintenance(vehicle._id);
    }

    if (
        status === VEHICLE_STATUS.EXPIRED_REGISTRATION &&
        previousStatus !== status
    ) {
        await alertAdminsOfStrandedBookings(
            vehicle._id,
            "was marked as having an expired registration"
        );
    }

    return savedVehicle;
};

const updateVehicleCondition = async (
    vehicleId,
    condition
) => {
    const vehicle = await findVehicleById(vehicleId);

    vehicle.condition = condition;

    return await saveVehicle(vehicle);
};

const updateVehicleBooking = async (
    vehicleId,
    availability
) => {
    const vehicle = await findVehicleById(vehicleId);

    const wasBookable =
        vehicle.availability?.bookingEnabled !== false;

    /*
     * Only the two settings this endpoint validates. Blocked dates have
     * their own endpoint (with its checks); taking the rest of the body
     * wholesale let anything else through unchecked.
     */
    const changes = {};

    if (availability?.bookingEnabled !== undefined) {
        changes.bookingEnabled = availability.bookingEnabled;
    }

    if (availability?.availableFrom !== undefined) {
        changes.availableFrom = availability.availableFrom
            ? new Date(availability.availableFrom)
            : null;

        // Bookings starting before the new date could never be picked up.
        if (
            changes.availableFrom &&
            changes.availableFrom > new Date()
        ) {
            await ensureNoBookingsStranded(vehicle._id, {
                start: new Date(),
                end: changes.availableFrom,
                statuses: UNPICKED_BOOKING_STATUSES,
                action: "make the vehicle available only from that date",
            });
        }
    }

    vehicle.availability = {
        ...vehicle.availability.toObject(),
        ...changes,
    };

    const savedVehicle = await saveVehicle(vehicle);

    if (
        wasBookable &&
        savedVehicle.availability?.bookingEnabled === false
    ) {
        await alertAdminsOfStrandedBookings(
            savedVehicle._id,
            "had bookings disabled"
        );
    }

    return savedVehicle;
};

/*
 * Called when an operator is suspended/unsuspended (see updateUserStatus in
 * userService.js) to take their vehicles off/back on the booking market.
 *
 * Suspending only turns off vehicles that were actually bookable at that
 * moment, and marks them with `disabledForSuspension` so the reverse
 * operation knows which ones it's responsible for. Unsuspending only turns
 * back on vehicles carrying that flag — one an operator/admin had already
 * disabled for an unrelated reason before the suspension is left alone
 * rather than being silently re-enabled.
 */
const setOperatorVehiclesBookable = async (
    operatorId,
    bookable
) => {
    if (bookable) {
        const result = await Vehicle.updateMany(
            {
                operator: operatorId,
                "availability.disabledForSuspension": true,
            },
            {
                $set: {
                    "availability.bookingEnabled": true,
                    "availability.disabledForSuspension": false,
                },
            }
        );

        return result.modifiedCount ?? 0;
    }

    const affected = await Vehicle.find({
        operator: operatorId,
        "availability.bookingEnabled": { $ne: false },
    })
        .select("_id")
        .lean();

    const result = await Vehicle.updateMany(
        {
            _id: { $in: affected.map((vehicle) => vehicle._id) },
            "availability.bookingEnabled": { $ne: false },
        },
        {
            $set: {
                "availability.bookingEnabled": false,
                "availability.disabledForSuspension": true,
            },
        }
    );

    for (const vehicle of affected) {
        await alertAdminsOfStrandedBookings(
            vehicle._id,
            "was taken off the market because its operator was suspended"
        );
    }

    return result.modifiedCount ?? 0;
};

const addVehicleBlockedDate = async (
    vehicleId,
    startDate,
    endDate,
    reason = ""
) => {
    const vehicle = await findVehicleById(vehicleId);

    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw new Error(
            "Archived vehicles cannot have blocked dates."
        );
    }

    const {
        start,
        end,
    } = validateBlockedDateRange(
        startDate,
        endDate
    );

    const blockedDates =
        vehicle.availability?.blockedDates || [];

    if (
        hasBlockedDateConflict(
            blockedDates,
            start,
            end
        )
    ) {
        throw new Error(
            "The blocked date range overlaps an existing blocked date."
        );
    }

    // Includes ongoing rentals: the vehicle is out with a customer then.
    await ensureNoBookingsStranded(vehicle._id, {
        start,
        end,
        statuses: [...UNPICKED_BOOKING_STATUSES, BOOKING_STATUS.ONGOING],
        action: "block these dates",
    });

    vehicle.availability = {
        ...vehicle.availability.toObject(),
        blockedDates: [
            ...blockedDates,
            {
                startDate: start,
                endDate: end,
                reason,
            },
        ],
    };

    return await saveVehicle(vehicle);
};

const removeVehicleBlockedDate = async (
    vehicleId,
    blockedDateId
) => {
    const vehicle = await findVehicleById(vehicleId);

    const blockedDates =
        vehicle.availability?.blockedDates || [];

    const blockedDateExists =
        blockedDates.some(
            (blockedDate) =>
                blockedDate._id?.toString() ===
                blockedDateId.toString()
        );

    if (!blockedDateExists) {
        throw new Error(
            "Blocked date not found."
        );
    }

    vehicle.availability = {
        ...vehicle.availability.toObject(),
        blockedDates:
            blockedDates.filter(
                (blockedDate) =>
                    blockedDate._id?.toString() !==
                    blockedDateId.toString()
            ),
    };

    return await saveVehicle(vehicle);
};

const checkVehicleAvailability = async (
    vehicleId,
    startDate,
    endDate,
    driverId = null
) => {
    const vehicle = await findVehicleById(vehicleId);

    const {
        start,
        end,
    } = validateBlockedDateRange(
        startDate,
        endDate
    );

    const reasons = [];

    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        reasons.push(
            "Vehicle is archived."
        );
    }

    // Only the maintenance window itself; later dates stay bookable.
    if (overlapsMaintenance(vehicle, start, end)) {
        reasons.push(
            describeMaintenanceBlock(getMaintenanceWindow(vehicle), {
                showOffRoadNotice: (await getOffRoadVehicleSettings())
                    .showNotice,
            })
        );
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.EXPIRED_REGISTRATION
    ) {
        reasons.push(
            "Vehicle's registration has expired and is pending renewal."
        );
    }

    /*
     * Reserved or Rented doesn't make other times unavailable: the booking
     * conflict check below decides that from the actual booked times, the
     * turnaround buffer, and whether the vehicle is still out overdue.
     */

    if (
        vehicle.availability?.bookingEnabled ===
        false
    ) {
        reasons.push(
            "Vehicle booking is currently disabled."
        );
    }

    const availableFrom =
        vehicle.availability?.availableFrom;

    if (
        availableFrom &&
        start < new Date(availableFrom)
    ) {
        reasons.push(
            "Vehicle is not available for booking during the requested period."
        );
    }

    const blockedDates =
        vehicle.availability?.blockedDates || [];

    if (
        hasBlockedDateConflict(
            blockedDates,
            start,
            end
        )
    ) {
        reasons.push(
            "Vehicle is blocked during the requested period."
        );
    }

    const bufferMs = await getTurnaroundBufferMs();

    const conflictingBooking =
        await hasBookingConflict(
            vehicleId,
            start,
            end,
            null,
            { bufferMs }
        );

    if (conflictingBooking) {
        reasons.push(
            conflictingBooking.stillOut
                ? "This vehicle is still out on a rental that hasn't been returned yet. Please choose a later pickup time."
                : `This vehicle is booked from ${formatManilaDateTime(conflictingBooking.startDate)} to ${formatManilaDateTime(conflictingBooking.endDate)}, and needs ${bufferMs / (60 * 60 * 1000)} hours between rentals for cleaning and inspection. Please choose different dates or a different pickup time.`
        );
    }

    /*
     * Driver conflict is independent of the vehicle checks above — a driver
     * already committed to another rental for an overlapping period blocks
     * this booking even when the vehicle itself is free.
     */
    if (driverId) {
        const conflictingDriverBooking =
            await hasDriverBookingConflict(
                driverId,
                start,
                end,
                null,
                { bufferMs }
            );

        if (conflictingDriverBooking) {
            reasons.push(
                conflictingDriverBooking.stillOut
                    ? "The selected driver is still out on a rental that hasn't been returned yet. Please choose a later pickup time or another driver."
                    : `The selected driver already has a booking for part of that time (drivers also need ${bufferMs / (60 * 60 * 1000)} hours between rentals). Please choose another driver or different dates.`
            );
        }
    }

    return {
        available: reasons.length === 0,
        reasons,
    };
};

/*
 * Bulk counterpart to checkVehicleAvailability's booking-conflict check,
 * used by the public browse/search page: the client already filters out
 * vehicles by status/bookingEnabled/blockedDates on its own, but only the
 * database knows about actual overlapping bookings, so this closes that gap
 * without requiring one availability request per vehicle card.
 */
const checkVehiclesAvailabilityBulk = async (
    vehicleIds,
    startDate,
    endDate
) => {
    const {
        start,
        end,
    } = validateBlockedDateRange(
        startDate,
        endDate
    );

    const conflictingVehicleIds =
        await findVehiclesWithBookingConflict(
            vehicleIds,
            start,
            end
        );

    // Vehicles under maintenance over those dates (still listed).
    const underMaintenance = await Vehicle.find({
        _id: { $in: vehicleIds },
        $or: [
            { "maintenance.mode": { $ne: null } },
            { status: VEHICLE_STATUS.MAINTENANCE },
        ],
    })
        .select("status maintenance")
        .lean();

    underMaintenance
        .filter((vehicle) => overlapsMaintenance(vehicle, start, end))
        .forEach((vehicle) =>
            conflictingVehicleIds.add(vehicle._id.toString())
        );

    return {
        unavailableVehicleIds: Array.from(
            conflictingVehicleIds
        ),
    };
};

const MAX_AVAILABILITY_CALENDAR_DAYS = 95;

const toISODateOnly = (date) =>
    date.toISOString().slice(0, 10);

/* Manila midnight of a "YYYY-MM-DD" key, as epoch ms. */
const manilaMidnightMs = (dateKey) =>
    Date.parse(`${dateKey}T00:00:00+08:00`);

/* 870 → "14:30". */
const minuteToTime = (minute) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
        minute % 60
    ).padStart(2, "0")}`;

// Rented/Reserved don't block other days: bookings are checked by time.
// Maintenance with an end date only blocks its window (loadOccupiedRanges).
const isEntirelyUnbookable = (vehicle) =>
    vehicle.status === VEHICLE_STATUS.ARCHIVED ||
    getMaintenanceWindow(vehicle)?.end === Infinity ||
    vehicle.status === VEHICLE_STATUS.EXPIRED_REGISTRATION ||
    vehicle.availability?.bookingEnabled === false;

/*
 * Every stretch (epoch ms, [start, end)) between fromMs and toMs that a new
 * rental of this vehicle — and of the driver, when given — must not touch:
 * admin-blocked dates, each booking widened by the turnaround buffer on both
 * sides, and, while either is out on an unreturned rental, everything before
 * now + the buffer. The same rules bookingConflictService enforces at booking.
 */
const loadOccupiedRanges = async (
    vehicle,
    fromMs,
    toMs,
    { driverId = null, bufferMs }
) => {
    const subjects = [
        { vehicle: vehicle._id },
        ...(driverId ? [{ driver: driverId }] : []),
    ];

    const [bookings, stillOut] = await Promise.all([
        Booking.find({
            $or: subjects,
            status: {
                $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
            },
            startDate: {
                $lt: new Date(toMs + bufferMs),
            },
            endDate: {
                $gt: new Date(fromMs - bufferMs),
            },
        })
            .select("startDate endDate")
            .lean(),

        Rental.exists({
            $or: subjects,
            status: RENTAL_STATUS.ONGOING,
            "return.date": null,
        }),
    ]);

    const blockedRanges = (
        vehicle.availability?.blockedDates || []
    ).map((blocked) => ({
        start: new Date(blocked.startDate).getTime(),
        end: new Date(blocked.endDate).getTime(),
    }));

    const bookingRanges = bookings.map((booking) => ({
        start: new Date(booking.startDate).getTime() - bufferMs,
        end: new Date(booking.endDate).getTime() + bufferMs,
    }));

    const maintenanceWindow = getMaintenanceWindow(vehicle);

    return [
        ...blockedRanges,
        ...bookingRanges,
        ...(maintenanceWindow
            ? [
                  {
                      start: maintenanceWindow.start,
                      end: maintenanceWindow.end,
                  },
              ]
            : []),
        ...(stillOut
            ? [{ start: 0, end: Date.now() + bufferMs }]
            : []),
    ];
};

/* Whether a rental from startMs to endMs clears every rule above. */
const isRentalWindowFree = (
    startMs,
    endMs,
    { occupiedRanges, earliestMs, availableFromMs }
) =>
    startMs >= earliestMs &&
    (availableFromMs === null || startMs >= availableFromMs) &&
    !occupiedRanges.some(
        (range) => startMs < range.end && endMs > range.start
    );

/*
 * Per-day bookable/unbookable snapshot for a date range — the building
 * block behind the public availability calendar on the vehicle detail page.
 * Deliberately says nothing about *why* a day is unavailable (an existing
 * booking, an admin-set blocked range, before the vehicle's available-from
 * date, or simply in the past all collapse into the same bucket) — the
 * calendar is meant to show what's bookable, not to leak booking activity.
 *
 * - unavailableDates: no pickup time is free (unchanged meaning; partner
 *   unavailability requests rely on it).
 * - returnOnlyDates: free, but no time could start even a 1-day rental —
 *   only usable as a return day.
 * - limitedPickupTimes: { "YYYY-MM-DD": { from, until } } for days where a
 *   1-day rental can start only within part of the 8 AM–6 PM window.
 */
const getVehicleAvailabilityCalendar = async (
    vehicleId,
    startDate,
    endDate
) => {
    const vehicle = await findVehicleById(vehicleId);

    const {
        start,
        end,
    } = validateBlockedDateRange(
        startDate,
        endDate
    );

    const rangeDays = Math.ceil(
        (end.getTime() - start.getTime()) /
            (1000 * 60 * 60 * 24)
    );

    if (rangeDays > MAX_AVAILABILITY_CALENDAR_DAYS) {
        throw new Error(
            `Date range cannot exceed ${MAX_AVAILABILITY_CALENDAR_DAYS} days.`
        );
    }

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    const entirelyUnbookable =
        isEntirelyUnbookable(vehicle);

    const availableFrom =
        vehicle.availability?.availableFrom
            ? new Date(
                  vehicle.availability
                      .availableFrom
              )
            : null;

    const bufferMs = await getTurnaroundBufferMs();

    // Two extra days so a 1-day rental starting on the last day is judged
    // against whatever follows it.
    const occupiedRanges = entirelyUnbookable
        ? []
        : await loadOccupiedRanges(
              vehicle,
              start.getTime(),
              end.getTime() + 2 * DAY_MS,
              { bufferMs }
          );

    const { bookingHours, pickupHours } = await getBookingSettings();

    // Earliest bookable pickup: the minimum notice from now (counted in
    // booking hours when those are on).
    const earliestSlotMs = getEarliestPickupMs(Date.now(), bookingHours);

    // The pickup times customers can choose (Settings → Bookings).
    const slotMinutes = getPickupSlotMinutes(pickupHours);

    /*
     * A day is bookable if at least one of its pickup times (Manila) is
     * far enough ahead (minimum notice) and falls outside every occupied range — so the return
     * day of another rental stays open for a pickup after its buffer. The
     * exact times are checked again when the customer books.
     */
    const hasFreePickupSlot = (dateKey) => {
        const midnight = manilaMidnightMs(dateKey);

        for (const minute of slotMinutes) {
            const slot = midnight + minute * 60 * 1000;

            if (
                slot >= earliestSlotMs &&
                !occupiedRanges.some(
                    (range) =>
                        slot >= range.start &&
                        slot < range.end
                )
            ) {
                return true;
            }
        }

        return false;
    };

    /*
     * The pickup times on a bookable day that could start at least the
     * shortest rental (1 day) — what the customer actually gets to choose
     * from. A day with none is only usable as a return day; a day whose
     * times don't span the whole pickup window gets a "from/until" hint.
     */
    const getPickupStartMinutes = (dateKey) => {
        const midnight = manilaMidnightMs(dateKey);
        const minutes = [];

        for (const minute of slotMinutes) {
            const slot = midnight + minute * 60 * 1000;

            if (
                isRentalWindowFree(slot, slot + DAY_MS, {
                    occupiedRanges,
                    earliestMs: earliestSlotMs,
                    availableFromMs: availableFrom?.getTime() ?? null,
                })
            ) {
                minutes.push(minute);
            }
        }

        return minutes;
    };

    const unavailableDates = [];
    const returnOnlyDates = [];
    const limitedPickupTimes = {};
    const cursor = new Date(start);

    while (cursor < end) {
        const dayStart = new Date(cursor);
        const dateKey = toISODateOnly(dayStart);

        const isPast = dayStart < todayStart;

        const isBeforeAvailableFrom =
            availableFrom &&
            dayStart < availableFrom;

        const isOccupied =
            entirelyUnbookable ||
            !hasFreePickupSlot(dateKey);

        if (
            isPast ||
            isBeforeAvailableFrom ||
            isOccupied
        ) {
            unavailableDates.push(dateKey);
        } else {
            const startMinutes =
                getPickupStartMinutes(dateKey);

            if (startMinutes.length === 0) {
                returnOnlyDates.push(dateKey);
            } else {
                const first = startMinutes[0];
                const last = startMinutes[startMinutes.length - 1];

                if (
                    first > slotMinutes[0] ||
                    last < slotMinutes.at(-1)
                ) {
                    limitedPickupTimes[dateKey] = {
                        from: minuteToTime(first),
                        until: minuteToTime(last),
                    };
                }
            }
        }

        cursor.setDate(
            cursor.getDate() + 1
        );
    }

    return {
        unavailableDates,
        returnOnlyDates,
        limitedPickupTimes,
    };
};

const PICKUP_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PICKUP_TIMES_RANGE_DAYS = 366;

/*
 * Which pickup times work for a rental from startDateKey to endDateKey
 * (Manila "YYYY-MM-DD"; the return is at the same time on the end date), so
 * the booking form can disable the rest instead of failing on submit. The
 * same rules as checkVehicleAvailability: minimum notice, available-from,
 * admin-blocked dates, other bookings plus the turnaround buffer, a vehicle
 * (or driver) still out on an unreturned rental. Only free/not-free per time
 * is returned — never why, so nobody else's booking can be read off it.
 */
const getVehiclePickupTimes = async (
    vehicleId,
    startDateKey,
    endDateKey,
    driverId = null
) => {
    if (
        !PICKUP_DATE_KEY_PATTERN.test(startDateKey ?? "") ||
        !PICKUP_DATE_KEY_PATTERN.test(endDateKey ?? "")
    ) {
        throw createError(
            "Dates must be in YYYY-MM-DD format.",
            400
        );
    }

    const startMidnight = manilaMidnightMs(startDateKey);
    const endMidnight = manilaMidnightMs(endDateKey);

    if (
        !Number.isFinite(startMidnight) ||
        !Number.isFinite(endMidnight)
    ) {
        throw createError("Invalid date.", 400);
    }

    if (endMidnight <= startMidnight) {
        throw createError(
            "Return date must be after the pickup date.",
            400
        );
    }

    if (
        (endMidnight - startMidnight) / DAY_MS >
        MAX_PICKUP_TIMES_RANGE_DAYS
    ) {
        throw createError(
            `Date range cannot exceed ${MAX_PICKUP_TIMES_RANGE_DAYS} days.`,
            400
        );
    }

    const vehicle = await findVehicleById(vehicleId);
    const entirelyUnbookable = isEntirelyUnbookable(vehicle);
    const bufferMs = await getTurnaroundBufferMs();

    const occupiedRanges = entirelyUnbookable
        ? []
        : await loadOccupiedRanges(
              vehicle,
              startMidnight,
              endMidnight + DAY_MS,
              { driverId, bufferMs }
          );

    const availableFromMs = vehicle.availability?.availableFrom
        ? new Date(vehicle.availability.availableFrom).getTime()
        : null;

    const { bookingHours, pickupHours } = await getBookingSettings();

    const earliestMs = getEarliestPickupMs(Date.now(), bookingHours);

    // Only the configured pickup times are listed (Settings → Bookings).
    const times = [];

    for (const minute of getPickupSlotMinutes(pickupHours)) {
        const offset = minute * 60 * 1000;

        times.push({
            time: minuteToTime(minute),
            available:
                !entirelyUnbookable &&
                isRentalWindowFree(
                    startMidnight + offset,
                    endMidnight + offset,
                    { occupiedRanges, earliestMs, availableFromMs }
                ),
        });
    }

    return { times };
};

const getVehicleAvailability = async (
    vehicleId
) => {
    const vehicle = await findVehicleById(vehicleId);

    return {
        vehicleId: vehicle._id,
        vehicleCode: vehicle.vehicleCode,
        status: vehicle.status,
        bookingEnabled:
            vehicle.availability?.bookingEnabled ??
            true,
        availableFrom:
            vehicle.availability?.availableFrom ??
            null,
        blockedDates:
            vehicle.availability?.blockedDates ??
            [],
        maintenance: toPublicMaintenance(vehicle),
    };
};

const updateFeaturedVehicle = async (
    vehicleId,
    isFeatured
) => {
    const vehicle = await findVehicleById(vehicleId);

    vehicle.isFeatured = isFeatured;

    return await saveVehicle(vehicle);
};

const createVehicleFromConsignment = async (
    consignment,
    operatorId,
    currentUserId,
    commission = null,
    pricing = null
) => {
    const snapshot =
        consignment.snapshots.vehicle;

    const vehicleData = {
        plateNumber:
            snapshot.plateNumber,

        registrationNumber:
            snapshot.registrationNumber,

        brand:
            snapshot.brand,

        model:
            snapshot.model,

        variant:
            snapshot.variant,

        year:
            snapshot.year,

        vehicleType:
            snapshot.vehicleType,

        category:
            snapshot.category,

        specifications: {
            ...snapshot.specifications.toObject(),
        },

        /*
         * Pricing is no longer collected from the operator at submission —
         * admin sets it as part of approving (see approveConsignment), so
         * it always arrives here as an explicit override rather than
         * coming off the snapshot.
         */
        pricing: {
            dailyRate: pricing?.dailyRate,
            reservationFee: pricing?.reservationFee,
        },

        description: {
            ...snapshot.description.toObject(),
        },

        compliance: {
            ...snapshot.compliance.toObject(),
        },

        /*
         * Was previously never copied over, so an approved consignment's
         * vehicle silently lost the OR/CR uploaded during the application —
         * fixed here alongside document-history tracking, which needs a
         * real starting document to seed from.
         */
        documents: {
            ...snapshot.documents.toObject(),
        },

        images: snapshot.images.map(
            (image) => ({
                ...image.toObject(),
            })
        ),

        operator: operatorId,

        ownership:
            VEHICLE_OWNERSHIP.CONSIGNED,

        status:
            VEHICLE_STATUS.AVAILABLE,

        audit: {
            createdBy: currentUserId,
        },
    };

    if (commission?.mode) {
        vehicleData.commission = {
            mode: commission.mode,
            value: commission.value,
        };
    }

    return await createVehicle(vehicleData);
};

/* -------------------------------------------------------------------------- */
/*                  Vehicle Registration Expiration & Renewal                 */
/* -------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * Mirrors Settings.validIdRenewalSettings' period-reset math, but the unit
 * (Month/Year) is configurable here rather than fixed to years. Deliberately
 * does NOT multiply by an extra *1000 the way userService.js's
 * uploadRenewedValidId does (a pre-existing bug there that pushes
 * expiration ~1000x too far out) — this returns a plain millisecond
 * duration, used as-is.
 */
const getRegistrationRenewalPeriodMs = (
    settings
) => {
    const config =
        settings?.vehicleRegistrationRenewalSettings;

    const value = config?.renewalPeriodValue ?? 1;
    const unit = config?.renewalPeriodUnit ?? "Year";

    return unit === "Month"
        ? value * 30 * DAY_MS
        : value * 365 * DAY_MS;
};

/*
 * Admins have no restrictions when managing a vehicle's registration;
 * operators may only act on a vehicle they own. Returns whether the acting
 * user is an admin, so callers can skip attempt-limit checks accordingly.
 */
const assertCanManageRegistration = (
    vehicle,
    actingUser
) => {
    const isAdmin =
        actingUser.role === "admin";

    const isOwningOperator =
        actingUser.role === "operator" &&
        vehicle.operator?.toString() ===
            actingUser._id.toString();

    if (!isAdmin && !isOwningOperator) {
        throw createError(
            "You are not authorized to manage this vehicle's registration.",
            403
        );
    }

    return isAdmin;
};

/*
 * Resets the operator's renewal-attempt counter once the configured period
 * has elapsed since their last renewal/attempt. Mutates the in-memory
 * vehicle document but does not save it — callers save afterward.
 */
const resetRegistrationRenewalCountIfPeriodElapsed = (
    vehicle,
    settings
) => {
    const periodMs =
        getRegistrationRenewalPeriodMs(settings);

    const lastRenewal =
        vehicle.compliance?.lastRegistrationRenewalAt;

    if (
        lastRenewal &&
        Date.now() -
            new Date(lastRenewal).getTime() >=
            periodMs
    ) {
        vehicle.compliance.registrationRenewalCount = 0;
    }
};

const renewVehicleRegistration = async (
    vehicleId,
    { officialReceiptImage, expirationDate },
    actingUser
) => {
    const vehicle = await findVehicleById(
        vehicleId
    );

    const isAdmin = assertCanManageRegistration(
        vehicle,
        actingUser
    );

    if (
        vehicle.status !==
        VEHICLE_STATUS.EXPIRED_REGISTRATION
    ) {
        throw createError(
            "This vehicle's registration is not currently expired.",
            400
        );
    }

    if (
        !officialReceiptImage?.url ||
        !officialReceiptImage?.publicId
    ) {
        throw createError(
            "A new official receipt image is required.",
            400
        );
    }

    const parsedExpiration = new Date(
        expirationDate
    );

    if (
        Number.isNaN(
            parsedExpiration.getTime()
        ) ||
        parsedExpiration <= new Date()
    ) {
        throw createError(
            "Registration expiration must be a future date.",
            400
        );
    }

    if (!isAdmin) {
        const settings = await Settings.findOne();

        resetRegistrationRenewalCountIfPeriodElapsed(
            vehicle,
            settings
        );

        const maxRenewalsPerPeriod =
            settings
                ?.vehicleRegistrationRenewalSettings
                ?.maxRenewalsPerPeriod ?? 1;

        if (
            (vehicle.compliance
                ?.registrationRenewalCount ??
                0) >= maxRenewalsPerPeriod
        ) {
            throw createError(
                `You have reached the maximum number of registration renewals (${maxRenewalsPerPeriod}) for this period. Request an extra attempt from an admin.`,
                400
            );
        }
    }

    vehicle.compliance = {
        ...vehicle.compliance.toObject(),
        licenseExpiration: parsedExpiration,
        lastRegistrationRenewalAt: new Date(),
        registrationRenewalCount: isAdmin
            ? vehicle.compliance
                  .registrationRenewalCount
            : (vehicle.compliance
                  .registrationRenewalCount ??
                  0) + 1,
    };

    const previousDocuments =
        vehicle.documents.toObject();

    vehicle.documents = {
        ...previousDocuments,
        officialReceipt: officialReceiptImage,
        /*
         * Backfills the OR being replaced into history first (in case this
         * vehicle predates document history tracking and it was never
         * recorded), then records the new one — so the old OR is never
         * silently discarded. CR is untouched here, same as always: it
         * isn't part of what registration renewal replaces.
         */
        history: appendDocumentHistoryEntries(
            previousDocuments.history,
            [
                {
                    type: "officialReceipt",
                    image: previousDocuments.officialReceipt,
                },
                {
                    type: "officialReceipt",
                    image: officialReceiptImage,
                },
            ]
        ),
    };

    /*
     * Deliberately leaves `status` as EXPIRED_REGISTRATION — the vehicle
     * only becomes bookable again once setVehicleAvailabilityAfterRenewal
     * runs (step 2 of the renewal dialog). This makes the flow resumable:
     * reopening the dialog after closing it mid-way detects the document is
     * already renewed (status still EXPIRED_REGISTRATION, but
     * licenseExpiration already in the future) and jumps straight to step 2.
     */
    return await saveVehicle(vehicle);
};

const setVehicleAvailabilityAfterRenewal = async (
    vehicleId,
    { availableFrom },
    actingUser
) => {
    const vehicle = await findVehicleById(
        vehicleId
    );

    assertCanManageRegistration(
        vehicle,
        actingUser
    );

    if (
        vehicle.status !==
        VEHICLE_STATUS.EXPIRED_REGISTRATION
    ) {
        throw createError(
            "This vehicle's registration is not currently expired.",
            400
        );
    }

    const expiration =
        vehicle.compliance?.licenseExpiration;

    if (
        !expiration ||
        new Date(expiration) <= new Date()
    ) {
        throw createError(
            "Renew the vehicle's registration before setting its availability.",
            400
        );
    }

    vehicle.status = VEHICLE_STATUS.AVAILABLE;

    vehicle.availability = {
        ...vehicle.availability.toObject(),
        availableFrom: availableFrom
            ? new Date(availableFrom)
            : new Date(),
    };

    return await saveVehicle(vehicle);
};

const getRegistrationRenewalEligibility = async (
    vehicleId,
    actingUser
) => {
    const vehicle = await findVehicleById(
        vehicleId
    );

    const isAdmin = assertCanManageRegistration(
        vehicle,
        actingUser
    );

    if (isAdmin) {
        return {
            unlimited: true,
        };
    }

    const settings = await Settings.findOne();

    resetRegistrationRenewalCountIfPeriodElapsed(
        vehicle,
        settings
    );

    const maxRenewalsPerPeriod =
        settings?.vehicleRegistrationRenewalSettings
            ?.maxRenewalsPerPeriod ?? 1;

    const maxAttempts =
        settings?.vehicleRegistrationRenewalSettings
            ?.maxAttempts ?? 3;

    const count =
        vehicle.compliance
            ?.registrationRenewalCount ?? 0;

    const periodMs =
        getRegistrationRenewalPeriodMs(settings);

    const lastRenewal =
        vehicle.compliance
            ?.lastRegistrationRenewalAt;

    return {
        unlimited: false,
        maxRenewalsPerPeriod,
        maxAttempts,
        count,
        remaining: Math.max(
            0,
            maxRenewalsPerPeriod - count
        ),
        canRequestAttempt: count < maxAttempts,
        periodResetAt: lastRenewal
            ? new Date(
                  new Date(
                      lastRenewal
                  ).getTime() + periodMs
              )
            : null,
    };
};

const requestVehicleRegistrationRenewalAttempt = async (
    vehicleId,
    actingUser
) => {
    const vehicle = await findVehicleById(
        vehicleId
    );

    if (
        vehicle.operator?.toString() !==
        actingUser._id.toString()
    ) {
        throw createError(
            "You can only request renewal attempts for your own vehicles.",
            403
        );
    }

    const settings = await Settings.findOne();

    resetRegistrationRenewalCountIfPeriodElapsed(
        vehicle,
        settings
    );

    const maxAttempts =
        settings?.vehicleRegistrationRenewalSettings
            ?.maxAttempts ?? 3;

    if (
        (vehicle.compliance
            ?.registrationRenewalCount ?? 0) >=
        maxAttempts
    ) {
        throw createError(
            `You have reached the maximum number of registration renewal attempts (${maxAttempts}) per period.`,
            400
        );
    }

    vehicle.compliance.registrationRenewalCount =
        (vehicle.compliance
            ?.registrationRenewalCount ?? 0) + 1;

    await vehicle.save();

    await notifyAdmins({
        type: "vehicleRegistrationRenewalRequest",
        title:
            "Vehicle Registration Renewal Attempt Requested",
        message: `${actingUser.firstName} ${actingUser.lastName} requested an extra registration renewal attempt for ${vehicle.vehicleCode}.`,
        variant: "warning",
        category: "Vehicle",
        metadata: {
            reference:
                "vehicle-registration-renewal",
            relatedId: vehicle._id,
            relatedModel: "Vehicle",
        },
    });

    return await getPopulatedVehicle(
        vehicle._id
    );
};

const grantVehicleRegistrationRenewalAttempt = async (
    vehicleId,
    amount
) => {
    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {
        throw createError(
            "Renewal attempt amount must be a positive integer.",
            400
        );
    }

    const vehicle = await findVehicleById(
        vehicleId
    );

    vehicle.compliance.registrationRenewalCount =
        Math.max(
            0,
            (vehicle.compliance
                ?.registrationRenewalCount ??
                0) - amount
        );

    return await saveVehicle(vehicle);
};

/*
 * Per-vehicle reminder/expired notification, shared by both the reminder
 * sweep (still-Available vehicles approaching expiration) and the
 * auto-expire sweep (vehicles that just flipped to EXPIRED_REGISTRATION).
 * Notifies both the owning operator and every admin, per the requirement
 * that either role should be reminded. Deduplicated per day per recipient
 * so a vehicle sitting in the same reminder window doesn't re-notify hourly.
 */
const checkVehicleRegistrationExpirationNotifications = async (
    vehicleId
) => {
    const vehicle = await Vehicle.findById(
        vehicleId
    );

    if (
        !vehicle ||
        !vehicle.compliance?.licenseExpiration
    ) {
        return;
    }

    const settings = await Settings.findOne();

    const expirationSettings =
        settings
            ?.vehicleRegistrationExpirationSettings;

    const now = new Date();

    const expirationDate = new Date(
        vehicle.compliance.licenseExpiration
    );

    const diffDays = Math.ceil(
        (expirationDate.getTime() -
            now.getTime()) /
            DAY_MS
    );

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const admins = await User.find({
        role: "admin",
    }).select("_id");

    const recipientIds = [
        ...admins.map((admin) =>
            admin._id.toString()
        ),
        ...(vehicle.operator
            ? [vehicle.operator.toString()]
            : []),
    ];

    const sendTo = async (
        recipientId,
        type,
        title,
        message,
        variant
    ) => {
        const alreadySent =
            await hasRecentNotification({
                recipient: recipientId,
                type,
                relatedId: vehicle._id,
                since: startOfDay,
            });

        if (alreadySent) {
            return;
        }

        await notifyUser(recipientId, {
            type,
            title,
            message,
            variant,
            category: "Vehicle",
            metadata: {
                reference: "vehicle-registration",
                relatedId: vehicle._id,
                relatedModel: "Vehicle",
            },
        });
    };

    if (diffDays <= 0) {
        if (!expirationSettings?.notifyOnExpired) {
            return;
        }

        for (const recipientId of recipientIds) {
            await sendTo(
                recipientId,
                "vehicleRegistrationExpired",
                "Vehicle Registration Expired",
                `${vehicle.vehicleCode}'s registration has expired and it is no longer bookable.`,
                "error"
            );
        }

        return;
    }

    if (!expirationSettings?.enabled) {
        return;
    }

    const thresholds = [
        expirationSettings.firstReminderDays,
        expirationSettings.secondReminderDays,
        expirationSettings.thirdReminderDays,
    ].filter(Boolean);

    const matchedThreshold = thresholds.find(
        (days) => diffDays <= days
    );

    if (!matchedThreshold) {
        return;
    }

    for (const recipientId of recipientIds) {
        await sendTo(
            recipientId,
            "vehicleRegistrationExpiringSoon",
            "Vehicle Registration Expiring Soon",
            `${vehicle.vehicleCode}'s registration is expiring in ${diffDays} day(s).`,
            "warning"
        );
    }
};

const checkAllVehicleRegistrationExpirations = async () => {
    const vehicles = await Vehicle.find({
        "compliance.licenseExpiration": {
            $exists: true,
            $ne: null,
        },
        status: {
            $ne: VEHICLE_STATUS.ARCHIVED,
        },
    }).select("_id");

    for (const vehicle of vehicles) {
        try {
            await checkVehicleRegistrationExpirationNotifications(
                vehicle._id
            );
        } catch (error) {
            console.error(
                `Failed to check registration expiration for vehicle ${vehicle._id}:`,
                error
            );
        }
    }
};

/*
 * Scoped to currently-Available vehicles only: a vehicle that's Reserved/
 * PickupInProgress/Rented when its registration expires stays that way
 * until it naturally cycles back to Available (no hook exists at booking/
 * rental completion to re-check this — a deliberate, known limitation
 * rather than deeper surgery into that flow).
 */
const autoExpireVehicleRegistrations = async () => {
    const vehicles = await Vehicle.find({
        status: VEHICLE_STATUS.AVAILABLE,
        "compliance.licenseExpiration": {
            $exists: true,
            $ne: null,
            $lte: new Date(),
        },
    });

    for (const vehicle of vehicles) {
        try {
            vehicle.status =
                VEHICLE_STATUS.EXPIRED_REGISTRATION;

            await vehicle.save();

            await checkVehicleRegistrationExpirationNotifications(
                vehicle._id
            );

            // Only Available vehicles get here, so no approved booking —
            // but unapproved ones can't be approved any more.
            await alertAdminsOfStrandedBookings(
                vehicle._id,
                "has an expired registration"
            );
        } catch (error) {
            console.error(
                `Failed to auto-expire registration for vehicle ${vehicle._id}:`,
                error
            );
        }
    }
};

export {
    alertAdminsOfStrandedBookings,
    createVehicle,
    createVehicleFromConsignment,
    getVehicles,
    getVehicleCounts,
    getVehicleBookingSchedule,
    getVehicleById,
    updateVehicle,
    archiveVehicle,
    restoreVehicle,
    updateVehicleStatus,
    updateVehicleCondition,
    updateVehicleBooking,
    setOperatorVehiclesBookable,
    addVehicleBlockedDate,
    removeVehicleBlockedDate,
    checkVehicleAvailability,
    checkVehiclesAvailabilityBulk,
    getVehicleAvailabilityCalendar,
    getVehiclePickupTimes,
    getVehicleAvailability,
    updateFeaturedVehicle,
    checkPlateNumberExists,
    checkRegistrationNumberExists,
    renewVehicleRegistration,
    setVehicleAvailabilityAfterRenewal,
    getRegistrationRenewalEligibility,
    requestVehicleRegistrationRenewalAttempt,
    grantVehicleRegistrationRenewalAttempt,
    checkAllVehicleRegistrationExpirations,
    autoExpireVehicleRegistrations,
};
