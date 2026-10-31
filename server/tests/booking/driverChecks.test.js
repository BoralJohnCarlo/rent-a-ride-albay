import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";
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
import Voucher from "../../models/Voucher.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_STATUS,
} from "../../constants/bookingConstants.js";
import {
    DRIVER_AVAILABILITY,
    DRIVER_STATUS,
} from "../../constants/driverConstants.js";
import { RENTAL_STATUS } from "../../constants/rentalConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import {
    approveBooking,
    cancelBooking,
    createBooking,
    updateBooking,
    requestBookingExtension,
    approveBookingExtension,
    changeBookingDriver,
    requestBookingReschedule,
    approveBookingReschedule,
    previewBookingReschedule,
    changeVehicleForMaintenanceConflict,
} from "../../services/bookingService.js";
import {
    archiveDriver,
    getAvailableDrivers,
    getDrivers,
} from "../../services/driverService.js";
import { reassignDriver } from "../../services/rentalService.js";
import { areDriversOfferedForVehicle } from "../../services/driverPricingService.js";
import { createPaymongoCheckout, cancelPayment, verifyPayment, verifyPaymentByCheckoutSession } from "../../services/paymentService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

/* 10:00 AM Manila (02:00 UTC), `days` from today — inside pickup hours. */
const manilaMorning = (days) => {
    const date = new Date(Date.now() + days * DAY);
    date.setUTCHours(2, 0, 0, 0);
    return date;
};

/*
 * Schemas require full listings the logic under test never reads, so
 * documents are inserted directly with just the fields the services query.
 */
const insertVehicle = async (overrides = {}) => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.AVAILABLE,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Toyota",
        model: "Vios",
        vehicleType: "Car",
        pricing: { dailyRate: 2400, reservationFee: 0 },
        availability: { bookingEnabled: true, blockedDates: [] },
        ...overrides,
    });

    return _id;
};

const insertDriver = async (overrides = {}) => {
    const _id = newId();

    await Driver.collection.insertOne({
        _id,
        driverCode: `RAR-DRV-${_id}`,
        firstName: "Test",
        lastName: "Driver",
        email: `driver-${_id}@test.local`,
        phoneNumber: "09170000000",
        status: DRIVER_STATUS.ACTIVE,
        availability: DRIVER_AVAILABILITY.AVAILABLE,
        license: {
            licenseNumber: `N-${_id}`,
            licenseType: "Professional",
            expiryDate: new Date(Date.now() + 365 * DAY),
            restrictionCodes: ["B"],
        },
        archive: { isArchived: false },
        audit: {},
        ...overrides,
    });

    return _id;
};

const insertBooking = async (overrides = {}) => {
    const _id = newId();
    const start = new Date(Date.now() + 3 * DAY);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle: newId(),
        driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
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
            driverDailyRate: 0,
            driverFee: 0,
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

const insertOngoingRental = async ({ bookingId, driverId, dueBackAt }) => {
    const _id = newId();
    const start = new Date(Date.now() - DAY);

    await Rental.collection.insertOne({
        _id,
        rentalCode: `RN-T${_id}`,
        booking: bookingId,
        customer: customerId,
        vehicle: newId(),
        driver: driverId,
        status: RENTAL_STATUS.ONGOING,
        bookingPeriod: {
            originalStartDate: start,
            originalEndDate: dueBackAt,
            actualStartDate: start,
        },
        actualEndDate: dueBackAt,
        pickup: { date: start },
        return: { date: null },
        extensions: [],
        driverReassignments: [],
        operationalEvents: [],
        audit: {},
    });

    return _id;
};

const setAdminAssignment = (on) =>
    Settings.collection.updateOne(
        {},
        {
            $set: {
                "driverAssignmentSettings.requireAdminDriverAssignment": on,
            },
        },
        { upsert: true }
    );

let adminId;
let customerId;

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Payment, Notification].map((model) => model.init())
    );
});

after(disconnectTestDb);
afterEach(() => mock.restoreAll());

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
            Voucher,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();
    customerId = newId();

    await User.collection.insertMany([
        {
            _id: adminId,
            role: "admin",
            email: `admin-${adminId}@test.local`,
        },
        {
            _id: customerId,
            role: "customer",
            firstName: "Maria",
            lastName: "Santos",
            email: `customer-${customerId}@test.local`,
            isVerified: true,
        },
    ]);
});

