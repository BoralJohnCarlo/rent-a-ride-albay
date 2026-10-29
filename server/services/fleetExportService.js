import Booking from "../models/Booking.js";
import Consignment from "../models/Consignment.js";
import Review from "../models/Review.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import "../models/VehicleCategory.js";

import {
    addTableSheet,
    createWorkbook,
    workbookToBuffer,
} from "../utils/excelExport.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";
import { CONSIGNMENT_STATUS } from "../constants/consignmentConstants.js";
import {
    VEHICLE_OWNERSHIP,
    VEHICLE_STATUS,
} from "../constants/vehicleConstants.js";

import { getSettingsWithDefaults } from "./payoutService.js";
import { getVehicleBookingSchedule } from "./vehicleService.js";

/*
 * Admin "Export to Excel" for the Fleet page and the Consignments → Partners
 * tab. Booking stats are all-time and follow the dashboard leaderboard's
 * rules (vehicleLeaderboardService.js): only bookings that became or are
 * becoming a trip count, and "booking value" is the booked total
 * (pricing.totalAmount) of completed trips - what customers committed to,
 * not settled revenue (late/damage charges and refunds aren't in it).
 */

// Same cap as the Bookings export (bounded by the JSON body limit).
export const MAX_EXPORT_VEHICLES = 3000;

/* ---------- helpers ---------- */

const personName = (person) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
    person?.email ||
    "";

// "RegistrationExpired" -> "Registration Expired"
const spaced = (text) =>
    String(text || "").replace(/([a-z])([A-Z])/g, "$1 $2");

const yesNo = (value) => (value ? "Yes" : "No");

const money = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

const commissionText = (commission, ownership, defaultRate) => {
    if (ownership !== VEHICLE_OWNERSHIP.CONSIGNED) {
        return "";
    }

    if (commission?.mode === "PERCENTAGE" && commission.value !== null) {
        return `${commission.value}%`;
    }

    if (commission?.mode === "FIXED" && commission.value !== null) {
        return `₱${Number(commission.value).toLocaleString("en-PH")} fixed`;
    }

    return `Default (${defaultRate}%)`;
};

/*
 * Per vehicle id: { bookings, completedTrips, rentalDays, bookingValue,
 * averageRating, reviewCount }, all-time.
 */
export const getVehicleStats = async (vehicleIds) => {
    if (!vehicleIds.length) {
        return new Map();
    }

    const [bookingRows, ratingRows] = await Promise.all([
        Booking.aggregate([
            {
                $match: {
                    vehicle: { $in: vehicleIds },
                    status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
                },
            },
            {
                $addFields: {
                    isCompleted: {
                        $eq: ["$status", BOOKING_STATUS.COMPLETED],
                    },
                },
            },
            {
                $group: {
                    _id: "$vehicle",
                    bookings: { $sum: 1 },
                    completedTrips: {
                        $sum: { $cond: ["$isCompleted", 1, 0] },
                    },
                    rentalDays: {
                        $sum: {
                            $cond: [
                                "$isCompleted",
                                { $ifNull: ["$pricing.rentalDays", 0] },
                                0,
                            ],
                        },
                    },
                    bookingValue: {
                        $sum: {
                            $cond: [
                                "$isCompleted",
                                { $ifNull: ["$pricing.totalAmount", 0] },
                                0,
                            ],
                        },
                    },
                },
            },
        ]),

        Review.aggregate([
            {
                $match: {
                    vehicle: { $in: vehicleIds },
                    rating: { $gte: 1 },
                },
            },
            {
                $group: {
                    _id: "$vehicle",
                    averageRating: { $avg: "$rating" },
                    reviewCount: { $sum: 1 },
                },
            },
        ]),
    ]);

    const stats = new Map();

    const entryFor = (id) => {
        const key = String(id);

        if (!stats.has(key)) {
            stats.set(key, {
                bookings: 0,
                completedTrips: 0,
                rentalDays: 0,
                bookingValue: 0,
                averageRating: null,
                reviewCount: 0,
            });
        }

        return stats.get(key);
    };

    bookingRows.forEach((row) => {
        Object.assign(entryFor(row._id), {
            bookings: row.bookings,
            completedTrips: row.completedTrips,
            rentalDays: row.rentalDays,
            bookingValue: row.bookingValue,
        });
    });

    ratingRows.forEach((row) => {
        Object.assign(entryFor(row._id), {
            averageRating: Math.round(row.averageRating * 10) / 10,
            reviewCount: row.reviewCount,
        });
    });

    return stats;
};

