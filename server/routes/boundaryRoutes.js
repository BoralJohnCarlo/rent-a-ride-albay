import express from "express";
import mongoose from "mongoose";
import { protect, authorize } from "../middleware/authMiddleware.js";
import BoundaryIncident from "../models/BoundaryIncident.js";
import BoundaryState from "../models/BoundaryState.js";
import Rental from "../models/Rental.js";
import Tracker from "../models/Tracker.js";
import Settings from "../models/Settings.js";
import { resolveBoundarySettings } from "../utils/boundaryPolicy.js";
import { BOUNDARY_RESOURCE, reviewBoundaryIncident, resolveBoundaryAlerts, publishBoundaryAlerts, cancelBoundaryNotices } from "../services/boundaryService.js";
import { withBookingCreationTransaction } from "../services/bookingCreationTransaction.js";
import { getGpsStaleThresholdMs } from "../constants/alertConstants.js";
import createError from "../utils/createError.js";
import { successResponse, errorResponse } from "../utils/response.js";

const router = express.Router();
router.use(protect);
const wrap = handler => async (req, res) => {
    try { return successResponse(res, "Boundary request completed.", await handler(req)); }
    catch (error) { return errorResponse(res, error.message, error.statusCode || 400); }
};
const validId = value => { if (!mongoose.isValidObjectId(value)) throw createError("Invalid record ID.", 400); };

router.get("/current", authorize("customer"), wrap(async req => {
    const policy = resolveBoundarySettings((await Settings.findOne().select("boundarySettings").lean())?.boundarySettings);
    if (!policy.alertsEnabled) return [];
    const rentals = await Rental.find({ customer: req.user._id, status: "Ongoing", "return.date": null }).select("_id").lean();
    const incidents = await BoundaryIncident.find({ rental: { $in: rentals.map(r => r._id) }, active: true }).lean();
    const result = [];
    for (const incident of incidents) {
        const state = await BoundaryState.findOne({ vehicle: incident.vehicle }).lean();
        const tracker = await Tracker.findById(incident.tracker).select("protocol status vehicle").lean();
        const known = tracker?.status === "active" && String(tracker.vehicle) === String(incident.vehicle) && !state?.state?.paused && state?.state?.lastAt && Date.now() - new Date(state.state.lastAt) <= Math.max(120000, getGpsStaleThresholdMs(tracker?.protocol));
        result.push({ id: incident._id, rental: incident.rental, stage: incident.stage, review: incident.review,
            locationKnown: Boolean(known), amount: Math.min(policy.penaltyAmount, incident.policy.penaltyAmount),
            penaltiesEnabled: policy.penaltiesEnabled && incident.policy.penaltiesEnabled && !incident.penaltyCancelledAt,
            remainingMinutes: Math.max(0, Math.max(policy.gracePeriodMinutes, incident.policy.gracePeriodMinutes) - incident.evidenceMinutes) });
    }
    return result;
}));
router.use(authorize("admin"));
router.get("/incidents", wrap(async () => {
    const details = query => query.populate("vehicle", "brand model plateNumber")
        .populate("rental", "rentalCode").populate("customer", "firstName lastName").lean();
    const [pending, recent] = await Promise.all([
        details(BoundaryIncident.find({ review: "eligible" }).sort({ createdAt: -1 })),
        details(BoundaryIncident.find().sort({ createdAt: -1 }).limit(100)),
    ]);
    const pendingIds = new Set(pending.map(incident => String(incident._id)));
    return [...pending, ...recent.filter(incident => !pendingIds.has(String(incident._id)))];
}));
router.post("/incidents/:id/review", wrap(req => {
    validId(req.params.id);
    return reviewBoundaryIncident(req.params.id, req.body.action, req.body.reason, req.user._id, req.body.amount);
}));
router.post("/rentals/:id/exemption", wrap(async req => {
    validId(req.params.id);
    const until = new Date(req.body.until);
    const reason = req.body.reason;
    const revoke = req.body.revoke === true;
    if ((!revoke && (!Number.isFinite(until.getTime()) || until <= new Date() || until - Date.now() > 30 * 86400000)) ||
        typeof reason !== "string" || !reason.trim() || reason.length > 500) throw createError("Provide a future expiry within 30 days and a reason (1–500 characters).", 400);
    let alerts = [];
    const result = await withBookingCreationTransaction([BOUNDARY_RESOURCE], async session => {
        alerts = [];
        const rental = await Rental.findById(req.params.id).session(session);
        if (!rental || rental.status !== "Ongoing") throw createError("Ongoing rental not found.", 404);
        rental.boundaryExemption = revoke ? undefined : { until, reason: reason.trim(), approvedBy: req.user._id, approvedAt: new Date() };
        rental.boundaryExemptionHistory.push({ until: revoke ? null : until, reason: reason.trim(), action: revoke ? "revoked" : "approved", performedBy: req.user._id, performedAt: new Date() });
        await rental.save({ session });
        if (revoke) return { revoked: true };
        alerts = await resolveBoundaryAlerts(rental.vehicle, session);
        await BoundaryIncident.updateMany({ rental: rental._id, review: "eligible" }, { $set: { review: "waived", reason: `Approved trip: ${reason.trim()}`, reviewedBy: req.user._id, reviewedAt: new Date() } }, { session });
        await BoundaryIncident.updateMany({ rental: rental._id, active: true }, { $set: { active: false, stage: "cancelled", resolvedAt: new Date() } }, { session });
        await BoundaryState.deleteOne({ rental: rental._id }, { session });
        const incidents = await BoundaryIncident.find({ rental: rental._id }).select("_id").session(session).lean();
        await cancelBoundaryNotices({ incident: { $in: incidents.map(incident => incident._id) }, kind: { $nin: ["approved", "waived"] } }, session);
        return { until, reason: reason.trim() };
    });
    publishBoundaryAlerts(alerts);
    return result;
}));
export default router;
