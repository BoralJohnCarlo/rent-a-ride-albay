import express from "express";

import {
    create,
    getVehicleReviews,
    getDriverReviews,
    getRentalReview,
    getAll,
    uploadPhoto,
    getVehicleAverageRating,
    getDriverAverageRating,
} from "../controllers/reviewController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    uploadReviewImage,
} from "../middleware/uploadMiddleware.js";

import {
    createReviewValidator,
    rentalIdValidator,
    vehicleIdValidator,
    driverIdValidator,
} from "../validators/reviewValidator.js";

const router = express.Router();

router.post(
    "/upload-image",
    protect,
    authorize("customer"),
    uploadReviewImage,
    uploadPhoto
);

router.post(
    "/:id",
    protect,
    createReviewValidator,
    create
);

router.get(
    "/rentals/:rentalId",
    protect,
    rentalIdValidator,
    getRentalReview
);

router.get(
    "/vehicles/:vehicleId/average",
    vehicleIdValidator,
    getVehicleAverageRating
);

router.get(
    "/vehicles/:vehicleId",
    getVehicleReviews
);

router.get(
    "/drivers/:driverId/average",
    driverIdValidator,
    getDriverAverageRating
);

router.get(
    "/drivers/:driverId",
    getDriverReviews
);

router.get(
    "/",
    protect,
    authorize("admin"),
    getAll
);

export default router;
