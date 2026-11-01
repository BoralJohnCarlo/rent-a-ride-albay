import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import nodemailer from "nodemailer";
import Settings from "../../models/Settings.js";
import { validatePayoutSettingsPatch, resolvePayoutSettings } from "../../utils/payoutSettings.js";

mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
const { calculateBookingPayout, updatePayoutSettings } = await import("../../services/payoutService.js");
const { updatePayoutSettingsHandler } = await import("../../controllers/payoutController.js");
const { updateBookingLocationPolicy } = await import("../../services/settingsService.js");
mock.restoreAll();
afterEach(() => mock.restoreAll());

it("commission splits preserve centavos and add up to the booking amount", () => {
    assert.deepEqual(calculateBookingPayout(100.5, {}, 10), { platformCommission: 10.05, payoutAmount: 90.45 });
    assert.deepEqual(calculateBookingPayout(100.5, { commission: { mode: "PERCENTAGE", value: 90 } }, 10),
        { platformCommission: 10.05, payoutAmount: 90.45 });
    assert.deepEqual(calculateBookingPayout(100.5, { commission: { mode: "FIXED", value: 50.25 } }, 10),
        { platformCommission: 50.25, payoutAmount: 50.25 });
    for (const rate of [0, 10, 33.3, 100]) {
        const result = calculateBookingPayout(123.45, {}, rate);
        assert.equal(Math.round((result.platformCommission + result.payoutAmount) * 100), 12345);
    }
});

for (const patch of [{ payoutCurrency: "USD" }, { payoutHoldHours: 1e100 }, { payoutHoldHours: Infinity },
    { payoutHoldHours: 1.5 }, { payoutHoldHours: -1 }, { platformCommissionRate: NaN }, { platformCommissionRate: 101 }, null]) {
    it(`rejects invalid payout settings without writing: ${JSON.stringify(patch)}`, async () => {
        const write = mock.method(Settings, "findOneAndUpdate", () => { throw new Error("unexpected write"); });
        const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
        await updatePayoutSettingsHandler({ body: patch }, res);
        assert.equal(res.code, 400);
        assert.equal(write.mock.callCount(), 0);
    });
}

it("partial settings writes use individual fields and validators", async () => {
    const write = mock.method(Settings, "findOneAndUpdate", () => ({ lean: async () => ({
        commissionSettings: { platformCommissionRate: 15, payoutHoldHours: 72, payoutCurrency: "PHP" },
    }) }));
    const result = await updatePayoutSettings({ commissionSettings: { platformCommissionRate: 15 } });
    assert.deepEqual(write.mock.calls[0].arguments[1], { $set: { "commissionSettings.platformCommissionRate": 15 } });
    assert.equal(write.mock.calls[0].arguments[2].runValidators, true);
    assert.equal(result.commissionSettings.payoutHoldHours, 72);
});

it("general settings updates enforce the same PHP and hold policies", async () => {
    await assert.rejects(updateBookingLocationPolicy({ commissionSettings: { payoutCurrency: "USD" } }), (error) => error.statusCode === 400);
    await assert.rejects(updateBookingLocationPolicy({ commissionSettings: { payoutHoldHours: 1e100 } }), (error) => error.statusCode === 400);
});

it("zero and upper boundaries are valid, and unsafe legacy fields use defaults", () => {
    assert.deepEqual(validatePayoutSettingsPatch({ platformCommissionRate: 0, payoutHoldHours: 0 }), { platformCommissionRate: 0, payoutHoldHours: 0 });
    assert.equal(validatePayoutSettingsPatch({ payoutHoldHours: 8760 }).payoutHoldHours, 8760);
    assert.deepEqual(resolvePayoutSettings({ payoutCurrency: "USD", payoutHoldHours: 1e100 }),
        { platformCommissionRate: 10, payoutCurrency: "PHP", payoutHoldHours: 24 });
});
