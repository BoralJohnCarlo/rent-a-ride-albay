import express from "express";

import {
    createVehicleCategoryController,
    getVehicleCategoriesController,
    getVehicleCategoryByIdController,
    updateVehicleCategoryController,
    updateVehicleCategoryStatusController,
    deleteVehicleCategoryController,
} from "../controllers/vehicleCategoryController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    vehicleCategoryIdValidator,
    createVehicleCategoryValidator,
    updateVehicleCategoryValidator,
    updateVehicleCategoryStatusValidator,
} from "../validators/vehicleCategoryValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
    "/",
    getVehicleCategoriesController
);

router.get(
    "/:id",
    vehicleCategoryIdValidator,
    getVehicleCategoryByIdController
);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

router.use(
    protect,
    authorize("admin")
);

router.post(
    "/",
    createVehicleCategoryValidator,
    createVehicleCategoryController
);

router.patch(
    "/:id",
    vehicleCategoryIdValidator,
    updateVehicleCategoryValidator,
    updateVehicleCategoryController
);

router.patch(
    "/:id/status",
    vehicleCategoryIdValidator,
    updateVehicleCategoryStatusValidator,
    updateVehicleCategoryStatusController
);

router.delete(
    "/:id",
    vehicleCategoryIdValidator,
    deleteVehicleCategoryController
);

export default router;