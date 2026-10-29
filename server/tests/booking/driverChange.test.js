import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Driver from "../../models/Driver.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
    DRIVER_CHANGE_REQUEST_STATUS,
} from "../../constants/bookingConstants.js";
import {
    DRIVER_AVAILABILITY,
    DRIVER_STATUS,
} from "../../constants/driverConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import {
    approveDriverChangeRequest,
    cancelDriverChangeRequest,
    changeBookingDriver,
    closePendingDriverChangeRequests,
    declineDriverChangeRequest,
    requestDriverChange,
} from "../../services/bookingService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;
let customerId;

const insertVehicle = async () => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.RESERVED,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Toyota",
        model: "Vios",
        vehicleType: "Car",
        pricing: { dailyRate: 2400, reservationFee: 0 },
        availability: { bookingEnabled: true, blockedDates: [] },
    });

    return _id;
};

const insertDriver = async (overrides = {}) => {
    const _id = newId();

    await Driver.collection.insertOne({
        _id,
        driverCode: `RAR-DRV-${_id}`,
        firstName: "Driver",
        lastName: String(_id).slice(-4),
        email: `driver-${_id}@test.local`,
        phoneNumber: "09170000000",
        address: { city: "Legazpi", street: "Secret St." },
        emergencyContact: { name: "Kin", phoneNumber: "0918" },
        uploadedDocuments: { driversLicense: "https://example.test/license.jpg" },
        status: DRIVER_STATUS.ACTIVE,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        license: {
            licenseNumber: `N-${_id}`,
            licenseType: "Professional",
            expiryDate: new Date(Date.now() + 365 * DAY),
        },
        pricing: { dailyRate: null },
        archive: { isArchived: false },
        audit: {},
        ...overrides,
    });

    return _id;
};

/* Approved with-driver booking, pickup in 5 days. */
const insertBooking = async (overrides = {}) => {
    const _id = newId();
    const start = new Date(Date.now() + 5 * DAY);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle: await insertVehicle(),
        driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
        driver: await insertDriver({ firstName: "Original" }),
        startDate: start,
        endDate: new Date(start.getTime() + 2 * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            dailyRate: 2400,
            reservationFee: 0,
            rentalDays: 2,
            subtotal: 4800,
            totalAmount: 6800,
            driverDailyRate: 1000,
            driverFee: 2000,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
        },
        status: BOOKING_STATUS.APPROVED,
        statusHistory: [],
        extensions: [],
        reschedules: [],
        driverChanges: [],
        driverChangeRequests: [],
        audit: {},
        ...overrides,
    });

    return _id;
};

const getBooking = (id) => Booking.findById(id).lean();

const customerNotice = (title) =>
    Notification.findOne({ recipient: customerId, title }).lean();

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Payment, Notification].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [
            Booking,
            Driver,
            Notification,
            Payment,
            Rental,
            Settings,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();
    customerId = newId();

    await User.collection.insertMany([
        { _id: adminId, role: "admin", email: `admin-${adminId}@test.local` },
        {
            _id: customerId,
            role: "customer",
            firstName: "Maria",
            email: `customer-${customerId}@test.local`,
        },
    ]);

    // Global driver pricing at the booking's rate.
    await Settings.collection.insertOne({
        driverPricingSettings: { mode: "global", globalDailyRate: 1000 },
    });
});

