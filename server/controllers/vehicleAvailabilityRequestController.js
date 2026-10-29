import { validationResult } from "express-validator";

import {
    createAvailabilityRequest,
    getMyAvailabilityRequests,
    getAvailabilityRequests,
    approveAvailabilityRequest,
    rejectAvailabilityRequest,
    cancelAvailabilityRequest,
} from "../services/vehicleAvailabilityRequestService.js";

import { successResponse, errorResponse } from "../utils/response.js";

export const createRequest = async (req, res) => {
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

        const request = await createAvailabilityRequest(
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Unavailability request submitted successfully.",
            request,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getMyRequests = async (req, res) => {
    try {
        const requests = await getMyAvailabilityRequests(
            req.user._id,
            { status: req.query.status }
        );

        return successResponse(
            res,
            "Availability requests retrieved successfully.",
            requests
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getRequests = async (req, res) => {
    try {
        const requests = await getAvailabilityRequests({
            status: req.query.status,
            vehicleId: req.query.vehicleId,
            operatorId: req.query.operatorId,
        });

        return successResponse(
            res,
            "Availability requests retrieved successfully.",
            requests
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const approveRequest = async (req, res) => {
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

        const request = await approveAvailabilityRequest(
            req.params.id,
            req.user._id,
            req.body.remarks
        );

        return successResponse(
            res,
            "Availability request approved successfully.",
            request
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const rejectRequest = async (req, res) => {
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

        const request = await rejectAvailabilityRequest(
            req.params.id,
            req.user._id,
            req.body.rejectionReason
        );

        return successResponse(
            res,
            "Availability request rejected successfully.",
            request
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancelRequest = async (req, res) => {
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

        const request = await cancelAvailabilityRequest(
            req.params.id,
            req.user
        );

        return successResponse(
            res,
            "Availability request cancelled successfully.",
            request
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
