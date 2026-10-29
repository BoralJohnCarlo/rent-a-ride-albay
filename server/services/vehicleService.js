import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";

import {
    VEHICLE_STATUS,
    VEHICLE_OWNERSHIP,
    VEHICLE_CODE_PREFIX,
    MAX_VEHICLE_IMAGES,
    MIN_VEHICLE_IMAGES,
} from "../constants/vehicleConstants.js";

import {
    BOOKING_STATUS,
} from "../constants/bookingConstants.js";

import {
    RENTAL_STATUS,
} from "../constants/rentalConstants.js";

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

const ensurePlateNumberAvailable = async (
    plateNumber,
    excludeVehicleId = null
) => {
    const query = {
        plateNumber,
    };

    if (excludeVehicleId) {
        query._id = {
            $ne: excludeVehicleId,
        };
    }

    const existingVehicle = await Vehicle.findOne(query);

    if (existingVehicle) {
        throw new Error("Plate number already exists.");
    }
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

const getBookingConflict = async (
    vehicleId,
    startDate,
    endDate
) => {
    return Booking.findOne({
        vehicle: vehicleId,
        status: {
            $nin: [
                BOOKING_STATUS.REJECTED,
                BOOKING_STATUS.CANCELLED,
                BOOKING_STATUS.EXPIRED,
                BOOKING_STATUS.COMPLETED,
            ],
        },
        startDate: {
            $lt: endDate,
        },
        endDate: {
            $gt: startDate,
        },
    })
        .select("bookingCode")
        .lean();
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

const getPopulatedVehicle = async (
    vehicleId
) => {
    return Vehicle.findById(vehicleId)
        .populate({
            path: "owner",
            populate: {
                path: "operator",
            },
        })
        .populate("category");
};

const saveVehicle = async (vehicle) => {
    await vehicle.save();

    return await getPopulatedVehicle(vehicle._id);
};

const buildVehicleFilters = (filters = {}) => {
    const query = {};

    if (filters.status) {
        query.status = filters.status;
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

    if (filters.isFeatured !== undefined) {
        query.isFeatured = filters.isFeatured;
    }

    return query;
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

    await ensurePlateNumberAvailable(
        vehicleData.plateNumber
    );

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
        .populate({
            path: "owner",
            populate: {
                path: "operator",
            },
        })
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

    if (
        updateData.plateNumber &&
        updateData.plateNumber !== vehicle.plateNumber
    ) {
        await ensurePlateNumberAvailable(
            updateData.plateNumber,
            vehicle._id
        );
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
         vehicle.documents = {
             ...vehicle.documents.toObject(),
             ...updateData.documents,
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

    vehicle.status = VEHICLE_STATUS.ARCHIVED;

    vehicle.archive = {
        ...vehicle.archive.toObject(),
        archivedAt: new Date(),
        archivedBy,
        archiveReason,
    };

    return await saveVehicle(vehicle);
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

const updateVehicleStatus = async (
    vehicleId,
    status
) => {
    const vehicle = await findVehicleById(vehicleId);

    vehicle.status = status;

    return await saveVehicle(vehicle);
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

    vehicle.availability = {
        ...vehicle.availability.toObject(),
        ...availability,
    };

    return await saveVehicle(vehicle);
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

    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        return {
            available: false,
            reason: "Vehicle is archived.",
        };
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.MAINTENANCE
    ) {
        return {
            available: false,
            reason: "Vehicle is currently under maintenance.",
        };
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.RESERVED
    ) {
        return {
            available: false,
            reason: "Vehicle is currently reserved.",
        };
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.RENTED
    ) {
        return {
            available: false,
            reason: "Vehicle is currently rented.",
        };
    }

    if (
        vehicle.availability?.bookingEnabled ===
        false
    ) {
        return {
            available: false,
            reason: "Vehicle booking is currently disabled.",
        };
    }

    const availableFrom =
        vehicle.availability?.availableFrom;

    if (
        availableFrom &&
        start < new Date(availableFrom)
    ) {
        return {
            available: false,
            reason: "Vehicle is not available for booking during the requested period.",
        };
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
        return {
            available: false,
            reason: "Vehicle is blocked during the requested period.",
        };
    }

    const conflictingBooking =
        await Booking.findOne({
            vehicle: vehicleId,
            status: {
                $nin: [
                    BOOKING_STATUS.REJECTED,
                    BOOKING_STATUS.CANCELLED,
                    BOOKING_STATUS.EXPIRED,
                ],
            },
            startDate: {
                $lt: end,
            },
            endDate: {
                $gt: start,
            },
        })
            .select(
                "bookingCode startDate endDate status"
            )
            .lean();

    if (conflictingBooking) {
        return {
            available: false,
            reason: `Vehicle is already booked (${conflictingBooking.bookingCode}) from ${new Date(conflictingBooking.startDate).toLocaleDateString()} to ${new Date(conflictingBooking.endDate).toLocaleDateString()}.`,
        };
    }

    return {
        available: true,
        reason: null,
    };
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
    vehicleOwnerId,
    currentUserId
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

        pricing: {
            ...snapshot.pricing.toObject(),
        },

        description: {
            ...snapshot.description.toObject(),
        },

        compliance: {
            ...snapshot.compliance.toObject(),
        },

        images: snapshot.images.map(
            (image) => ({
                ...image.toObject(),
            })
        ),

        owner: vehicleOwnerId,

        ownership:
            VEHICLE_OWNERSHIP.CONSIGNED,

        status:
            VEHICLE_STATUS.AVAILABLE,

        audit: {
            createdBy: currentUserId,
        },
    };

    return await createVehicle(vehicleData);
};

export {
    createVehicle,
    createVehicleFromConsignment,
    getVehicles,
    getVehicleCounts,
    getVehicleById,
    updateVehicle,
    archiveVehicle,
    restoreVehicle,
    updateVehicleStatus,
    updateVehicleCondition,
    updateVehicleBooking,
    addVehicleBlockedDate,
    removeVehicleBlockedDate,
    checkVehicleAvailability,
    getVehicleAvailability,
    updateFeaturedVehicle,
};
