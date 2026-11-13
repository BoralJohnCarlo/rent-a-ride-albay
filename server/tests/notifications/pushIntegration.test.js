import "dotenv/config";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { generateVAPIDKeys } from "web-push";
import { logout } from "../../controllers/logoutController.js";
import User from "../../models/User.js";
import Booking from "../../models/Booking.js";
import Notification from "../../models/Notification.js";
import PushSubscription from "../../models/PushSubscription.js";
import PushDelivery from "../../models/PushDelivery.js";
import { persistNotification } from "../../services/notificationStore.js";
import { sendBrowserPush, processPushDeliveries, pushTransport, sessionHash, claimNextPushDelivery } from "../../services/webPushService.js";

// A separate throwaway database; never touch the development database.
const database = `rent_a_ride_albay_test_push_${process.pid}_${Date.now()}`;
let server;
let baseUrl;
let notificationService;
const originalEnvironment = { ...process.env };
const keys = generateVAPIDKeys();
const configurePush = () => Object.assign(process.env, {
    VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "mailto:test@example.com", JWT_SECRET: "push-integration-test-secret",
});
before(async () => {
    await mongoose.connect(process.env.MONGO_URI, { dbName: database, serverSelectionTimeoutMS: 5000 });
    await Promise.all([User, Booking, Notification, PushSubscription, PushDelivery].map((model) => model.init()));
    configurePush();
    // Avoid the application's SMTP startup probe contacting an external server.
    Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_SECURE: "false" });
    notificationService = await import("../../services/notificationService.js");
    const { default: notificationRoutes } = await import("../../routes/notificationRoutes.js");
    const app = express();
    app.use(express.json(), cookieParser());
    app.use("/notifications", notificationRoutes);
    app.post("/logout", logout);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
        if (mongoose.connection.name === database && database.startsWith("rent_a_ride_albay_test_push_")) await mongoose.connection.dropDatabase();
    } finally {
        await mongoose.disconnect();
        process.env = originalEnvironment;
    }
});
beforeEach(async () => {
    configurePush();
    await Promise.all([User, Booking, Notification, PushSubscription, PushDelivery].map((model) => model.deleteMany({})));
});
const makeUser = async (role) => {
    const user = new User({ _id: new mongoose.Types.ObjectId(), firstName: "Test", lastName: "Account", email: `${role}-${crypto.randomUUID()}@example.com`, password: "hashed-test-fixture", phoneNumber: "09171234567", role, credentialVersion: 0 });
    // Tests exercise push/session behavior, not password hashing.
    await User.collection.insertOne(user.toObject());
    const token = jwt.sign({ id: String(user._id), credentialVersion: 0 }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return { user, token };
};
const request = async (method, path, account, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method, headers: { "Content-Type": "application/json", ...(account && { Cookie: `token=${account.token}` }) },
        ...(body && { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
};
const subscriptionBody = () => ({ endpoint: `https://fcm.googleapis.com/wp/${crypto.randomUUID()}`, keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } });
const subscribe = async (account, body = subscriptionBody()) => {
    assert.equal((await request("POST", "/notifications/push/subscription", account, body)).status, 200);
    return PushSubscription.findOne({ endpoint: body.endpoint });
};
const importantEvent = { admin: "New Booking Request", operator: "Withdrawal Failed", customer: "Booking Approved" };
const notificationFor = (account, extra = {}) => persistNotification({ recipient: account.user._id, type: importantEvent[account.user.role], title: importantEvent[account.user.role], message: "Private test customer details", category: "Booking", ...extra });

for (const role of ["admin", "operator", "customer"]) {
    test(`${role}: enable, check status, queue an important event, deliver once, disable`, async (t) => {
        const account = await makeUser(role);
        const subscription = await subscribe(account);
        const status = await request("POST", "/notifications/push/status", account, { endpoint: subscription.endpoint });
        assert.equal(status.body.subscribed, true);
        const config = await request("GET", "/notifications/push/config", account);
        assert.equal(config.body.publicKey, keys.publicKey);
        assert.equal(JSON.stringify(config.body).includes(keys.privateKey), false);
        const notification = await notificationFor(account);
        const sent = [];
        t.mock.method(pushTransport, "sendNotification", async (target, payload) => sent.push({ target, data: JSON.parse(payload) }));
        // Pause claims briefly to inspect the actual notification-to-queue path.
        const paused = t.mock.method(PushDelivery, "findOneAndUpdate", async () => null);
        await sendBrowserPush(account.user, notification);
        await processPushDeliveries();
        paused.mock.restore();
        const job = await PushDelivery.findOne({ notification: notification._id });
        assert.ok(job, "important notification persisted in the delivery queue");
        await processPushDeliveries();
        await processPushDeliveries();
        assert.equal(sent.length, 1);
        assert.equal(sent[0].target.endpoint, subscription.endpoint);
        assert.equal(sent[0].data.url, `/${role}/notifications`);
        assert.equal(JSON.stringify(sent[0]).includes("Private test customer"), false);
        const completed = await PushDelivery.findById(job._id);
        assert.ok(completed.nextAttemptAt >= completed.expiresAt);
        assert.equal((await request("DELETE", "/notifications/push/subscription", account, { endpoint: subscription.endpoint })).status, 200);
        assert.equal(await PushSubscription.countDocuments({ recipient: account.user._id }), 0);
    });
}

test("routine and wrong-role events do not enter any role's delivery queue", async () => {
    for (const role of ["admin", "operator", "customer"]) {
        const account = await makeUser(role);
        await subscribe(account);
        const routine = await notificationFor(account, { type: "review", title: "New Review" });
        await sendBrowserPush(account.user, routine);
        const unrelated = await notificationFor(account, { type: role === "customer" ? "Consignment Approved" : "Booking Approved", title: "Unrelated role event" });
        await sendBrowserPush(account.user, unrelated);
    }
    assert.equal(await PushDelivery.countDocuments({}), 0);
});

test("boundary warnings actually reach subscribed customers and link to their booking", async (t) => {
    const account = await makeUser("customer");
    await subscribe(account);
    const bookingId = new mongoose.Types.ObjectId();
    const notification = await notificationFor(account, { type: "Boundary Alert", title: "Vehicle outside Albay",
        metadata: { relatedModel: "Booking", relatedId: bookingId } });
    const sent = [];
    t.mock.method(pushTransport, "sendNotification", async (_target, payload) => sent.push(JSON.parse(payload)));
    await sendBrowserPush(account.user, notification);
    await processPushDeliveries();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, `/customer/bookings/${bookingId}`);
});

test("a boundary warning cancelled after queueing is not pushed", async (t) => {
    const account = await makeUser("customer");
    await subscribe(account);
    const notification = await notificationFor(account, { type: "Boundary Alert", title: "Vehicle outside Albay" });
    let sent = 0;
    t.mock.method(pushTransport, "sendNotification", async () => { sent++; });
    const paused = t.mock.method(PushDelivery, "findOneAndUpdate", async () => null);
    await sendBrowserPush(account.user, notification);
    await processPushDeliveries();
    paused.mock.restore();
    assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 1);
    await Notification.updateOne({ _id: notification._id }, { $set: { pushCancelled: true } });
    await processPushDeliveries();
    assert.equal(sent, 0);
    assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 0);
});

