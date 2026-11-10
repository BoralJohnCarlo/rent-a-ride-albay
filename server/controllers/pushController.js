import jwt from "jsonwebtoken";
import PushSubscription from "../models/PushSubscription.js";
import { validPushSubscription } from "../utils/pushPolicy.js";
import { pushConfigured, sessionHash } from "../services/webPushService.js";

export const getPushConfig = (req, res) => res.json({ enabled: pushConfigured(), publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });

export const getPushStatus = async (req, res) => {
    try {
        const subscribed = typeof req.body.endpoint === "string" && Boolean(await PushSubscription.exists({
            endpoint: req.body.endpoint, recipient: req.user._id, sessionHash: sessionHash(req.cookies.token), expiresAt: { $gt: new Date() },
        }));
        return res.json({ subscribed });
    } catch { return res.status(500).json({ message: "Could not load browser notification settings." }); }
};

export const subscribePush = async (req, res) => {
    if (!pushConfigured()) return res.status(503).json({ message: "Browser notifications are not configured yet." });
    if (!validPushSubscription(req.body)) return res.status(400).json({ message: "Invalid browser subscription." });
    try {
        const existing = await PushSubscription.exists({ endpoint: req.body.endpoint, recipient: req.user._id });
        if (!existing && await PushSubscription.countDocuments({ recipient: req.user._id, expiresAt: { $gt: new Date() } }) >= 10) {
            return res.status(400).json({ message: "Browser notification device limit reached. Disable notifications on another browser first." });
        }
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        await PushSubscription.findOneAndUpdate({ endpoint: req.body.endpoint }, { $set: {
            recipient: req.user._id, endpoint: req.body.endpoint,
            keys: { p256dh: req.body.keys.p256dh, auth: req.body.keys.auth },
            sessionHash: sessionHash(req.cookies.token), issuedAt: decoded.iat,
            enabledAt: new Date(),
            credentialVersion: decoded.credentialVersion, expiresAt: new Date(decoded.exp * 1000),
        } }, { upsert: true, runValidators: true });
        return res.json({ success: true });
    } catch { return res.status(500).json({ message: "Could not enable browser notifications." }); }
};

export const unsubscribePush = async (req, res) => {
    try {
        if (typeof req.body.endpoint !== "string") return res.status(400).json({ message: "Subscription endpoint required." });
        await PushSubscription.deleteOne({ endpoint: req.body.endpoint, recipient: req.user._id });
        return res.json({ success: true });
    } catch { return res.status(500).json({ message: "Could not disable browser notifications." }); }
};
