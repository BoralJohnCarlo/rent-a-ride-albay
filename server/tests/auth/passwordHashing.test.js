import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

let sequence = 0;
const data = password => ({ firstName: "Test", lastName: "Customer", email: `hash-${++sequence}@example.test`, phoneNumber: "09175551234", password });
before(async () => { await connectTestDb(); await User.init(); });
after(disconnectTestDb);

test("new accounts hash a user-entered $2 password", async () => {
    const password = "$2Password123";
    const user = await User.create(data(password));
    assert.notEqual(user.password, password);
    assert.equal(await user.comparePassword(password), true);
});

test("even a complete bcrypt hash entered as a password is treated as plaintext", async () => {
    const password = await bcrypt.hash("UnderlyingPass123", 4);
    const user = await User.create(data(password));
    assert.notEqual(user.password, password);
    assert.equal(await user.comparePassword(password), true);
    assert.equal(await user.comparePassword("UnderlyingPass123"), false);
});

test("registration explicitly preserves its trusted hash and consumes the marker", async () => {
    const hash = await bcrypt.hash("RegisteredPass123", 4);
    const user = new User(data(hash));
    user.$locals.registrationPasswordHash = hash;
    await user.save();
    assert.equal(user.password, hash);
    assert.equal(user.$locals.registrationPasswordHash, undefined);
    assert.equal(await user.comparePassword("RegisteredPass123"), true);
    const stored = await User.collection.findOne({ _id: user._id });
    assert.equal(stored.$locals, undefined);
    user.firstName = "Updated";
    await user.save();
    assert.equal(user.password, hash);
});

test("password edits hash bcrypt-looking input even if a registration marker is set", async () => {
    const user = await User.create(data("OriginalPass123"));
    const password = await bcrypt.hash("DifferentPass123", 4);
    user.password = password;
    user.$locals.registrationPasswordHash = password;
    await user.save();
    assert.notEqual(user.password, password);
    assert.equal(await user.comparePassword(password), true);
    assert.equal(await user.comparePassword("DifferentPass123"), false);
    assert.ok(user.passwordChangedAt);
    assert.equal(user.$locals.registrationPasswordHash, undefined);
});

test("oversized password saves are rejected without modifying persisted credentials", async () => {
    const user = await User.create(data("OriginalPass123"));
    for (const password of ["Aa1" + "x".repeat(70), "Aa1" + "😀".repeat(18)]) {
        user.password = password;
        await assert.rejects(user.save(), error => error.statusCode === 400 && /72 UTF-8 bytes/.test(error.message));
        const stored = await User.findById(user._id).select("+password");
        assert.equal(await stored.comparePassword("OriginalPass123"), true);
        assert.equal(stored.passwordChangedAt, null);
    }
});

test("a 72-byte multibyte password is stored and authenticated without truncation", async () => {
    const password = "Aa1" + "é".repeat(34) + "x";
    const user = await User.create(data(password));
    assert.equal(await user.comparePassword(password), true);
    assert.equal(await user.comparePassword(password.slice(0, -1) + "y"), false);
});

test("legacy long passwords can still authenticate and be replaced", async () => {
    const password = "Aa1" + "x".repeat(100);
    const hash = await bcrypt.hash(password, 4);
    const result = await User.collection.insertOne(data(hash));
    const user = await User.findById(result.insertedId).select("+password");
    assert.equal(await user.comparePassword(password), true);
    user.password = "ReplacementPass123";
    await user.save();
    assert.equal(await user.comparePassword("ReplacementPass123"), true);
});