describe("booking creation transactions", () => {
    let otherCustomerId;
    const book = (vehicle, customer = customerId, extra = {}) => {
        const start = manilaMorning(5);
        const location = {
            type: "Custom", address: "Legazpi City",
            latitude: 13.1391, longitude: 123.7438,
        };
        return createBooking({
            vehicle,
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            startDate: start.toISOString(),
            endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
            pickupLocation: location, returnLocation: location,
            paymentMethod: "GCASH",
            ...extra,
        }, customer);
    };

    // Force both requests past the preflight limit check before either can
    // save. Only checks using the transaction's session may decide the winner.
    const synchronizePreflight = (method = "countDocuments", predicate = () => true) => {
        const original = Booking[method];
        let arrivals = 0;
        let release;
        const ready = new Promise((resolve) => { release = resolve; });
        mock.method(Booking, method, function (...args) {
            const query = original.apply(this, args);
            const exec = query.exec.bind(query);
            query.exec = async () => {
                const count = await exec();
                if (!query.getOptions().session && predicate(query)) {
                    if (++arrivals === 2) release();
                    await ready;
                }
                return count;
            };
            return query;
        });
    };

    const assertOneWinner = (results, pattern) => {
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        const rejected = results.find((r) => r.status === "rejected");
        assert.match(rejected.reason.message, pattern);
    };

    beforeEach(async () => {
        otherCustomerId = newId();
        await User.collection.insertOne({
            _id: otherCustomerId, role: "customer", isVerified: true,
            email: `other-${otherCustomerId}@test.local`,
        });
        await Settings.create({
            driverAssignmentSettings: { requireAdminDriverAssignment: true },
            customerBookingSettings: { maxConcurrentBookings: 10 },
        });
    });

    it("keeps one simultaneous booking and payment for the same vehicle", async () => {
        const vehicle = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        synchronizePreflight();
        const results = await Promise.allSettled([
            book(vehicle), book(vehicle, otherCustomerId),
        ]);
        assertOneWinner(results, /already booked/);
        assert.equal(await Booking.countDocuments({}), 1);
        assert.equal(await Payment.countDocuments({}), 1);
    });

    it("keeps one booking when different vehicles request the same driver", async () => {
        await setAdminAssignment(false);
        const driver = await insertDriver();
        const first = await insertVehicle();
        const second = await insertVehicle();
        synchronizePreflight();
        const results = await Promise.allSettled([
            book(first, customerId, { driver }),
            book(second, otherCustomerId, { driver }),
        ]);
        assertOneWinner(results, /driver.*already booked/i);
        assert.equal(await Booking.countDocuments({}), 1);
    });

    it("enforces the customer limit across simultaneous bookings of different vehicles", async () => {
        await Settings.updateOne({}, { $set: { "customerBookingSettings.maxConcurrentBookings": 1 } });
        const first = await insertVehicle();
        const second = await insertVehicle();
        synchronizePreflight();
        const results = await Promise.allSettled([book(first), book(second)]);
        assertOneWinner(results, /maximum allowed/);
        assert.equal(await Booking.countDocuments({ customer: customerId }), 1);
    });

    it("rolls back booking and voucher usage if saving the payment fails, then allows retry", async () => {
        const vehicle = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        const voucher = await Voucher.create({
            code: `ROLLBACK${newId()}`, name: "Rollback test",
            type: "reservation_fee", discountMethod: "fixed", discountValue: 100,
            startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 30 * DAY),
        });
        const failure = mock.method(Payment, "create", async () => {
            throw new Error("Payment storage unavailable");
        });
        await assert.rejects(book(vehicle, customerId, { voucherCode: voucher.code }), /Payment storage unavailable/);
        assert.equal(await Booking.countDocuments({}), 0);
        assert.equal(await Payment.countDocuments({}), 0);
        const unused = await Voucher.findById(voucher._id).lean();
        assert.equal(unused.usageCount, 0);
        assert.equal(unused.usedBy.length, 0);

        failure.mock.restore();
        const saved = await book(vehicle, customerId, { voucherCode: voucher.code, payInFull: true });
        const payment = await Payment.findOne({ booking: saved._id }).lean();
        assert.equal(payment.amount, saved.pricing.totalAmount);
        assert.equal((await Voucher.findById(voucher._id)).usageCount, 1);
    });

    it("creates a booking without a payment when no upfront fees are due", async () => {
        const vehicle = await insertVehicle();
        const saved = await book(vehicle);
        assert.ok(saved._id);
        assert.equal(await Payment.countDocuments({ booking: saved._id }), 0);
    });

    it("allows independent customers to book different vehicles concurrently", async () => {
        const first = await insertVehicle();
        const second = await insertVehicle();
        synchronizePreflight();
        const results = await Promise.all([
            book(first), book(second, otherCustomerId),
        ]);
        assert.equal(results.length, 2);
        assert.equal(await Booking.countDocuments({}), 2);
    });

    const laterDates = () => {
        const start = manilaMorning(10);
        return {
            startDate: start.toISOString(),
            endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
        };
    };

    it("prevents two edits from moving onto the same vehicle and dates", async () => {
        const first = await book(await insertVehicle());
        const second = await book(await insertVehicle(), otherCustomerId);
        const target = await insertVehicle();
        const changes = { vehicle: target, ...laterDates() };
        synchronizePreflight();
        const results = await Promise.allSettled([
            updateBooking(first._id, changes, customerId),
            updateBooking(second._id, changes, otherCustomerId),
        ]);
        assertOneWinner(results, /already booked/);
        assert.equal(await Booking.countDocuments({ vehicle: target }), 1);
    });

    it("prevents a booking edit racing a new booking onto the same slot", async () => {
        const existing = await book(await insertVehicle());
        const target = await insertVehicle();
        const dates = laterDates();
        synchronizePreflight();
        const results = await Promise.allSettled([
            updateBooking(existing._id, { vehicle: target, ...dates }, customerId),
            book(target, otherCustomerId, dates),
        ]);
        assertOneWinner(results, /already booked/);
        assert.equal(await Booking.countDocuments({ vehicle: target }), 1);
    });

    it("prevents two approvals from assigning one driver to overlapping bookings", async () => {
        const first = await book(await insertVehicle());
        const second = await book(await insertVehicle(), otherCustomerId);
        const driver = await insertDriver();
        synchronizePreflight("findById");
        const results = await Promise.allSettled([
            approveBooking(first._id, adminId, driver),
            approveBooking(second._id, adminId, driver),
        ]);
        assertOneWinner(results, /driver.*already booked/i);
        assert.equal(await Booking.countDocuments({ driver, status: BOOKING_STATUS.APPROVED }), 1);
    });

    it("closes the old checkout and cancels its payment when an edit removes the upfront fee", async (t) => {
        const oldVehicle = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        const booking = await book(oldVehicle);
        await Payment.updateOne({ booking: booking._id }, { $set: {
            "paymongo.checkoutSessionId": "cs_zero_fee_test",
        } });
        const previousKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_stubbed";
        t.after(() => {
            if (previousKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = previousKey;
        });
        const request = mock.method(globalThis, "fetch", async (url) => {
            assert.match(String(url), /checkout_sessions\/cs_zero_fee_test\/expire$/);
            return { ok: true, json: async () => ({ data: { id: "cs_zero_fee_test", attributes: { status: "expired" } } }) };
        });
        const saved = await updateBooking(booking._id, { vehicle: await insertVehicle() }, customerId);
        const payment = await Payment.findOne({ booking: booking._id }).lean();
        assert.equal(request.mock.callCount(), 1);
        assert.equal(payment.amount, 0);
        assert.equal(payment.status, "CANCELLED");
        assert.equal(saved.paymentAmount, 0);
        assert.equal(saved.pricing.reservationFee, 0);
    });

    it("rolls back payment repricing when saving a booking edit fails", async () => {
        const originalVehicle = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        const booking = await book(originalVehicle);
        const target = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 700 } });
        mock.method(Booking, "findOneAndUpdate", async () => { throw new Error("Booking storage unavailable"); });
        await assert.rejects(updateBooking(booking._id, { vehicle: target }, customerId), /Booking storage unavailable/);
        assert.equal((await Payment.findOne({ booking: booking._id })).amount, 500);
        assert.equal(String((await Booking.findById(booking._id)).vehicle), String(originalVehicle));
    });

    it("refuses a stale checkout that finishes opening after an edit removes the fee", async (t) => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }));
        const payment = await Payment.findOne({ booking: booking._id });
        const target = await insertVehicle();
        const previousKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_stubbed";
        t.after(() => {
            if (previousKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = previousKey;
        });
        const request = mock.method(globalThis, "fetch", async (url) => {
            if (String(url).endsWith("/checkout_sessions")) {
                await updateBooking(booking._id, { vehicle: target }, customerId);
                return { ok: true, json: async () => ({ data: {
                    id: "cs_stale_edit", attributes: { checkout_url: "https://checkout.example.test/stale" },
                } }) };
            }
            assert.match(String(url), /checkout_sessions\/cs_stale_edit\/expire$/);
            return { ok: true, json: async () => ({ data: { id: "cs_stale_edit", attributes: { status: "expired" } } }) };
        });
        await assert.rejects(createPaymongoCheckout(payment._id, customerId, "https://example.test"), /payment changed/);
        assert.equal(request.mock.callCount(), 2);
        const saved = await Payment.findById(payment._id);
        assert.equal(saved.status, "CANCELLED");
        assert.equal(saved.amount, 0);
        assert.ok(!saved.paymongo?.checkoutSessionId);
    });

    it("applies booking-hours notice to edited pickup dates", async () => {
        const booking = await book(await insertVehicle());
        await Settings.updateOne({}, { $set: {
            "bookingSettings.bookingHours": { enabled: true, openTime: "08:00", closeTime: "20:00" },
        } });
        mock.method(Date, "now", () => Date.parse("2030-11-01T23:00:00+08:00"));
        await assert.rejects(updateBooking(booking._id, {
            startDate: "2030-11-02T08:00:00+08:00", endDate: "2030-11-03T08:00:00+08:00",
        }, customerId), /earliest pickup/);
        const saved = await updateBooking(booking._id, {
            startDate: "2030-11-02T10:00:00+08:00", endDate: "2030-11-03T10:00:00+08:00",
        }, customerId);
        assert.equal(new Date(saved.startDate).toISOString(), "2030-11-02T02:00:00.000Z");
    });

    it("creates a payable reservation when an edit adds the first upfront fee", async () => {
        const booking = await book(await insertVehicle());
        assert.equal(await Payment.countDocuments({ booking: booking._id }), 0);
        const target = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        const saved = await updateBooking(booking._id, { vehicle: target }, customerId);
        const payment = await Payment.findOne({ booking: booking._id }).lean();
        assert.equal(payment.amount, 500);
        assert.equal(payment.status, "PENDING");
        assert.equal(payment.paymentMethod, "GCASH");
        assert.equal(String(saved.paymentId), String(payment._id));
        assert.equal(saved.paymentAmount, 500);
    });

    it("rolls back the edit if creating its first payment fails", async () => {
        const originalVehicle = await insertVehicle();
        const booking = await book(originalVehicle);
        const target = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        mock.method(Payment, "create", async () => { throw new Error("Payment storage unavailable"); });
        await assert.rejects(updateBooking(booking._id, { vehicle: target }, customerId), /Payment storage unavailable/);
        assert.equal(String((await Booking.findById(booking._id)).vehicle), String(originalVehicle));
        assert.equal(await Payment.countDocuments({ booking: booking._id }), 0);
    });

    it("prevents simultaneous driver replacements from claiming the same driver", async () => {
        const first = await book(await insertVehicle());
        const second = await book(await insertVehicle(), otherCustomerId);
        const driver = await insertDriver();
        synchronizePreflight("findById");
        const results = await Promise.allSettled([
            changeBookingDriver(first._id, { driverId: driver, reason: "Assign driver" }, adminId),
            changeBookingDriver(second._id, { driverId: driver, reason: "Assign driver" }, adminId),
        ]);
        assertOneWinner(results, /driver.*already booked/i);
        assert.equal(await Booking.countDocuments({ driver }), 1);
    });

    it("prevents reschedule approvals from moving two bookings onto the same dates", async () => {
        const vehicle = await insertVehicle();
        const first = await book(vehicle);
        const second = await book(vehicle, otherCustomerId, laterDates());
        const start = manilaMorning(15);
        const dates = { startDate: start.toISOString(), endDate: new Date(start.getTime() + 2 * DAY).toISOString() };
        const firstRequest = await requestBookingReschedule(first._id, dates, customerId, "customer");
        const secondRequest = await requestBookingReschedule(second._id, dates, otherCustomerId, "customer");
        synchronizePreflight("findById");
        const results = await Promise.allSettled([
            approveBookingReschedule(first._id, firstRequest.reschedules[0]._id, adminId),
            approveBookingReschedule(second._id, secondRequest.reschedules[0]._id, adminId),
        ]);
        assertOneWinner(results, /already booked/);
        assert.equal(await Booking.countDocuments({ vehicle, startDate: start }), 1);
    });

    it("protects an extension approval racing a new booking for the extra days", async () => {
        const vehicle = await insertVehicle();
        const booking = await book(vehicle);
        await approveBooking(booking._id, adminId, await insertDriver());
        const requestedEndDate = new Date(manilaMorning(10).getTime() + 2 * DAY);
        const requested = await requestBookingExtension(booking._id, { requestedEndDate }, customerId);
        synchronizePreflight("findOne", (query) => Boolean(query.getFilter().vehicle && query.getFilter().startDate?.$lt));
        const results = await Promise.allSettled([
            approveBookingExtension(booking._id, requested.extensions[0]._id, adminId),
            book(vehicle, otherCustomerId, laterDates()),
        ]);
        assertOneWinner(results, /already booked/);
        const saved = await Booking.findById(booking._id).lean();
        const extensionWon = saved.endDate.getTime() === requestedEndDate.getTime();
        assert.equal(await Payment.countDocuments({ booking: booking._id, paymentType: "EXTENSION_FEE" }), extensionWon ? 1 : 0);
        assert.equal(await Booking.countDocuments({ vehicle }), extensionWon ? 1 : 2);
    });

    it("lets only one conflict resolution claim a replacement vehicle without creating an unnecessary payment", async () => {
        const first = await book(await insertVehicle());
        const second = await book(await insertVehicle(), otherCustomerId);
        await Booking.updateMany({ _id: { $in: [first._id, second._id] } }, { $set: {
            maintenanceConflict: { status: BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER },
        } });
        const target = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
        synchronizePreflight("findById");
        const results = await Promise.allSettled([
            changeVehicleForMaintenanceConflict(first._id, target, adminId, "admin"),
            changeVehicleForMaintenanceConflict(second._id, target, adminId, "admin"),
        ]);
        assertOneWinner(results, /already booked/);
        assert.equal(await Booking.countDocuments({ vehicle: target }), 1);
        // A forced vehicle move retains the booking's original zero deposit.
        assert.equal(await Payment.countDocuments({}), 0);
    });

    const reschedule = async (booking, dates) => {
        return requestBookingReschedule(booking._id, dates, adminId, "admin");
    };

    for (const status of ["PENDING", "CANCELLED"]) {
        it(`reduces an unpaid full ${status.toLowerCase()} payment after a cheaper reschedule`, async () => {
            const vehicle = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
            const booking = await book(vehicle, customerId, { payInFull: true });
            await Payment.updateOne({ booking: booking._id }, { $set: { status } });
            const start = manilaMorning(10);
            if (status === "PENDING") {
                await assert.rejects(reschedule(booking, {
                    startDate: start.toISOString(), endDate: new Date(start.getTime() + DAY).toISOString(),
                }), /Pay the reservation fee/);
                assert.equal((await Payment.findOne({ booking: booking._id })).amount, 5300);
                return;
            }
            const saved = await reschedule(booking, {
                startDate: start.toISOString(), endDate: new Date(start.getTime() + DAY).toISOString(),
            });
            const payments = await Payment.find({ booking: booking._id }).lean();
            assert.equal(saved.pricing.totalAmount, 2900);
            assert.equal(payments.length, 1);
            assert.equal(payments[0].amount, 2900);
            assert.equal(payments[0].status, status);
            assert.equal(saved.reschedules.at(-1).settlement.kind, "none");
        });
    }

    it("expires an old full-payment checkout before saving the cheaper reschedule", async (t) => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }), customerId, { payInFull: true });
        await Payment.updateOne({ booking: booking._id }, { $set: { status: "CANCELLED", "paymongo.checkoutSessionId": "cs_reschedule_old" } });
        const previousKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_stubbed";
        t.after(() => {
            if (previousKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = previousKey;
        });
        const request = mock.method(globalThis, "fetch", async (url, options) => {
            if (String(url).endsWith("/checkout_sessions")) {
                assert.equal(JSON.parse(options.body).data.attributes.line_items[0].amount, 290000);
                return { ok: true, json: async () => ({ data: {
                    id: "cs_reschedule_new", attributes: { checkout_url: "https://checkout.example.test/new" },
                } }) };
            }
            assert.match(String(url), /checkout_sessions\/cs_reschedule_old\/expire$/);
            return { ok: true, json: async () => ({ data: { id: "cs_reschedule_old", attributes: { status: "expired" } } }) };
        });
        const start = manilaMorning(10);
        await reschedule(booking, { startDate: start.toISOString(), endDate: new Date(start.getTime() + DAY).toISOString() });
        const payment = await Payment.findOne({ booking: booking._id });
        assert.equal(request.mock.callCount(), 1);
        assert.equal(payment.amount, 2900);
        assert.ok(!payment.paymongo?.checkoutSessionId);
        const checkout = await createPaymongoCheckout(payment._id, customerId, "https://example.test");
        assert.equal(checkout.checkoutSessionId, "cs_reschedule_new");
        assert.equal(request.mock.callCount(), 2);
    });

    it("resizes an unpaid full payment upwards without charging the difference twice", async () => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }), customerId, { payInFull: true });
        await Payment.updateOne({ booking: booking._id }, { $set: { status: "CANCELLED" } });
        const start = manilaMorning(10);
        const dates = { startDate: start.toISOString(), endDate: new Date(start.getTime() + 3 * DAY).toISOString() };
        const preview = await previewBookingReschedule(booking._id, dates, adminId, "admin");
        const saved = await reschedule(booking, dates);
        assert.equal(preview.settlement.amount, 0);
        assert.equal(saved.pricing.totalAmount, 7700);
        assert.equal((await Payment.findOne({ booking: booking._id })).amount, 7700);
        assert.equal(await Payment.countDocuments({ booking: booking._id }), 1);
    });

    it("rolls back a reschedule payment resize if saving the approved dates fails", async () => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }), customerId, { payInFull: true });
        await Payment.updateOne({ booking: booking._id }, { $set: { status: "CANCELLED" } });
        const start = manilaMorning(10);
        mock.method(Booking, "findOneAndUpdate", async () => { throw new Error("Reschedule storage unavailable"); });
        await assert.rejects(reschedule(booking, {
            startDate: start.toISOString(), endDate: new Date(start.getTime() + DAY).toISOString(),
        }), /Reschedule storage unavailable/);
        assert.equal((await Payment.findOne({ booking: booking._id })).amount, 5300);
        assert.equal((await Booking.findById(booking._id)).startDate.getTime(), new Date(booking.startDate).getTime());
    });

    it("keeps verified full payments intact and refunds a cheaper reschedule", async () => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }), customerId, { payInFull: true });
        await Payment.updateOne({ booking: booking._id }, { $set: { status: "VERIFIED" } });
        const start = manilaMorning(10);
        await reschedule(booking, { startDate: start.toISOString(), endDate: new Date(start.getTime() + DAY).toISOString() });
        const payment = await Payment.findOne({ booking: booking._id });
        assert.equal(payment.amount, 5300);
        assert.equal(payment.status, "VERIFIED");
        assert.equal(payment.refund.amount, 2400);
    });

    it("checks a self-drive customer's license at reschedule preview, request and approval", async () => {
        const booking = await book(await insertVehicle(), customerId, { driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER });
        const dates = laterDates();
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(8) } });
        await assert.rejects(previewBookingReschedule(booking._id, dates, customerId, "customer"), /before this rental ends/);
        await assert.rejects(requestBookingReschedule(booking._id, dates, customerId, "customer"), /before this rental ends/);
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(20) } });
        const requested = await requestBookingReschedule(booking._id, dates, customerId, "customer");
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(8) } });
        await assert.rejects(approveBookingReschedule(booking._id, requested.reschedules[0]._id, adminId), /before this rental ends/);
    });

    it("checks self-drive license coverage when requesting and approving an extension", async () => {
        const booking = await book(await insertVehicle(), customerId, { driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER });
        await approveBooking(booking._id, adminId);
        const requestedEndDate = manilaMorning(10);
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(8) } });
        await assert.rejects(requestBookingExtension(booking._id, { requestedEndDate }, customerId), /before this rental ends/);
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(20) } });
        const requested = await requestBookingExtension(booking._id, { requestedEndDate }, customerId);
        await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(8) } });
        await assert.rejects(approveBookingExtension(booking._id, requested.extensions[0]._id, adminId), /before this rental ends/);
        assert.equal((await Booking.findById(booking._id)).endDate.getTime(), new Date(booking.endDate).getTime());
    });

    for (const driverOption of [BOOKING_DRIVER_OPTIONS.WITH_DRIVER, BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER]) {
        it(`preserves license policy exceptions for ${driverOption.toLowerCase()} reschedules`, async () => {
            if (driverOption === BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER) {
                await Settings.updateOne({}, { $set: { "customerBookingSettings.licenseRestrictionEnabled": false } });
            }
            const booking = await book(await insertVehicle(), customerId, { driverOption });
            await User.updateOne({ _id: customerId }, { $set: { licenseExpirationDate: manilaMorning(8) } });
            const saved = await reschedule(booking, laterDates());
            assert.equal(new Date(saved.startDate).getTime(), manilaMorning(10).getTime());
        });
    }

    it("applies booking-hours lead time to reschedule previews and admin approvals", async () => {
        const booking = await book(await insertVehicle());
        const dates = { startDate: "2030-11-02T08:00:00+08:00", endDate: "2030-11-03T08:00:00+08:00" };
        const requested = await requestBookingReschedule(booking._id, dates, customerId, "customer");
        await Settings.updateOne({}, { $set: { "bookingSettings.bookingHours": { enabled: true, openTime: "08:00", closeTime: "20:00" } } });
        mock.method(Date, "now", () => Date.parse("2030-11-01T23:00:00+08:00"));
        await assert.rejects(previewBookingReschedule(booking._id, dates, adminId, "admin"), /earliest pickup/);
        await assert.rejects(approveBookingReschedule(booking._id, requested.reschedules[0]._id, adminId), /earliest pickup/);
        const preview = await previewBookingReschedule(booking._id, {
            startDate: "2030-11-02T10:00:00+08:00", endDate: "2030-11-03T10:00:00+08:00",
        }, adminId, "admin");
        assert.equal(new Date(preview.startDate).toISOString(), "2030-11-02T02:00:00.000Z");
    });

    const stubRefundGateway = (t) => {
        const previousKey = process.env.PAYMONGO_SECRET_KEY;
        process.env.PAYMONGO_SECRET_KEY = "sk_test_stubbed";
        t.after(() => {
            if (previousKey === undefined) delete process.env.PAYMONGO_SECRET_KEY;
            else process.env.PAYMONGO_SECRET_KEY = previousKey;
        });
        let refunds = 0;
        mock.method(globalThis, "fetch", async (url, options) => {
            if (String(url).endsWith("/expire")) {
                return { ok: true, json: async () => ({ data: { id: "cs_confirmation_race", attributes: { status: "expired" } } }) };
            }
            assert.ok(String(url).endsWith("/refunds"));
            assert.equal(JSON.parse(options.body).data.attributes.amount, 50000);
            refunds++;
            return { ok: true, json: async () => ({ data: { id: "ref_confirmation_race", attributes: { status: "succeeded" } } }) };
        });
        return () => refunds;
    };

    const bookingWithCheckout = async () => {
        const booking = await book(await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } }));
        await Payment.updateOne({ booking: booking._id }, { $set: { "paymongo.checkoutSessionId": "cs_confirmation_race" } });
        return booking;
    };

    it("refunds once when cancellation finishes after confirmation reads the live booking", async (t) => {
        const refundCount = stubRefundGateway(t);
        const booking = await bookingWithCheckout();
        const original = Booking.findById;
        let cancelled = false;
        mock.method(Booking, "findById", function (...args) {
            const query = original.apply(this, args);
            const exec = query.exec.bind(query);
            query.exec = async () => {
                const result = await exec();
                if (!cancelled && query.getOptions().session && String(args[0]) === String(booking._id)) {
                    cancelled = true;
                    await cancelBooking(booking._id, adminId, "Cancelled during confirmation", "admin");
                }
                return result;
            };
            return query;
        });
        await verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test");
        const payment = await Payment.findOne({ booking: booking._id });
        assert.equal((await Booking.findById(booking._id)).status, BOOKING_STATUS.CANCELLED);
        assert.equal(payment.refund.amount, 500);
        assert.equal(payment.refund.status, "succeeded");
        assert.equal(refundCount(), 1);
        await verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test");
        assert.equal(refundCount(), 1);
    });

    it("refunds normally when confirmation commits before cancellation", async (t) => {
        const refundCount = stubRefundGateway(t);
        const booking = await bookingWithCheckout();
        await verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test");
        assert.equal((await Booking.findById(booking._id)).status, BOOKING_STATUS.PAYMENT_RECEIVED);
        await cancelBooking(booking._id, adminId, "Admin cancellation", "admin");
        assert.equal((await Payment.findOne({ booking: booking._id })).refund.amount, 500);
        assert.equal(refundCount(), 1);
    });

    it("rolls back verification if updating the booking fails", async () => {
        const booking = await bookingWithCheckout();
        mock.method(Booking, "findOneAndUpdate", async () => { throw new Error("Booking storage unavailable"); });
        await assert.rejects(verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test"), /Booking storage unavailable/);
        assert.equal((await Payment.findOne({ booking: booking._id })).status, "PENDING");
        assert.equal((await Booking.findById(booking._id)).status, BOOKING_STATUS.PENDING);
    });

    it("handles concurrent confirmation calls without duplicating payment notices", async () => {
        const booking = await bookingWithCheckout();
        await Promise.all([
            verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test"),
            verifyPaymentByCheckoutSession("cs_confirmation_race", "intent_test", "pay_test"),
        ]);
        assert.equal((await Payment.findOne({ booking: booking._id })).status, "VERIFIED");
        assert.equal((await Booking.findById(booking._id)).status, BOOKING_STATUS.PAYMENT_RECEIVED);
        assert.equal(await Notification.countDocuments({ recipient: adminId, title: "Booking Payment Received" }), 1);
    });

    it("does not allow cancelling an already refunded payment attempt", async () => {
        const booking = await bookingWithCheckout();
        const payment = await Payment.findOneAndUpdate({ booking: booking._id }, { $set: { status: "REFUNDED" } }, { new: true });
        await assert.rejects(cancelPayment(payment._id, customerId), /cannot be cancelled/);
        assert.equal((await Payment.findById(payment._id)).status, "REFUNDED");
    });

    it("does not overwrite verification when cancelling a payment attempt races it", async () => {
        const booking = await bookingWithCheckout();
        const payment = await Payment.findOne({ booking: booking._id });
        const find = Payment.findById;
        let verified = false;
        mock.method(Payment, "findById", function (...args) {
            const query = find.apply(this, args);
            const exec = query.exec.bind(query);
            query.exec = async () => {
                const result = await exec();
                if (!verified && String(args[0]) === String(payment._id)) {
                    verified = true;
                    await Payment.updateOne({ _id: payment._id }, { $set: { status: "VERIFIED" } });
                }
                return result;
            };
            return query;
        });
        await assert.rejects(cancelPayment(payment._id, customerId), /payment changed/);
        assert.equal((await Payment.findById(payment._id)).status, "VERIFIED");
    });

    it("still cancels a pending payment attempt and closes its checkout", async (t) => {
        const refunds = stubRefundGateway(t);
        const booking = await bookingWithCheckout();
        const payment = await Payment.findOne({ booking: booking._id });
        await cancelPayment(payment._id, customerId);
        const saved = await Payment.findById(payment._id);
        assert.equal(saved.status, "CANCELLED");
        assert.ok(saved.paymongo.checkoutExpiredAt);
        assert.equal(refunds(), 0);
    });

    it("does not force-verify a payment after cancellation wins during admin verification", async (t) => {
        const refundCount = stubRefundGateway(t);
        const booking = await bookingWithCheckout();
        const payment = await Payment.findOne({ booking: booking._id });
        const original = Booking.findById;
        let cancelled = false;
        mock.method(Booking, "findById", function (...args) {
            const query = original.apply(this, args);
            const exec = query.exec.bind(query);
            query.exec = async () => {
                const result = await exec();
                if (!cancelled && query.getOptions().session) {
                    cancelled = true;
                    await cancelBooking(booking._id, adminId, "Cancelled during verification", "admin");
                }
                return result;
            };
            return query;
        });
        await assert.rejects(verifyPayment(payment._id, adminId, { force: true }), /Cancelled payments cannot be verified/);
        assert.equal((await Payment.findById(payment._id)).status, "CANCELLED");
        assert.equal((await Booking.findById(booking._id)).status, BOOKING_STATUS.CANCELLED);
        assert.equal(refundCount(), 0);
    });
});

