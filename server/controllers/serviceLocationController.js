import {
    getAllServiceLocations,
    getServiceLocationById,
    getEnabledServiceLocations,
    createServiceLocation,
    updateServiceLocation,
    disableServiceLocation,
    enableServiceLocation,
    deleteServiceLocation,
} from "../services/serviceLocationService.js";

import handleValidation from "../utils/handleValidation.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getAllLocations =
    async (req, res, next) => {
        try {
            const locations =
                await getAllServiceLocations();

            return successResponse(
                res,
                "Service locations retrieved successfully.",
                locations
            );
        } catch (error) {
            next(error);
        }
    };

export const getEnabledLocations =
    async (req, res, next) => {
        try {
            const locations =
                await getEnabledServiceLocations();

            return successResponse(
                res,
                "Enabled service locations retrieved successfully.",
                locations
            );
        } catch (error) {
            next(error);
        }
    };

export const getSingleLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await getServiceLocationById(
                    req.params.id
                );

            return successResponse(
                res,
                "Service location retrieved successfully.",
                location
            );
        } catch (error) {
            next(error);
        }
    };

export const createLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await createServiceLocation(
                    req.body
                );

            return successResponse(
                res,
                "Service location created successfully.",
                location,
                201
            );
        } catch (error) {
            next(error);
        }
    };

export const updateLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await updateServiceLocation(
                    req.params.id,
                    req.body
                );

            return successResponse(
                res,
                "Service location updated successfully.",
                location
            );
        } catch (error) {
            next(error);
        }
    };

export const disableLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await disableServiceLocation(
                    req.params.id
                );

            return successResponse(
                res,
                "Service location disabled successfully.",
                location
            );
        } catch (error) {
            next(error);
        }
    };

export const enableLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await enableServiceLocation(
                    req.params.id
                );

            return successResponse(
                res,
                "Service location enabled successfully.",
                location
            );
        } catch (error) {
            next(error);
        }
    };

export const deleteLocation =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const location =
                await deleteServiceLocation(
                    req.params.id
                );

            return successResponse(
                res,
                "Service location deleted successfully.",
                location
            );
        } catch (error) {
            next(error);
        }
    };
