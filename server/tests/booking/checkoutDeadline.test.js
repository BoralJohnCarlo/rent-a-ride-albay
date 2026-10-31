import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import nodemailer from "nodemailer";
import Booking from "../../models/Booking.js";
import Payment from "../../models/Payment.js";
import { BOOKING_STATUS } from "../../constants/bookingConstants.js";
import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TYPE } from "../../constants/paymentConstants.js";

// Importing paymentService loads the mail configuration, which verifies SMTP
// on startup. Keep these isolated tests entirely offline.
mock.method(nodemailer, "createTransport", () => ({
    verify: async () => {},
    sendMail: async () => { assert.fail("Checkout eligibility must not send mail."); },
}));
const { createPaymongoCheckout } = await import("../../services/paymentService.js");
mock.restoreAll();

const HOUR = 60 * 60 * 1000;
afterEach(() => mock.restoreAll());

const prepare = ({ ageHours = 25, pickupHours = 72, status = PAYMENT_STATUS.PENDING,
    bookingStatus = BOOKING_STATUS.PENDING, paymentType = PAYMENT_TYPE.RESERVATION_FEE } = {}) => {
    const booking = {
        _id: "booking", status: bookingStatus,
        createdAt: new Date(Date.now() - ageHours * HOUR),
        startDate: new Date(Date.now() + pickupHours * HOUR),
    };
    const payment = {
        _id: "payment", booking: booking._id, customer: "customer",
        paymentType, paymentMethod: PAYMENT_METHOD.GCASH, status, amount: 500,
    };
    mock.method(Booking, "findById", async () => booking);
    mock.method(Payment, "findById", async () => payment);
    const writes = mock.method(Payment, "findOneAndUpdate", async () => {
        assert.fail("A blocked checkout must not mutate the payment.");
    });
    return writes;
};

for (const force of [false, true]) {
    it(`rejects an overdue pending reservation before checkout (force=${force})`, async () => {
        const writes = prepare();
        await assert.rejects(createPaymongoCheckout("payment", "customer", "", { force }),
            (error) => error.statusCode === 409 && error.message.includes("payment window"));
        assert.equal(writes.mock.callCount(), 0);
    });
}

it("rejects payment after pickup even when less than 24 hours old", async () => {
    prepare({ ageHours: 2, pickupHours: -1 });
    await assert.rejects(createPaymongoCheckout("payment", "customer", ""), /payment window/);
});

it("still rejects reopening an overdue cancelled reservation", async () => {
    prepare({ status: PAYMENT_STATUS.CANCELLED });
    await assert.rejects(createPaymongoCheckout("payment", "customer", ""), /payment window/);
});

for (const [label, options] of [
    ["a reservation inside its payment window", { ageHours: 1 }],
    ["an extension payment", { paymentType: PAYMENT_TYPE.EXTENSION_FEE }],
    ["an approved legacy reservation", { bookingStatus: BOOKING_STATUS.APPROVED }],
]) {
    it(`does not apply the pending reservation deadline to ${label}`, async () => {
        prepare(options);
        // Stop before contacting PayMongo: reaching URL validation proves
        // the payment eligibility checks succeeded without a provider call.
        await assert.rejects(createPaymongoCheckout("payment", "customer", ""), /Client base URL is required/);
    });
}
