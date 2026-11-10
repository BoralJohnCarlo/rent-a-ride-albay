import { withInspectionBookingLock } from "../services/inspectionBookingLock.js";
import { assertInspectionSlotAvailable } from "../services/inspectionSlotService.js";
import PendingVehicle from "../models/PendingVehicle.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import createError from "../utils/createError.js";
import generateVehicleCode from "../utils/generateVehicleCode.js";
import { notifyUser } from "../services/notificationService.js";
import {
    VEHICLE_STATUS,
    VEHICLE_OWNERSHIP,
} from "../constants/vehicleConstants.js";

// A new listing stays unbookable until the completed submission is durable.
// If activation fails, repeating approval finishes this same listing.
const activateRegistrationVehicle = async (vehicle, submission) => {
    if (!vehicle.isPendingInspection) return vehicle;
    return await Vehicle.findOneAndUpdate(
        { _id: vehicle._id, registrationSubmission: submission._id, isPendingInspection: true },
        { $set: { isPendingInspection: false, "availability.bookingEnabled": submission.availability?.bookingEnabled !== false } },
        { returnDocument: "after" }
    ) || await Vehicle.findById(vehicle._id);
};

/*
 * Best-effort notice to the operator who submitted a pending vehicle about an
 * admin decision. A failure here must never fail the status update.
 */