test("unauthenticated callers are rejected and another account cannot read or delete a subscription", async () => {
    assert.equal((await request("GET", "/notifications/push/config")).status, 401);
    const owner = await makeUser("customer");
    const other = await makeUser("operator");
    const subscription = await subscribe(owner);
    assert.equal((await request("POST", "/notifications/push/status", other, { endpoint: subscription.endpoint })).body.subscribed, false);
    await request("DELETE", "/notifications/push/subscription", other, { endpoint: subscription.endpoint });
    assert.ok(await PushSubscription.findById(subscription._id));
});

test("notification-change limits are per account and return a retryable JSON message", async () => {
    const first = await makeUser("customer");
    const second = await makeUser("customer");
    const body = subscriptionBody();
    for (let i = 0; i < 20; i++) assert.equal((await request("POST", "/notifications/push/subscription", first, body)).status, 200);
    const limited = await request("POST", "/notifications/push/subscription", first, body);
    assert.equal(limited.status, 429);
    assert.match(limited.body.message, /try again/i);
    assert.equal((await request("POST", "/notifications/push/subscription", second, subscriptionBody())).status, 200);
});

test("concurrent pickup reminders create exactly one notification and ordinary notifications remain independent", async () => {
    const account = await makeUser("customer");
    const input = { recipient: account.user._id, type: "Pickup Reminder", title: "Upcoming Pickup", category: "Booking", message: "Pickup soon", dedupeKey: "pickup:booking:date" };
    const results = await Promise.all(Array.from({ length: 12 }, () => persistNotification(input)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await Notification.countDocuments({ dedupeKey: input.dedupeKey }), 1);
    const { dedupeKey, ...ordinary } = input;
    await Promise.all([persistNotification(ordinary), persistNotification(ordinary)]);
    assert.equal(await Notification.countDocuments({ recipient: account.user._id }), 3);
});

for (const all of [false, true]) {
    test(`${all ? "clearing the inbox" : "deleting a reminder"} preserves deduplication but removes content and visible/unread counts`, async () => {
        const account = await makeUser("customer");
        const reminder = await notificationFor(account, { type: "Pickup Reminder", title: "Upcoming Pickup", dedupeKey: "pickup:booking:date", metadata: { relatedId: new mongoose.Types.ObjectId(), relatedModel: "Booking" } });
        const ordinary = await notificationFor(account);
        const result = await request("DELETE", all ? "/notifications" : `/notifications/${reminder._id}`, account);
        assert.equal(result.status, 200);
        const receipt = await Notification.findById(reminder._id);
        assert.equal(receipt.dismissed, true);
        assert.equal(receipt.pushPending, false);
        assert.equal(receipt.read, true);
        assert.equal(receipt.message.includes("Private"), false);
        assert.equal(receipt.metadata.relatedId, undefined);
        const listings = await request("GET", "/notifications", account);
        assert.equal(listings.body.pagination.total, all ? 0 : 1);
        assert.equal(listings.body.data.some((item) => item._id === String(reminder._id)), false);
        const unread = await request("GET", "/notifications/unread-count", account);
        assert.equal(unread.body.data.count, all ? 0 : 1);
        assert.equal(await notificationFor(account, { dedupeKey: reminder.dedupeKey }), null);
        assert.equal((await request("PUT", `/notifications/${reminder._id}/read`, account, {})).status, 404);
        if (all) assert.equal(await Notification.findById(ordinary._id), null);
    });
}

test("the actual pickup sweep cannot resurrect a deleted reminder, but a rescheduled pickup gets a new one", async () => {
    const account = await makeUser("customer");
    const booking = { _id: new mongoose.Types.ObjectId(), bookingCode: "BK-pickup-test", status: "Approved", customer: account.user._id, startDate: new Date(Date.now() + 12 * 60 * 60 * 1000) };
    await Booking.collection.insertOne(booking);
    const { sendPickupReminders } = await import("../../services/pickupReminderService.js");
    await sendPickupReminders();
    const reminder = await Notification.findOne({ recipient: account.user._id });
    assert.ok(reminder);
    await request("DELETE", `/notifications/${reminder._id}`, account);
    await Promise.all([sendPickupReminders(), sendPickupReminders()]);
    assert.equal(await Notification.countDocuments({ recipient: account.user._id }), 1);
    assert.equal((await request("GET", "/notifications", account)).body.pagination.total, 0);
    await Booking.updateOne({ _id: booking._id }, { $set: { startDate: new Date(booking.startDate.getTime() + 60 * 60 * 1000) } });
    await sendPickupReminders();
    assert.equal((await request("GET", "/notifications", account)).body.pagination.total, 1);
    await processPushDeliveries();
});

for (const role of ["admin", "operator", "customer"]) {
    test(`${role}: a failed initial queue insert is recovered from the saved notification`, async (t) => {
        const account = await makeUser(role);
        await subscribe(account);
        const failure = t.mock.method(PushDelivery, "updateOne", async () => { throw new Error("simulated initial queue outage"); });
        const notification = await notificationService.createNotification({ recipient: account.user._id, type: importantEvent[role], title: importantEvent[role], message: "Important test update", category: "Booking" });
        assert.ok(notification, "in-app notification survives queue failure");
        assert.equal((await Notification.findById(notification._id)).pushPending, true);
        assert.equal(await PushDelivery.countDocuments({}), 0);
        failure.mock.restore();
        let sends = 0;
        t.mock.method(pushTransport, "sendNotification", async () => { sends++; });
        await processPushDeliveries();
        await processPushDeliveries();
        assert.equal(sends, 1);
        assert.equal((await Notification.findById(notification._id)).pushPending, false);
        assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 1);
    });
}

