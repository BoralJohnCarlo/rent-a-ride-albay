import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Driver from "../../models/Driver.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
import Voucher from "../../models/Voucher.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_EXTENSION_STATUS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    DRIVER_AVAILABILITY,
    DRIVER_STATUS,
} from "../../constants/driverConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import { hasDriverBookingConflict } from "../../services/bookingConflictService.js";
import {
    approveBooking,
    approveBookingExtension,
    cancelBookingExtension,
    expireLapsedUnapprovedBookings,
    markBookingNoShow,
    markNoShowBookings,
    rejectBookingExtension,
    requestBookingExtension,
} from "../../services/bookingService.js";
import {
    addVehicleBlockedDate,
    alertAdminsOfStrandedBookings,
    archiveVehicle,
    updateVehicleBooking,
} from "../../services/vehicleService.js";
import { claimVoucherUsage } from "../../services/voucherService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/*
 * Booking, Vehicle, Driver and User schemas require full listings the logic
 * under test never reads, so documents are inserted directly with just the
 * fields bookingService queries.
 */
const insertVehicle = async (overrides = {}) => {
    const _id = new mongoose.Types.ObjectId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.AVAILABLE,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Test",
        model: "Car",
        vehicleType: "Car",
        pricing: { dailyRate: 2400, reservationFee: 500 },
        availability: { bookingEnabled: true, blockedDates: [] },
        ...overrides,
    });

    return _id;
};

const insertDriver = async (overrides = {}) => {
    const _id = new mongoose.Types.ObjectId();

    await Driver.collection.insertOne({
        _id,
        firstName: "Test",
        lastName: "Driver",
        status: DRIVER_STATUS.ACTIVE,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        ...overrides,
    });

    return _id;
};

const insertBooking = async (overrides = {}) => {
    const _id = new mongoose.Types.ObjectId();
    const start = new Date(Date.now() + 3 * DAY);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: new mongoose.Types.ObjectId(),
        vehicle: new mongoose.Types.ObjectId(),
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate: start,
        endDate: new Date(start.getTime() + 2 * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            dailyRate: 2400,
            reservationFee: 0,
            rentalDays: 2,
            subtotal: 4800,
            totalAmount: 4800,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
        },
        status: BOOKING_STATUS.PENDING,
        statusHistory: [],
        extensions: [],
        reschedules: [],
        audit: {},
        ...overrides,
    });

    return _id;
};

const adminNotifications = (type, relatedId) =>
    Notification.countDocuments({
        recipient: adminId,
        type,
        "metadata.relatedId": relatedId,
    });

let adminId;

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Payment, Notification].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [Booking, Driver, Notification, Payment, Rental, User, Vehicle, Voucher].map(
            (model) => model.deleteMany({})
        )
    );

    adminId = new mongoose.Types.ObjectId();

    await User.collection.insertOne({
        _id: adminId,
        role: "admin",
        email: `admin-${adminId}@test.local`,
    });
});

describe("driver conflicts", () => {
    it("counts a paid booking awaiting approval as holding the driver", async () => {
        const driverId = await insertDriver();
        const start = new Date(Date.now() + 5 * DAY);

        await insertBooking({
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driver: driverId,
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
            startDate: start,
            endDate: new Date(start.getTime() + DAY),
        });

        const conflict = await hasDriverBookingConflict(
            driverId,
            new Date(start.getTime() + HOUR),
            new Date(start.getTime() + 2 * DAY)
        );

        assert.ok(conflict, "a Payment Received booking must block the driver");
    });
});

describe("approveBooking", () => {
    it("refuses a driver who was deactivated after being chosen", async () => {
        const vehicleId = await insertVehicle();
        const driverId = await insertDriver({
            status: DRIVER_STATUS.SUSPENDED,
        });

        const bookingId = await insertBooking({
            vehicle: vehicleId,
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driver: driverId,
        });

        await assert.rejects(
            approveBooking(bookingId, adminId),
            /not active/
        );

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.PENDING);
    });

    it("approves an eligible booking and reserves the vehicle", async () => {
        const vehicleId = await insertVehicle();
        const bookingId = await insertBooking({ vehicle: vehicleId });

        const result = await approveBooking(bookingId, adminId);

        assert.equal(result.status, BOOKING_STATUS.APPROVED);

        const vehicle = await Vehicle.findById(vehicleId).lean();
        assert.equal(vehicle.status, VEHICLE_STATUS.RESERVED);
    });
});

