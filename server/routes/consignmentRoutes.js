import express from "express";

import {
    create,
    getAll,
    getMine,
    getById,
    updateDraft,
    submit,
    review,
    inspect,
    approve,
    withdraw,
    archive,
    restore,
    requestRescheduleCtrl,
    approveRescheduleCtrl,
    rejectRescheduleCtrl,
    bookInspectionAppointmentCtrl,
} from "../controllers/consignmentController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createConsignmentValidator,
    updateDraftConsignmentValidator,
    submitConsignmentValidator,
    reviewConsignmentValidator,
    inspectionValidator,
    approvalValidator,
    withdrawalValidator,
    archiveValidator,
    consignmentIdValidator,
    rescheduleRequestValidator,
    rescheduleApproveValidator,
    rescheduleRejectValidator,
    inspectionAppointmentValidator,
} from "../validators/consignmentValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Operator Routes
|--------------------------------------------------------------------------
*/

router.use(protect);

router.post(
    "/",
    authorize("operator"),
    createConsignmentValidator,
    create
);

router.get(
    "/my",
    authorize("operator"),
    getMine
);

router.patch(
    "/:id/draft",
    authorize("operator", "admin"),
    consignmentIdValidator,
    updateDraftConsignmentValidator,
    updateDraft
);

router.patch(
    "/:id/submit",
    authorize("operator", "admin"),
    consignmentIdValidator,
    submitConsignmentValidator,
    submit
);

router.patch(
    "/:id/withdraw",
    authorize("operator", "admin"),
    consignmentIdValidator,
    withdrawalValidator,
    withdraw
);

router.patch(
    "/:id/inspection-appointment",
    authorize("operator", "admin"),
    consignmentIdValidator,
    inspectionAppointmentValidator,
    bookInspectionAppointmentCtrl
);

router.post(
    "/:id/reschedule",
    authorize("operator"),
    consignmentIdValidator,
    rescheduleRequestValidator,
    requestRescheduleCtrl
);

/*
 |--------------------------------------------------------------------------
 | Administrator Routes
 |--------------------------------------------------------------------------
 */

router.get(
    "/",
    authorize("admin"),
    getAll
);

router.get(
    "/:id",
    authorize("admin"),
    consignmentIdValidator,
    getById
);

router.patch(
    "/:id/review",
    authorize("admin"),
    consignmentIdValidator,
    reviewConsignmentValidator,
    review
);

router.patch(
    "/:id/inspect",
    authorize("admin"),
    consignmentIdValidator,
    inspectionValidator,
    inspect
);

router.patch(
    "/:id/approve",
    authorize("admin"),
    consignmentIdValidator,
    approvalValidator,
    approve
);

router.patch(
    "/:id/archive",
    authorize("admin"),
    consignmentIdValidator,
    archiveValidator,
    archive
);

router.patch(
    "/:id/restore",
    authorize("admin"),
    consignmentIdValidator,
    restore
);

router.patch(
    "/:id/reschedule/approve",
    authorize("admin"),
    consignmentIdValidator,
    rescheduleApproveValidator,
    approveRescheduleCtrl
);

router.patch(
    "/:id/reschedule/reject",
    authorize("admin"),
    consignmentIdValidator,
    rescheduleRejectValidator,
    rejectRescheduleCtrl
);

export default router;