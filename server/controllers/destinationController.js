import { validationResult } from "express-validator";

import {
    getPublicDestinations,
    getAllDestinations,
    createDestination,
    updateDestination,
    reorderDestinations,
    deleteDestination,
} from "../services/destinationService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        errorResponse(
            res,
            "Validation failed.",
            400,
            errors.array()
        );

        return false;
    }

    return true;
};

const handleError = (res, error) =>
    errorResponse(
        res,
        error.message,
        error.statusCode || 400
    );

export const getPublic = async (req, res) => {
    try {
        const data = await getPublicDestinations();

        return successResponse(
            res,
            "Destinations retrieved successfully.",
            data
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const getAll = async (req, res) => {
    try {
        const destinations = await getAllDestinations();

        return successResponse(
            res,
            "Destinations retrieved successfully.",
            destinations
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const create = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const destination = await createDestination(req.body);

        return successResponse(
            res,
            "Destination added successfully.",
            destination,
            201
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const update = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const destination = await updateDestination(
            req.params.id,
            req.body
        );

        return successResponse(
            res,
            "Destination updated successfully.",
            destination
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const reorder = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const destinations = await reorderDestinations(req.body.ids);

        return successResponse(
            res,
            "Destination order saved.",
            destinations
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const remove = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        await deleteDestination(req.params.id);

        return successResponse(
            res,
            "Destination removed successfully."
        );
    } catch (error) {
        return handleError(res, error);
    }
};

export const uploadPhoto = async (req, res) =>
    successResponse(
        res,
        "Destination image uploaded successfully.",
        req.destinationImage,
        201
    );
