import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Voucher from "../../models/Voucher.js";

// These regressions run offline and never access a real customer or send mail.
mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
const {
    getActiveVouchersForUser,
    getAvailableVouchers,
    getPublicVoucherById,
    calculatePricingWithVoucher,
    getVoucherDateState,
    recordVoucherUsage,
    claimVoucherUsage,
    updateVoucherById,
} = await import("../../services/voucherService.js");
const { resolveVehicleRate } = await import("../../services/discountService.js");
mock.restoreAll();
afterEach(() => mock.restoreAll());

const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const day = 86400000;
const voucher = (overrides = {}) => ({
    _id: new mongoose.Types.ObjectId(), code: "PROMO123", name: "Promo",
    status: "active", type: "vehicle_price", discountMethod: "fixed",
    discountValue: 100, maxUsagesPerUser: 1,
    assignmentType: "all_customers", assignedTo: [], usedBy: [],
    startDate: new Date(Date.now() - day), endDate: new Date(Date.now() + day),
    ...overrides,
});
const mockAvailable = (items) => mock.method(Voucher, "find", () => ({
    sort: async () => items,
}));
const pricing = {
    dailyRate: 600, rentalDays: 2, subtotal: 1200,
    reservationFee: 100, pickupDistanceFee: 50, returnDistanceFee: 50,
    driverFee: 200, totalAmount: 1600,
};

it("preserves redemption counts and history when a voucher is rescheduled", async () => {
    const existing = voucher({ usageCount: 3, usedBy: [{ user: userId }] });
    mock.method(Voucher, "findById", async () => existing);
    const futureStart = new Date(Date.now() + 3 * day).toISOString();
    const futureEnd = new Date(Date.now() + 5 * day).toISOString();
    mock.method(Voucher, "findByIdAndUpdate", (id, update) => {
        assert.equal(id, existing._id);
        assert.equal(update.$set.startDate, futureStart);
        assert.equal(Object.hasOwn(update.$set, "usageCount"), false);
        assert.equal(Object.hasOwn(update.$set, "usedBy"), false);
        const result = { ...existing, ...update.$set };
        const query = {
            populate: () => query,
            then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
        };
        return query;
    });
    const updated = await updateVoucherById(existing._id, {
        startDate: futureStart, endDate: futureEnd,
    }, otherUserId);
    assert.equal(updated.usageCount, 3);
    assert.deepEqual(updated.usedBy, existing.usedBy);
});

it("records admin voucher usage only if this booking has not already been counted", async () => {
    const bookingId = new mongoose.Types.ObjectId();
    const voucherId = new mongoose.Types.ObjectId();
    const update = mock.method(Voucher, "findOneAndUpdate", async (filter, changes) => {
        assert.equal(filter._id, voucherId);
        assert.deepEqual(filter["usedBy.booking"], { $ne: bookingId });
        assert.equal(changes.$inc.usageCount, 1);
        assert.equal(changes.$push.usedBy.booking, bookingId);
        return null; // A repeated request does not match the conditional write.
    });
    await recordVoucherUsage(voucherId, userId, bookingId);
    assert.equal(update.mock.callCount(), 1);
});

it("rejects missing or invalid usage IDs before changing voucher counters", async () => {
    const update = mock.method(Voucher, "findOneAndUpdate", async () => assert.fail("must not write"));
    for (const [customer, booking] of [[undefined, userId], [userId, undefined], ["invalid", userId]]) {
        await assert.rejects(recordVoucherUsage(new mongoose.Types.ObjectId(), customer, booking),
            error => error.statusCode === 400);
    }
    assert.equal(update.mock.callCount(), 0);
});

it("cannot claim a second use for the same booking even when a voucher permits multiple uses", async () => {
    const bookingId = new mongoose.Types.ObjectId();
    mock.method(Voucher, "findOneAndUpdate", async filter => {
        assert.deepEqual(filter["usedBy.booking"], { $ne: bookingId });
        assert.ok(filter.$expr, "per-customer usage limits must still be enforced");
        return null;
    });
    assert.equal(await claimVoucherUsage(new mongoose.Types.ObjectId(), userId, bookingId), false);
});

