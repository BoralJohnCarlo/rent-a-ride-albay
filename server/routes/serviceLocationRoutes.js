import express from "express";

import {
    getAllLocations,
    getEnabledLocations,
    getSingleLocation,
    createLocation,
    updateLocation,
    disableLocation,
    enableLocation,
    deleteLocation,
} from "../controllers/serviceLocationController.js";

import {
    serviceLocationIdValidator,
    createServiceLocationValidator,
    updateServiceLocationValidator,
} from "../validators/serviceLocationValidator.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/enabled",
    getEnabledLocations
);

router.use(protect);
router.use(authorize("admin"));

router.get("/", getAllLocations);

router.get(
    "/:id",
    serviceLocationIdValidator,
    getSingleLocation
);

router.post(
    "/",
    createServiceLocationValidator,
    createLocation
);

router.put(
    "/:id",
    updateServiceLocationValidator,
    updateLocation
);

router.patch(
    "/:id/disable",
    serviceLocationIdValidator,
    disableLocation
);

router.patch(
    "/:id/enable",
    serviceLocationIdValidator,
    enableLocation
);

router.delete(
    "/:id",
    serviceLocationIdValidator,
    deleteLocation
);

export default router;
