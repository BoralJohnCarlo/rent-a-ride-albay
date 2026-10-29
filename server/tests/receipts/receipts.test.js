import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import transporter from "../../config/email.js";

import Booking from "../../models/Booking.js";
import ManualRefund from "../../models/ManualRefund.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Receipt from "../../models/Receipt.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_STATUS,
} from "../../constants/bookingConstants.js";
import {
    MANUAL_REFUND_STATUS,
    PAYMENT_METHOD,
    PAYMENT_REFUND_STATUS,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../../constants/paymentConstants.js";
import {
    RENTAL_PAYMENT_METHOD,
    RENTAL_PAYMENT_STATUS,
    RENTAL_PAYMENT_TYPE,
    RENTAL_REFUND_REASON,
    RENTAL_REFUND_STATUS,
    RENTAL_STATUS,
} from "../../constants/rentalConstants.js";

import {
    getBookingStatement,
    getReceiptById,
    receiptEmail,
    syncBookingReceipts,
} from "../../services/receiptService.js";
import { verifyPaymentByCheckoutSession } from "../../services/paymentService.js";
import { describePaymongoPayment } from "../../services/paymongoService.js";
import { createNotification } from "../../services/notificationService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const DAY = 24 * 60 * 60 * 1000;
const newId = () => new mongoose.Types.ObjectId();

let adminId;
let customerId;
let vehicleId;

const admin = () => ({ _id: adminId, role: "admin" });
const customer = () => ({ _id: customerId, role: "customer" });

const createBooking = async (overrides = {}) => {
    const _id = newId();
    const start = new Date(Date.now() + 3 * DAY);

    await Booking.collection.insertOne({
        _id,
        bookingCode: `BK-T${_id}`,
        customer: customerId,
        vehicle: vehicleId,
        driverOption: BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER,
        driver: null,
        startDate: start,
        endDate: new Date(start.getTime() + 2 * DAY),
        pickupLocation: { type: "Office", address: "Legazpi" },
        returnLocation: { type: "Office", address: "Legazpi" },
        pricing: {
            dailyRate: 2400,
            reservationFee: 500,
            rentalDays: 2,
            subtotal: 4800,
            totalAmount: 5300,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
            driverFee: 0,
        },
        status: BOOKING_STATUS.APPROVED,
        statusHistory: [],
        extensions: [],
        reschedules: [],
        audit: {},
        createdAt: new Date(),
        ...overrides,
    });

    return _id;
};

const createPayment = (bookingId, overrides = {}) =>
    Payment.create({
        booking: bookingId,
        customer: customerId,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        paymentMethod: PAYMENT_METHOD.GCASH,
        amount: 500,
        status: PAYMENT_STATUS.VERIFIED,
        verification: { verifiedAt: new Date() },
        paymongo: { checkoutSessionId: `cs_${newId()}`, chargeId: "pay_test" },
        audit: { createdBy: customerId },
        ...overrides,
    });

const createRental = (bookingId, overrides = {}) =>
    Rental.create({
        rentalCode: `RN-T${newId()}`,
        booking: bookingId,
        customer: customerId,
        vehicle: vehicleId,
        status: RENTAL_STATUS.ONGOING,
        pickup: { date: new Date(), processedBy: adminId },
        bookingPeriod: {
            originalStartDate: new Date(),
            originalEndDate: new Date(Date.now() + 2 * DAY),
            actualStartDate: new Date(),
        },
        financial: {
            baseRentalCharge: 4800,
            reservationFee: 500,
            balance: 0,
        },
        ...overrides,
    });

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, ManualRefund, Notification, Payment, Receipt, Rental].map(
            (model) => model.init()
        )
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
            Receipt,
            Rental,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();
    customerId = newId();
    vehicleId = newId();

    await User.collection.insertMany([
        { _id: adminId, role: "admin", email: `admin-${adminId}@test.local` },
        {
            _id: customerId,
            role: "customer",
            firstName: "Maria",
            lastName: "Santos",
            email: `customer-${customerId}@test.local`,
            phoneNumber: "09170000000",
        },
    ]);

    await Vehicle.collection.insertOne({
        _id: vehicleId,
        brand: "Toyota",
        model: "Vios",
        plateNumber: "ABC 1234",
        vehicleCode: `TEST-${vehicleId}`,
    });
});