describe("admin driver assignment (Settings → Drivers)", () => {
    it("lets a customer book With Driver without choosing one", async () => {
        await setAdminAssignment(true);

        const vehicleId = await insertVehicle();
        const start = manilaMorning(5);

        const booking = await createBooking(
            {
                vehicle: vehicleId,
                driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
                driver: "",
                startDate: start.toISOString(),
                endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
                pickupLocation: {
                    type: "Custom",
                    address: "Legazpi City",
                    latitude: 13.1391,
                    longitude: 123.7438,
                },
                returnLocation: {
                    type: "Custom",
                    address: "Legazpi City",
                    latitude: 13.1391,
                    longitude: 123.7438,
                },
            },
            customerId
        );

        const saved = await Booking.findById(booking._id).lean();

        assert.equal(saved.driverOption, BOOKING_DRIVER_OPTIONS.WITH_DRIVER);
        assert.equal(saved.driver, null);
    });

    it("lets the admin assign a driver at approval once the setting is off again", async () => {
        const vehicleId = await insertVehicle();
        const driverId = await insertDriver();
        const bookingId = await insertBooking({ vehicle: vehicleId });

        await approveBooking(bookingId, adminId, driverId);

        const saved = await Booking.findById(bookingId).lean();

        assert.equal(saved.status, BOOKING_STATUS.APPROVED);
        assert.equal(String(saved.driver), String(driverId));
    });

    it("doesn't put the booking code in the customer's driver notice", async () => {
        const vehicleId = await insertVehicle();
        const driverId = await insertDriver();
        const bookingId = await insertBooking({ vehicle: vehicleId });

        await approveBooking(bookingId, adminId, driverId);

        const notice = await Notification.findOne({
            recipient: customerId,
            title: "Driver Assigned to Your Booking",
        }).lean();

        assert.ok(notice);
        assert.doesNotMatch(notice.message, /BK-/);
    });
});

