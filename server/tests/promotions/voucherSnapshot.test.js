import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import nodemailer from "nodemailer";
import Voucher from "../../models/Voucher.js";
import { getUpfrontFees } from "../../utils/bookingFees.js";
import { VOUCHER_TYPE, VOUCHER_DISCOUNT_METHOD } from "../../constants/voucherConstants.js";

// The service imports email configuration; keep the regression tests offline.
mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
const { calculatePricingWithVoucherSnapshot } = await import("../../services/voucherService.js");
mock.restoreAll();
afterEach(() => mock.restoreAll());

const base = {
    dailyRate: 2000, rentalDays: 1, subtotal: 2000,
    reservationFee: 500, pickupDistanceFee: 0, returnDistanceFee: 0,
    driverFee: 0, totalAmount: 2500,
};
const snapshot = {
    voucher: "507f1f77bcf86cd799439011", code: "BOOKED", name: "Booked voucher",
    type: VOUCHER_TYPE.RESERVATION_FEE,
    discountMethod: VOUCHER_DISCOUNT_METHOD.FIXED, discountValue: 500,
    discountAmount: 500,
};

it("uses the booked voucher type even if the live promotion is edited", () => {
    const lookup = mock.method(Voucher, "findById", async () => ({
        ...snapshot, type: VOUCHER_TYPE.TOTAL, discountValue: 100,
    }));
    const pricing = calculatePricingWithVoucherSnapshot(base, snapshot);
    assert.equal(pricing.totalAmount, 2000);
    assert.equal(pricing.voucher.type, VOUCHER_TYPE.RESERVATION_FEE);
    assert.equal(pricing.voucher.discountValue, 500);
    assert.equal(getUpfrontFees({ pricing, voucher: snapshot }).total, 0);
    assert.equal(lookup.mock.callCount(), 0);
});

it("retains the booked discount when the original voucher was removed", () => {
    const lookup = mock.method(Voucher, "findById", async () => null);
    assert.equal(calculatePricingWithVoucherSnapshot(base, snapshot).totalAmount, 2000);
    assert.equal(lookup.mock.callCount(), 0);
});

it("recalculates percentages against the new pricing without changing recorded terms", () => {
    const recorded = { ...snapshot, discountMethod: VOUCHER_DISCOUNT_METHOD.PERCENTAGE, discountValue: 50 };
    const original = { ...recorded };
    const pricing = calculatePricingWithVoucherSnapshot({ ...base, reservationFee: 1000, totalAmount: 3000 }, recorded);
    assert.equal(pricing.voucher.discount.reservationFeeDiscount, 500);
    assert.equal(pricing.totalAmount, 2500);
    assert.deepEqual(recorded, original);
});

it("keeps total-voucher pricing and upfront payment consistent", () => {
    const recorded = { ...snapshot, type: VOUCHER_TYPE.TOTAL,
        discountMethod: VOUCHER_DISCOUNT_METHOD.PERCENTAGE, discountValue: 90 };
    const pricing = calculatePricingWithVoucherSnapshot(base, recorded);
    assert.equal(pricing.totalAmount, 250);
    assert.equal(getUpfrontFees({ pricing, voucher: {
        ...recorded, discountAmount: pricing.voucher.discount.totalDiscount,
    } }).total, 250);
});

it("leaves pricing unchanged for a booking without a voucher", () => {
    assert.equal(calculatePricingWithVoucherSnapshot(base, null), base);
});
