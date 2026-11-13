import BoundaryState from "../models/BoundaryState.js";
import Alert from "../models/Alert.js";
import { ALERT_DEFINITIONS } from "../constants/alertConstants.js";
import BoundaryIncident from "../models/BoundaryIncident.js";
import BoundaryNotice from "../models/BoundaryNotice.js";
import Notification from "../models/Notification.js";
import Settings from "../models/Settings.js";
import Rental from "../models/Rental.js";
import Booking from "../models/Booking.js";
import Tracker from "../models/Tracker.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import VehicleTrackingState from "../models/VehicleTrackingState.js";
import createError from "../utils/createError.js";
import { broadcastNewAlert, broadcastResolvedAlert } from "../sockets/broadcastAlerts.js";
import { resolveBoundarySettings, lockedBoundaryPolicy } from "../utils/boundaryPolicy.js";
import { classifyAlbayPosition, BOUNDARY_VERSION } from "../utils/albayBoundary.js";
import { transitionBoundary } from "../utils/boundaryTransition.js";
import { withBookingCreationTransaction } from "./bookingCreationTransaction.js";
import { getGpsStaleThresholdMs } from "../constants/alertConstants.js";
import { TRACKER_STATUS } from "../constants/telemetryConstants.js";

export const BOUNDARY_RESOURCE = "boundary-policy";
const money = value => `PHP ${Number(value).toFixed(2)}`;
const boundaryTypes = ["BOUNDARY_NEAR", "BOUNDARY_OUTSIDE"];
export const resolveBoundaryAlerts = async (vehicle, session, events = []) => {
    const alerts = await Alert.find({ ...(vehicle ? { vehicle } : {}), type: { $in: boundaryTypes }, status: "active" }).session(session);
    for (const alert of alerts) {
        alert.status = "resolved"; alert.resolvedAt = new Date();
        await alert.save({ session }); events.push({ kind: "resolved", alert: alert.toObject() });
    }
    return events;
};
export const publishBoundaryAlerts = events => {
    for (const event of events) {
        try { (event.kind === "created" ? broadcastNewAlert : broadcastResolvedAlert)(event.alert); }
        catch (error) { console.error("Boundary realtime delivery failed:", error.message); }
    }
};

// Preserve the in-app audit trail, but stop outdated warnings from being pushed.
// The push worker rechecks pushCancelled even for a previously queued delivery.
export const cancelBoundaryNotices = async (filter, session) => {
    const notices = await BoundaryNotice.find(filter).select("key").session(session).lean();
    const keys = notices.map(notice => notice.key);
    if (!keys.length) return;
    await BoundaryNotice.updateMany({ key: { $in: keys } }, { $set: { delivered: true } }, { session });
    await Notification.updateMany({ dedupeKey: { $in: keys } }, { $set: { pushPending: false, pushCancelled: true } }, { session });
};

export const cancelPendingBoundaryPenalties = async session => {
    const incidents = await BoundaryIncident.find({ $or: [{ active: true }, { review: "eligible" }] }).session(session);
    for (const incident of incidents) {
        if (incident.review === "approved") continue;
        incident.penaltyCancelledAt = new Date();
        if (incident.review === "eligible") {
            incident.review = "waived"; incident.reason = "Boundary penalties disabled by admin."; incident.reviewedAt = new Date();
        }
        await incident.save({ session });
        await cancelBoundaryNotices({ incident: incident._id, kind: "eligible" }, session);
    }
};

