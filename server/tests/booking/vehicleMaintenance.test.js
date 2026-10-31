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
    BOOKING_RESCHEDULE_SETTLEMENT,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";
import {
    VEHICLE_MAINTENANCE_MODE,
    VEHICLE_STATUS,
} from "../../constants/vehicleConstants.js";

import {
    cancelBooking,
    changeVehicleForMaintenanceConflict,
    ensurePickupPaymentVerified,
    getMaintenanceConflictOptions,
    processMaintenanceConflicts,
    refundMaintenanceConflict,
    sendMaintenanceConflictOptions,
} from "../../services/bookingService.js";
import {
    checkVehicleAvailability,
    checkVehiclesAvailabilityBulk,
} from "../../services/vehicleService.js";
import {
    applyVehicleMaintenance,
    clearVehicleMaintenance,
    endExpiredVehicleMaintenance,
} from "../../services/vehicleMaintenanceService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * A vehicle under maintenance stays listed with only its maintenance window
 * unbookable; bookings already inside the window become maintenance
 * conflicts, resolved by moving to another vehicle or a full refund. Payments
 * here have no PayMongo charge, so refunds take the manual path.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const newId = () => new mongoose.Types.ObjectId();

let adminId;

const insertVehicle = async (overrides = {}) => {
    const _id = newId();

    await Vehicle.collection.insertOne({
        _id,
        status: VEHICLE_STATUS.AVAILABLE,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        brand: "Test",
        model: "Car",
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
    start = new Date(Date.now() + 5 * DAY),
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

/* Puts the vehicle under `days` of maintenance and sends the options. */
const conflictedBooking = async (bookingOverrides = {}) => {
    const vehicle = await insertVehicle({ brand: "Toyota", model: "Vios" });
    const booking = await insertBooking({
        vehicle,
        start: new Date(Date.now() + 3 * DAY),
        ...bookingOverrides,
    });

    await applyVehicleMaintenance(
        vehicle,
        { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 5 },
        adminId
    );

    await sendMaintenanceConflictOptions(booking._id, adminId);

    return { vehicle, booking };
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
        [
            Booking,
            ManualRefund,
            Notification,
            Payment,
            Rental,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();

    await User.collection.insertOne({
        _id: adminId,
        role: "admin",
        email: `admin-${adminId}@test.local`,
    });
});

describe("maintenance window availability", () => {
    it("blocks only the days under maintenance, not later ones", async () => {
        const vehicle = await insertVehicle();

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 3 },
            adminId
        );

        const stored = await Vehicle.findById(vehicle).lean();
        assert.equal(stored.status, VEHICLE_STATUS.MAINTENANCE);

        const inside = await checkVehicleAvailability(
            vehicle,
            new Date(Date.now() + 1 * DAY),
            new Date(Date.now() + 2 * DAY)
        );
        assert.equal(inside.available, false);
        assert.match(inside.reasons.join(" "), /under maintenance until/);

        const afterwards = await checkVehicleAvailability(
            vehicle,
            new Date(Date.now() + 5 * DAY),
            new Date(Date.now() + 6 * DAY)
        );
        assert.equal(afterwards.available, true);
    });

    it("blocks every date while off road", async () => {
        const vehicle = await insertVehicle();

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD },
            adminId
        );

        const farOut = await checkVehicleAvailability(
            vehicle,
            new Date(Date.now() + 60 * DAY),
            new Date(Date.now() + 61 * DAY)
        );
        assert.equal(farOut.available, false);
        assert.match(farOut.reasons.join(" "), /off the road/);
    });

    it("leaves the vehicle out of a date search inside the window only", async () => {
        const vehicle = await insertVehicle();

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 2 },
            adminId
        );

        const inside = await checkVehiclesAvailabilityBulk(
            [vehicle],
            new Date(Date.now() + 1 * DAY),
            new Date(Date.now() + 1.5 * DAY)
        );
        assert.deepEqual(inside.unavailableVehicleIds, [String(vehicle)]);

        const later = await checkVehiclesAvailabilityBulk(
            [vehicle],
            new Date(Date.now() + 4 * DAY),
            new Date(Date.now() + 5 * DAY)
        );
        assert.deepEqual(later.unavailableVehicleIds, []);
    });

    it("ends day-count maintenance on its own when the time is up", async () => {
        const vehicle = await insertVehicle({
            status: VEHICLE_STATUS.MAINTENANCE,
            maintenance: {
                mode: VEHICLE_MAINTENANCE_MODE.EXTENDED,
                startedAt: new Date(Date.now() - 3 * DAY),
                until: new Date(Date.now() - HOUR),
                days: 3,
            },
        });

        await endExpiredVehicleMaintenance();

        const stored = await Vehicle.findById(vehicle).lean();
        assert.equal(stored.status, VEHICLE_STATUS.AVAILABLE);
        assert.equal(stored.maintenance.mode, null);
    });
});