test("recovery repairs partial fanout without sending the completed device twice", async (t) => {
    const account = await makeUser("customer");
    const first = await subscribe(account);
    const second = await subscribe(account);
    const notification = await notificationFor(account);
    const expiresAt = new Date(Date.now() + 60_000);
    await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: first._id, sessionHash: sessionHash(account.token), expiresAt, nextAttemptAt: expiresAt, leaseUntil: expiresAt });
    const sent = [];
    t.mock.method(pushTransport, "sendNotification", async (target) => sent.push(target.endpoint));
    await processPushDeliveries();
    assert.deepEqual(sent, [second.endpoint]);
    assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 2);
});

test("recovery never replays an old alert to a newly enabled session", async (t) => {
    const account = await makeUser("operator");
    const notification = await notificationFor(account);
    await subscribe(account);
    // Model the explicit ordering even on machines with millisecond clock granularity.
    await PushSubscription.updateMany({ recipient: account.user._id }, { $set: { enabledAt: new Date(notification.createdAt.getTime() + 1000) } });
    t.mock.method(pushTransport, "sendNotification", async () => assert.fail("historical alert replayed"));
    await processPushDeliveries();
    assert.equal(await PushDelivery.countDocuments({}), 0);
    assert.equal((await Notification.findById(notification._id)).pushPending, false);
});

