import "../helpers/mockEmail.js";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import transporter from "../../config/email.js";
import generateToken from "../../utils/generateToken.js";
import { protect } from "../../middleware/authMiddleware.js";
import authenticateSocket from "../../sockets/socketAuthMiddleware.js";
import { changeUserPassword } from "../../services/userService.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const originalPassword = "OriginalPass123";
const sendMail = transporter.sendMail;
let sequence = 0;
const createUser = () => User.create({ firstName: "Test", lastName: "Customer", email: `session-${++sequence}@example.test`, phoneNumber: "09175551234", password: originalPassword });
const storedUser = id => User.findById(id).select("+password +passwordResetCode +passwordResetToken");
const claims = (user, version = user.credentialVersion ?? 0) => ({ id: String(user._id), role: user.role, credentialVersion: version });
const httpAccess = async token => {
    const result = { status: 200 };
    const res = { status: code => { result.status = code; return res; }, json: body => { result.body = body; } };
    await protect({ cookies: { token } }, res, () => { result.accepted = true; });
    return result;
};
const socketAccess = async token => {
    let result;
    await authenticateSocket({ request: { cookies: { token } } }, error => { result = error ?? null; });
    return result;
};

before(async () => { transporter.sendMail = async () => ({ messageId: "test" }); await connectTestDb(); await User.init(); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), Notification.deleteMany({})]); });
after(async () => { transporter.sendMail = sendMail; await disconnectTestDb(); });

test("credential versions distinguish sessions with identical JWT issue times", () => {
    const timestamp = Date.UTC(2030, 0, 1, 0, 0, 0, 500);
    const issuedAt = Math.floor(timestamp / 1000);
    const user = new User({ credentialVersion: 2, passwordChangedAt: new Date(timestamp) });
    assert.equal(user.isTokenStale(issuedAt, 1), true);
    assert.equal(user.isTokenStale(issuedAt, 2), false);
    assert.equal(user.isTokenStale(issuedAt), true);
    for (const version of [null, "2", -1, 2.5]) assert.equal(user.isTokenStale(issuedAt, version), true);
});

test("overlapping password changes have one winner and send one security notice", async () => {
    const user = await createUser();
    const passwords = ["FirstChangedPass123", "SecondChangedPass123"];
    const results = await Promise.allSettled(passwords.map(password => changeUserPassword(user._id, originalPassword, password)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.statusCode, 409);
    const winner = results.findIndex(result => result.status === "fulfilled");
    const stored = await storedUser(user._id);
    assert.equal(await stored.comparePassword(passwords[winner]), true);
    assert.equal(await stored.comparePassword(passwords[1 - winner]), false);
    assert.equal(stored.credentialVersion, 1);
    assert.equal(await Notification.countDocuments({ recipient: user._id, title: "Password Changed" }), 1);
});

test("HTTP and socket authentication reject old versions even with the same JWT second", async () => {
    const user = await createUser();
    const iat = Math.floor(Date.now() / 1000);
    const oldToken = generateToken({ ...claims(user), iat });
    const updated = await changeUserPassword(user._id, originalPassword, "ReplacementPass123");
    const freshToken = generateToken({ ...claims(updated), iat });
    assert.equal(jwt.decode(oldToken).iat, jwt.decode(freshToken).iat);
    assert.equal((await httpAccess(oldToken)).body.code, "PASSWORD_CHANGED");
    assert.match((await socketAccess(oldToken)).message, /password was changed/);
    assert.equal((await httpAccess(freshToken)).accepted, true);
    assert.equal(await socketAccess(freshToken), null);
});

test("legacy users and tokens keep working until the next password change", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { $unset: { credentialVersion: "" } });
    // Production legacy tokens had an expiry, but no credentialVersion.
    const legacyToken = jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    assert.equal((await httpAccess(legacyToken)).accepted, true);
    assert.equal(await socketAccess(legacyToken), null);
    const updated = await changeUserPassword(user._id, originalPassword, "ReplacementPass123");
    assert.equal(updated.credentialVersion, 1);
    assert.equal((await httpAccess(legacyToken)).body.code, "PASSWORD_CHANGED");
    assert.match((await socketAccess(legacyToken)).message, /password was changed/);
    assert.equal((await httpAccess(generateToken(claims(updated)))).accepted, true);
});

test("changing a password invalidates outstanding recovery codes and tokens", async () => {
    const user = await createUser();
    const token = crypto.createHash("sha256").update("reset-token").digest("hex");
    await User.updateOne({ _id: user._id }, { $set: { passwordResetCode: "code", passwordResetToken: token } });
    await changeUserPassword(user._id, originalPassword, "ReplacementPass123");
    const stored = await storedUser(user._id);
    assert.equal(stored.passwordResetCode, null);
    assert.equal(stored.passwordResetToken, null);
});

test("hash failure preserves credentials and session version", async () => {
    const user = await createUser();
    const hash = bcrypt.hash;
    bcrypt.hash = async () => { throw new Error("simulated hash failure"); };
    try { await assert.rejects(changeUserPassword(user._id, originalPassword, "ReplacementPass123"), /simulated hash failure/); }
    finally { bcrypt.hash = hash; }
    const stored = await storedUser(user._id);
    assert.equal(stored.credentialVersion, 0);
    assert.equal(await stored.comparePassword(originalPassword), true);
    assert.equal((await httpAccess(generateToken(claims(user)))).accepted, true);
});

test("database failure preserves credentials and session version for retry", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = () => { throw new Error("simulated database failure"); };
    try { await assert.rejects(changeUserPassword(user._id, originalPassword, "ReplacementPass123"), /simulated database failure/); }
    finally { User.findOneAndUpdate = update; }
    const stored = await storedUser(user._id);
    assert.equal(stored.credentialVersion, 0);
    assert.equal(await stored.comparePassword(originalPassword), true);
    assert.equal((await changeUserPassword(user._id, originalPassword, "ReplacementPass123")).credentialVersion, 1);
});
