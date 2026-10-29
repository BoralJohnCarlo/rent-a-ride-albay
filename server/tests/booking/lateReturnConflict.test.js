import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import ManualRefund from "../../models/ManualRefund.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_MAINTENANCE_CONFLICT_STATUS,
    BOOKING_STATUS,
    BOOKING_VEHICLE_CONFLICT_CAUSE,
} from "../../constants/bookingConstants.js";
import {
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";
import { RENTAL_STATUS } from "../../constants/rentalConstants.js";
import {
    VEHICLE_MAINTENANCE_MODE,
    VEHICLE_STATUS,
} from "../../constants/vehicleConstants.js";

import {
    changeVehicleForMaintenanceConflict,
    getMaintenanceConflictOptions,
    processMaintenanceConflicts,
    refundMaintenanceConflict,
    sendMaintenanceConflictOptions,
    waitForLateVehicle,
} from "../../services/bookingService.js";
import {
    detectLateReturnConflicts,
    getLateReturnImpact,
    reconcileLateReturnConflicts,
} from "../../services/lateReturnConflictService.js";
import {
    applyVehicleMaintenance,
    clearVehicleMaintenance,
} from "../../services/vehicleMaintenanceService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Rental 1 isn't back by its due-back time and the same vehicle is booked
 * next: the next booking is flagged (heads-up), its customer is sent their
 * options automatically once the vehicle can't be ready in time (another
 * vehicle at no extra cost, waiting, or a full refund), and the conflict
 * clears if the vehicle comes back first. Defaults: 2h turnaround buffer,
 * 4h no-show grace. Payments have no PayMongo charge (manual refunds).
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;

const insertVehicle = async (overrides = {}) => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.RENTED,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Toyota",
        model: "Vios",
        vehicleType: "Car",
        operator: null,
        pricing: { dailyRate: 2400, reservationFee: 500 },
        availability: { bookingEnabled: true, blockedDates: [] },
        ...overrides,
    });

    return _id;
};

const insertBooking = async ({
    vehicle,
    start,
    days = 2,
    dailyRate = 2400,
    ...overrides
}) => {
    const _id = newId();
    const subtotal = dailyRate * days;

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: newId(),
        vehicle,
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate: start,
        endDate: new Date(start.getTime() + days * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            dailyRate,
            reservationFee: 500,
            rentalDays: days,
            subtotal,
            totalAmount: subtotal + 500,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
            driverDailyRate: 0,
            driverFee: 0,
        },
        status: BOOKING_STATUS.APPROVED,
        statusHistory: [
            {
                status: BOOKING_STATUS.APPROVED,
                changedAt: new Date(Date.now() - 10 * DAY),
            },
        ],
        extensions: [],
        reschedules: [],
        maintenanceConflict: null,
        refundAmount: 0,
        audit: {},
        ...overrides,
    });

    return Booking.findById(_id).lean();
};

/* Rental 1: picked up two days ago, due back `overdueBy` ago, still out. */
const insertLateRental = async (vehicle, { overdueBy = 2 * HOUR } = {}) => {
    const dueBackAt = new Date(Date.now() - overdueBy);
    const pickedUpAt = new Date(dueBackAt.getTime() - 2 * DAY);

    const booking = await insertBooking({
        vehicle,
        start: pickedUpAt,
        status: BOOKING_STATUS.ONGOING,
    });

    const _id = newId();

    await Rental.collection.insertOne({
        _id,
        rentalCode: `RN-T${_id}`,
        booking: booking._id,
        customer: booking.customer,
        vehicle,
        driver: null,
        status: RENTAL_STATUS.ONGOING,
        bookingPeriod: {
            originalStartDate: pickedUpAt,
            originalEndDate: dueBackAt,
            actualStartDate: pickedUpAt,
        },
        actualEndDate: dueBackAt,
        extensions: [],
        pickup: { date: pickedUpAt },
        return: { date: null },
    });

    return { rentalId: _id, lateBooking: booking, dueBackAt };
};