/* ---------- fleet ---------- */

export const VEHICLE_COLUMNS = [
    // Details & specs
    { header: "Vehicle code", key: "vehicleCode", width: 16 },
    { header: "Brand", key: "brand", width: 14 },
    { header: "Model", key: "model", width: 16 },
    { header: "Variant", key: "variant", width: 14 },
    { header: "Year", key: "year", type: "number", width: 8 },
    { header: "Type", key: "vehicleType", width: 12 },
    { header: "Category", key: "category", width: 16 },
    { header: "Plate no.", key: "plateNumber", width: 12 },
    { header: "Transmission", key: "transmission", width: 13 },
    { header: "Fuel", key: "fuelType", width: 10 },
    { header: "Engine", key: "engine", width: 12 },
    { header: "Seats", key: "seats", type: "number", width: 8 },
    { header: "Status", key: "status", width: 18 },
    { header: "Condition", key: "condition", width: 12 },
    { header: "Maintenance", key: "maintenance", width: 14 },
    { header: "Maintenance until", key: "maintenanceUntil", type: "datetime", width: 20 },
    { header: "Featured", key: "featured", width: 10 },
    { header: "Booking", key: "booking", width: 10 },
    { header: "Added on", key: "createdAt", type: "date", width: 14 },

    // Pricing
    { header: "Daily rate", key: "dailyRate", type: "money", width: 13 },
    { header: "Reservation fee", key: "reservationFee", type: "money", width: 14 },
    { header: "Daily total", key: "dailyTotal", type: "money", width: 13 },
    { header: "Security deposit", key: "securityDeposit", type: "money", width: 14 },
    { header: "Partner commission", key: "commission", width: 18 },

    // Registration & owner
    { header: "Registration no.", key: "registrationNumber", width: 18 },
    { header: "Registration expiry", key: "registrationExpiry", type: "date", width: 16 },
    { header: "Ownership", key: "ownership", width: 12 },
    { header: "Partner (owner)", key: "partner", width: 22 },
    { header: "Partner email", key: "partnerEmail", width: 26 },
    { header: "Partner phone", key: "partnerPhone", width: 16 },

    // Booking stats
    { header: "Bookings (all time)", key: "bookings", type: "number", width: 12 },
    { header: "Completed trips", key: "completedTrips", type: "number", width: 12 },
    { header: "Rental days (completed)", key: "rentalDays", type: "number", width: 13 },
    { header: "Completed booking value", key: "bookingValue", type: "money", width: 16 },
    { header: "Avg rating", key: "averageRating", type: "number", width: 10 },
    { header: "Reviews", key: "reviewCount", type: "number", width: 9 },
    { header: "On rent - due back", key: "dueBack", type: "datetime", width: 20 },
    { header: "Next pickup", key: "nextPickup", type: "datetime", width: 20 },
    { header: "Upcoming bookings", key: "upcomingCount", type: "number", width: 12 },
];

// Only added when the export has an archived vehicle in it.
const ARCHIVE_COLUMNS = [
    { header: "Archived on", key: "archivedAt", type: "datetime", width: 20 },
    { header: "Archive reason", key: "archiveReason", width: 30 },
];

const VEHICLE_TOTALS = [
    "bookings",
    "completedTrips",
    "rentalDays",
    "bookingValue",
    "reviewCount",
    "upcomingCount",
];

