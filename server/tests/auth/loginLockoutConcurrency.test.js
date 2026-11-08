import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { loginUser } from "../../services/authService.js";
import { changeUserPassword } from "../../services/userService.js";
import transporter from "../../config/email.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const password = "OriginalPass123";
const wrongPassword = "IncorrectPass123";
const replacement = "ReplacementPass123";
const sendMail = transporter.sendMail;
let sequence = 0;
const createUser = overrides => User.create({ firstName: "Test", lastName: "Customer", email: `login-${++sequence}@example.test`, phoneNumber: "09175551234", password, ...overrides });
const storedUser = id => User.findById(id).select("+loginAttempts +lockoutUntil +password");
const wrongLogin = user => loginUser({ email: user.email, password: wrongPassword });
const correctLogin = user => loginUser({ email: user.email, password });

before(async () => { transporter.sendMail = async () => ({ messageId: "test" }); await connectTestDb(); await User.init(); });
beforeEach(async () => { await User.deleteMany({}); });
after(async () => { transporter.sendMail = sendMail; await disconnectTestDb(); });

test("five parallel failures lock the account, including after an expired lockout", async () => {
    for (const overrides of [{}, { loginAttempts: 5, lockoutUntil: new Date(Date.now() - 1000) }]) {
        const user = await createUser(overrides);
        const results = await Promise.allSettled(Array.from({ length: 5 }, () => wrongLogin(user)));
        assert.ok(results.every(result => result.status === "rejected"));
        assert.ok(results.some(result => /locked/.test(result.reason.message)));
        const stored = await storedUser(user._id);
        assert.equal(stored.loginAttempts, 5);
        assert.ok(stored.lockoutUntil > new Date());
        assert.equal(stored.credentialVersion, 0);
    }
});

test("extra overlapping attempts do not exceed five or extend an active lockout", async () => {
    const user = await createUser();
    await Promise.allSettled(Array.from({ length: 10 }, () => wrongLogin(user)));
    const locked = await storedUser(user._id);
    assert.equal(locked.loginAttempts, 5);
    assert.ok(locked.lockoutUntil > new Date());
    await assert.rejects(wrongLogin(user), /temporarily locked/);
    await assert.rejects(correctLogin(user), /temporarily locked/);
    const unchanged = await storedUser(user._id);
    assert.equal(unchanged.loginAttempts, 5);
    assert.equal(unchanged.lockoutUntil.getTime(), locked.lockoutUntil.getTime());
});

test("expired lockouts start at one failure and a subsequent correct login recovers normally", async () => {
    const user = await createUser({ loginAttempts: 5, lockoutUntil: new Date(Date.now() - 1000) });
    await assert.rejects(wrongLogin(user), /Invalid email or password/);
    const failed = await storedUser(user._id);
    assert.equal(failed.loginAttempts, 1);
    assert.equal(failed.lockoutUntil, null);
    const result = await correctLogin(user);
    assert.equal(jwt.verify(result.token, process.env.JWT_SECRET).credentialVersion, 0);
    const stored = await storedUser(user._id);
    assert.equal(stored.loginAttempts, 0);
    assert.equal(stored.lockoutUntil, null);
    assert.ok(stored.lastLogin);
});

test("a successful login clears failures and does not expose the password", async () => {
    const user = await createUser({ loginAttempts: 4 });
    const result = await correctLogin(user);
    assert.equal(String(result.user.id), String(user._id));
    assert.equal(Object.hasOwn(result.user, "password"), false);
    assert.equal((await storedUser(user._id)).loginAttempts, 0);
});

test("a correct-password request cannot clear a lockout that committed while checking", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    const lockoutUntil = new Date(Date.now() + 900000);
    User.findOneAndUpdate = function (filter, changes, options) {
        if (!Array.isArray(changes) && changes.$set?.lastLogin) {
            return (async () => {
                await User.updateOne({ _id: user._id }, { $set: { loginAttempts: 5, lockoutUntil } });
                return update.call(this, filter, changes, options);
            })();
        }
        return update.call(this, filter, changes, options);
    };
    try { await assert.rejects(correctLogin(user), /temporarily locked/); }
    finally { User.findOneAndUpdate = update; }
    const stored = await storedUser(user._id);
    assert.equal(stored.loginAttempts, 5);
    assert.equal(stored.lockoutUntil.getTime(), lockoutUntil.getTime());
    assert.equal(stored.lastLogin, user.lastLogin);
});

test("a delayed failed login cannot count against a replacement password", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = function (filter, changes, options) {
        if (Array.isArray(changes)) {
            return (async () => {
                await changeUserPassword(user._id, password, replacement);
                return update.call(this, filter, changes, options);
            })();
        }
        return update.call(this, filter, changes, options);
    };
    try { await assert.rejects(wrongLogin(user), /Invalid email or password/); }
    finally { User.findOneAndUpdate = update; }
    const stored = await storedUser(user._id);
    assert.equal(stored.loginAttempts, 0);
    assert.equal(stored.lockoutUntil, null);
    assert.equal(stored.credentialVersion, 1);
    assert.ok((await loginUser({ email: user.email, password: replacement })).token);
});

test("a delayed successful login cannot issue a session after the password changes", async () => {
    const user = await createUser();
    const update = User.findOneAndUpdate;
    User.findOneAndUpdate = function (filter, changes, options) {
        if (!Array.isArray(changes) && changes.$set?.lastLogin) {
            return (async () => {
                await changeUserPassword(user._id, password, replacement);
                return update.call(this, filter, changes, options);
            })();
        }
        return update.call(this, filter, changes, options);
    };
    try { await assert.rejects(correctLogin(user), /account details changed/); }
    finally { User.findOneAndUpdate = update; }
    const result = await loginUser({ email: user.email, password: replacement });
    assert.equal(jwt.verify(result.token, process.env.JWT_SECRET).credentialVersion, 1);
});

test("legacy accounts without counter fields start counting at one", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { $unset: { loginAttempts: "", lockoutUntil: "" } });
    await assert.rejects(wrongLogin(user), /Invalid email or password/);
    assert.equal((await storedUser(user._id)).loginAttempts, 1);
});