const returnVehicle = (rentalId, at = new Date()) =>
    Rental.updateOne(
        { _id: rentalId },
        { $set: { "return.date": at, status: RENTAL_STATUS.COMPLETED } }
    );

const payFor = (booking, amount) =>
    Payment.create({
        booking: booking._id,
        customer: booking.customer,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        paymentMethod: PAYMENT_METHOD.GCASH,
        amount,
        status: PAYMENT_STATUS.VERIFIED,
        audit: { createdBy: adminId, updatedBy: adminId },
    });

const conflictOf = async (bookingId) =>
    (await Booking.findById(bookingId).lean()).maintenanceConflict;

const notificationsTo = (recipient) =>
    Notification.find({ recipient }).sort({ createdAt: 1 }).lean();

/*
 * A late rental with the next booking `pickupIn` from now, after the
 * detection sweep. Under the 2h buffer the options go out automatically.
 */
const lateReturnScenario = async ({ pickupIn = 1 * HOUR, paid = 5300 } = {}) => {
    const vehicle = await insertVehicle();
    const late = await insertLateRental(vehicle);
    const booking = await insertBooking({
        vehicle,
        start: new Date(Date.now() + pickupIn),
    });

    if (paid) {
        await payFor(booking, paid);
    }

    await detectLateReturnConflicts();

    return { vehicle, booking, ...late };
};

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, Notification, Payment, Rental].map((model) => model.init())
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [Booking, ManualRefund, Notification, Payment, Rental, User, Vehicle].map(
            (model) => model.deleteMany({})
        )
    );

    adminId = newId();

    await User.collection.insertOne({
        _id: adminId,
        role: "admin",
        email: `admin-${adminId}@test.local`,
    });
});

describe("detecting a late return", () => {
    it("warns the next customer, admins and the late renter while there's still time", async () => {
        const { booking, lateBooking, rentalId } = await lateReturnScenario({
            pickupIn: 10 * HOUR,
        });

        const conflict = await conflictOf(booking._id);
        assert.equal(conflict.status, BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED);
        assert.equal(conflict.cause, BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN);
        assert.equal(String(conflict.blockingRental), String(rentalId));
        assert.ok(conflict.dueBackAt);

        const [headsUp] = await notificationsTo(booking.customer);
        assert.equal(headsUp.title, "Heads-up: Your Vehicle Is Running Late");

        assert.ok(
            await Notification.exists({
                recipient: adminId,
                title: "Late Return Puts Bookings at Risk",
            })
        );

        const [nudge] = await notificationsTo(lateBooking.customer);
        assert.equal(nudge.title, "Please Return Your Vehicle Now");

        // A second sweep doesn't repeat any of it.
        await detectLateReturnConflicts();
        assert.equal((await notificationsTo(booking.customer)).length, 1);
        assert.equal((await notificationsTo(lateBooking.customer)).length, 1);
    });

    it("doesn't let the customer choose before the options are out", async () => {
        const { booking } = await lateReturnScenario({ pickupIn: 10 * HOUR });

        await assert.rejects(
            getMaintenanceConflictOptions(booking._id, booking.customer, "customer"),
            /may still make it back in time/
        );
    });

    it("ignores bookings far off, and rentals that aren't overdue", async () => {
        const vehicle = await insertVehicle();
        await insertLateRental(vehicle);
        const farOff = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 3 * DAY),
        });

        const onTimeVehicle = await insertVehicle();
        await insertLateRental(onTimeVehicle, { overdueBy: -3 * HOUR });
        const nextOnTime = await insertBooking({
            vehicle: onTimeVehicle,
            start: new Date(Date.now() + 6 * HOUR),
        });

        await detectLateReturnConflicts();

        assert.equal(await conflictOf(farOff._id), null);
        assert.equal(await conflictOf(nextOnTime._id), null);
    });

    it("sends the options automatically once the vehicle can't be ready in time", async () => {
        const { booking } = await lateReturnScenario({ pickupIn: 1 * HOUR });

        const conflict = await conflictOf(booking._id);
        assert.equal(
            conflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER
        );

        // Pickup + the 4h no-show grace.
        const expected = new Date(booking.startDate).getTime() + 4 * HOUR;
        assert.ok(Math.abs(new Date(conflict.respondBy).getTime() - expected) < MINUTE);

        const titles = (await notificationsTo(booking.customer)).map((n) => n.title);
        assert.deepEqual(titles, [
            "Heads-up: Your Vehicle Is Running Late",
            "Action Needed: Your Vehicle Is Running Late",
        ]);

        const options = await getMaintenanceConflictOptions(
            booking._id,
            booking.customer,
            "customer"
        );
        assert.equal(options.cause, BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN);
        assert.equal(options.waitAvailable, true);
        assert.equal(options.coversUpgrades, true);
        assert.equal(options.refundAmount, 5300);
    });

    it("lets an admin send the options early", async () => {
        const { booking } = await lateReturnScenario({ pickupIn: 10 * HOUR });

        await sendMaintenanceConflictOptions(booking._id, adminId);

        const conflict = await conflictOf(booking._id);
        assert.equal(
            conflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER
        );
        assert.equal(String(conflict.optionsSentBy), String(adminId));
    });

    it("leaves a maintenance conflict alone, and survives maintenance ending", async () => {
        const vehicle = await insertVehicle();
        await insertLateRental(vehicle);
        const booking = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 10 * HOUR),
        });

        await detectLateReturnConflicts();
        await clearVehicleMaintenance(vehicle);

        assert.equal(
            (await conflictOf(booking._id)).status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED
        );
    });
});