describe("receipt issuing", () => {
    it("issues one numbered receipt per verified payment, however often it's synced", async () => {
        const bookingId = await createBooking();
        await createPayment(bookingId);
        await createPayment(bookingId, {
            paymentType: PAYMENT_TYPE.EXTENSION_FEE,
            bookingExtension: newId(),
            amount: 1200,
        });
        // Not received: no receipt.
        await createPayment(bookingId, {
            paymentType: PAYMENT_TYPE.EXTENSION_FEE,
            bookingExtension: newId(),
            status: PAYMENT_STATUS.PENDING,
        });

        await Promise.all([
            syncBookingReceipts(bookingId),
            syncBookingReceipts(bookingId),
            syncBookingReceipts(bookingId),
        ]);
        const { receipts, created } = await syncBookingReceipts(bookingId);

        assert.equal(receipts.length, 2);
        assert.equal(created.length, 0, "a later sync issues nothing new");
        assert.deepEqual(
            receipts.map((receipt) => receipt.description).sort(),
            ["Rental extension fee", "Reservation fee"]
        );

        for (const receipt of receipts) {
            assert.match(receipt.receiptNumber, /^AR-\d{6}$/);
            assert.equal(receipt.snapshot.vehicleName, "Toyota Vios");
            assert.equal(receipt.snapshot.customerName, "Maria Santos");
            assert.equal(receipt.method, "Online payment (PayMongo)");
        }
    });

    it("acknowledges a refund only once it has succeeded", async () => {
        const bookingId = await createBooking({
            status: BOOKING_STATUS.CANCELLED,
        });
        const payment = await createPayment(bookingId, {
            refund: {
                amount: 300,
                reason: "requested_by_customer",
                status: PAYMENT_REFUND_STATUS.PENDING,
                method: "automatic",
            },
        });

        let { receipts } = await syncBookingReceipts(bookingId);
        assert.equal(
            receipts.filter((receipt) => receipt.kind === "refund").length,
            0
        );

        await Payment.updateOne(
            { _id: payment._id },
            {
                $set: {
                    "refund.status": PAYMENT_REFUND_STATUS.SUCCEEDED,
                    "refund.completedAt": new Date(),
                    "refund.refundId": "ref_test",
                },
            }
        );

        ({ receipts } = await syncBookingReceipts(bookingId));
        const refund = receipts.find((receipt) => receipt.kind === "refund");

        assert.ok(refund);
        assert.match(refund.receiptNumber, /^RF-\d{6}$/);
        assert.equal(refund.amount, 300);
        assert.equal(refund.reference, "ref_test");
    });

    it("receipts a rental refund once, from the payment that carried it", async () => {
        const bookingId = await createBooking({
            status: BOOKING_STATUS.ONGOING,
        });
        const payment = await createPayment(bookingId, {
            refund: {
                amount: 400,
                reason: "others",
                status: PAYMENT_REFUND_STATUS.SUCCEEDED,
                method: "automatic",
                completedAt: new Date(),
            },
        });

        const rental = await createRental(bookingId);
        rental.payments.push({
            amount: 4800,
            type: RENTAL_PAYMENT_TYPE.FULL_PAYMENT,
            status: RENTAL_PAYMENT_STATUS.VERIFIED,
            paymentMethod: RENTAL_PAYMENT_METHOD.CASH,
            verifiedAt: new Date(),
        });
        rental.refunds.push(
            {
                // Tracked by the payment's refund above.
                amount: 400,
                reason: RENTAL_REFUND_REASON.OVERPAYMENT,
                status: RENTAL_REFUND_STATUS.APPROVED,
                gatewayPayment: payment._id,
                gatewayStatus: PAYMENT_REFUND_STATUS.SUCCEEDED,
            },
            {
                // Paid outside the app and confirmed by an admin.
                amount: 150,
                reason: RENTAL_REFUND_REASON.ADJUSTMENT,
                status: RENTAL_REFUND_STATUS.APPROVED,
                gatewayStatus: PAYMENT_REFUND_STATUS.SUCCEEDED,
                settledAt: new Date(),
            },
            {
                // Still owed: no receipt yet.
                amount: 90,
                reason: RENTAL_REFUND_REASON.OTHER,
                status: RENTAL_REFUND_STATUS.APPROVED,
                gatewayStatus: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
            }
        );
        await rental.save();

        const { receipts } = await syncBookingReceipts(bookingId);
        const refunds = receipts.filter((receipt) => receipt.kind === "refund");
        const payments = receipts.filter((receipt) => receipt.kind === "payment");

        assert.deepEqual(
            refunds.map((receipt) => receipt.amount).sort((a, b) => a - b),
            [150, 400]
        );
        assert.deepEqual(
            payments.map((receipt) => receipt.amount).sort((a, b) => a - b),
            [500, 4800]
        );
        assert.equal(
            payments.find((receipt) => receipt.amount === 4800).method,
            "Cash"
        );
    });
});

