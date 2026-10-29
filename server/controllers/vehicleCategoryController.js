import { validationResult } from "express-validator";

import {
    createVehicleCategory,
    getVehicleCategories,
    getVehicleCategoryById,
    updateVehicleCategory,
    deleteVehicleCategory,
    updateVehicleCategoryStatus,
} from "../services/vehicleCategoryService.js";

const handleValidation = (req) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        throw new Error(
            errors.array()[0].msg
        );
    }
};

const createVehicleCategoryController = async (
    req,
    res,
    next
) => {
    try {
        handleValidation(req);

        const category =
            await createVehicleCategory(req.body);

        res.status(201).json({
            success: true,
            message:
                "Vehicle category created successfully.",
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

const getVehicleCategoriesController = async (
    req,
    res,
    next
) => {
    try {
        const categories =
            await getVehicleCategories(req.query);

        res.status(200).json({
            success: true,
            data: categories,
        });
    } catch (error) {
        next(error);
    }
};

const getVehicleCategoryByIdController = async (
    req,
    res,
    next
) => {
    try {
        handleValidation(req);

        const category =
            await getVehicleCategoryById(
                req.params.id
            );

        res.status(200).json({
            success: true,
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

const updateVehicleCategoryController = async (
    req,
    res,
    next
) => {
    try {
        handleValidation(req);

        const category =
            await updateVehicleCategory(
                req.params.id,
                req.body
            );

        res.status(200).json({
            success: true,
            message:
                "Vehicle category updated successfully.",
            data: category,
        });
    } catch (error) {
        next(error);
    }
};

const updateVehicleCategoryStatusController =
    async (req, res, next) => {
        try {
            handleValidation(req);

            const category =
                await updateVehicleCategoryStatus(
                    req.params.id,
                    req.body.status
                );

            res.status(200).json({
                success: true,
                message:
                    "Vehicle category status updated successfully.",
                data: category,
            });
        } catch (error) {
            next(error);
        }
    };

const deleteVehicleCategoryController = async (
    req,
    res,
    next
) => {
    try {
        handleValidation(req);

        await deleteVehicleCategory(
            req.params.id
        );

        res.status(200).json({
            success: true,
            message:
                "Vehicle category deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
};

export {
    createVehicleCategoryController,
    getVehicleCategoriesController,
    getVehicleCategoryByIdController,
    updateVehicleCategoryController,
    updateVehicleCategoryStatusController,
    deleteVehicleCategoryController,
};