describe("the customer's choices", () => {
    it("switches to a pricier vehicle as a free upgrade, covered by the platform", async () => {
        const { booking } = await lateReturnScenario();
        const pricier = await insertVehicle({
            status: VEHICLE_STATUS.AVAILABLE,
            brand: "Honda",
            model: "City",
            pricing: { dailyRate: 3000, reservationFee: 500 },
        });

        const options = await getMaintenanceConflictOptions(
            booking._id,
            booking.customer,
            "customer"
        );
        const offered = options.alternatives.find(
            (vehicle) => String(vehicle._id) === String(pricier)
        );
        assert.equal(offered.difference, 1200);
        assert.equal(offered.settlement.kind, "covered");
        assert.equal(offered.customerTotalAmount, 5300);

        await changeVehicleForMaintenanceConflict(
            booking._id,
            pricier,
            booking.customer,
            "customer"
        );

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(String(stored.vehicle), String(pricier));
        // The customer's price is unchanged; the platform covers the rest.
        assert.equal(stored.pricing.totalAmount, 5300);
        assert.equal(stored.pricing.platformCoveredAmount, 1200);
        assert.equal(
            stored.maintenanceConflict.vehicleChange.pricing.coveredAmount,
            1200
        );
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED
        );

        // Nothing to pay.
        assert.equal(
            await Payment.exists({
                booking: booking._id,
                paymentType: PAYMENT_TYPE.EXTENSION_FEE,
            }),
            null
        );
    });

    it("refunds the difference for a cheaper vehicle", async () => {
        const { booking } = await lateReturnScenario();
        const cheaper = await insertVehicle({
            status: VEHICLE_STATUS.AVAILABLE,
            pricing: { dailyRate: 2000, reservationFee: 500 },
        });

        await changeVehicleForMaintenanceConflict(
            booking._id,
            cheaper,
            booking.customer,
            "customer"
        );

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.pricing.totalAmount, 4500);
        assert.equal(stored.pricing.platformCoveredAmount ?? 0, 0);
        assert.equal(stored.maintenanceConflict.vehicleChange.settlement.amount, 800);
    });

    it("cancels for a full refund", async () => {
        const { booking } = await lateReturnScenario();

        await refundMaintenanceConflict(booking._id, booking.customer, "customer");

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.CANCELLED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED
        );
        assert.equal(stored.maintenanceConflict.refundAmount, 5300);
    });

    it("waits, then goes ahead when the vehicle comes back", async () => {
        const { vehicle, booking, rentalId } = await lateReturnScenario();

        await waitForLateVehicle(booking._id, booking.customer, "customer");

        let conflict = await conflictOf(booking._id);
        assert.equal(conflict.status, BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING);
        assert.ok(new Date(conflict.waitUntil) > new Date(conflict.respondBy) - MINUTE);

        // Still out: nothing changes.
        await reconcileLateReturnConflicts(vehicle);
        assert.equal(
            (await conflictOf(booking._id)).status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING
        );

        await returnVehicle(rentalId);
        await reconcileLateReturnConflicts(vehicle);

        conflict = await conflictOf(booking._id);
        assert.equal(conflict.status, BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED);
        assert.ok(conflict.vehicleReturnedAt);

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.APPROVED);

        const titles = (await notificationsTo(booking.customer)).map((n) => n.title);
        assert.ok(titles.includes("Good News: Your Vehicle Is Back"));
    });

    it("can't wait on a maintenance conflict", async () => {
        const vehicle = await insertVehicle({ status: VEHICLE_STATUS.AVAILABLE });
        const booking = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 3 * DAY),
        });

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 5 },
            adminId
        );
        await sendMaintenanceConflictOptions(booking._id, adminId);

        await assert.rejects(
            waitForLateVehicle(booking._id, booking.customer, "customer"),
            /only offered when the vehicle is running late/
        );
    });
});

