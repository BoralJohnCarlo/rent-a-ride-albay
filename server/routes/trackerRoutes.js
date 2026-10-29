import express from "express";

import {
    listTrackers,
    getTracker,
    registerTracker,
    assignTracker,
    unassignTrackerHandler,
    disableTrackerHandler,
    enableTrackerHandler,
    updateTrackerHandler,
    regenerateDeviceKeyHandler,
} from "../controllers/trackerController.js";

import {
    trackerIdValidator,
    createTrackerValidator,
    updateTrackerValidator,
    assignTrackerValidator,
} from "../validators/trackerValidator.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/", listTrackers);
router.get("/:id", trackerIdValidator, getTracker);
router.post("/", createTrackerValidator, registerTracker);
router.patch(
    "/:id/assign",
    assignTrackerValidator,
    assignTracker
);
router.patch("/:id/unassign", trackerIdValidator, unassignTrackerHandler);
router.patch("/:id/disable", trackerIdValidator, disableTrackerHandler);
router.patch("/:id/enable", trackerIdValidator, enableTrackerHandler);
router.post(
    "/:id/regenerate-key",
    trackerIdValidator,
    regenerateDeviceKeyHandler
);
router.put("/:id", updateTrackerValidator, updateTrackerHandler);

export default router;
