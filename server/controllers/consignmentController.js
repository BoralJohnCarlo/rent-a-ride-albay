import { validationResult } from "express-validator";

import {
    createConsignment,
    getConsignments,
    getOperatorConsignments,
    getConsignmentById,
    updateDraftConsignment,
    submitConsignment,
    reviewConsignment,
    inspectConsignment,
    approveConsignment,
    withdrawConsignment,
    archiveConsignment,
    restoreConsignment,
    requestReschedule,
    approveReschedule,
    rejectReschedule,
    bookInspectionAppointment,
} from "../services/consignmentService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const create = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await createConsignment(
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment created successfully.",
            consignment,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            isArchived:
                req.query.isArchived !== undefined
                    ? req.query.isArchived === "true"
                    : undefined,
            vehicleType:
                req.query.vehicleType,
            ownership:
                req.query.ownership,
            applicantName:
                req.query.applicantName,
        };

        const consignments =
            await getConsignments(filters);

        return successResponse(
            res,
            "Consignments retrieved successfully.",
            consignments
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getMine = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            isArchived:
                req.query.isArchived !== undefined
                    ? req.query.isArchived === "true"
                    : undefined,
            vehicleType:
                req.query.vehicleType,
            ownership:
                req.query.ownership,
            applicantName:
                req.query.applicantName,
        };

        const consignments =
            await getOperatorConsignments(
                req.user._id,
                filters
            );

        return successResponse(
            res,
            "Consignments retrieved successfully.",
            consignments
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getById = async (req, res) => {
    try {
        const consignment =
            await getConsignmentById(
                req.params.id
            );

        return successResponse(
            res,
            "Consignment retrieved successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            404
        );
    }
};

export const updateDraft = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await updateDraftConsignment(
                req.params.id,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment updated successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const submit = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await submitConsignment(
                req.params.id,
                {
                    remarks: req.body.remarks,
                    termsAgreed:
                        req.body.termsAgreed,
                    termsVersionId:
                        req.body.termsVersionId,
                },
                req.user._id
            );

        return successResponse(
            res,
            "Consignment submitted successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const review = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await reviewConsignment(
                req.params.id,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment reviewed successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const inspect = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await inspectConsignment(
                req.params.id,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Vehicle inspection completed successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const approve = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await approveConsignment(
                req.params.id,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment approved successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const withdraw = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await withdrawConsignment(
                req.params.id,
                req.body.remarks,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment withdrawn successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const archive = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const consignment =
            await archiveConsignment(
                req.params.id,
                req.body.remarks,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment archived successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const restore = async (req, res) => {
    try {
        const consignment =
            await restoreConsignment(
                req.params.id,
                req.user._id
            );

        return successResponse(
            res,
            "Consignment restored successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const requestRescheduleCtrl = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, "Validation failed.", 400, errors.array());
        }

        const consignment = await requestReschedule(
            req.params.id,
            req.body,
            req.user._id
        );

        return successResponse(res, "Reschedule requested successfully.", consignment);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const approveRescheduleCtrl = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, "Validation failed.", 400, errors.array());
        }

        const consignment = await approveReschedule(
            req.params.id,
            req.body,
            req.user._id
        );

        return successResponse(res, "Reschedule approved successfully.", consignment);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const rejectRescheduleCtrl = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, "Validation failed.", 400, errors.array());
        }

        const consignment = await rejectReschedule(
            req.params.id,
            req.body,
            req.user._id
        );

        return successResponse(res, "Reschedule rejected successfully.", consignment);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const bookInspectionAppointmentCtrl = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, "Validation failed.", 400, errors.array());
        }

        const consignment = await bookInspectionAppointment(
            req.params.id,
            { date: req.body.date, time: req.body.time },
            req.user._id
        );

        return successResponse(
            res,
            "Inspection appointment scheduled successfully.",
            consignment
        );
    } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 400);
    }
};