test("one recovery lookup failure leaves its notification pending and does not block another notification or an existing queued job", async (t) => {
    const broken = await makeUser("customer");
    const healthy = await makeUser("operator");
    const queued = await makeUser("admin");
    await subscribe(broken);
    await subscribe(healthy);
    const subscription = await subscribe(queued);
    const failedNotification = await notificationFor(broken);
    await notificationFor(healthy);
    const queuedNotification = await notificationFor(queued);
    await Notification.updateOne({ _id: queuedNotification._id }, { $set: { pushPending: false } });
    await PushDelivery.create({ recipient: queued.user._id, notification: queuedNotification._id, subscription: subscription._id, sessionHash: sessionHash(queued.token), expiresAt: new Date(Date.now() + 60_000) });
    const findUser = User.findById.bind(User);
    t.mock.method(User, "findById", (id) => String(id) === String(broken.user._id)
        ? { select: async () => { throw new Error("one recovery lookup failed"); } } : findUser(id));
    const sent = [];
    t.mock.method(pushTransport, "sendNotification", async (_subscription, payload) => sent.push(JSON.parse(payload).tag));
    await processPushDeliveries();
    assert.equal(sent.length, 2);
    assert.ok(sent.includes(String(queuedNotification._id)));
    assert.equal((await Notification.findById(failedNotification._id)).pushPending, true);
});

test("a failed recovery scan does not stop delivery of existing queued jobs", async (t) => {
    const account = await makeUser("admin");
    const subscription = await subscribe(account);
    const notification = await notificationFor(account);
    await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: subscription._id, sessionHash: sessionHash(account.token), expiresAt: new Date(Date.now() + 60_000) });
    t.mock.method(Notification, "find", () => ({ sort: () => ({ limit: async () => { throw new Error("recovery scan unavailable"); } }) }));
    let sent = 0;
    t.mock.method(pushTransport, "sendNotification", async () => { sent++; });
    await processPushDeliveries();
    assert.equal(sent, 1);
});

test("temporary provider failure survives a new worker pass and succeeds without resending a completed job", async (t) => {
    const account = await makeUser("admin");
    const subscription = await subscribe(account);
    const notification = await notificationFor(account);
    const job = await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: subscription._id, sessionHash: sessionHash(account.token), expiresAt: new Date(Date.now() + 600_000) });
    let attempts = 0;
    t.mock.method(pushTransport, "sendNotification", async () => { if (++attempts === 1) throw { statusCode: 503 }; });
    await processPushDeliveries();
    const deferred = await PushDelivery.findById(job._id);
    assert.equal(deferred.attempts, 1);
    assert.ok(deferred.nextAttemptAt > new Date());
    await PushDelivery.updateOne({ _id: job._id }, { $set: { nextAttemptAt: new Date(0) } });
    await processPushDeliveries();
    await processPushDeliveries();
    assert.equal(attempts, 2);
});

test("two concurrent enqueues retain one durable receipt per subscription", async (t) => {
    const account = await makeUser("operator");
    await subscribe(account);
    const notification = await notificationFor(account);
    // No due claims here, so enqueue races cannot trigger a real external request.
    t.mock.method(PushDelivery, "findOneAndUpdate", async () => null);
    await Promise.all([sendBrowserPush(account.user, notification), sendBrowserPush(account.user, notification)]);
    await processPushDeliveries();
    assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 1);
});