describe("driver eligibility", () => {
    it("refuses a driver whose license expires before the trip ends", async () => {
        const vehicleId = await insertVehicle();
        const driverId = await insertDriver();
        const bookingId = await insertBooking({
            vehicle: vehicleId,
            driver: driverId,
        });
        const booking = await Booking.findById(bookingId).lean();

        await Driver.collection.updateOne(
            { _id: driverId },
            {
                $set: {
                    "license.expiryDate": new Date(
                        new Date(booking.endDate).getTime() - HOUR
                    ),
                },
            }
        );

        await assert.rejects(
            approveBooking(bookingId, adminId),
            /expires before this trip ends/
        );
    });

    it("refuses an archived driver", async () => {
        const vehicleId = await insertVehicle();
        const driverId = await insertDriver({
            availability: DRIVER_AVAILABILITY.UNAVAILABLE,
            archive: { isArchived: true },
        });
        const bookingId = await insertBooking({
            vehicle: vehicleId,
            driver: driverId,
        });

        await assert.rejects(
            approveBooking(bookingId, adminId),
            /not active/
        );
    });

    it("refuses an extension that runs past the driver's license", async () => {
        const vehicleId = await insertVehicle({
            status: VEHICLE_STATUS.RENTED,
        });
        const start = new Date(Date.now() - DAY);
        const end = new Date(Date.now() + DAY);
        const driverId = await insertDriver({
            license: {
                licenseNumber: "N-EXT",
                licenseType: "Professional",
                expiryDate: new Date(end.getTime() + 2 * HOUR),
                restrictionCodes: ["B"],
            },
        });
        const bookingId = await insertBooking({
            vehicle: vehicleId,
            driver: driverId,
            status: BOOKING_STATUS.ONGOING,
            startDate: start,
            endDate: end,
        });

        await assert.rejects(
            requestBookingExtension(
                bookingId,
                {
                    requestedEndDate: new Date(
                        end.getTime() + DAY
                    ).toISOString(),
                },
                customerId
            ),
            /license expires before this trip ends/
        );
    });
});

