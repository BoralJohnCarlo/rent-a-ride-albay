import express from "express";

import {
    getFavorites,
    toggleVehicleFavorite,
    checkFavorite,
} from "../controllers/favoriteController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    favoriteVehicleIdValidator,
} from "../validators/favoriteValidator.js";

const router = express.Router();

router.get(
    "/",
    protect,
    authorize("customer"),
    getFavorites
);

router.post(
    "/:vehicleId/toggle",
    protect,
    authorize("customer"),
    favoriteVehicleIdValidator,
    toggleVehicleFavorite
);

router.get(
    "/:vehicleId/check",
    protect,
    authorize("customer"),
    favoriteVehicleIdValidator,
    checkFavorite
);

export default router;