it("omits vouchers exhausted by this customer, but counts other customers separately", async () => {
    const exhausted = voucher({ usedBy: [{ user: userId }] });
    const anotherCustomer = voucher({ usedBy: [{ user: otherUserId }] });
    const remaining = voucher({ maxUsagesPerUser: 2, usedBy: [{ user: userId }] });
    const restored = voucher();
    mockAvailable([exhausted, anotherCustomer, remaining, restored]);
    assert.deepEqual((await getActiveVouchersForUser(userId)).map(v => v._id),
        [anotherCustomer._id, remaining._id, restored._id]);
});

it("defaults legacy vouchers without a per-user limit to one use", async () => {
    mockAvailable([voucher({ maxUsagesPerUser: undefined, usedBy: [{ user: userId }] })]);
    assert.equal((await getActiveVouchersForUser(userId)).length, 0);
});

it("does not expose assignment lists, other users' bookings, or audit data in customer responses", async () => {
    const promo = voucher({
        usedBy: [{ user: otherUserId, booking: new mongoose.Types.ObjectId() }],
        assignedTo: [userId, otherUserId], usageCount: 9,
        audit: { createdBy: otherUserId },
    });
    mockAvailable([promo]);
    const [publicPromo] = await getAvailableVouchers(userId);
    assert.equal(publicPromo.code, promo.code);
    assert.equal(publicPromo.discountValue, promo.discountValue);
    for (const field of ["usedBy", "assignedTo", "audit", "usageCount"]) {
        assert.equal(Object.hasOwn(publicPromo, field), false, field);
    }
});

it("includes status when checking a voucher lookup's active state", async () => {
    const active = voucher();
    mock.method(Voucher, "findById", () => ({
        select: async fields => Object.fromEntries(fields.split(" ").map(key => [key, active[key]])),
    }));
    assert.equal((await getPublicVoucherById(active._id)).code, active.code);
});

it("reports no more daily-rate reduction than the actual vehicle price", () => {
    const result = calculatePricingWithVoucher(pricing, voucher({ discountValue: 1000 }), userId);
    assert.equal(result.voucher.discount.dailyRateReduction, 600);
    assert.equal(result.voucher.discount.subtotalDiscount, 1200);
    assert.equal(result.totalAmount, 400);
});

it("applies vouchers after the best automatic discount without stacking automatic discounts", () => {
    const vehicle = { _id: new mongoose.Types.ObjectId(), pricing: { dailyRate: 1000 } };
    const resolved = resolveVehicleRate(vehicle, [
        { _id: "first", scope: "all_vehicles", discountMethod: "percentage", discountValue: 10 },
        { _id: "best", scope: "all_vehicles", discountMethod: "fixed", discountValue: 200 },
    ]);
    assert.equal(resolved.dailyRate, 800);
    const discounted = calculatePricingWithVoucher({ ...pricing, dailyRate: 800, subtotal: 1600 },
        voucher({ discountMethod: "percentage", discountValue: 25 }), userId);
    assert.equal(discounted.voucher.discount.discountedDailyRate, 600);
    assert.equal(discounted.totalAmount, 1600);
});

it("retains a booked automatic discount after the live sale ends", () => {
    const result = resolveVehicleRate({ pricing: { dailyRate: 1000 } }, [], {
        lockedDiscount: { discountMethod: "percentage", discountValue: 25 },
    });
    assert.equal(result.dailyRate, 750);
});

for (const [type, discountMethod, discountValue, expectedTotal] of [
    ["vehicle_price", "fixed", 100, 1400],
    ["vehicle_price", "percentage", 25, 1300],
    ["reservation_fee", "fixed", 200, 1500],
    ["reservation_fee", "percentage", 25, 1575],
    ["pickup_fee", "fixed", 200, 1550],
    ["pickup_fee", "percentage", 50, 1575],
    ["total", "fixed", 5000, 0],
    ["total", "percentage", 25, 1200],
]) {
    it(`keeps ${type} ${discountMethod} voucher pricing and undiscounted fees consistent`, () => {
        const result = calculatePricingWithVoucher(pricing,
            voucher({ type, discountMethod, discountValue }), userId);
        assert.equal(result.totalAmount, expectedTotal);
        assert.equal(result.driverFee, 200);
        assert.equal(result.returnDistanceFee, 50);
        assert.equal(pricing.totalAmount, 1600);
    });
}