const enqueue = async (incident, event, vehicle, session) => {
    if (event === "outside" || event === "returned") await cancelBoundaryNotices({ incident: incident._id,
        kind: { $in: event === "outside" ? ["near"] : ["near", "outside"] } }, session);
    const p = incident.policy;
    const title = { near: "Approaching the Albay boundary", outside: "Vehicle outside Albay",
        eligible: "Boundary penalty needs review", returned: "Vehicle returned inside Albay",
        approved: "Boundary penalty approved", waived: "Boundary penalty waived" }[event];
    const message = { near: `Your vehicle is within ${p.warningDistanceKm} km of the Albay boundary. Please stay within Albay unless your trip has been approved.`,
        outside: `GPS confirms the vehicle is outside Albay. Please return safely. ${p.penaltiesEnabled ? `A ${p.gracePeriodMinutes}-minute grace period starts now. A penalty of up to ${money(p.penaltyAmount)} may be reviewed after confirmed outside travel; it is not charged automatically.` : "Boundary penalties are not enabled for this rental."}`,
        eligible: `Confirmed outside travel exceeded the grace period. A proposed ${money(incident.amount)} penalty requires admin review.`,
        returned: "The vehicle has returned inside Albay. The boundary countdown has stopped. Any already eligible penalty remains subject to admin review.",
        approved: `A boundary penalty of ${money(incident.amount)} was added to the rental. ${incident.reason || ""}`,
        waived: `The proposed boundary penalty was waived. ${incident.reason || ""}` }[event];
    const admins = await User.find({ role: "admin", isSuspended: { $ne: true } }).select("_id").session(session).lean();
    const rental = incident.rental && await Rental.findById(incident.rental).select("booking").session(session).lean();
    const recipients = new Set([incident.customer && String(incident.customer)]);
    if (event !== "near") {
        admins.forEach(user => recipients.add(String(user._id)));
        if (vehicle?.operator) recipients.add(String(vehicle.operator));
    }
    for (const recipient of [...recipients].filter(Boolean)) {
        const key = `boundary:${incident._id}:${event}:${recipient}`;
        const customerBooking = String(incident.customer || "") === recipient && rental?.booking;
        const payload = { type: "Boundary Alert", title, message, variant: event === "returned" ? "success" : "warning", category: "Rental",
            metadata: { relatedId: customerBooking || incident.rental || incident.vehicle,
                relatedModel: customerBooking ? "Booking" : incident.rental ? "Rental" : "Vehicle" } };
        // Persist the warning in the same transaction as crossing confirmation.
        // A delivery outage cannot silently consume the customer's grace period.
        await Notification.updateOne({ recipient, dedupeKey: key }, { $setOnInsert: {
            recipient, dedupeKey: key, ...payload, pushPending: true,
        } }, { upsert: true, session, runValidators: true });
        await BoundaryNotice.updateOne({ key }, { $setOnInsert: {
            key, recipient, incident: incident._id, kind: event,
            payload,
        } }, { upsert: true, session });
    }
};

export const deliverBoundaryNotices = async () => {
    const { createNotification } = await import("./notificationService.js");
    const { sendBrowserPush } = await import("./webPushService.js");
    const settings = resolveBoundarySettings((await Settings.findOne().select("boundarySettings").lean())?.boundarySettings);
    for (const notice of await BoundaryNotice.find({ delivered: false }).sort({ createdAt: 1 }).limit(100).lean()) {
        if (!settings.alertsEnabled && !["approved", "waived"].includes(notice.kind)) continue;
        const existing = await Notification.findOne({ recipient: notice.recipient, dedupeKey: notice.key });
        if (existing && !existing.pushCancelled) {
            const user = await User.findById(notice.recipient).select("role credentialVersion passwordChangedAt isSuspended");
            await sendBrowserPush(user, existing);
        }
        const notification = existing || await createNotification({ recipient: notice.recipient, dedupeKey: notice.key, ...notice.payload });
        if (notification || await Notification.exists({ recipient: notice.recipient, dedupeKey: notice.key }))
            await BoundaryNotice.updateOne({ _id: notice._id }, { $set: { delivered: true } });
    }
};

// Called under the same policy guard as detection. Approved charges are retained.
export const cancelBoundaryMonitoring = async (session) => {
    const events = await resolveBoundaryAlerts(null, session);
    await BoundaryState.updateMany({}, { $set: { state: {} } }, { session });
    await BoundaryIncident.updateMany({ $or: [{ active: true }, { review: "eligible" }] },
        { $set: { active: false, stage: "cancelled", resolvedAt: new Date() } }, { session });
    await BoundaryIncident.updateMany({ review: "eligible", stage: "cancelled" },
        { $set: { review: "waived", reason: "Boundary alerts disabled by admin.", reviewedAt: new Date() } }, { session });
    await cancelBoundaryNotices({ kind: { $nin: ["approved", "waived"] } }, session);
    return events;
};