describe("deadlines", () => {
    it("refunds in full when nobody chose and the vehicle still isn't back", async () => {
        const { booking } = await lateReturnScenario();

        await Booking.updateOne(
            { _id: booking._id },
            { $set: { "maintenanceConflict.respondBy": new Date(Date.now() - MINUTE) } }
        );

        await processMaintenanceConflicts();

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.CANCELLED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED
        );
        assert.equal(stored.maintenanceConflict.resolvedByRole, "system");
        assert.equal(stored.maintenanceConflict.refundAmount, 5300);
    });

    it("lets the booking go ahead instead if the vehicle came back by the deadline", async () => {
        const { booking, rentalId } = await lateReturnScenario();

        await Booking.updateOne(
            { _id: booking._id },
            { $set: { "maintenanceConflict.respondBy": new Date(Date.now() - MINUTE) } }
        );
        await returnVehicle(rentalId);

        await processMaintenanceConflicts();

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.APPROVED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED
        );
    });

    it("refunds a waiting customer once the wait runs out", async () => {
        const { booking } = await lateReturnScenario();

        await waitForLateVehicle(booking._id, booking.customer, "customer");
        await Booking.updateOne(
            { _id: booking._id },
            { $set: { "maintenanceConflict.waitUntil": new Date(Date.now() - MINUTE) } }
        );

        await processMaintenanceConflicts();

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.CANCELLED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED
        );
    });
});

describe("late return impact (admin)", () => {
    it("lists the bookings the late rental affected and what it cost", async () => {
        const { booking, lateBooking } = await lateReturnScenario();

        await refundMaintenanceConflict(booking._id, booking.customer, "customer");

        const impact = await getLateReturnImpact(lateBooking._id);

        assert.equal(impact.stillOut, true);
        assert.ok(impact.lateMinutes >= 119);
        assert.equal(impact.bookings.length, 1);
        assert.equal(impact.bookings[0].bookingCode, booking.bookingCode);
        assert.equal(impact.totals.refunded, 5300);
        assert.equal(impact.totals.open, 0);
    });
});