describe("extension requests", () => {
    const setUpApprovedBooking = async () => {
        const vehicleId = await insertVehicle({
            status: VEHICLE_STATUS.RESERVED,
        });
        const customerId = new mongoose.Types.ObjectId();
        const bookingId = await insertBooking({
            vehicle: vehicleId,
            customer: customerId,
            status: BOOKING_STATUS.APPROVED,
        });

        return { bookingId, customerId };
    };

    it("keeps only one of two simultaneous requests", async () => {
        const { bookingId, customerId } = await setUpApprovedBooking();
        const booking = await Booking.findById(bookingId).lean();
        const requestedEndDate = new Date(
            booking.endDate.getTime() + 5 * HOUR
        );

        const results = await Promise.allSettled([
            requestBookingExtension(bookingId, { requestedEndDate }, customerId),
            requestBookingExtension(bookingId, { requestedEndDate }, customerId),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        const saved = await Booking.findById(bookingId).lean();
        assert.equal(
            saved.extensions.filter(
                (extension) =>
                    extension.status === BOOKING_EXTENSION_STATUS.PENDING
            ).length,
            1
        );
    });

    it("approves a request once: extends the booking and raises one fee", async () => {
        const { bookingId, customerId } = await setUpApprovedBooking();
        const booking = await Booking.findById(bookingId).lean();
        const requestedEndDate = new Date(
            booking.endDate.getTime() + 4 * HOUR
        );

        const requested = await requestBookingExtension(
            bookingId,
            { requestedEndDate },
            customerId
        );
        const extensionId = requested.extensions[0]._id;

        const results = await Promise.allSettled([
            approveBookingExtension(bookingId, extensionId, adminId),
            approveBookingExtension(bookingId, extensionId, adminId),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        const saved = await Booking.findById(bookingId).lean();
        assert.equal(saved.endDate.getTime(), requestedEndDate.getTime());
        assert.equal(
            saved.extensions[0].status,
            BOOKING_EXTENSION_STATUS.APPROVED
        );

        // 4 hours at 2,400/day.
        const fees = await Payment.find({
            booking: bookingId,
            paymentType: "EXTENSION_FEE",
        }).lean();
        assert.equal(fees.length, 1);
        assert.equal(fees[0].amount, 400);
    });

    it("lets only one of a rejection and a cancellation close a request", async () => {
        const { bookingId, customerId } = await setUpApprovedBooking();
        const booking = await Booking.findById(bookingId).lean();

        const requested = await requestBookingExtension(
            bookingId,
            { requestedEndDate: new Date(booking.endDate.getTime() + 3 * HOUR) },
            customerId
        );
        const extensionId = requested.extensions[0]._id;

        const results = await Promise.allSettled([
            rejectBookingExtension(bookingId, extensionId, adminId, "No"),
            cancelBookingExtension(
                bookingId,
                extensionId,
                customerId,
                "Changed my mind"
            ),
        ]);

        assert.equal(
            results.filter((result) => result.status === "fulfilled").length,
            1
        );

        const [loser] = results.filter(
            (result) => result.status === "rejected"
        );
        assert.equal(loser.reason.statusCode, 409);
    });
});

describe("expireLapsedUnapprovedBookings", () => {
    it("expires paid and unpaid bookings nobody approved before they ended", async () => {
        const ended = { startDate: new Date(Date.now() - 3 * DAY), endDate: new Date(Date.now() - HOUR) };

        const paidId = await insertBooking({
            ...ended,
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
        });
        const pendingId = await insertBooking({ ...ended });
        const upcomingId = await insertBooking({
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
        });

        await expireLapsedUnapprovedBookings();

        const statuses = Object.fromEntries(
            (
                await Booking.find({
                    _id: { $in: [paidId, pendingId, upcomingId] },
                }).lean()
            ).map((booking) => [String(booking._id), booking.status])
        );

        assert.equal(statuses[String(paidId)], BOOKING_STATUS.EXPIRED);
        assert.equal(statuses[String(pendingId)], BOOKING_STATUS.EXPIRED);
        assert.equal(
            statuses[String(upcomingId)],
            BOOKING_STATUS.PAYMENT_RECEIVED
        );

        assert.equal(
            await adminNotifications("booking", paidId),
            1
        );
    });
});

describe("markNoShowBookings", () => {
    it("doesn't penalise a customer whose vehicle was taken out of service", async () => {
        const vehicleId = await insertVehicle({
            status: VEHICLE_STATUS.MAINTENANCE,
        });
        const start = new Date(Date.now() - 2 * DAY);

        const bookingId = await insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.APPROVED,
            startDate: start,
            endDate: new Date(start.getTime() + 3 * DAY),
            statusHistory: [
                {
                    status: BOOKING_STATUS.APPROVED,
                    changedAt: new Date(start.getTime() - DAY),
                },
            ],
        });

        await markNoShowBookings();
        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);

        // Alerted once, not on every sweep.
        assert.equal(
            await adminNotifications("Booking No-Show Skipped", bookingId),
            1
        );
    });

    /*
     * An approved booking whose pickup time (2 days ago) has long passed,
     * plus a previous rental of the same vehicle returned at `returnedAt`.
     */
    const setUpAfterPreviousRental = async (returnedAt, vehicleOverrides) => {
        const vehicleId = await insertVehicle(vehicleOverrides);
        const start = new Date(Date.now() - 2 * DAY);

        await Rental.collection.insertOne({
            _id: new mongoose.Types.ObjectId(),
            rentalCode: `RN-T${vehicleId}`,
            booking: new mongoose.Types.ObjectId(),
            vehicle: vehicleId,
            status: returnedAt ? "Completed" : "Ongoing",
            pickup: { date: new Date(start.getTime() - 3 * DAY) },
            return: { date: returnedAt },
        });

        const bookingId = await insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.APPROVED,
            startDate: start,
            endDate: new Date(start.getTime() + 3 * DAY),
            statusHistory: [
                {
                    status: BOOKING_STATUS.APPROVED,
                    changedAt: new Date(start.getTime() - DAY),
                },
            ],
        });

        return { bookingId, start };
    };

    it("doesn't penalise a customer whose vehicle is still out on the previous rental", async () => {
        const { bookingId } = await setUpAfterPreviousRental(null);

        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);
        assert.equal(
            await adminNotifications("Booking No-Show Skipped", bookingId),
            1
        );
    });

    it("doesn't penalise one whose vehicle came back only after the pickup time", async () => {
        const { bookingId } = await setUpAfterPreviousRental(
            new Date(Date.now() - 2 * DAY + 3 * HOUR)
        );

        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);
    });

    it("still marks a no-show when the vehicle was back in time", async () => {
        const { bookingId } = await setUpAfterPreviousRental(
            new Date(Date.now() - 2 * DAY - 3 * HOUR)
        );

        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.NO_SHOW);
    });

    it("doesn't penalise one whose vehicle has dates blocked during the booking", async () => {
        const start = new Date(Date.now() - 2 * DAY);

        const { bookingId } = await setUpAfterPreviousRental(
            new Date(start.getTime() - 3 * HOUR),
            {
                availability: {
                    bookingEnabled: true,
                    blockedDates: [
                        {
                            startDate: new Date(start.getTime() + DAY),
                            endDate: new Date(start.getTime() + 2 * DAY),
                        },
                    ],
                },
            }
        );

        await markNoShowBookings();

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);
    });
});

