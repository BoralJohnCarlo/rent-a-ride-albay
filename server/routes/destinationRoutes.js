import express from "express";

import {
    getPublic,
    getAll,
    create,
    update,
    reorder,
    remove,
    uploadPhoto,
} from "../controllers/destinationController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    uploadDestinationImage,
} from "../middleware/uploadMiddleware.js";

import {
    createDestinationValidator,
    updateDestinationValidator,
    destinationIdValidator,
    reorderDestinationsValidator,
} from "../validators/destinationValidator.js";

const router = express.Router();

router.get("/public", getPublic);

router.use(protect);
router.use(authorize("admin"));

router.get("/", getAll);

router.post("/upload-image", uploadDestinationImage, uploadPhoto);

router.post("/", createDestinationValidator, create);

// Before "/:id" so "reorder" isn't read as an id.
router.put("/reorder", reorderDestinationsValidator, reorder);

router.put("/:id", updateDestinationValidator, update);

router.delete("/:id", destinationIdValidator, remove);

export default router;
