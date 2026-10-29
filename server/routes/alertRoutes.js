import express from "express";

import {
    listAlerts,
    listActiveAlerts,
    getAlert,
    readAlert,
    resolveAlert,
} from "../controllers/alertController.js";

import {
    alertIdValidator,
    listAlertsValidator,
} from "../validators/alertValidator.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin", "operator"));

// Order matters: /active must be registered before /:id.
router.get("/active", listAlertsValidator, listActiveAlerts);
router.get("/", listAlertsValidator, listAlerts);
router.get("/:id", alertIdValidator, getAlert);
router.patch("/:id/read", alertIdValidator, readAlert);
// Resolving means the platform has dealt with the alert - admin-only, so a
// partner can't close an alert before an admin has seen it. Partners can
// still mark alerts read.
router.patch(
    "/:id/resolve",
    authorize("admin"),
    alertIdValidator,
    resolveAlert
);

export default router;