const notifyOperatorOfPendingVehicle = async (pendingVehicle, { type, title, message, variant, dedupeKey }) => {
    if (!pendingVehicle?.operator) {
        return;
    }

    try {
        return await notifyUser(pendingVehicle.operator, {
            type,
            title,
            message,
            variant,
            dedupeKey,
            category: "Vehicle",
            metadata: {
                reference: pendingVehicle.plateNumber,
                relatedId: pendingVehicle._id,
                relatedModel: "PendingVehicle",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of pending vehicle decision:",
            notificationError
        );
    }
};

const recoveryIds = () => Vehicle.distinct("registrationSubmission", { registrationSubmission: { $ne: null }, isPendingInspection: true });
const queueFilter = ids => ({ $or: [{ status: { $ne: "approved" } }, { approvalPending: true }, { _id: { $in: ids } }] });
const annotateRecovery = (records, ids) => records.map(record => ({
    ...record.toObject(),
    approvalRecoveryRequired: record.approvalPending || ids.some(id => String(id) === String(record._id)),
}));
const finishApproval = async (submission, listing) => {
    const vehicle = await activateRegistrationVehicle(listing, submission);
    const dedupeKey = `registration-approved:${submission._id}`;
    const receipt = { recipient: submission.operator, $or: [{ dedupeKey }, { type: "Vehicle Approved", "metadata.relatedId": submission._id }] };
    await Notification.init();
    if (!await Notification.exists(receipt)) {
        await notifyOperatorOfPendingVehicle(submission, {
            type: "Vehicle Approved", title: "Vehicle Approved", variant: "success",
            message: `Your vehicle ${submission.brand} ${submission.model} (${submission.plateNumber}) was approved and is now listed on the platform as ${vehicle.vehicleCode}.`,
            dedupeKey,
        });
    }
    if (!await Notification.exists(receipt)) throw createError("Approval was saved, but its confirmation could not be delivered. Please retry approval.", 503);
    await PendingVehicle.updateOne({ _id: submission._id, status: "approved" }, { $set: { approvalPending: false } });
    submission.approvalPending = false;
    return vehicle;
};

export const getPendingVehicles = async (req, res, next) => {
    try {
        const {
            search = "",
            vehicleType = "",
            status = "",
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 20
        } = req.query;

        const ids = await recoveryIds();
        const query = req.query.includeCompleted === "true" || status ? {} : queueFilter(ids);

        if (search) {
            query.$and = [{ $or: [
                { "operator.firstName": { $regex: search, $options: "i" } },
                { "operator.lastName": { $regex: search, $options: "i" } },
                { "operator.email": { $regex: search, $options: "i" } },
                { plateNumber: { $regex: search, $options: "i" } },
                { registrationNumber: { $regex: search, $options: "i" } },
                { brand: { $regex: search, $options: "i" } },
                { model: { $regex: search, $options: "i" } }
            ] }];
        }

        if (vehicleType) {
            query.vehicleType = vehicleType;
        }

        if (status) {
            query.status = status;
        }

        let sort = {};
        if (sortBy === "createdAt") {
            sort.createdAt = sortOrder === "desc" ? -1 : 1;
        } else if (sortBy === "brand") {
            sort.brand = sortOrder === "desc" ? -1 : 1;
        } else if (sortBy === "plateNumber") {
            sort.plateNumber = sortOrder === "desc" ? -1 : 1;
        }

        // Keep page boundaries stable when multiple submissions share a date/name.
        sort._id = sortOrder === "desc" ? -1 : 1;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const pendingVehicles = await PendingVehicle.find(query)
            .populate("operator", "firstName lastName email phoneNumber")
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PendingVehicle.countDocuments(query);

        res.json({
            success: true,
            data: annotateRecovery(pendingVehicles, ids),
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

/*
 * A partner's own vehicle submissions from registration — scoped to
 * req.user._id (never a client-supplied id), same pattern as every other
 * "mine" endpoint. Read-only from this side: approve/reject stays admin-only.
 */
export const getMyPendingVehicles = async (req, res, next) => {
    try {
        const {
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 20
        } = req.query;

        const query = { operator: req.user._id };
        const ids = await recoveryIds();
        if (req.query.includeCompleted !== "true") Object.assign(query, queueFilter(ids));

        let sort = {};
        if (sortBy === "createdAt") {
            sort.createdAt = sortOrder === "desc" ? -1 : 1;
        } else if (sortBy === "brand") {
            sort.brand = sortOrder === "desc" ? -1 : 1;
        } else if (sortBy === "plateNumber") {
            sort.plateNumber = sortOrder === "desc" ? -1 : 1;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const pendingVehicles = await PendingVehicle.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await PendingVehicle.countDocuments(query);

        res.json({
            success: true,
            data: annotateRecovery(pendingVehicles, ids),
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getPendingVehicleById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const pendingVehicle = await PendingVehicle.findById(id)
            .populate("operator", "firstName lastName email phoneNumber middleName alternativeContact birthdate validIdType validIdImage validIdBack");

        if (!pendingVehicle) {
            return res.status(404).json({
                success: false,
                message: "Pending vehicle not found"
            });
        }

        res.json({
            success: true,
            data: pendingVehicle
        });
    } catch (error) {
        next(error);
    }
};

const updatePendingVehicleStatusUnlocked = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, rejectionDetails, pricing } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required"
            });
        }

        const validStatuses = ["pending_review", "under_inspection", "approved", "rejected"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            });
        }

        if (status === "rejected" && (!rejectionReason || rejectionReason.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required when rejecting a vehicle"
            });
        }

        const pendingVehicle = await PendingVehicle.findById(id);

        if (!pendingVehicle) {
            return res.status(404).json({
                success: false,
                message: "Pending vehicle not found"
            });
        }

        if (pendingVehicle.status === "approved") {
            if (status !== "approved") return res.status(409).json({ success: false, message: "This submission is completed. Manage its approved vehicle instead." });
            let vehicle = await Vehicle.findById(pendingVehicle.approvedVehicle);
            if (!vehicle) return res.status(409).json({ success: false, message: "The approved vehicle is no longer available. The appointment history has been preserved." });
            vehicle = await finishApproval(pendingVehicle, vehicle);
            return res.json({ success: true, message: "Vehicle is already approved.", data: { vehicle, pendingVehicle } });
        }

        const existingVehicle = await Vehicle.findOne({ registrationSubmission: pendingVehicle._id });
        if (existingVehicle && status !== "approved") return res.status(409).json({ success: false, message: "Approval was partially saved. Retry approval to finish before changing this submission." });

        // If setting status to approved, create the bookable vehicle
        if (["pending_review", "under_inspection"].includes(status) && !["pending_review", "under_inspection"].includes(pendingVehicle.status) && pendingVehicle.inspection?.scheduledDate) {
            await assertInspectionSlotAvailable(pendingVehicle.inspection.scheduledDate, pendingVehicle.inspection.scheduledTime, { excludePendingVehicleId: pendingVehicle._id });
        }

        if (status === "approved") {
            /*
             * PendingVehicle.pricing.dailyRate/reservationFee are never set
             * during registration (RegisterOperator.jsx doesn't collect
             * pricing) and nothing else in the app writes them before this
             * point, so the stored pricing is always empty. Admin sets the
             * actual rate here, as part of approving — fall back to
             * whatever is already on the document only so a re-approval
             * attempt after a transient failure doesn't lose a previously
             * submitted rate.
             */
            const effectivePricing = {
                dailyRate:
                    existingVehicle?.pricing?.dailyRate ?? pricing?.dailyRate ??
                    pendingVehicle.pricing?.dailyRate,
                reservationFee:
                    existingVehicle?.pricing?.reservationFee ?? pricing?.reservationFee ??
                    pendingVehicle.pricing?.reservationFee,
                securityDeposit:
                    pricing?.securityDeposit ??
                    pendingVehicle.pricing?.securityDeposit,
            };

            if (!effectivePricing.dailyRate) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot approve: Pricing is required and must include dailyRate"
                });
            }

            if (!effectivePricing.reservationFee && effectivePricing.reservationFee !== 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot approve: Pricing must include a reservation fee"
                });
            }

            // Generate vehicle code
            const vehicleCode = existingVehicle?.vehicleCode || await generateVehicleCode();

            // Create new Vehicle from PendingVehicle data
            let newVehicle = existingVehicle || await Vehicle.create({
                registrationSubmission: pendingVehicle._id,
                vehicleCode,
                plateNumber: pendingVehicle.plateNumber,
                registrationNumber: pendingVehicle.registrationNumber,
                brand: pendingVehicle.brand,
                model: pendingVehicle.model,
                variant: pendingVehicle.variant || "",
                year: pendingVehicle.year,
                vehicleType: pendingVehicle.vehicleType,
                specifications: {
                    transmission: pendingVehicle.specifications?.transmission || "",
                    fuelType: pendingVehicle.specifications?.fuelType || "",
                    engine: pendingVehicle.specifications?.engine || "",
                    seatingCapacity: pendingVehicle.specifications?.seatingCapacity || 1
                },
                pricing: {
                    dailyRate: effectivePricing.dailyRate,
                    reservationFee: effectivePricing.reservationFee
                },
                securityDeposit: effectivePricing.securityDeposit || {
                    enabled: false,
                    amount: 0
                },
                description: {
                    public: pendingVehicle.description?.public || ""
                },
                // Vehicle.imageSchema requires a non-empty publicId; PendingVehicle
                // allows it blank, so fall back to the (required) url.
                images: (pendingVehicle.images || []).map((image) => ({
                    url: image.url,
                    publicId: image.publicId || image.url,
                    originalName: image.originalName || "",
                    isPrimary: image.isPrimary || false,
                })),
                availability: {
                    bookingEnabled: false,
                    availableFrom: pendingVehicle.availability?.availableFrom || null,
                    blockedDates: pendingVehicle.availability?.blockedDates || []
                },
                compliance: {
                    licenseExpiration: pendingVehicle.compliance?.licenseExpiration || null,
                    registrationNumberVerified: pendingVehicle.compliance?.registrationNumberVerified || false
                },
                gps: {
                    deviceId: pendingVehicle.gps?.deviceId || ""
                },
                condition: pendingVehicle.condition || "Good",
                isFeatured: pendingVehicle.isFeatured || false,
                operator: pendingVehicle.operator,
                status: VEHICLE_STATUS.AVAILABLE,
                isPendingInspection: true,
                ownership: VEHICLE_OWNERSHIP.CONSIGNED,
                category: null
            });

            // Keep the inspection and request history after the listing is approved.
            pendingVehicle.status = "approved";
            pendingVehicle.isPendingInspection = false;
            pendingVehicle.approvedVehicle = newVehicle._id;
            pendingVehicle.approvedAt = new Date();
            pendingVehicle.approvalPending = true;
            await pendingVehicle.save();
            newVehicle = await finishApproval(pendingVehicle, newVehicle);

            res.json({
                success: true,
                message: "Vehicle approved and created successfully",
                data: {
                    vehicle: newVehicle,
                    pendingVehicle
                }
            });
        } else {
            // For other status updates (pending_review, under_inspection, rejected)
            pendingVehicle.status = status;

            if (rejectionReason) {
                pendingVehicle.rejectionReason = rejectionReason;
            }
            if (rejectionDetails) {
                pendingVehicle.rejectionDetails = rejectionDetails;
            }

            // If setting to under_inspection, clear pending inspection flag only if not approved
            if (status === "under_inspection") {
                pendingVehicle.isPendingInspection = true;
            }

            await pendingVehicle.save();

            if (status === "rejected") {
                await notifyOperatorOfPendingVehicle(pendingVehicle, {
                    type: "Vehicle Rejected",
                    title: "Vehicle Submission Rejected",
                    message: `Your vehicle ${pendingVehicle.brand} ${pendingVehicle.model} (${pendingVehicle.plateNumber}) was rejected.${
                        rejectionReason ? ` Reason: ${String(rejectionReason).slice(0, 300)}` : ""
                    }`,
                    variant: "rejected",
                });
            } else if (status === "under_inspection") {
                await notifyOperatorOfPendingVehicle(pendingVehicle, {
                    type: "Vehicle Under Inspection",
                    title: "Vehicle Under Inspection",
                    message: `Your vehicle ${pendingVehicle.brand} ${pendingVehicle.model} (${pendingVehicle.plateNumber}) is now under inspection.`,
                    variant: "info",
                });
            }

            res.json({
                success: true,
                message: `Pending vehicle ${status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`,
                data: pendingVehicle
            });
        }
    } catch (error) {
        next(error);
    }
};

