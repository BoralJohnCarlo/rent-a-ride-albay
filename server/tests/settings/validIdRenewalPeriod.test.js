import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import nodemailer from "nodemailer";
import User from "../../models/User.js";
import Settings from "../../models/Settings.js";
import mongoose from "mongoose";
import Notification from "../../models/Notification.js";
import { refreshValidIdRenewalPeriod } from "../../utils/validIdRenewalPeriod.js";

mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
const { requestRenewalAttempt, uploadRenewedValidId, grantExtraRenewalAttempt,
    checkValidIdExpirationNotifications } = await import("../../services/userService.js");
mock.restoreAll();
afterEach(() => mock.restoreAll());

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const mockTransactions = () => {
    // Model serialized guard transactions without requiring a live database.
    let pending = Promise.resolve();
    mock.method(mongoose, "startSession", async () => ({
        withTransaction(run) {
            const result = pending.then(run);
            pending = result.catch(() => {});
            return result;
        },
        endSession: async () => {},
    }));
    return mock.method(mongoose.model("BookingCreationGuard"), "updateOne", async () => ({}));
};

it("an expired legacy period only resets once and preserves the last upload date", () => {
    const user = { validIdRenewalCount: 3, lastValidIdRenewalAt: new Date("2020-01-01") };
    const now = Date.parse("2026-11-01T00:00:00Z");
    refreshValidIdRenewalPeriod(user, YEAR_MS, now);
    assert.equal(user.validIdRenewalCount, 0);
    user.validIdRenewalCount = 1;
    refreshValidIdRenewalPeriod(user, YEAR_MS, now + 1000);
    assert.equal(user.validIdRenewalCount, 1);
    assert.equal(user.lastValidIdRenewalAt.toISOString(), "2020-01-01T00:00:00.000Z");
    refreshValidIdRenewalPeriod(user, YEAR_MS, now + YEAR_MS);
    assert.equal(user.validIdRenewalCount, 0);
});

it("legacy accounts keep their used quota until their period actually expires", () => {
    const now = Date.now();
    const user = { validIdRenewalCount: 2, lastValidIdRenewalAt: new Date(now - 1000) };
    refreshValidIdRenewalPeriod(user, YEAR_MS, now);
    assert.equal(user.validIdRenewalCount, 2);
    assert.equal(user.validIdRenewalPeriodStartedAt.getTime(), now - 1000);
    const noUpload = { validIdRenewalCount: 1 };
    refreshValidIdRenewalPeriod(noUpload, YEAR_MS, now);
    assert.equal(noUpload.validIdRenewalCount, 1);
    assert.equal(noUpload.validIdRenewalPeriodStartedAt.getTime(), now);
});

it("requesting again after an expired-period reset respects maxAttempts", async () => {
    mockTransactions();
    const user = new User({ firstName: "Test", lastName: "User", email: "test@example.com",
        validIdRenewalCount: 1, lastValidIdRenewalAt: new Date("2020-01-01") });
    mock.method(User, "findById", () => ({ session: async () => user }));
    mock.method(User, "find", () => ({ select: async () => [] }));
    mock.method(Settings, "findOne", () => ({ session: async () => ({ validIdRenewalSettings: { maxAttempts: 1, renewalPeriodYears: 1 } }) }));
    const save = mock.method(user, "save", async () => user);
    await requestRenewalAttempt(user._id);
    await assert.rejects(requestRenewalAttempt(user._id), (error) => error.statusCode === 400);
    assert.equal(save.mock.callCount(), 1);
    assert.equal(user.validIdRenewalCount, 1);
    assert.ok(user.validIdRenewalPeriodStartedAt);
});

it("concurrent requests share a user guard and only one consumes the final slot", async () => {
    const guards = mockTransactions();
    const id = new mongoose.Types.ObjectId();
    let persisted = { _id: id, firstName: "Test", lastName: "User", email: "test@example.com",
        validIdRenewalCount: 0, validIdRenewalPeriodStartedAt: new Date() };
    mock.method(User, "findById", () => ({ session: async (session) => {
        assert.ok(session);
        return new User(persisted);
    } }));
    mock.method(User, "find", () => ({ select: async () => [] }));
    mock.method(Settings, "findOne", () => ({ session: async () => ({ validIdRenewalSettings: { maxAttempts: 1 } }) }));
    const saves = mock.method(User.prototype, "save", async function (options) {
        assert.ok(options.session);
        persisted = this.toObject();
        return this;
    });
    const results = await Promise.allSettled([requestRenewalAttempt(id), requestRenewalAttempt(id)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.find((result) => result.status === "rejected").reason.statusCode, 400);
    assert.equal(saves.mock.callCount(), 1);
    assert.equal(persisted.validIdRenewalCount, 1);
    for (const call of guards.mock.calls) assert.equal(call.arguments[0]._id, `valid-id-renewal:${id}`);
});

it("an exhausted upload uses the same guard and is refused before writing", async () => {
    const guards = mockTransactions();
    const user = new User({ validIdRenewalCount: 1, validIdRenewalPeriodStartedAt: new Date() });
    mock.method(User, "findById", () => ({ session: async () => user }));
    mock.method(Settings, "findOne", () => ({ session: async () => ({ validIdRenewalSettings: { maxUploadsPerYear: 1 } }) }));
    const save = mock.method(user, "save", async () => user);
    await assert.rejects(uploadRenewedValidId(user._id, { url: "new-id.jpg" }), (error) => error.statusCode === 400);
    assert.equal(save.mock.callCount(), 0);
    assert.equal(guards.mock.calls[1].arguments[0]._id, `valid-id-renewal:${user._id}`);
});

it("admin-granted quota changes use the same guard and transactional save", async () => {
    const guards = mockTransactions();
    const user = new User({ validIdRenewalCount: 2 });
    mock.method(User, "findById", () => ({ session: async () => user }));
    mock.method(user, "save", async (options) => { assert.ok(options.session); return user; });
    await grantExtraRenewalAttempt(String(user._id), "different-admin", 1);
    assert.equal(user.validIdRenewalCount, 1);
    assert.equal(guards.mock.calls[1].arguments[0]._id, `valid-id-renewal:${user._id}`);
});

for (const settings of [null, {}, { validIdExpirationSettings: { notifyOnExpired: false } },
    { validIdExpirationSettings: { notifyOnExpired: true } }]) {
    it(`expired notice follows explicit opt-in: ${JSON.stringify(settings)}`, async () => {
        mock.method(User, "findById", async () => ({ _id: new mongoose.Types.ObjectId(), validIdExpirationDate: new Date("2020-01-01") }));
        mock.method(Settings, "findOne", async () => settings);
        mock.method(Notification, "exists", async () => null);
        const create = mock.method(Notification, "create", async () => ({}));
        await checkValidIdExpirationNotifications("user");
        assert.equal(create.mock.callCount(), settings?.validIdExpirationSettings?.notifyOnExpired === true ? 1 : 0);
    });
}
