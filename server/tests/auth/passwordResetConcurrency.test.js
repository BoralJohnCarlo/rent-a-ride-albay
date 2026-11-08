import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import transporter from "../../config/email.js";
import { requestPasswordReset, verifyPasswordResetCode, resetPassword } from "../../services/passwordResetService.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const token = "a".repeat(64);
const originalPassword = "OriginalPass123";
const sendMail = transporter.sendMail;
let sequence = 0;
const createUser = overrides => User.create({
    firstName: "Test", lastName: "Customer", email: `reset-race-${++sequence}@example.test`,
    phoneNumber: "09175551234", password: originalPassword,
    passwordResetCode: "old-code", passwordResetExpires: new Date(Date.now() + 600000),
    passwordResetSentAt: new Date(Date.now() - 120000), passwordResetAttempts: 4,
    passwordResetToken: sha256(token), passwordResetTokenExpires: new Date(Date.now() + 600000),
    ...overrides,
});
const storedUser = id => User.findById(id).select("+password +passwordResetCode +passwordResetExpires +passwordResetAttempts +passwordResetToken +passwordResetTokenExpires");
const assertFreshCode = async id => {
    const stored = await storedUser(id);
    assert.match(stored.passwordResetCode, /^[a-f0-9]{64}$/);
    assert.equal(stored.passwordResetAttempts, 0);
    assert.ok(stored.passwordResetExpires > new Date());
};

before(async () => {
    transporter.sendMail = async () => ({ messageId: "test" });
    await connectTestDb();
    await User.init();
});
beforeEach(async () => { await Promise.all([User.deleteMany({}), Notification.deleteMany({})]); });
after(async () => { transporter.sendMail = sendMail; await disconnectTestDb(); });

test("a delayed old-code guess cannot clear a replacement reset code", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = function (filter, changes, options) {
        const query = update.call(this, filter, changes, options);
        if (changes.$inc?.passwordResetAttempts) {
            return { select: async selection => {
                await requestPasswordReset(user.email);
                return query.select(selection);
            } };
        }
        return query;
    };
    try {
        await assert.rejects(verifyPasswordResetCode(user.email, "111111"), /invalid or has expired/);
        await assertFreshCode(user._id);
    } finally { User.findOneAndUpdate = update; }
});

test("a replacement code is protected even if the random digits repeat", async () => {
    const user = await createUser({ passwordResetCode: sha256("111111") });
    const update = User.findOneAndUpdate;
    const randomInt = crypto.randomInt;
    crypto.randomInt = () => 111111;
    User.findOneAndUpdate = function (filter, changes, options) {
        const query = update.call(this, filter, changes, options);
        if (changes.$inc?.passwordResetAttempts) {
            return { select: async selection => {
                await requestPasswordReset(user.email);
                return query.select(selection);
            } };
        }
        return query;
    };
    try {
        await assert.rejects(verifyPasswordResetCode(user.email, "222222"), /invalid or has expired/);
        await assertFreshCode(user._id);
        assert.equal((await storedUser(user._id)).passwordResetCode, sha256("111111"));
    } finally { User.findOneAndUpdate = update; crypto.randomInt = randomInt; }
});

test("a resend between counting the fifth guess and lockout preserves the new code", async () => {
    const user = await createUser();
    const update = User.updateOne;
    User.updateOne = function (filter, changes, ...options) {
        if (changes.$set?.passwordResetCode === null) {
            return (async () => {
                await requestPasswordReset(user.email);
                return update.call(this, filter, changes, ...options);
            })();
        }
        return update.call(this, filter, changes, ...options);
    };
    try {
        await assert.rejects(verifyPasswordResetCode(user.email, "111111"), /Too many incorrect codes/);
        await assertFreshCode(user._id);
    } finally { User.updateOne = update; }
});

test("a code that expires before being claimed cannot issue a reset token", async () => {
    const code = "123456";
    const user = await createUser({ passwordResetCode: sha256(code), passwordResetAttempts: 0, passwordResetToken: null });
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = function (filter, changes, options) {
        if (changes.$set?.passwordResetToken) {
            return (async () => {
                await User.updateOne({ _id: user._id }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
                return update.call(this, filter, changes, options);
            })();
        }
        return update.call(this, filter, changes, options);
    };
    try {
        await assert.rejects(verifyPasswordResetCode(user.email, code), /invalid or has expired/);
        assert.equal((await storedUser(user._id)).passwordResetToken, null);
    } finally { User.findOneAndUpdate = update; }
});

test("overlapping password resets consume one token once and store the winner's password", async () => {
    const user = await createUser();
    const passwords = ["FirstReplacement123", "SecondReplacement123"];
    const results = await Promise.allSettled(passwords.map(password => resetPassword(user.email, token, password)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const loser = results.find(result => result.status === "rejected");
    assert.match(loser.reason.message, /reset session has expired/);
    const stored = await storedUser(user._id);
    const winner = results.findIndex(result => result.status === "fulfilled");
    assert.equal(await stored.comparePassword(passwords[winner]), true);
    assert.equal(await stored.comparePassword(passwords[1 - winner]), false);
    assert.equal(stored.passwordResetToken, null);
    assert.ok(stored.passwordChangedAt);
    assert.equal(stored.credentialVersion, 1);
    assert.equal(await Notification.countDocuments({ recipient: user._id, title: "Password Reset" }), 1);
});

test("hash failure preserves the original password and reset token for retry", async () => {
    const user = await createUser();
    const hash = bcrypt.hash;
    bcrypt.hash = async () => { throw new Error("simulated hash failure"); };
    try {
        await assert.rejects(resetPassword(user.email, token, "ReplacementPass123"), /simulated hash failure/);
    } finally { bcrypt.hash = hash; }
    const stored = await storedUser(user._id);
    assert.equal(stored.passwordResetToken, sha256(token));
    assert.equal(await stored.comparePassword(originalPassword), true);
    await resetPassword(user.email, token, "ReplacementPass123");
});

test("database failure does not consume the reset token or change the password", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = () => { throw new Error("simulated database failure"); };
    try {
        await assert.rejects(resetPassword(user.email, token, "ReplacementPass123"), /simulated database failure/);
    } finally { User.findOneAndUpdate = update; }
    const stored = await storedUser(user._id);
    assert.equal(stored.passwordResetToken, sha256(token));
    assert.equal(await stored.comparePassword(originalPassword), true);
    await resetPassword(user.email, token, "ReplacementPass123");
});

test("a token that expires while hashing cannot change the password", async () => {
    const user = await createUser();
    const hash = bcrypt.hash;
    bcrypt.hash = async (...args) => {
        const result = await hash(...args);
        await User.updateOne({ _id: user._id }, { $set: { passwordResetTokenExpires: new Date(Date.now() - 1000) } });
        return result;
    };
    try {
        await assert.rejects(resetPassword(user.email, token, "ReplacementPass123"), /reset session has expired/);
    } finally { bcrypt.hash = hash; }
    const stored = await storedUser(user._id);
    assert.equal(await stored.comparePassword(originalPassword), true);
    assert.equal(stored.passwordChangedAt, null);
});