describe("admin: change the driver before pickup", () => {
    it("swaps the driver, keeps the price, records it and tells the customer", async () => {
        const bookingId = await insertBooking();
        const before = await getBooking(bookingId);
        const newDriverId = await insertDriver({ firstName: "Replacement" });

        const result = await changeBookingDriver(
            bookingId,
            { driverId: newDriverId, reason: "Original driver is sick" },
            adminId
        );

        const after = await getBooking(bookingId);

        assert.equal(String(after.driver), String(newDriverId));
        assert.deepEqual(after.pricing, before.pricing);
        assert.equal(after.driverChanges.length, 1);
        assert.equal(String(after.driverChanges[0].previousDriver), String(before.driver));
        assert.equal(after.driverChanges[0].reason, "Original driver is sick");

        const notice = await customerNotice("Your Driver Has Changed");
        assert.ok(notice);
        assert.match(notice.message, /Replacement/);
        assert.doesNotMatch(notice.message, /BK-/);

        // Booking responses never carry the driver's private details.
        assert.equal(result.driver.email, undefined);
        assert.equal(result.driver.address?.street, undefined);
        assert.equal(result.driver.license?.licenseNumber, undefined);
        assert.equal(result.driver.uploadedDocuments, undefined);
        assert.equal(result.driver.emergencyContact, undefined);
        assert.equal(result.driver.firstName, "Replacement");
    });

    it("requires a reason", async () => {
        const bookingId = await insertBooking();
        const newDriverId = await insertDriver();

        await assert.rejects(
            changeBookingDriver(bookingId, { driverId: newDriverId, reason: "  " }, adminId),
            /reason/
        );
    });

    it("assigns one to a booking still waiting for its driver", async () => {
        const bookingId = await insertBooking({
            driver: null,
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
        });
        const newDriverId = await insertDriver();

        await changeBookingDriver(
            bookingId,
            { driverId: newDriverId, reason: "Assigning early" },
            adminId
        );

        assert.equal(String((await getBooking(bookingId)).driver), String(newDriverId));
    });

    it("refuses once the trip has started", async () => {
        const bookingId = await insertBooking({ status: BOOKING_STATUS.ONGOING });

        await assert.rejects(
            changeBookingDriver(bookingId, { driverId: await insertDriver(), reason: "x" }, adminId),
            /before the vehicle is picked up/
        );
    });

    it("refuses a driver booked during the trip", async () => {
        const bookingId = await insertBooking();
        const booking = await getBooking(bookingId);
        const busyId = await insertDriver();

        await insertBooking({
            driver: busyId,
            startDate: booking.startDate,
            endDate: booking.endDate,
        });

        await assert.rejects(
            changeBookingDriver(bookingId, { driverId: busyId, reason: "x" }, adminId),
            /already booked/
        );
    });

    it("refuses a driver whose licence won't last the trip", async () => {
        const bookingId = await insertBooking();
        const booking = await getBooking(bookingId);
        const driverId = await insertDriver({
            license: {
                licenseNumber: "N-SOON",
                licenseType: "Professional",
                expiryDate: new Date(new Date(booking.endDate).getTime() - HOUR),
            },
        });

        await assert.rejects(
            changeBookingDriver(bookingId, { driverId, reason: "x" }, adminId),
            /license expires before this trip ends/
        );
    });

    it("answers the customer's pending request too", async () => {
        const bookingId = await insertBooking();

        await requestDriverChange(bookingId, { reason: "Prefer someone else" }, customerId);

        await changeBookingDriver(
            bookingId,
            { driverId: await insertDriver(), reason: "Done on a call" },
            adminId
        );

        const [request] = (await getBooking(bookingId)).driverChangeRequests;
        assert.equal(request.status, DRIVER_CHANGE_REQUEST_STATUS.APPROVED);
    });
});