describe("refunds including paid reschedule top-ups", () => {
    it("keeps the vehicle and price unchanged while an earlier top-up is pending", async () => {
        const { booking, vehicle } = await conflictedBooking();
        await payFor(booking, 500);
        const payment = await Payment.create({
            booking: booking._id, customer: booking.customer,
            paymentType: PAYMENT_TYPE.EXTENSION_FEE, paymentMethod: PAYMENT_METHOD.GCASH,
            bookingExtension: newId(), bookingReschedule: newId(), amount: 2400,
            status: PAYMENT_STATUS.PENDING, audit: { createdBy: adminId },
        });
        const target = await insertVehicle({ pricing: { dailyRate: 1200, reservationFee: 500 } });
        await assert.rejects(changeVehicleForMaintenanceConflict(booking._id, target, booking.customer, "customer"), /Pay or cancel the outstanding top-up/);
        const saved = await Booking.findById(booking._id).lean();
        assert.equal(String(saved.vehicle), String(vehicle));
        assert.equal(saved.pricing.totalAmount, 5300);
        assert.equal((await Payment.findById(payment._id)).status, PAYMENT_STATUS.PENDING);
    });

    it("records only successful shares when a later refund allocation fails", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 500);
        const topUp = await Payment.create({
            booking: booking._id, customer: booking.customer,
            paymentType: PAYMENT_TYPE.EXTENSION_FEE, paymentMethod: PAYMENT_METHOD.GCASH,
            bookingExtension: newId(), bookingReschedule: newId(), amount: 7200,
            status: PAYMENT_STATUS.VERIFIED, audit: { createdBy: adminId },
        });
        await Booking.collection.updateOne({ _id: booking._id }, { $set: {
            "pricing.dailyRate": 3600, "pricing.subtotal": 7200, "pricing.totalAmount": 7700,
        } });
        const target = await insertVehicle();
        const original = Payment.findOneAndUpdate;
        Payment.findOneAndUpdate = function (filter, ...args) {
            if (String(filter._id) === String(topUp._id) && filter.refund === null) {
                throw new Error("Simulated second allocation failure");
            }
            return original.call(this, filter, ...args);
        };
        try {
            await changeVehicleForMaintenanceConflict(booking._id, target, booking.customer, "customer");
        } finally {
            Payment.findOneAndUpdate = original;
        }
        const saved = await Booking.findById(booking._id).lean();
        const settlement = saved.vehicleChanges.at(-1).settlement;
        assert.equal(settlement.amount, 500);
        assert.equal(settlement.allocations.length, 1);
        assert.equal(settlement.allocations[0].amount, 500);
        assert.equal((await Payment.findById(topUp._id)).refund, null);
        await cancelBooking(booking._id, adminId, "Cancel after partial allocation", "admin");
        const payments = await Payment.find({ booking: booking._id }).lean();
        const owed = await ManualRefund.find({ booking: booking._id }).lean();
        assert.equal(payments.reduce((sum, p) => sum + Number(p.refund?.amount || 0), 0) + owed.reduce((sum, r) => sum + r.amount, 0), 7700);
    });

    for (const reservationAmount of [5300, 500]) {
        it(`refunds a cheaper move across payments after a ${reservationAmount} reservation payment`, async () => {
            await ManualRefund.deleteMany({});
            const { booking } = await conflictedBooking();
            await payFor(booking, reservationAmount);
            const topUp = await Payment.create({
                booking: booking._id, customer: booking.customer,
                paymentType: PAYMENT_TYPE.EXTENSION_FEE, paymentMethod: PAYMENT_METHOD.GCASH,
                bookingExtension: newId(), bookingReschedule: newId(),
                amount: 7700 - reservationAmount, status: PAYMENT_STATUS.VERIFIED,
                audit: { createdBy: adminId, updatedBy: adminId },
            });
            await Booking.collection.updateOne({ _id: booking._id }, { $set: {
                "pricing.dailyRate": 3600, "pricing.subtotal": 7200, "pricing.totalAmount": 7700,
            } });
            const target = await insertVehicle({ pricing: { dailyRate: 2400, reservationFee: 500 } });
            const options = await getMaintenanceConflictOptions(booking._id, booking.customer, "customer");
            assert.equal(options.refundAmount, 7700);
            await changeVehicleForMaintenanceConflict(booking._id, target, booking.customer, "customer");
            const saved = await Booking.findById(booking._id).lean();
            assert.equal(saved.pricing.totalAmount, 5300);
            assert.equal(saved.vehicleChanges.at(-1).settlement.amount, 2400);
            assert.equal(saved.vehicleChanges.at(-1).settlement.allocations.reduce((sum, allocation) => sum + allocation.amount, 0), 2400);
            const refunds = await Payment.find({ booking: booking._id }).lean();
            assert.equal(refunds.reduce((sum, payment) => sum + Number(payment.refund?.amount || 0), 0), 2400);
            if (reservationAmount === 500) {
                assert.equal((await Payment.findById(topUp._id)).refund.amount, 1900);
            }
            // Cancelling later returns only the remaining 5,300, even when
            // a top-up's one refund slot was partly used by the vehicle move.
            await cancelBooking(booking._id, adminId, "Cancel after move", "admin");
            const payments = await Payment.find({ booking: booking._id }).lean();
            const owed = await ManualRefund.find({ booking: booking._id }).lean();
            const totalAllocated = payments.reduce((sum, payment) => sum + Number(payment.refund?.amount || 0), 0) + owed.reduce((sum, refund) => sum + refund.amount, 0);
            assert.equal(totalAllocated, 7700);
        });
    }
});