/* Rows in the order of `vehicleIds` (the admin's on-screen order). */
export const getVehicleExportRows = async (vehicleIds = []) => {
    const [vehicles, settings, schedule] = await Promise.all([
        Vehicle.find({ _id: { $in: vehicleIds } })
            .populate("operator", "firstName lastName email phoneNumber")
            .populate("category", "name")
            .lean(),
        getSettingsWithDefaults(),
        getVehicleBookingSchedule(),
    ]);

    const defaultRate =
        settings.commissionSettings?.platformCommissionRate ?? 10;

    const stats = await getVehicleStats(
        vehicles.map((vehicle) => vehicle._id)
    );

    const byId = new Map(
        vehicles.map((vehicle) => [String(vehicle._id), vehicle])
    );

    return vehicleIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .map((vehicle) => {
            const id = String(vehicle._id);
            const stat = stats.get(id);
            const entry = schedule[id];
            const dailyRate = Number(vehicle.pricing?.dailyRate) || 0;
            const reservationFee =
                Number(vehicle.pricing?.reservationFee) || 0;
            const consigned =
                vehicle.ownership === VEHICLE_OWNERSHIP.CONSIGNED;
            const archived =
                vehicle.status === VEHICLE_STATUS.ARCHIVED;

            return {
                vehicleCode: vehicle.vehicleCode ?? "",
                brand: vehicle.brand ?? "",
                model: vehicle.model ?? "",
                variant: vehicle.variant ?? "",
                year: vehicle.year ?? null,
                vehicleType: vehicle.vehicleType ?? "",
                category: vehicle.category?.name ?? "Uncategorized",
                plateNumber: vehicle.plateNumber ?? "",
                transmission: vehicle.specifications?.transmission ?? "",
                fuelType: vehicle.specifications?.fuelType ?? "",
                engine: vehicle.specifications?.engine ?? "",
                seats: vehicle.specifications?.seatingCapacity ?? null,
                status: spaced(vehicle.status),
                condition: vehicle.condition ?? "",
                maintenance: spaced(vehicle.maintenance?.mode ?? ""),
                maintenanceUntil: vehicle.maintenance?.mode
                    ? vehicle.maintenance?.until
                    : null,
                featured: yesNo(vehicle.isFeatured),
                booking:
                    vehicle.availability?.bookingEnabled === false
                        ? "Off"
                        : "On",
                createdAt: vehicle.createdAt,

                dailyRate,
                reservationFee,
                dailyTotal: money(dailyRate + reservationFee),
                securityDeposit: vehicle.securityDeposit?.enabled
                    ? Number(vehicle.securityDeposit.amount) || 0
                    : null,
                commission: commissionText(
                    vehicle.commission,
                    vehicle.ownership,
                    defaultRate
                ),

                registrationNumber: vehicle.registrationNumber ?? "",
                registrationExpiry:
                    vehicle.compliance?.licenseExpiration ?? null,
                ownership: vehicle.ownership ?? VEHICLE_OWNERSHIP.COMPANY,
                partner: consigned ? personName(vehicle.operator) : "",
                partnerEmail: consigned ? vehicle.operator?.email ?? "" : "",
                partnerPhone: consigned
                    ? vehicle.operator?.phoneNumber ?? ""
                    : "",

                bookings: stat?.bookings ?? 0,
                completedTrips: stat?.completedTrips ?? 0,
                rentalDays: stat?.rentalDays ?? 0,
                bookingValue: money(stat?.bookingValue),
                averageRating: stat?.averageRating ?? null,
                reviewCount: stat?.reviewCount ?? 0,
                dueBack: entry?.current?.dueBackDate ?? null,
                nextPickup: entry?.next?.startDate ?? null,
                upcomingCount: entry?.upcomingCount ?? 0,

                // A restored vehicle keeps its old archive record; ignore it.
                archived,
                archivedAt: archived
                    ? vehicle.archive?.archivedAt ?? null
                    : null,
                archiveReason: archived
                    ? vehicle.archive?.archiveReason ?? ""
                    : "",
            };
        });
};

export const buildVehiclesWorkbook = async (vehicleIds) => {
    const rows = await getVehicleExportRows(vehicleIds);
    const workbook = createWorkbook();

    addTableSheet(workbook, {
        name: "Fleet",
        columns: rows.some((row) => row.archived)
            ? [...VEHICLE_COLUMNS, ...ARCHIVE_COLUMNS]
            : VEHICLE_COLUMNS,
        rows,
        totals: VEHICLE_TOTALS,
    });

    return { buffer: await workbookToBuffer(workbook), rowCount: rows.length };
};

/* ---------- approved partners ---------- */

