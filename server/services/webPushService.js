import { sendNotification } from "web-push";
import { createHash, randomUUID } from "node:crypto";
import PushSubscription from "../models/PushSubscription.js";
import PushDelivery from "../models/PushDelivery.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { shouldPush, pushPath } from "../utils/pushPolicy.js";
import { getPushConfiguration } from "../utils/pushConfiguration.js";

export const sessionHash = (token) => createHash("sha256").update(token || "").digest("hex");
export const pushTransport = { sendNotification };
export const pushConfigured = () => Boolean(getPushConfiguration());

const MAX_ATTEMPTS = 5;
const HOUR = 60 * 60 * 1000;

export const nextPushAttempt = (error, attempts, now = new Date()) => {
    const status = error.statusCode;
    if (attempts >= MAX_ATTEMPTS || (status && ![408, 425, 429].includes(status) && status < 500)) return null;
    const header = error.headers?.["retry-after"];
    const retryAfter = typeof header === "string" && /^\d+$/.test(header)
        ? now.getTime() + Number(header) * 1000 : Date.parse(header);
    const backoff = now.getTime() + Math.min(300_000, 15_000 * 2 ** (attempts - 1));
    return new Date(Math.max(backoff, Number.isFinite(retryAfter) ? retryAfter : 0));
};

// Persist first; provider requests run separately from the business operation.
export const sendBrowserPush = async (user, notification) => {
    if (!pushConfigured()) return;
    const finish = () => Notification.updateOne({ _id: notification._id }, { $set: { pushPending: false } });
    if (!user || user.isSuspended || notification.read || notification.dismissed || !shouldPush(user.role, notification)) {
        await finish();
        return;
    }
    const now = new Date();
    const occurredAt = new Date(notification.createdAt || now);
    const expiresAt = new Date(occurredAt.getTime() + HOUR);
    if (expiresAt <= now) { await finish(); return; }
    const subscriptions = await PushSubscription.find({
        recipient: user._id, expiresAt: { $gt: now },
        $or: [
            { enabledAt: { $lte: occurredAt } },
            { enabledAt: { $exists: false }, createdAt: { $lte: occurredAt } },
        ],
    });
    await Promise.all(subscriptions.map(async (subscription) => {
        if (user.isTokenStale(subscription.issuedAt, subscription.credentialVersion)) {
            await PushSubscription.deleteOne({ _id: subscription._id, sessionHash: subscription.sessionHash });
            return;
        }
        try {
            await PushDelivery.updateOne({ notification: notification._id, subscription: subscription._id }, {
                $setOnInsert: {
                    recipient: user._id, sessionHash: subscription.sessionHash, expiresAt,
                    attempts: 0, nextAttemptAt: now, leaseUntil: new Date(0),
                },
            }, { upsert: true });
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }));
    await finish();
    void processPushDeliveries().catch(() => console.warn("Browser push worker unavailable; queued deliveries will retry"));
};

export const recoverPendingPushNotifications = async () => {
    if (!pushConfigured()) return;
    const notifications = await Notification.find({
        pushPending: true, dismissed: { $ne: true }, read: false,
        createdAt: { $gt: new Date(Date.now() - HOUR) },
    }).sort({ createdAt: 1 }).limit(50);
    for (const notification of notifications) {
        try {
            const user = await User.findById(notification.recipient).select("role credentialVersion passwordChangedAt isSuspended");
            await sendBrowserPush(user, notification);
        } catch {
            console.warn("One browser push recovery failed; pending notification retained for retry");
        }
    }
};

export const deliverClaimedPush = async (job) => {
    const claim = { _id: job._id, claimToken: job.claimToken };
    try {
        const [subscription, user, notification] = await Promise.all([
            PushSubscription.findOne({ _id: job.subscription, recipient: job.recipient, sessionHash: job.sessionHash, expiresAt: { $gt: new Date() } }),
            User.findById(job.recipient).select("role credentialVersion passwordChangedAt isSuspended"),
            Notification.findById(job.notification),
        ]);
        if (!subscription || !user || user.isSuspended || !notification || notification.read || notification.dismissed ||
            String(notification.recipient) !== String(job.recipient) || !shouldPush(user.role, notification) ||
            job.expiresAt <= new Date()) {
            await PushDelivery.deleteOne(claim);
            return;
        }
        if (user.isTokenStale(subscription.issuedAt, subscription.credentialVersion)) {
            await PushSubscription.deleteOne({ _id: subscription._id, sessionHash: job.sessionHash });
            await PushDelivery.deleteOne(claim);
            return;
        }
        await pushTransport.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        }, JSON.stringify({
            title: "Rent-A-Ride Albay",
            body: "An important update needs your attention. Open your notifications to view it.",
            tag: String(notification._id), url: pushPath(user.role, notification), expiresAt: job.expiresAt.getTime(),
        }), {
            TTL: Math.max(0, Math.ceil((job.expiresAt - Date.now()) / 1000)), timeout: 5000,
            vapidDetails: getPushConfiguration(),
        });
        // A completed receipt prevents re-enqueueing from resending it before expiry.
        await PushDelivery.updateOne(claim, { $set: { nextAttemptAt: job.expiresAt, leaseUntil: job.expiresAt } });
    } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
            await PushSubscription.deleteOne({ _id: job.subscription, recipient: job.recipient, sessionHash: job.sessionHash });
        }
        const retry = nextPushAttempt(error, job.attempts);
        await PushDelivery.updateOne(claim, { $set: {
            nextAttemptAt: retry && retry < job.expiresAt ? retry : job.expiresAt,
            leaseUntil: new Date(0),
        } });
        console.warn("Browser push delivery deferred or stopped", error.statusCode || "transport error");
    }
};

let processing = null;
export const claimNextPushDelivery = () => {
    const now = new Date();
    return PushDelivery.findOneAndUpdate({
        nextAttemptAt: { $lte: now }, leaseUntil: { $lte: now },
        expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS },
    }, {
        $set: { claimToken: randomUUID(), leaseUntil: new Date(now.getTime() + 60_000) },
        $inc: { attempts: 1 },
    }, { returnDocument: "after", sort: { nextAttemptAt: 1 } });
};

export const processPushDeliveries = () => {
    if (processing) return processing;
    if (!pushConfigured()) return Promise.resolve();
    processing = runPushDeliveries().finally(() => { processing = null; });
    return processing;
};

const runPushDeliveries = async () => {
    try {
        await recoverPendingPushNotifications();
    } catch {
        console.warn("Browser push recovery scan unavailable; continuing existing deliveries");
    }
    let remaining = 20;
    await Promise.all(Array.from({ length: 4 }, async () => {
        while (remaining-- > 0) {
            const job = await claimNextPushDelivery();
            if (!job) break;
            await deliverClaimedPush(job);
        }
    }));
};