describe("transaction IDs", () => {
    it("reads the method and the provider's own reference off a PayMongo payment", () => {
        assert.deepEqual(
            describePaymongoPayment({
                id: "pay_1",
                attributes: {
                    external_reference_number: "9012345678901",
                    source: { type: "gcash", provider_id: null },
                },
            }),
            { sourceType: "gcash", providerReference: "9012345678901" }
        );

        // Test mode: PayMongo leaves both references null.
        assert.deepEqual(
            describePaymongoPayment({
                attributes: {
                    external_reference_number: null,
                    source: { type: "gcash", provider: { id: null }, provider_id: null },
                },
            }),
            { sourceType: "gcash", providerReference: "" }
        );

        assert.deepEqual(describePaymongoPayment(null), {
            sourceType: "",
            providerReference: "",
        });
    });

    it("puts the PayMongo transaction ID and GCash reference on the receipt", async () => {
        const bookingId = await createBooking({ status: BOOKING_STATUS.PENDING });
        const checkoutSessionId = `cs_${newId()}`;

        await createPayment(bookingId, {
            status: PAYMENT_STATUS.PENDING,
            verification: {},
            paymongo: { checkoutSessionId },
        });

        await verifyPaymentByCheckoutSession(
            checkoutSessionId,
            "pi_test",
            "pay_abc123",
            {
                id: "pay_abc123",
                attributes: {
                    external_reference_number: "9012345678901",
                    source: { type: "gcash" },
                },
            }
        );

        const { receipts } = await syncBookingReceipts(bookingId);
        const receipt = await getReceiptById(receipts[0]._id, customer());

        assert.equal(receipt.method, "GCash via PayMongo");
        assert.equal(receipt.reference, "pay_abc123");
        assert.equal(receipt.transactionIdText, "pay_abc123");
        assert.equal(receipt.providerReference, "9012345678901");
        assert.equal(receipt.providerReferenceLabel, "GCash reference no.");

        const email = receiptEmail(receipt, { subject: "Payment received" });
        const rows = Object.fromEntries(email.rows);

        assert.equal(rows["Transaction ID"], "pay_abc123");
        assert.equal(rows["GCash reference no."], "9012345678901");
    });

    it("says why a cash payment has no transaction ID", async () => {
        const bookingId = await createBooking({ status: BOOKING_STATUS.ONGOING });
        const rental = await createRental(bookingId);

        rental.payments.push({
            amount: 4800,
            type: RENTAL_PAYMENT_TYPE.FULL_PAYMENT,
            status: RENTAL_PAYMENT_STATUS.VERIFIED,
            paymentMethod: RENTAL_PAYMENT_METHOD.CASH,
            verifiedAt: new Date(),
        });
        await rental.save();

        const statement = await getBookingStatement(bookingId, admin());
        const cash = statement.payments.find((line) => line.method === "Cash");

        assert.equal(cash.transactionId, "");
        assert.equal(cash.transactionIdText, "None — paid in cash");
    });
});