export const evaluateBoundary = async (tracker, now = new Date()) => {
    if (!tracker.vehicle) return;
    let alerts = [];
    await withBookingCreationTransaction([BOUNDARY_RESOURCE, `boundary:${tracker.vehicle}`], async session => {
        alerts = [];
        const policy = resolveBoundarySettings((await Settings.findOne().session(session).lean())?.boundarySettings);
        if (!policy.alertsEnabled) return;
        const assigned = await Tracker.findOne({ _id: tracker._id, vehicle: tracker.vehicle, status: TRACKER_STATUS.ACTIVE }).select("alertSession assignedAt").session(session).lean();
        const vehicle = assigned && await Vehicle.findOne({ _id: tracker.vehicle, status: { $ne: "Archived" } }).session(session).lean();
        if (!vehicle) return;
        const fix = await VehicleTrackingState.findOne({ vehicle: tracker.vehicle, tracker: tracker._id }).session(session).lean();
        const maxGapMs = Math.max(120000, getGpsStaleThresholdMs(tracker.protocol));
        if (!fix?.gpsFix || !fix.recordedAt || now - new Date(fix.recordedAt) > maxGapMs) {
            await BoundaryState.updateOne({ vehicle: tracker.vehicle }, { $set: { "state.paused": true } }, { session });
            return;
        }
        const position = classifyAlbayPosition(fix.latitude, fix.longitude, policy);
        if (!position) {
            await BoundaryState.updateOne({ vehicle: tracker.vehicle }, { $set: { "state.paused": true } }, { session });
            return;
        }
        const rental = await Rental.findOne({ vehicle: tracker.vehicle, status: "Ongoing", "return.date": null,
            $or: [{ "bookingPeriod.actualStartDate": { $ne: null } }, { "pickup.date": { $ne: null } }] }).session(session).lean();
        const pickupAt = rental?.bookingPeriod.actualStartDate || rental?.pickup?.date;
        if ((assigned.assignedAt && new Date(fix.recordedAt) < new Date(assigned.assignedAt)) ||
            (pickupAt && new Date(fix.recordedAt) < new Date(pickupAt))) return;
        const booking = rental && await Booking.findById(rental.booking).select("termsAcceptance").session(session).lean();
        const stored = await BoundaryState.findOne({ vehicle: tracker.vehicle }).session(session).lean();
        let incident = await BoundaryIncident.findOne({ vehicle: tracker.vehicle, active: true }).session(session);
        const identityChanged = stored && (String(stored.tracker) !== String(tracker._id) ||
            (stored.alertSession ?? null) !== (assigned.alertSession ?? null) ||
            String(stored.rental || "") !== String(rental?._id || ""));
        const exempt = rental?.boundaryExemption?.until && new Date(rental.boundaryExemption.until) > now;
        if (incident && (identityChanged || exempt)) {
            await cancelBoundaryNotices({ incident: incident._id, kind: { $in: ["near", "outside"] } }, session);
            await resolveBoundaryAlerts(tracker.vehicle, session, alerts);
            incident.active = false; incident.stage = "cancelled"; incident.resolvedAt = now;
            await incident.save({ session }); incident = null;
        }
        if (exempt) {
            await BoundaryState.deleteOne({ vehicle: tracker.vehicle }, { session });
            return;
        }
        if (rental?.boundaryExemption?.until && new Date(fix.recordedAt) < new Date(rental.boundaryExemption.until)) return;
        let effective = lockedBoundaryPolicy(policy, booking?.termsAcceptance?.policySnapshot?.boundary);
        if (incident?.policy) effective = { ...effective,
            penaltiesEnabled: effective.penaltiesEnabled && incident.policy.penaltiesEnabled && !incident.penaltyCancelledAt,
            penaltyAmount: Math.min(effective.penaltyAmount, incident.policy.penaltyAmount),
            gracePeriodMinutes: Math.max(effective.gracePeriodMinutes, incident.policy.gracePeriodMinutes) };
        if (rental?.boundaryPenaltyIncident) effective.penaltiesEnabled = false;
        const previous = identityChanged ? {} : stored?.state || {};
        const result = transitionBoundary(previous, { ...fix, zone: position.zone }, effective, now.getTime(), maxGapMs);
        if (result.state === previous) return;
        await BoundaryState.updateOne({ vehicle: tracker.vehicle }, { $set: {
            tracker: tracker._id, alertSession: assigned.alertSession ?? null, rental: rental?._id || null, state: result.state,
        } }, { upsert: true, session });
        if (!incident && result.events.some(event => event === "near" || event === "outside")) {
            [incident] = await BoundaryIncident.create([{
                vehicle: tracker.vehicle, tracker: tracker._id, rental: rental?._id || null, customer: rental?.customer || null,
                policy: effective, boundaryVersion: BOUNDARY_VERSION,
            }], { session });
        }
        if (!incident) return;
        incident.latitude = fix.latitude; incident.longitude = fix.longitude; incident.lastFixAt = fix.recordedAt;
        incident.evidenceMinutes = Math.max(incident.evidenceMinutes || 0,
            (result.state.graceEvidenceMs ?? Math.max(0, (result.state.evidenceMs || 0) - (result.state.graceEvidenceStart || 0))) / 60000);
        for (const event of result.events) {
            if (event === "outside") { incident.stage = "outside"; incident.outsideAt = fix.recordedAt; }
            if (event === "eligible" && rental && !rental.boundaryPenaltyIncident) { incident.review = "eligible"; incident.amount = effective.penaltyAmount; }
            if (event === "returned") { incident.stage = "returned"; incident.active = false; incident.resolvedAt = now; }
            if (["near", "outside", "returned"].includes(event)) {
                await resolveBoundaryAlerts(tracker.vehicle, session, alerts);
                if (event !== "returned") {
                    const type = event === "near" ? "BOUNDARY_NEAR" : "BOUNDARY_OUTSIDE";
                    const definition = ALERT_DEFINITIONS[type];
                    const [created] = await Alert.create([{ vehicle: tracker.vehicle, tracker: tracker._id, type,
                        title: definition.title, message: definition.buildMessage(), severity: definition.severity,
                        context: { incident: incident._id, latitude: fix.latitude, longitude: fix.longitude },
                    }], { session });
                    alerts.push({ kind: "created", alert: created.toObject() });
                }
            }
            await enqueue({ ...incident.toObject(), policy: effective }, event, vehicle, session);
        }
        if (result.state.zone === "inside" && !result.state.outsideSince && incident.stage === "near") {
            await cancelBoundaryNotices({ incident: incident._id, kind: "near" }, session);
            await resolveBoundaryAlerts(tracker.vehicle, session, alerts);
            incident.stage = "returned"; incident.active = false; incident.resolvedAt = now;
        }
        await incident.save({ session });
    });
    publishBoundaryAlerts(alerts);
};