const updatePendingVehicleUnlocked = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        if (updateData.inspection !== undefined || updateData.reschedule !== undefined || updateData.status !== undefined || updateData.approvedVehicle !== undefined || updateData.approvedAt !== undefined || updateData.approvalPending !== undefined) {
            return res.status(400).json({ success: false, message: "Use the appointment or status action to update inspection details." });
        }

        const pendingVehicle = await PendingVehicle.findById(id);

        if (!pendingVehicle) {
            return res.status(404).json({
                success: false,
                message: "Pending vehicle not found"
            });
        }

        if (pendingVehicle.status === "approved") return res.status(409).json({ success: false, message: "This submission is completed. Manage its approved vehicle instead." });
        if (await Vehicle.exists({ registrationSubmission: pendingVehicle._id })) return res.status(409).json({ success: false, message: "Approval was partially saved. Retry approval before editing this submission." });

        // If pricing is being updated, validate it
        if (updateData.pricing) {
            if (updateData.pricing.dailyRate === undefined || updateData.pricing.dailyRate === null) {
                return res.status(400).json({
                    success: false,
                    message: "Daily rate is required"
                });
            }
            if (updateData.pricing.reservationFee === undefined || updateData.pricing.reservationFee === null) {
                return res.status(400).json({
                    success: false,
                    message: "Reservation fee is required"
                });
            }
        }

        Object.assign(pendingVehicle, updateData);
        await pendingVehicle.save();

        res.json({
            success: true,
            message: "Pending vehicle updated successfully",
            data: pendingVehicle
        });
    } catch (error) {
        next(error);
    }
};

export const getPendingVehicleCounts = async (req, res, next) => {
    try {
        const ids = await recoveryIds();
        const counts = {
            total: await PendingVehicle.countDocuments(queueFilter(ids)),
            pending_review: await PendingVehicle.countDocuments({ status: "pending_review" }),
            under_inspection: await PendingVehicle.countDocuments({ status: "under_inspection" }),
            approved: await PendingVehicle.countDocuments({ status: "approved" }),
            rejected: await PendingVehicle.countDocuments({ status: "rejected" })
        };

        res.json({
            success: true,
            data: counts
        });
    } catch (error) {
        next(error);
    }
};

export const updatePendingVehicleStatus = (req, res, next) => withInspectionBookingLock(() => updatePendingVehicleStatusUnlocked(req, res, next)).catch(next);
export const updatePendingVehicle = (req, res, next) => withInspectionBookingLock(() => updatePendingVehicleUnlocked(req, res, next)).catch(next);