describe("booking statement", () => {
    it("adds a booked booking's charges up to its total, voucher included", async () => {
        const bookingId = await createBooking({
            pricing: {
                dailyRate: 2400,
                reservationFee: 500,
                rentalDays: 2,
                subtotal: 4800,
                totalAmount: 5550,
                pickupDistanceFee: 150,
                returnDistanceFee: 100,
                driverFee: 0,
            },
            voucher: { code: "SAVE100", discountAmount: 100 },
            extensions: [
                {
                    status: "Approved",
                    pricing: { amount: 100 },
                },
            ],
        });
        await createPayment(bookingId, { amount: 650 });

        const statement = await getBookingStatement(bookingId, customer());

        assert.equal(statement.totals.charges, 5550);
        assert.equal(
            statement.charges.reduce((sum, item) => sum + item.amount, 0),
            5550
        );
        assert.ok(
            statement.charges.some(
                (item) => item.label === "Voucher discount" && item.amount === -100
            )
        );
        assert.equal(statement.totals.paid, 650);
        assert.equal(statement.totals.balanceDue, 4900);
        assert.equal(statement.payments[0].description,
            "Reservation fee and pickup distance fee");
    });

    it("shows what a cancelled booking kept, counting refunds still on their way", async () => {
        const bookingId = await createBooking({
            status: BOOKING_STATUS.CANCELLED,
        });
        await createPayment(bookingId, {
            amount: 1000,
            refund: {
                amount: 300,
                reason: "requested_by_customer",
                status: PAYMENT_REFUND_STATUS.SUCCEEDED,
                method: "automatic",
                completedAt: new Date(),
            },
        });
        await ManualRefund.create({
            booking: bookingId,
            customer: customerId,
            amount: 200,
            reason: "Reschedule overpayment",
            status: MANUAL_REFUND_STATUS.OWED,
        });

        const statement = await getBookingStatement(bookingId, admin());

        assert.equal(statement.endedWithoutTrip, true);
        assert.deepEqual(statement.charges, []);
        assert.equal(statement.totals.paid, 1000);
        assert.equal(statement.totals.refunded, 300);
        assert.equal(statement.totals.pendingRefunds, 200);
        assert.equal(statement.totals.retained, 500);
        assert.equal(statement.totals.balanceDue, 0);
    });

    it("uses the rental's own balance once the vehicle is picked up", async () => {
        const bookingId = await createBooking({
            status: BOOKING_STATUS.ONGOING,
        });
        await createPayment(bookingId);
        await createRental(bookingId, {
            financial: {
                baseRentalCharge: 4800,
                reservationFee: 500,
                lateCharges: 600,
                discounts: 100,
                balance: 5300,
            },
        });

        const statement = await getBookingStatement(bookingId, customer());

        assert.equal(statement.totals.charges, 5800);
        assert.equal(statement.totals.balanceDue, 5300);
        assert.ok(
            statement.charges.some(
                (item) => item.label === "Late return charges"
            )
        );
    });

    it("is only for admins and the booking's own customer", async () => {
        const bookingId = await createBooking();
        const payment = await createPayment(bookingId);

        await assert.rejects(
            getBookingStatement(bookingId, { _id: newId(), role: "customer" }),
            { statusCode: 403 }
        );
        await assert.rejects(
            getBookingStatement(bookingId, { _id: customerId, role: "operator" }),
            { statusCode: 403 }
        );

        const { receipts } = await syncBookingReceipts(bookingId);
        const receipt = receipts.find((item) =>
            item.source.id.equals(payment._id)
        );

        assert.ok(await getReceiptById(receipt._id, customer()));
        assert.ok(await getReceiptById(receipt._id, admin()));
        await assert.rejects(
            getReceiptById(receipt._id, { _id: newId(), role: "customer" }),
            { statusCode: 403 }
        );
    });
});

describe("notification emails", () => {
    const originalSendMail = transporter.sendMail;
    const originalFlag = process.env.NOTIFICATION_EMAILS;
    let sent;

    beforeEach(() => {
        sent = [];
        transporter.sendMail = async (mail) => {
            sent.push(mail);
            return { messageId: "test" };
        };
    });

    afterEach(() => {
        transporter.sendMail = originalSendMail;

        if (originalFlag === undefined) {
            delete process.env.NOTIFICATION_EMAILS;
        } else {
            process.env.NOTIFICATION_EMAILS = originalFlag;
        }
    });

    const settle = async () => {
        for (let i = 0; i < 20 && sent.length === 0; i += 1) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    };

    it("emails a customer the code-free copy, with user text escaped", async () => {
        process.env.NOTIFICATION_EMAILS = "true";

        await createNotification({
            recipient: customerId,
            type: "booking",
            title: "Booking Rejected",
            message: "Your booking BK-0042 was rejected. Reason: <b>no ID</b>",
            category: "Booking",
            metadata: { relatedId: newId(), relatedModel: "Booking" },
            email: true,
        });

        await settle();

        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, `customer-${customerId}@test.local`);
        assert.equal(sent[0].subject, "Booking Rejected");
        assert.doesNotMatch(sent[0].text, /BK-0042/);
        assert.match(sent[0].text, /Hello Maria,/);
        assert.match(sent[0].html, /&lt;b&gt;no ID&lt;\/b&gt;/);
        assert.doesNotMatch(sent[0].html, /<b>no ID<\/b>/);
    });

    it("sends nothing unless the notice opts in, and nothing under node --test by default", async () => {
        process.env.NOTIFICATION_EMAILS = "true";

        await createNotification({
            recipient: customerId,
            type: "booking",
            title: "Booking Submitted",
            message: "Submitted.",
            category: "Booking",
        });

        delete process.env.NOTIFICATION_EMAILS;

        await createNotification({
            recipient: customerId,
            type: "booking",
            title: "Booking Cancelled",
            message: "Cancelled.",
            category: "Booking",
            email: true,
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        assert.equal(sent.length, 0);
        assert.equal(
            await Notification.countDocuments({ recipient: customerId }),
            2,
            "the in-app notifications are still created"
        );
    });
});