describe("driver pickers", () => {
    it("marks drivers already booked during the trip as busy", async () => {
        const freeId = await insertDriver({ firstName: "Free" });
        const busyId = await insertDriver({ firstName: "Busy" });
        const start = new Date(Date.now() + 4 * DAY);

        await insertBooking({
            driver: busyId,
            status: BOOKING_STATUS.APPROVED,
            startDate: start,
            endDate: new Date(start.getTime() + DAY),
        });

        const drivers = await getAvailableDrivers({
            startDate: new Date(start.getTime() + HOUR).toISOString(),
            endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
        });

        const byId = new Map(
            drivers.map((driver) => [String(driver._id), driver])
        );

        assert.equal(byId.get(String(freeId)).busy, false);
        assert.equal(byId.get(String(busyId)).busy, true);
    });

    it("leaves out drivers whose license won't last the trip", async () => {
        const start = new Date(Date.now() + 4 * DAY);
        const end = new Date(start.getTime() + 2 * DAY);

        const okId = await insertDriver();
        const expiringId = await insertDriver({
            license: {
                licenseNumber: "N-SOON",
                licenseType: "Professional",
                expiryDate: new Date(start.getTime() + DAY),
                restrictionCodes: ["B"],
            },
        });

        const ids = (
            await getAvailableDrivers({
                startDate: start.toISOString(),
                endDate: end.toISOString(),
            })
        ).map((driver) => String(driver._id));

        assert.ok(ids.includes(String(okId)));
        assert.ok(!ids.includes(String(expiringId)));

        // The admin's approval picker applies the same rule.
        const adminIds = (
            await getDrivers({
                availability: "BOOKABLE",
                startDate: start.toISOString(),
                endDate: end.toISOString(),
            })
        ).map((driver) => String(driver._id));

        assert.ok(!adminIds.includes(String(expiringId)));
    });
});