export const reviewBoundaryIncident = async (id, action, reason, userId, requestedAmount) => {
    if (!["approve", "waive"].includes(action) || typeof reason !== "string" || !reason.trim() || reason.length > 500)
        throw createError("Choose approve or waive and provide a reason (1–500 characters).", 400);
    return withBookingCreationTransaction([BOUNDARY_RESOURCE], async session => {
        const incident = await BoundaryIncident.findById(id).session(session);
        if (!incident || incident.review !== "eligible") throw createError("This incident is not awaiting review.", 409);
        const settings = resolveBoundarySettings((await Settings.findOne().session(session).lean())?.boundarySettings);
        const rental = await Rental.findById(incident.rental).session(session);
        if (!rental) throw createError("Rental not found.", 404);
        if (action === "approve") {
            if (!settings.alertsEnabled || !settings.penaltiesEnabled) throw createError("Boundary penalties are disabled.", 409);
            if (rental.boundaryPenaltyIncident || rental.status !== "Ongoing") throw createError("This rental has already been charged or is completed.", 409);
            if (incident.evidenceMinutes < Math.max(settings.gracePeriodMinutes, incident.policy.gracePeriodMinutes))
                throw createError("The current, more favorable grace period has not been met.", 409);
            const warning = await Notification.exists({ recipient: incident.customer, dedupeKey: `boundary:${incident._id}:outside:${incident.customer}` }).session(session);
            if (!warning) throw createError("The customer's outside-boundary warning has not been saved yet. Retry after notification delivery.", 409);
            if (rental.boundaryExemption?.until && new Date(rental.boundaryExemption.until) > new Date()) throw createError("This rental has an approved outside trip.", 409);
            incident.amount = Math.min(incident.amount, settings.penaltyAmount);
            if (requestedAmount !== undefined) {
                if (typeof requestedAmount !== "number" || !Number.isFinite(requestedAmount) || requestedAmount <= 0 ||
                    requestedAmount > incident.amount || Math.abs(requestedAmount * 100 - Math.round(requestedAmount * 100)) > 1e-7)
                    throw createError("The reviewed charge must be positive and cannot exceed the proposed charge or current rate.", 400);
                incident.amount = requestedAmount;
            }
            if (incident.amount <= 0) throw createError("No positive penalty is due; waive this incident instead.", 400);
            rental.charges.push({ type: "Other", amount: incident.amount, description: "Outside Albay boundary penalty", referenceId: incident._id, addedBy: userId });
            rental.boundaryPenaltyIncident = incident._id;
            const { calculateFinancials } = await import("./rentalService.js");
            await calculateFinancials(rental);
            await rental.save({ session });
        }
        incident.review = action === "approve" ? "approved" : "waived";
        incident.reason = reason.trim(); incident.reviewedBy = userId; incident.reviewedAt = new Date();
        await incident.save({ session });
        const vehicle = await Vehicle.findById(incident.vehicle).session(session).lean();
        await enqueue(incident, incident.review, vehicle, session);
        return incident.toObject();
    });
};

export const sweepBoundaries = async () => {
    for (const tracker of await Tracker.find({ vehicle: { $ne: null }, status: TRACKER_STATUS.ACTIVE }).lean()) {
        try { await evaluateBoundary(tracker); } catch (error) { console.error("Boundary evaluation failed:", error.message); }
    }
    await deliverBoundaryNotices();
};
