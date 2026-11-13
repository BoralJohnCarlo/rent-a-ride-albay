import test from "node:test";
import assert from "node:assert/strict";
import { shouldPush, pushPath, validPushSubscription } from "../../utils/pushPolicy.js";
import { nextPushAttempt } from "../../services/webPushService.js";
import PushSubscription from "../../models/PushSubscription.js";
import { pickupReminderDue } from "../../utils/pickupReminder.js";
import { getPickupReference } from "../../services/cancellationPolicyService.js";
import { getPushConfig, getPushStatus, subscribePush, unsubscribePush } from "../../controllers/pushController.js";
import jwt from "jsonwebtoken";
import { generateVAPIDKeys } from "web-push";
import { pushConfigured } from "../../services/webPushService.js";

test("boundary alerts reach every authorized role, link to the correct screen and stop after cancellation", () => {
    const notification = { type: "Boundary Alert", metadata: { relatedModel: "Booking", relatedId: "a".repeat(24) } };
    for (const role of ["admin", "operator", "customer"]) {
        assert.equal(shouldPush(role, notification), true);
        assert.equal(shouldPush(role, { ...notification, pushCancelled: true }), false);
    }
    assert.equal(pushPath("customer", notification), `/customer/bookings/${"a".repeat(24)}`);
    assert.equal(pushPath("admin", notification), "/admin/settings/penalties");
    assert.equal(shouldPush("stranger", notification), false);
});

test("push configuration rejects malformed and mismatched keys and invalid contacts without exposing secrets", (t) => {
    const originalEnvironment = { ...process.env };
    t.after(() => { process.env = originalEnvironment; });
    const keys = generateVAPIDKeys();
    const other = generateVAPIDKeys();
    const valid = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com" };
    Object.assign(process.env, valid);
    assert.equal(pushConfigured(), true);
    for (const changes of [
        { VAPID_PUBLIC_KEY: "test" }, { VAPID_PRIVATE_KEY: "test" },
        { VAPID_PUBLIC_KEY: other.publicKey }, { VAPID_PRIVATE_KEY: other.privateKey },
        { VAPID_SUBJECT: "invalid" }, { VAPID_SUBJECT: "http://example.com" },
        { VAPID_SUBJECT: "mailto:" }, { VAPID_SUBJECT: "mailto:@" },
        { VAPID_SUBJECT: "mailto:name@" }, { VAPID_SUBJECT: "mailto:name%20name@example.com" },
        { VAPID_SUBJECT: "https://localhost" },
        { VAPID_PRIVATE_KEY: "" },
    ]) {
        Object.assign(process.env, valid, changes);
        assert.equal(pushConfigured(), false);
        const res = { json(value) { this.body = value; } };
        getPushConfig({}, res);
        assert.deepEqual(res.body, { enabled: false, publicKey: null });
    }
    Object.assign(process.env, valid, { VAPID_SUBJECT: "https://example.com/support" });
    assert.equal(pushConfigured(), true, "valid configuration becomes available after correcting environment values");
});