describe("archiveDriver", () => {
    it("refuses while a paid booking awaits approval", async () => {
        const driverId = await insertDriver();

        await insertBooking({
            driver: driverId,
            status: BOOKING_STATUS.PAYMENT_RECEIVED,
        });

        await assert.rejects(
            archiveDriver(driverId, "", adminId),
            /cannot be archived/
        );
    });

    it("refuses while their trip is running past its due-back time", async () => {
        const driverId = await insertDriver();

        await insertBooking({
            driver: driverId,
            status: BOOKING_STATUS.ONGOING,
            startDate: new Date(Date.now() - 3 * DAY),
            endDate: new Date(Date.now() - DAY),
        });

        await assert.rejects(
            archiveDriver(driverId, "", adminId),
            /cannot be archived/
        );
    });

    it("refuses while they drive a rental they took over", async () => {
        const driverId = await insertDriver();
        const bookingId = await insertBooking({
            driver: newId(),
            status: BOOKING_STATUS.ONGOING,
        });

        await insertOngoingRental({
            bookingId,
            driverId,
            dueBackAt: new Date(Date.now() + DAY),
        });

        await assert.rejects(
            archiveDriver(driverId, "", adminId),
            /cannot be archived/
        );
    });
});

describe("reassignDriver", () => {
    const setup = async () => {
        const previousId = await insertDriver({
            firstName: "First",
            availability: DRIVER_AVAILABILITY.UNAVAILABLE,
        });
        const nextId = await insertDriver({ firstName: "Second" });
        const dueBackAt = new Date(Date.now() + DAY);
        const bookingId = await insertBooking({
            driver: previousId,
            status: BOOKING_STATUS.ONGOING,
            startDate: new Date(Date.now() - DAY),
            endDate: dueBackAt,
        });
        const rentalId = await insertOngoingRental({
            bookingId,
            driverId: previousId,
            dueBackAt,
        });

        return { previousId, nextId, bookingId, rentalId, dueBackAt };
    };

    it("moves the booking, frees the first driver and books the second", async () => {
        const { previousId, nextId, bookingId, rentalId } = await setup();

        await reassignDriver(rentalId, nextId, "Sick", adminId);

        const [rental, booking, previous, next] = await Promise.all([
            Rental.findById(rentalId).lean(),
            Booking.findById(bookingId).lean(),
            Driver.findById(previousId).lean(),
            Driver.findById(nextId).lean(),
        ]);

        assert.equal(String(rental.driver), String(nextId));
        assert.equal(rental.driverReassignments.length, 1);
        assert.equal(String(booking.driver), String(nextId));
        assert.equal(previous.availability, DRIVER_AVAILABILITY.AVAILABLE);
        assert.equal(next.availability, DRIVER_AVAILABILITY.UNAVAILABLE);

        const notice = await Notification.findOne({
            recipient: customerId,
            title: "Your Driver Has Changed",
        }).lean();

        assert.ok(notice);
        assert.doesNotMatch(notice.message, /BK-|RN-/);
    });

    it("refuses a replacement who's booked before the rental is due back", async () => {
        const { nextId, rentalId, dueBackAt } = await setup();

        await insertBooking({
            driver: nextId,
            status: BOOKING_STATUS.APPROVED,
            startDate: new Date(dueBackAt.getTime() - 2 * HOUR),
            endDate: new Date(dueBackAt.getTime() + DAY),
        });

        await assert.rejects(
            reassignDriver(rentalId, nextId, "", adminId),
            /before this rental is due back/
        );
    });

    it("refuses a replacement whose license won't last the trip", async () => {
        const { nextId, rentalId, dueBackAt } = await setup();

        await Driver.collection.updateOne(
            { _id: nextId },
            {
                $set: {
                    "license.expiryDate": new Date(
                        dueBackAt.getTime() - HOUR
                    ),
                },
            }
        );

        await assert.rejects(
            reassignDriver(rentalId, nextId, "", adminId),
            /license expires before this rental is due back/
        );
    });
});