describe("customer: ask for a different driver", () => {
    it("sends a request that an admin approves with the preferred driver", async () => {
        const bookingId = await insertBooking();
        const preferredId = await insertDriver({ firstName: "Preferred" });

        await requestDriverChange(
            bookingId,
            { reason: "Language", preferredDriverId: preferredId },
            customerId
        );

        const [pending] = (await getBooking(bookingId)).driverChangeRequests;
        assert.equal(pending.status, DRIVER_CHANGE_REQUEST_STATUS.PENDING);

        await approveDriverChangeRequest(bookingId, pending._id, {}, adminId);

        const after = await getBooking(bookingId);
        assert.equal(String(after.driver), String(preferredId));
        assert.equal(after.driverChangeRequests[0].status, DRIVER_CHANGE_REQUEST_STATUS.APPROVED);
        assert.ok(await customerNotice("Driver Change Approved"));
    });

    it("lets the admin decline, keeping the current driver", async () => {
        const bookingId = await insertBooking();
        const before = await getBooking(bookingId);

        await requestDriverChange(bookingId, { reason: "Just curious" }, customerId);
        const [pending] = (await getBooking(bookingId)).driverChangeRequests;

        await declineDriverChangeRequest(bookingId, pending._id, { note: "No one else free" }, adminId);

        const after = await getBooking(bookingId);
        assert.equal(String(after.driver), String(before.driver));
        assert.equal(after.driverChangeRequests[0].status, DRIVER_CHANGE_REQUEST_STATUS.DECLINED);

        const notice = await customerNotice("Driver Change Declined");
        assert.match(notice.message, /No one else free/);
    });

    it("lets the customer withdraw it", async () => {
        const bookingId = await insertBooking();

        await requestDriverChange(bookingId, { reason: "Changed my mind" }, customerId);
        const [pending] = (await getBooking(bookingId)).driverChangeRequests;

        await cancelDriverChangeRequest(bookingId, pending._id, customerId);

        assert.equal(
            (await getBooking(bookingId)).driverChangeRequests[0].status,
            DRIVER_CHANGE_REQUEST_STATUS.CANCELLED
        );
    });

    it("allows only one pending request", async () => {
        const bookingId = await insertBooking();

        await requestDriverChange(bookingId, { reason: "First" }, customerId);

        await assert.rejects(
            requestDriverChange(bookingId, { reason: "Second" }, customerId),
            /already asked/
        );
    });

    it("needs 24 hours' notice", async () => {
        const start = new Date(Date.now() + 10 * HOUR);
        const bookingId = await insertBooking({
            startDate: start,
            endDate: new Date(start.getTime() + DAY),
        });

        await assert.rejects(
            requestDriverChange(bookingId, { reason: "Late" }, customerId),
            /at least 24 hours before pickup/
        );
    });

    it("refuses a preferred driver who costs more than the quoted rate", async () => {
        await Settings.collection.updateOne(
            {},
            { $set: { "driverPricingSettings.mode": "individual" } }
        );

        const bookingId = await insertBooking();
        const pricierId = await insertDriver({ pricing: { dailyRate: 1500 } });

        await assert.rejects(
            requestDriverChange(
                bookingId,
                { reason: "Prefer them", preferredDriverId: pricierId },
                customerId
            ),
            /costs more per day/
        );
    });

    it("doesn't let customers pick a driver while admins assign them", async () => {
        await Settings.collection.updateOne(
            {},
            { $set: { "driverAssignmentSettings.requireAdminDriverAssignment": true } }
        );

        const bookingId = await insertBooking();

        await assert.rejects(
            requestDriverChange(
                bookingId,
                { reason: "x", preferredDriverId: await insertDriver() },
                customerId
            ),
            /Our team assigns drivers/
        );
    });

    it("refuses someone else's booking", async () => {
        const bookingId = await insertBooking();

        await assert.rejects(
            requestDriverChange(bookingId, { reason: "x" }, newId()),
            (error) => error.statusCode === 403
        );
    });

    it("is closed when the booking ends", async () => {
        const bookingId = await insertBooking();

        await requestDriverChange(bookingId, { reason: "x" }, customerId);
        await closePendingDriverChangeRequests({ _id: bookingId }, adminId, "Picked up.");

        const [request] = (await getBooking(bookingId)).driverChangeRequests;
        assert.equal(request.status, DRIVER_CHANGE_REQUEST_STATUS.CANCELLED);
        assert.equal(request.resolutionNote, "Picked up.");
    });
});