test("logout clears the cookie and succeeds when push cleanup fails", async (t) => {
    const account = await makeUser("customer");
    t.mock.method(PushSubscription, "deleteMany", () => ({ maxTimeMS: async () => { throw new Error("database unavailable"); } }));
    const result = await request("POST", "/logout", account, {});
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.match(result.cookie, /token=;/);
});

test("multiple server claims cannot send the same job; expired leases recover safely", async () => {
    const account = await makeUser("admin");
    const subscription = await subscribe(account);
    const notification = await notificationFor(account);
    const job = await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: subscription._id, sessionHash: sessionHash(account.token), expiresAt: new Date(Date.now() + 600_000) });
    const claims = await Promise.all(Array.from({ length: 12 }, () => claimNextPushDelivery()));
    assert.equal(claims.filter(Boolean).length, 1);
    const oldClaim = claims.find(Boolean);
    await PushDelivery.updateOne({ _id: job._id }, { $set: { leaseUntil: new Date(0) } });
    const recovered = await claimNextPushDelivery();
    assert.notEqual(recovered.claimToken, oldClaim.claimToken);
    const staleUpdate = await PushDelivery.updateOne({ _id: job._id, claimToken: oldClaim.claimToken }, { $set: { attempts: 100 } });
    assert.equal(staleUpdate.modifiedCount, 0);
    assert.equal(recovered.attempts, 2);
});

test("expired provider subscriptions are removed and exhausted deliveries do not retry", async (t) => {
    const account = await makeUser("operator");
    const subscription = await subscribe(account);
    const notification = await notificationFor(account);
    await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: subscription._id, sessionHash: sessionHash(account.token), expiresAt: new Date(Date.now() + 600_000) });
    let attempts = 0;
    t.mock.method(pushTransport, "sendNotification", async () => { attempts++; throw { statusCode: 410 }; });
    await processPushDeliveries();
    await processPushDeliveries();
    assert.equal(attempts, 1);
    assert.equal(await PushSubscription.findById(subscription._id), null);
    await PushDelivery.create({ recipient: account.user._id, notification: new mongoose.Types.ObjectId(), subscription: subscription._id, sessionHash: "old", attempts: 5, expiresAt: new Date(Date.now() + 600_000) });
    assert.equal(await claimNextPushDelivery(), null);
});

test("logout revokes the current session but leaves another device signed in", async () => {
    const account = await makeUser("operator");
    const current = await subscribe(account);
    const other = await PushSubscription.create({ recipient: account.user._id, endpoint: subscriptionBody().endpoint, keys: subscriptionBody().keys, sessionHash: "other-session", issuedAt: 1, expiresAt: new Date(Date.now() + 60_000) });
    assert.equal((await request("POST", "/logout", account, {})).status, 200);
    assert.equal(await PushSubscription.findById(current._id), null);
    assert.ok(await PushSubscription.findById(other._id));
});

for (const reason of ["logout", "password", "suspended", "switched-account", "read", "deleted", "expired"]) {
    test(`queued deliveries stop after ${reason}`, async (t) => {
        const account = await makeUser("customer");
        const subscription = await subscribe(account);
        const notification = await notificationFor(account);
        await PushDelivery.create({ recipient: account.user._id, notification: notification._id, subscription: subscription._id, sessionHash: sessionHash(account.token), expiresAt: new Date(Date.now() + 60_000) });
        if (reason === "logout") await request("POST", "/logout", account, {});
        if (reason === "password") await User.updateOne({ _id: account.user._id }, { $inc: { credentialVersion: 1 } });
        if (reason === "suspended") await User.updateOne({ _id: account.user._id }, { $set: { isSuspended: true } });
        if (reason === "switched-account") await PushSubscription.updateOne({ _id: subscription._id }, { $set: { recipient: new mongoose.Types.ObjectId(), sessionHash: "different-login" } });
        if (reason === "read") await Notification.updateOne({ _id: notification._id }, { $set: { read: true } });
        if (reason === "deleted") await Notification.deleteOne({ _id: notification._id });
        if (reason === "expired") await PushSubscription.updateOne({ _id: subscription._id }, { $set: { expiresAt: new Date(0) } });
        t.mock.method(pushTransport, "sendNotification", async () => assert.fail("revoked delivery sent"));
        await processPushDeliveries();
        assert.equal(await PushDelivery.countDocuments({ notification: notification._id }), 0);
    });
}