export const PARTNER_COLUMNS = [
    { header: "Partner", key: "partner", width: 24 },
    { header: "Organization", key: "organization", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Alt. phone", key: "altPhone", width: 16 },
    { header: "Address", key: "address", width: 40 },
    { header: "ID verification", key: "verification", width: 14 },
    { header: "Account", key: "account", width: 12 },
    { header: "Approved vehicles", key: "vehicleCount", type: "number", width: 12 },
    { header: "First approved", key: "firstApproved", type: "date", width: 14 },
    { header: "Latest approved", key: "latestApproved", type: "date", width: 14 },
    { header: "Completed trips", key: "completedTrips", type: "number", width: 12 },
    { header: "Completed booking value", key: "bookingValue", type: "money", width: 16 },
];

export const PARTNER_VEHICLE_COLUMNS = [
    { header: "Consignment code", key: "consignmentCode", width: 18 },
    { header: "Partner", key: "partner", width: 24 },
    { header: "Organization", key: "organization", width: 22 },
    { header: "Vehicle", key: "vehicle", width: 26 },
    { header: "Year", key: "year", type: "number", width: 8 },
    { header: "Type", key: "vehicleType", width: 12 },
    { header: "Plate no.", key: "plateNumber", width: 12 },
    { header: "Registration no.", key: "registrationNumber", width: 18 },
    { header: "Registration expiry", key: "registrationExpiry", type: "date", width: 16 },
    { header: "Approved on", key: "approvedAt", type: "datetime", width: 20 },
    { header: "Approved by", key: "approvedBy", width: 20 },
    { header: "Commission", key: "commission", width: 16 },
    { header: "Fleet code", key: "vehicleCode", width: 16 },
    { header: "Fleet status", key: "vehicleStatus", width: 18 },
    { header: "Daily rate", key: "dailyRate", type: "money", width: 13 },
    { header: "Reservation fee", key: "reservationFee", type: "money", width: 14 },
    { header: "Completed trips", key: "completedTrips", type: "number", width: 12 },
    { header: "Completed booking value", key: "bookingValue", type: "money", width: 16 },
];

const addressText = (address) =>
    [
        address?.street,
        address?.barangay,
        address?.city,
        address?.province,
        address?.postalCode,
    ]
        .filter(Boolean)
        .join(", ");

const vehicleLabel = (vehicle) =>
    [vehicle?.brand, vehicle?.model, vehicle?.variant]
        .filter(Boolean)
        .join(" ");

/*
 * The Partners tab's list: approved, non-archived consignments. One row per
 * partner (grouped by the account that applied, same id approval uses for
 * the vehicle's operator) and one row per approved vehicle.
 */
export const getPartnerExportRows = async () => {
    const consignments = await Consignment.find({
        "application.status": CONSIGNMENT_STATUS.APPROVED,
        "archive.isArchived": { $ne: true },
    })
        .sort({ "application.approval.approvedAt": 1, createdAt: 1 })
        .populate(
            "generatedEntities.vehicle",
            "vehicleCode status pricing commission ownership"
        )
        .populate("application.approval.approvedBy", "firstName lastName email")
        .lean();

    const settings = await getSettingsWithDefaults();
    const defaultRate =
        settings.commissionSettings?.platformCommissionRate ?? 10;

    const fleetVehicleIds = consignments
        .map((consignment) => consignment.generatedEntities?.vehicle?._id)
        .filter(Boolean);

    const partnerIds = [
        ...new Set(
            consignments
                .map(
                    (consignment) =>
                        consignment.audit?.createdBy ??
                        consignment.application?.submitted?.submittedBy
                )
                .filter(Boolean)
                .map(String)
        ),
    ];

    const [stats, users] = await Promise.all([
        getVehicleStats(fleetVehicleIds),
        User.find({ _id: { $in: partnerIds } })
            .select("firstName lastName email phoneNumber isSuspended")
            .lean(),
    ]);

    const usersById = new Map(users.map((user) => [String(user._id), user]));

    const vehicleRows = [];
    const partners = new Map();

    consignments.forEach((consignment) => {
        const applicant = consignment.snapshots?.applicant;
        const snapshot = consignment.snapshots?.vehicle;
        const fleetVehicle = consignment.generatedEntities?.vehicle;
        const approval = consignment.application?.approval;
        const partnerId = String(
            consignment.audit?.createdBy ??
                consignment.application?.submitted?.submittedBy ??
                applicant?.contact?.email ??
                consignment._id
        );
        const user = usersById.get(partnerId);
        const stat = fleetVehicle
            ? stats.get(String(fleetVehicle._id))
            : null;

        const partnerName =
            applicant?.identity?.displayName || personName(user);
        const organization = applicant?.organization?.name ?? "";

        vehicleRows.push({
            consignmentCode: consignment.consignmentCode ?? "",
            partner: partnerName,
            organization,
            vehicle: vehicleLabel(snapshot),
            year: snapshot?.year ?? null,
            vehicleType: snapshot?.vehicleType ?? "",
            plateNumber: snapshot?.plateNumber ?? "",
            registrationNumber: snapshot?.registrationNumber ?? "",
            registrationExpiry:
                snapshot?.compliance?.licenseExpiration ?? null,
            approvedAt: approval?.approvedAt ?? null,
            approvedBy: personName(approval?.approvedBy),
            commission: commissionText(
                fleetVehicle?.commission ?? approval?.commission,
                VEHICLE_OWNERSHIP.CONSIGNED,
                defaultRate
            ),
            vehicleCode: fleetVehicle?.vehicleCode ?? "",
            vehicleStatus: fleetVehicle
                ? spaced(fleetVehicle.status)
                : "Not in fleet",
            dailyRate:
                fleetVehicle?.pricing?.dailyRate ??
                snapshot?.pricing?.dailyRate ??
                null,
            reservationFee:
                fleetVehicle?.pricing?.reservationFee ??
                snapshot?.pricing?.reservationFee ??
                null,
            completedTrips: stat?.completedTrips ?? 0,
            bookingValue: money(stat?.bookingValue),
        });

        // Applicant details from the latest approved application win.
        const existing = partners.get(partnerId);
        const approvedAt = approval?.approvedAt
            ? new Date(approval.approvedAt)
            : null;

        const partner = existing ?? {
            vehicleCount: 0,
            firstApproved: null,
            latestApproved: null,
            completedTrips: 0,
            bookingValue: 0,
        };

        partner.partner = partnerName;
        partner.organization = organization;
        partner.email = applicant?.contact?.email || user?.email || "";
        partner.phone =
            applicant?.contact?.phoneNumber || user?.phoneNumber || "";
        partner.altPhone = applicant?.contact?.alternativePhoneNumber ?? "";
        partner.address = addressText(applicant?.address);
        partner.verification = applicant?.verification?.status ?? "";
        partner.account = user
            ? user.isSuspended
                ? "Suspended"
                : "Active"
            : "No account";
        partner.vehicleCount += 1;
        partner.completedTrips += stat?.completedTrips ?? 0;
        partner.bookingValue = money(
            partner.bookingValue + (stat?.bookingValue ?? 0)
        );

        if (approvedAt) {
            if (!partner.firstApproved || approvedAt < partner.firstApproved) {
                partner.firstApproved = approvedAt;
            }

            if (!partner.latestApproved || approvedAt > partner.latestApproved) {
                partner.latestApproved = approvedAt;
            }
        }

        partners.set(partnerId, partner);
    });

    const partnerRows = [...partners.values()].sort((a, b) =>
        a.partner.localeCompare(b.partner)
    );

    return { partnerRows, vehicleRows };
};

export const buildPartnersWorkbook = async () => {
    const { partnerRows, vehicleRows } = await getPartnerExportRows();
    const workbook = createWorkbook();

    addTableSheet(workbook, {
        name: "Partners",
        columns: PARTNER_COLUMNS,
        rows: partnerRows,
        totals: ["vehicleCount", "completedTrips", "bookingValue"],
    });

    addTableSheet(workbook, {
        name: "Approved vehicles",
        columns: PARTNER_VEHICLE_COLUMNS,
        rows: vehicleRows,
        totals: ["completedTrips", "bookingValue"],
    });

    return {
        buffer: await workbookToBuffer(workbook),
        partnerCount: partnerRows.length,
        vehicleCount: vehicleRows.length,
    };
};
