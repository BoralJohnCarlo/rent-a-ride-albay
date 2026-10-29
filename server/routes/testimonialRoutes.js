import express from "express";

import {
    getPublic,
    getAll,
    create,
    createFromReview,
    update,
    remove,
    uploadPhoto,
} from "../controllers/testimonialController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    uploadTestimonialImage,
} from "../middleware/uploadMiddleware.js";

import {
    createTestimonialValidator,
    updateTestimonialValidator,
    testimonialIdValidator,
    reviewIdParamValidator,
} from "../validators/testimonialValidator.js";

const router = express.Router();

router.get("/public", getPublic);

router.use(protect);
router.use(authorize("admin"));

router.get("/", getAll);

router.post("/upload-image", uploadTestimonialImage, uploadPhoto);

router.post("/", createTestimonialValidator, create);

router.post(
    "/from-review/:reviewId",
    reviewIdParamValidator,
    createFromReview
);

router.put("/:id", updateTestimonialValidator, update);

router.delete("/:id", testimonialIdValidator, remove);

export default router;