describe("motorcycle drivers (Settings → Drivers)", () => {
    const setMotorcycleDrivers = (on) =>
        Settings.collection.updateOne(
            {},
            {
                $set: {
                    "driverAssignmentSettings.motorcycleDriversEnabled": on,
                },
            },
            { upsert: true }
        );

    const book = async (vehicleId, driverOption, driver = null) => {
        const start = manilaMorning(5);
        const location = {
            type: "Custom",
            address: "Legazpi City",
            latitude: 13.1391,
            longitude: 123.7438,
        };

        return createBooking(
            {
                vehicle: vehicleId,
                driverOption,
                driver,
                startDate: start.toISOString(),
                endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
                pickupLocation: location,
                returnLocation: location,
            },
            customerId
        );
    };

    it("treats a missing setting as on (older settings)", () => {
        const motorcycle = { vehicleType: "Motorcycle" };

        assert.equal(areDriversOfferedForVehicle(motorcycle, null), true);
        assert.equal(
            areDriversOfferedForVehicle(motorcycle, {
                driverAssignmentSettings: {},
            }),
            true
        );
        assert.equal(
            areDriversOfferedForVehicle(motorcycle, {
                driverAssignmentSettings: { motorcycleDriversEnabled: false },
            }),
            false
        );
    });

    it("refuses a motorcycle with a driver while it's off", async () => {
        await setMotorcycleDrivers(false);

        const motorcycleId = await insertVehicle({ vehicleType: "Motorcycle" });
        const driverId = await insertDriver();

        await assert.rejects(
            book(motorcycleId, BOOKING_DRIVER_OPTIONS.WITH_DRIVER, driverId),
            /self-drive only/
        );
    });

    it("still books a motorcycle as self-drive while it's off", async () => {
        await setMotorcycleDrivers(false);

        const motorcycleId = await insertVehicle({ vehicleType: "Motorcycle" });

        const booking = await book(
            motorcycleId,
            BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
        );

        assert.equal(
            booking.driverOption,
            BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
        );
    });

    it("leaves cars bookable with a driver while it's off", async () => {
        await setMotorcycleDrivers(false);

        const carId = await insertVehicle();
        const driverId = await insertDriver();

        const booking = await book(
            carId,
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driverId
        );

        assert.equal(String(booking.driver?._id ?? booking.driver), String(driverId));
    });

    it("offers drivers for motorcycles again once it's back on", async () => {
        await setMotorcycleDrivers(false);
        await setMotorcycleDrivers(true);

        const motorcycleId = await insertVehicle({ vehicleType: "Motorcycle" });
        const driverId = await insertDriver();

        const booking = await book(
            motorcycleId,
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driverId
        );

        assert.equal(
            booking.driverOption,
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER
        );
    });

    it("keeps an existing motorcycle booking with its driver when turned off", async () => {
        const motorcycleId = await insertVehicle({ vehicleType: "Motorcycle" });
        const driverId = await insertDriver();
        const bookingId = await insertBooking({
            vehicle: motorcycleId,
            driver: driverId,
        });

        await setMotorcycleDrivers(false);

        await approveBooking(bookingId, adminId);

        const saved = await Booking.findById(bookingId).lean();

        assert.equal(saved.status, BOOKING_STATUS.APPROVED);
        assert.equal(String(saved.driver), String(driverId));
    });
});