describe("markBookingNoShow (admin)", () => {
    const setUpBlocked = async () => {
        const vehicleId = await insertVehicle({
            status: VEHICLE_STATUS.MAINTENANCE,
        });
        const start = new Date(Date.now() - 2 * DAY);

        return insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.APPROVED,
            startDate: start,
            endDate: new Date(start.getTime() + 3 * DAY),
            statusHistory: [
                {
                    status: BOOKING_STATUS.APPROVED,
                    changedAt: new Date(start.getTime() - DAY),
                },
            ],
        });
    };

    it("stops and says why when something on our side blocked the pickup", async () => {
        const bookingId = await setUpBlocked();

        await assert.rejects(
            markBookingNoShow(bookingId, adminId),
            (error) =>
                error.statusCode === 409 &&
                error.errors?.code === "PICKUP_BLOCKED" &&
                /maintenance/.test(error.errors.pickupBlocker)
        );

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.APPROVED);
    });

    it("goes ahead once the admin confirms, and records that they did", async () => {
        const bookingId = await setUpBlocked();

        await markBookingNoShow(bookingId, adminId, {
            ignorePickupBlocker: true,
        });

        const booking = await Booking.findById(bookingId).lean();
        assert.equal(booking.status, BOOKING_STATUS.NO_SHOW);
        assert.match(booking.statusHistory.at(-1).notes, /maintenance/);
    });
});