test("subscription writes and deletes use authenticated identity, not request identity", async (t) => {
    const originalEnvironment = { ...process.env };
    t.after(() => { process.env = originalEnvironment; });
    const keys = generateVAPIDKeys();
    Object.assign(process.env, { JWT_SECRET: "test-only-secret", VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com" });
    const token = jwt.sign({ id: "authenticated", credentialVersion: 2 }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const body = { endpoint: "https://fcm.googleapis.com/wp/test", keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) }, recipient: "attacker-selected" };
    const req = { user: { _id: "authenticated" }, cookies: { token }, body, query: { endpoint: body.endpoint } };
    const res = { json(value) { this.body = value; return this; }, status(value) { this.statusCode = value; return this; } };
    t.mock.method(PushSubscription, "exists", async () => false);
    t.mock.method(PushSubscription, "countDocuments", async () => 0);
    let saved;
    t.mock.method(PushSubscription, "findOneAndUpdate", async (_query, update) => { saved = update.$set; });
    await subscribePush(req, res);
    assert.equal(res.body.success, true);
    assert.equal(saved.recipient, "authenticated");
    assert.equal(saved.credentialVersion, 2);
    assert.equal(saved.sessionHash.includes(token), false);
    assert.ok(saved.expiresAt > new Date());
    let removed;
    t.mock.method(PushSubscription, "deleteOne", async (query) => { removed = query; });
    await unsubscribePush(req, res);
    assert.deepEqual(removed, { endpoint: body.endpoint, recipient: "authenticated" });
    await getPushStatus(req, res);
    assert.equal(res.body.subscribed, false);
    await getPushConfig(req, res);
    assert.equal(Object.hasOwn(res.body, "privateKey"), false);
});

test("invalid push destinations are rejected before any database operation", async () => {
    const res = { json(value) { this.body = value; return this; }, status(value) { this.statusCode = value; return this; } };
    const originalEnvironment = { ...process.env };
    try {
        const keys = generateVAPIDKeys();
        Object.assign(process.env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com" });
        await subscribePush({ body: { endpoint: "https://localhost/private" } }, res);
        assert.equal(res.statusCode, 400);
    } finally { process.env = originalEnvironment; }
});

test("pickup reminders use the existing Manila pickup reference and exclude past pickups", () => {
    const start = new Date("2026-11-15T00:00:00+08:00");
    const pickup = getPickupReference(start).getTime();
    assert.equal(pickupReminderDue(start, new Date(pickup - 24 * 60 * 60 * 1000)), true);
    assert.equal(pickupReminderDue(start, new Date(pickup - 25 * 60 * 60 * 1000)), false);
    assert.equal(pickupReminderDue(start, new Date(pickup)), false);
    assert.equal(pickupReminderDue(start, new Date(pickup + 1000)), false);
});

test("important events are role-specific; unknown and routine events stay in-app", () => {
    for (const [role, event] of [["customer", "Booking Approved"], ["customer", "Rental Return Reminder"], ["operator", "Withdrawal Failed"], ["admin", "New Booking Request"]]) {
        assert.equal(shouldPush(role, { type: event }), true);
        assert.equal(shouldPush(role, { type: "generic", title: event }), true);
    }
    for (const role of ["admin", "customer", "operator", "unknown"]) {
        assert.equal(shouldPush(role, { type: "Promo", title: "New promotion" }), false);
        assert.equal(shouldPush(role, { type: "Review", title: "New review" }), false);
    }
    assert.equal(shouldPush("customer", { type: "Consignment Approved" }), false);
    assert.equal(shouldPush("operator", { type: "Vehicle Maintenance", title: "Vehicle Back in Service" }), false);
});

test("push endpoints cannot target local, arbitrary, or lookalike hosts", () => {
    const subscription = { endpoint: "https://fcm.googleapis.com/wp/abc", keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } };
    assert.equal(validPushSubscription(subscription), true);
    for (const endpoint of ["http://fcm.googleapis.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://fcm.googleapis.com.evil.example/a", "https://user@fcm.googleapis.com/a", "https://fcm.googleapis.com:8443/a"]) {
        assert.equal(validPushSubscription({ ...subscription, endpoint }), false);
    }
    assert.equal(validPushSubscription({ ...subscription, keys: {} }), false);
    assert.equal(validPushSubscription(null), false);
});

test("booking links require an actual identifier and otherwise use the role inbox", () => {
    const notification = { metadata: { relatedModel: "Booking", relatedId: "a".repeat(24) } };
    assert.equal(pushPath("customer", notification), `/customer/bookings/${"a".repeat(24)}`);
    assert.equal(pushPath("admin", notification), "/admin/notifications");
    notification.metadata.relatedId = "https://evil.example";
    assert.equal(pushPath("customer", notification), "/customer/notifications");
});

test("retry backoff respects provider Retry-After and stops permanent errors and exhausted attempts", () => {
    const now = new Date("2026-11-10T00:00:00Z");
    assert.equal(nextPushAttempt(new Error("offline"), 1, now).getTime() - now, 15_000);
    assert.equal(nextPushAttempt({ statusCode: 503 }, 3, now).getTime() - now, 60_000);
    assert.equal(nextPushAttempt({ statusCode: 429, headers: { "retry-after": "120" } }, 1, now).getTime() - now, 120_000);
    assert.equal(nextPushAttempt({ statusCode: 503, headers: { "retry-after": "Tue, 10 Nov 2026 00:03:00 GMT" } }, 1, now).getTime() - now, 180_000);
    for (const statusCode of [400, 401, 403, 404, 410, 413]) assert.equal(nextPushAttempt({ statusCode }, 1, now), null);
    assert.equal(nextPushAttempt(new Error("offline"), 5, now), null);
});