it("does not apply a vehicle-specific sale to an unrelated vehicle", () => {
    const selected = new mongoose.Types.ObjectId();
    const sale = { scope: "specific_vehicles", vehicles: [selected],
        discountMethod: "percentage", discountValue: 50 };
    assert.equal(resolveVehicleRate({ _id: selected, pricing: { dailyRate: 1000 } }, [sale]).dailyRate, 500);
    assert.equal(resolveVehicleRate({ _id: otherUserId, pricing: { dailyRate: 1000 } }, [sale]).dailyRate, 1000);
});

it("caps a 100% automatic sale at zero before applying a rental voucher", () => {
    const resolved = resolveVehicleRate({ pricing: { dailyRate: 600 } }, [{
        scope: "all_vehicles", discountMethod: "percentage", discountValue: 100,
    }]);
    const result = calculatePricingWithVoucher({ ...pricing, dailyRate: resolved.dailyRate, subtotal: 0 },
        voucher({ discountValue: 1000 }), userId);
    assert.equal(result.voucher.discount.dailyRateReduction, 0);
    assert.equal(result.totalAmount, 400);
});

it("treats the voucher end date as inclusive in Manila", () => {
    const promo = voucher({ startDate: new Date("2026-11-01"), endDate: new Date("2026-11-13") });
    assert.equal(getVoucherDateState(promo, new Date("2026-11-13T15:59:59Z")), "current");
    assert.equal(getVoucherDateState(promo, new Date("2026-11-13T16:00:00Z")), "expired");
});

it("calculates voucher quotes from numeric strings without concatenating money", () => {
    const input = Object.fromEntries(Object.entries(pricing).map(([key, value]) => [key, String(value)]));
    const before = { ...input };
    const result = calculatePricingWithVoucher(input,
        voucher({ type: "total", discountMethod: "percentage", discountValue: 25 }), userId);
    assert.equal(result.totalAmount, 1200);
    assert.equal(result.voucher.discount.totalDiscount, 400);
    assert.equal(result.subtotal, 1200);
    assert.deepEqual(input, before);
});

it("defaults omitted fees to zero in a partial rental quote", () => {
    const result = calculatePricingWithVoucher({ dailyRate: 600, rentalDays: 2, subtotal: 1200 }, voucher(), userId);
    assert.equal(result.totalAmount, 1000);
    assert.equal(result.driverFee, 0);
    assert.equal(result.returnDistanceFee, 0);
    assert.equal(result.voucher.discount.subtotalDiscount, 200);
});

it("derives a missing rental subtotal before calculating the voucher savings", () => {
    const result = calculatePricingWithVoucher({ dailyRate: 600, rentalDays: 2 }, voucher(), userId);
    assert.equal(result.subtotal, 1200);
    assert.equal(result.totalAmount, 1000);
    assert.equal(result.voucher.discount.subtotalDiscount, 200);
});

it("does not invent one rental day when dates are cleared to a zero-day quote", () => {
    const result = calculatePricingWithVoucher({ ...pricing, rentalDays: 0, subtotal: 0 }, voucher(), userId);
    assert.equal(result.voucher.discount.newSubtotal, 0);
    assert.equal(result.voucher.discount.subtotalDiscount, 0);
    assert.equal(result.totalAmount, 400);
});

it("continues to price fractional rental days correctly", () => {
    const result = calculatePricingWithVoucher({ ...pricing, rentalDays: 0.5, subtotal: 300 }, voucher(), userId);
    assert.equal(result.totalAmount, 650);
    assert.equal(result.voucher.discount.subtotalDiscount, 50);
});

for (const bad of ["invalid", "", false, [], {}, -1, Infinity, NaN]) {
    it(`rejects an invalid quote amount (${JSON.stringify(bad)}) rather than returning an invalid total`, () => {
        assert.throws(() => calculatePricingWithVoucher({ ...pricing, pickupDistanceFee: bad }, voucher(), userId),
            error => error.statusCode === 400);
    });
}

it("rejects quote amounts that overflow during money rounding", () => {
    assert.throws(() => calculatePricingWithVoucher({ ...pricing, returnDistanceFee: 1e308 }, voucher(), userId),
        error => error.statusCode === 400);
});
