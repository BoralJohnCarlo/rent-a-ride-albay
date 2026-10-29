import {
    getAllDistanceFeeRules,
    getDistanceFeeRuleById,
    createDistanceFeeRule,
    updateDistanceFeeRule,
    disableDistanceFeeRule,
    enableDistanceFeeRule,
    deleteDistanceFeeRule,
    getDistanceFeeRuleForDistance,
} from "../services/distanceFeeRuleService.js";

import handleValidation from "../utils/handleValidation.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getAllRules = async (
    req,
    res,
    next
) => {
    try {
        const rules =
            await getAllDistanceFeeRules();

        return successResponse(
            res,
            "Distance fee rules retrieved successfully.",
            rules
        );
    } catch (error) {
        next(error);
    }
};

export const getSingleRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await getDistanceFeeRuleById(
                req.params.id
            );

        return successResponse(
            res,
            "Distance fee rule retrieved successfully.",
            rule
        );
    } catch (error) {
        next(error);
    }
};

export const createRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await createDistanceFeeRule(
                req.body
            );

        return successResponse(
            res,
            "Distance fee rule created successfully.",
            rule,
            201
        );
    } catch (error) {
        next(error);
    }
};

export const updateRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await updateDistanceFeeRule(
                req.params.id,
                req.body
            );

        return successResponse(
            res,
            "Distance fee rule updated successfully.",
            rule
        );
    } catch (error) {
        next(error);
    }
};

export const disableRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await disableDistanceFeeRule(
                req.params.id
            );

        return successResponse(
            res,
            "Distance fee rule disabled successfully.",
            rule
        );
    } catch (error) {
        next(error);
    }
};

export const enableRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await enableDistanceFeeRule(
                req.params.id
            );

        return successResponse(
            res,
            "Distance fee rule enabled successfully.",
            rule
        );
    } catch (error) {
        next(error);
    }
};

export const deleteRule = async (
    req,
    res,
    next
) => {
    if (!handleValidation(req, res)) {
        return;
    }

    try {
        const rule =
            await deleteDistanceFeeRule(
                req.params.id
            );

        return successResponse(
            res,
            "Distance fee rule deleted successfully.",
            rule
        );
    } catch (error) {
        next(error);
    }
};
