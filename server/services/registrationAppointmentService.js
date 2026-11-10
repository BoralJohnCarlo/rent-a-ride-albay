import PendingVehicle from "../models/PendingVehicle.js";
import Vehicle from "../models/Vehicle.js";
import createError from "../utils/createError.js";
import { withInspectionBookingLock } from "./inspectionBookingLock.js";
import { assertInspectionSlotAvailable } from "./inspectionSlotService.js";
import { notifyUser, notifyAdmins } from "./notificationService.js";

export const updateRegistrationAppointment = (id, input, user) => withInspectionBookingLock(async () => {
    const vehicle = await PendingVehicle.findById(id);
    if (!vehicle) throw createError("Registration vehicle not found.", 404);
    if (user.role !== "admin" && (user.role !== "operator" || String(vehicle.operator) !== String(user._id))) throw createError("You do not have permission to change this appointment.", 403);
    if (!["pending_review", "under_inspection"].includes(vehicle.status)) throw createError("This inspection is already closed.", 400);
    if (await Vehicle.exists({ registrationSubmission: vehicle._id })) throw createError("Approval was partially saved. Ask an administrator to retry approval before changing this appointment.", 409);
    const { action, date, time } = input;
    const reason = String(input.reason || "").trim();
    const remarks = String(input.remarks || "").trim();
    if (!["request", "approve", "reject", "book"].includes(action)) throw createError("Invalid appointment action.", 400);
    if (action !== "request" && user.role !== "admin") throw createError("Only administrators can review or move appointments directly.", 403);
    if (reason.length > 500 || remarks.length > 500) throw createError("Please use no more than 500 characters.", 400);
    if (action === "request") {
        if (!reason) throw createError("Please explain why you need to reschedule.", 400);
        if (vehicle.reschedule?.status === "Pending") throw createError("A reschedule request is already pending.", 409);
        await assertInspectionSlotAvailable(date, time, { excludePendingVehicleId: vehicle._id });
        vehicle.reschedule = { status: "Pending", proposedDate: new Date(date), proposedTime: time, reason, requestedAt: new Date() };
    } else if (action === "approve" || action === "reject") {
        if (vehicle.reschedule?.status !== "Pending") throw createError("No pending reschedule request found.", 409);
        if (action === "reject" && !remarks) throw createError("Please explain why the request is rejected.", 400);
        if (action === "approve") {
            const proposedDate = vehicle.reschedule.proposedDate.toISOString().slice(0, 10);
            await assertInspectionSlotAvailable(proposedDate, vehicle.reschedule.proposedTime, { excludePendingVehicleId: vehicle._id });
            vehicle.inspection = { scheduledDate: proposedDate, scheduledTime: vehicle.reschedule.proposedTime };
        }
        vehicle.reschedule.status = action === "approve" ? "Approved" : "Rejected";
        vehicle.reschedule.reviewedAt = new Date();
        vehicle.reschedule.reviewRemarks = remarks;
    } else {
        await assertInspectionSlotAvailable(date, time, { excludePendingVehicleId: vehicle._id });
        vehicle.inspection = { scheduledDate: date, scheduledTime: time };
        if (vehicle.reschedule?.status === "Pending") vehicle.reschedule = { status: "Rejected", reviewRemarks: "Administrator moved the appointment directly.", reviewedAt: new Date() };
    }
    await vehicle.save();
    try {
        const notification = {
            type: action === "request" ? "Consignment Reschedule Requested" : action === "reject" ? "Consignment Reschedule Rejected" : "Consignment Inspection Scheduled",
            title: action === "request" ? "Inspection Reschedule Requested" : action === "reject" ? "Inspection Reschedule Rejected" : "Inspection Appointment Updated",
            message: action === "request" ? `A new inspection time was requested for ${vehicle.plateNumber}: ${date} at ${time}. Reason: ${reason}` : `Registration inspection for ${vehicle.plateNumber}: ${vehicle.inspection.scheduledDate} at ${vehicle.inspection.scheduledTime}.${remarks ? " Remarks: " + remarks : ""}`,
            category: "Consignment", variant: "consignment",
            metadata: { reference: vehicle.plateNumber, relatedId: vehicle._id, relatedModel: "PendingVehicle" },
        };
        if (action === "request") await notifyAdmins(notification);
        else await notifyUser(vehicle.operator, notification);
    } catch (error) { console.error("Registration appointment notification failed:", error.message); }
    return vehicle;
});