describe("maintenance conflicts", () => {
    it("flags only the bookings inside the window and alerts admins", async () => {
        const vehicle = await insertVehicle();
        const inside = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 2 * DAY),
        });
        const later = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 10 * DAY),
        });

        const { conflicts } = await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 4 },
            adminId
        );

        assert.deepEqual(
            conflicts.map((conflict) => String(conflict._id)),
            [String(inside._id)]
        );
        assert.equal(
            (await conflictOf(inside._id)).status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED
        );
        assert.equal(await conflictOf(later._id), null);
        assert.equal(
            await Notification.countDocuments({
                recipient: adminId,
                type: "Maintenance Conflict",
            }),
            1
        );
    });

    it("clears the conflict when the vehicle is back in service early", async () => {
        const { vehicle, booking } = await conflictedBooking();

        await clearVehicleMaintenance(vehicle);

        assert.equal(
            (await conflictOf(booking._id)).status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.CLEARED
        );

        // The approved booking holds it again.
        const stored = await Vehicle.findById(vehicle).lean();
        assert.equal(stored.status, VEHICLE_STATUS.RESERVED);
    });

    it("gives the customer until a day before pickup to choose", async () => {
        const { booking } = await conflictedBooking();

        const conflict = await conflictOf(booking._id);

        assert.equal(
            conflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER
        );
        assert.ok(
            new Date(conflict.respondBy).getTime() <=
                new Date(booking.startDate).getTime() - DAY + 1000
        );
    });

    it("lets the customer take a full refund, even close to pickup", async () => {
        // 20 hours out, the cancellation policy would normally keep the fee.
        const vehicle = await insertVehicle();
        const booking = await insertBooking({
            vehicle,
            start: new Date(Date.now() + 20 * HOUR),
        });
        await payFor(booking, 5300);

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.EXTENDED, days: 3 },
            adminId
        );
        await sendMaintenanceConflictOptions(booking._id, adminId);

        await refundMaintenanceConflict(
            booking._id,
            booking.customer,
            "customer"
        );

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.CANCELLED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED
        );

        const payment = await Payment.findOne({ booking: booking._id }).lean();
        assert.equal(payment.refund.amount, 5300);
    });

    it("refunds in full when the customer cancels the usual way", async () => {
        const { booking } = await conflictedBooking({
            start: new Date(Date.now() + 20 * HOUR),
        });
        await payFor(booking, 5300);

        await cancelBooking(
            booking._id,
            booking.customer,
            "",
            "customer"
        );

        const payment = await Payment.findOne({ booking: booking._id }).lean();
        assert.equal(payment.refund.amount, 5300);
    });

    it("only lets the customer act once the options are sent", async () => {
        const vehicle = await insertVehicle();
        const booking = await insertBooking({ vehicle });

        await applyVehicleMaintenance(
            vehicle,
            { mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD },
            adminId
        );

        await assert.rejects(
            getMaintenanceConflictOptions(
                booking._id,
                booking.customer,
                "customer"
            ),
            /still reviewing/
        );
    });

    it("offers free vehicles priced for the same dates", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 5300);

        const cheaper = await insertVehicle({
            pricing: { dailyRate: 2000, reservationFee: 500 },
        });
        const taken = await insertVehicle();
        await insertBooking({ vehicle: taken, start: booking.startDate });

        const options = await getMaintenanceConflictOptions(
            booking._id,
            booking.customer,
            "customer"
        );

        assert.deepEqual(
            options.alternatives.map((vehicle) => String(vehicle._id)),
            [String(cheaper)]
        );
        assert.equal(options.alternatives[0].difference, -800);
        assert.equal(options.refundAmount, 5300);
    });

    it("moves to a cheaper vehicle and refunds the difference", async () => {
        const { vehicle, booking } = await conflictedBooking();
        await payFor(booking, 5300);

        const cheaper = await insertVehicle({
            pricing: { dailyRate: 2000, reservationFee: 500 },
        });

        await changeVehicleForMaintenanceConflict(
            booking._id,
            cheaper,
            booking.customer,
            "customer"
        );

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(String(stored.vehicle), String(cheaper));
        assert.equal(stored.pricing.totalAmount, 4500);
        assert.equal(stored.status, BOOKING_STATUS.APPROVED);
        assert.equal(
            stored.maintenanceConflict.status,
            BOOKING_MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED
        );
        assert.equal(
            stored.maintenanceConflict.vehicleChange.settlement.kind,
            BOOKING_RESCHEDULE_SETTLEMENT.REFUND
        );
        assert.equal(
            stored.maintenanceConflict.vehicleChange.settlement.amount,
            800
        );

        // The new vehicle is held for the approved booking.
        assert.equal(
            (await Vehicle.findById(cheaper).lean()).status,
            VEHICLE_STATUS.RESERVED
        );
        assert.equal(
            (await Vehicle.findById(vehicle).lean()).status,
            VEHICLE_STATUS.MAINTENANCE
        );
    });

    it("charges the difference for a pricier vehicle", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 5300);

        const pricier = await insertVehicle({
            pricing: { dailyRate: 3000, reservationFee: 500 },
        });

        await changeVehicleForMaintenanceConflict(
            booking._id,
            pricier,
            booking.customer,
            "customer"
        );

        const charge = await Payment.findOne({
            booking: booking._id,
            paymentType: PAYMENT_TYPE.EXTENSION_FEE,
        }).lean();

        assert.equal(charge.amount, 1200);
        assert.equal(charge.status, PAYMENT_STATUS.PENDING);
        assert.ok(charge.bookingVehicleChange);
    });

    it("refuses a vehicle that's booked for those dates", async () => {
        const { booking } = await conflictedBooking();
        const taken = await insertVehicle();
        await insertBooking({ vehicle: taken, start: booking.startDate });

        await assert.rejects(
            changeVehicleForMaintenanceConflict(
                booking._id,
                taken,
                booking.customer,
                "customer"
            ),
            /already booked/
        );
    });

    it("still accepts a paid-in-full payment after switching vehicles", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 5300);

        const pricier = await insertVehicle({
            pricing: { dailyRate: 3000, reservationFee: 500 },
        });

        await changeVehicleForMaintenanceConflict(
            booking._id,
            pricier,
            booking.customer,
            "customer"
        );

        const moved = await Booking.findById(booking._id);
        assert.equal(moved.pricing.totalAmount, 6500);

        // The 5,300 paid in full still counts as the booking's payment.
        await ensurePickupPaymentVerified(moved);
    });

    it("never refunds an earlier vehicle switch twice", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 5300);

        const cheaper = await insertVehicle({
            pricing: { dailyRate: 2000, reservationFee: 500 },
        });

        // 5,300 → 4,500: 800 back.
        await changeVehicleForMaintenanceConflict(
            booking._id,
            cheaper,
            booking.customer,
            "customer"
        );

        // The new vehicle goes under maintenance too; full refund this time.
        await applyVehicleMaintenance(
            cheaper,
            { mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD },
            adminId
        );
        await sendMaintenanceConflictOptions(booking._id, adminId);
        await refundMaintenanceConflict(
            booking._id,
            booking.customer,
            "customer"
        );

        const paymentRefund = (
            await Payment.findOne({
                booking: booking._id,
                paymentType: PAYMENT_TYPE.RESERVATION_FEE,
            }).lean()
        ).refund.amount;

        const owed = await ManualRefund.find({ booking: booking._id }).lean();
        const owedTotal = owed.reduce(
            (sum, refund) => sum + Number(refund.amount),
            0
        );

        // Everything paid comes back exactly once.
        assert.equal(paymentRefund + owedTotal, 5300);
    });

    it("only offers vehicles of the same type", async () => {
        const { booking } = await conflictedBooking();

        await insertVehicle({ vehicleType: "Motorcycle" });
        const car = await insertVehicle();

        const options = await getMaintenanceConflictOptions(
            booking._id,
            booking.customer,
            "customer"
        );

        assert.deepEqual(
            options.alternatives.map((vehicle) => String(vehicle._id)),
            [String(car)]
        );
    });

    it("refunds in full automatically once the deadline passes", async () => {
        const { booking } = await conflictedBooking();
        await payFor(booking, 5300);

        await Booking.updateOne(
            { _id: booking._id },
            {
                $set: {
                    "maintenanceConflict.respondBy": new Date(
                        Date.now() - HOUR
                    ),
                },
            }
        );

        await processMaintenanceConflicts();

        const stored = await Booking.findById(booking._id).lean();
        assert.equal(stored.status, BOOKING_STATUS.CANCELLED);
        assert.equal(
            stored.maintenanceConflict.resolvedByRole,
            "system"
        );

        const payment = await Payment.findOne({ booking: booking._id }).lean();
        assert.equal(payment.refund.amount, 5300);
    });
});