describe("vehicle availability changes", () => {
    it("refuses to block dates over a booking a customer holds", async () => {
        const vehicleId = await insertVehicle();
        const start = new Date(Date.now() + 5 * DAY);

        await insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.APPROVED,
            startDate: start,
            endDate: new Date(start.getTime() + 2 * DAY),
        });

        await assert.rejects(
            addVehicleBlockedDate(
                vehicleId,
                new Date(start.getTime() + DAY),
                new Date(start.getTime() + 4 * DAY),
                "Owner using it"
            ),
            (error) => error.statusCode === 409 && /BK-T/.test(error.message)
        );

        const vehicle = await Vehicle.findById(vehicleId).lean();
        assert.equal(vehicle.availability.blockedDates.length, 0);
    });

    it("refuses an \"available from\" date later than a booked pickup", async () => {
        const vehicleId = await insertVehicle();
        const start = new Date(Date.now() + 5 * DAY);

        await insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
            startDate: start,
            endDate: new Date(start.getTime() + 2 * DAY),
        });

        await assert.rejects(
            updateVehicleBooking(vehicleId, {
                availableFrom: new Date(start.getTime() + DAY).toISOString(),
            }),
            (error) => error.statusCode === 409
        );
    });
});

describe("claimVoucherUsage", () => {
    it("spends a single-use voucher once, even when claimed twice at once", async () => {
        const voucherId = new mongoose.Types.ObjectId();
        const customerId = new mongoose.Types.ObjectId();

        await Voucher.collection.insertOne({
            _id: voucherId,
            code: `TEST${voucherId}`,
            maxUsagesPerUser: 1,
            usageCount: 0,
            usedBy: [],
        });

        const results = await Promise.all([
            claimVoucherUsage(voucherId, customerId, new mongoose.Types.ObjectId()),
            claimVoucherUsage(voucherId, customerId, new mongoose.Types.ObjectId()),
        ]);

        assert.deepEqual(results.sort(), [false, true]);

        const voucher = await Voucher.findById(voucherId).lean();
        assert.equal(voucher.usedBy.length, 1);
        assert.equal(voucher.usageCount, 1);

        // Another customer still has their own use.
        assert.equal(
            await claimVoucherUsage(
                voucherId,
                new mongoose.Types.ObjectId(),
                new mongoose.Types.ObjectId()
            ),
            true
        );
    });
});

describe("alertAdminsOfStrandedBookings", () => {
    it("lists the vehicle's bookings that haven't been picked up", async () => {
        const vehicleId = await insertVehicle();

        await insertBooking({ vehicle: vehicleId, status: BOOKING_STATUS.APPROVED });
        await insertBooking({ vehicle: vehicleId, status: BOOKING_STATUS.PAYMENT_RECEIVED });
        await insertBooking({ vehicle: vehicleId, status: BOOKING_STATUS.CANCELLED });

        await alertAdminsOfStrandedBookings(vehicleId, "was put under maintenance");

        const [notice] = await Notification.find({
            recipient: adminId,
            type: "Vehicle Out Of Service",
        }).lean();

        assert.ok(notice, "admins must be alerted");
        assert.match(notice.message, /2 booking\(s\)/);
    });

    it("stays quiet when nothing is affected", async () => {
        const vehicleId = await insertVehicle();

        await alertAdminsOfStrandedBookings(vehicleId, "was put under maintenance");

        assert.equal(
            await Notification.countDocuments({ type: "Vehicle Out Of Service" }),
            0
        );
    });
});

describe("archiveVehicle", () => {
    it("refuses while the vehicle still has a live booking", async () => {
        const vehicleId = await insertVehicle({
            archive: { archivedAt: null, archivedBy: null, archiveReason: "" },
        });

        await insertBooking({
            vehicle: vehicleId,
            status: BOOKING_STATUS.APPROVED,
        });

        await assert.rejects(
            archiveVehicle(vehicleId, adminId, "Sold"),
            (error) => error.statusCode === 409
        );

        const vehicle = await Vehicle.findById(vehicleId).lean();
        assert.equal(vehicle.status, VEHICLE_STATUS.AVAILABLE);
    });
});
