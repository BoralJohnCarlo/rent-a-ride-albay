import express from "express";

import {
    create,
    getAll,
    getById,
    update,
    pickup,
    returnVehicle,
    reassign,
    addDamage,
    addRentalCharge,
    addRentalAdjustment,
    payment,
    verifyRentalPayment,
    holdDeposit,
    deductDeposit,
    releaseDeposit,
    vehicleOutcome,
    complete,
    customerComplete,
    addEvent,
    waivePenaltyController,
    adjustPenaltyController,
    addPenaltyNoteController,
    applyPenaltyController,
} from "../controllers/rentalController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createRentalValidator,
    updateRentalValidator,
    rentalIdValidator,
    pickupRentalValidator,
    returnRentalValidator,
    addDamageIssueValidator,
    addChargeValidator,
    addAdjustmentValidator,
    addPaymentValidator,
    verifyPaymentValidator,
    holdSecurityDepositValidator,
    deductSecurityDepositValidator,
    releaseSecurityDepositValidator,
    reassignDriverValidator,
    addOperationalEventValidator,
    updateVehicleOutcomeValidator,
    completeRentalValidator,
    waivePenaltyValidator,
    adjustPenaltyValidator,
    addPenaltyNoteValidator,
    applyPenaltyValidator,
} from "../validators/rentalValidator.js";

const router = express.Router();

router.use(protect);

/*
|--------------------------------------------------------------------------|
| Rental Retrieval Routes
|--------------------------------------------------------------------------|
*/

/*
 * Partners (operators) don't read rentals directly: the full rental carries
 * customer addresses, payments, refunds and the security deposit. What a
 * partner needs about a rental rides along on their booking view instead
 * (see toOperatorBookingView in bookingService).
 */
router.get(
    "/",
    authorize(
        "admin",
        "customer"
    ),
    getAll
);

router.get(
    "/:rentalId",
    authorize(
        "admin",
        "customer"
    ),
    rentalIdValidator,
    getById
);

/*
|--------------------------------------------------------------------------|
| Rental Creation
|--------------------------------------------------------------------------|
*/

router.post(
    "/",
    authorize("admin"),
    createRentalValidator,
    create
);

/*
|--------------------------------------------------------------------------|
| Rental Management
|--------------------------------------------------------------------------|
*/

router.put(
    "/:rentalId",
    authorize("admin"),
    updateRentalValidator,
    update
);

/*
|--------------------------------------------------------------------------|
| Pickup
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/pickup",
    authorize("admin"),
    pickupRentalValidator,
    pickup
);

/*
|--------------------------------------------------------------------------|
| Return
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/return",
    authorize("admin"),
    returnRentalValidator,
    returnVehicle
);

/*
|--------------------------------------------------------------------------|
| Driver Management
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/driver",
    authorize("admin"),
    reassignDriverValidator,
    reassign
);

/*
|--------------------------------------------------------------------------|
| Damage Issues
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/damage-issues",
    authorize("admin"),
    addDamageIssueValidator,
    addDamage
);

/*
|--------------------------------------------------------------------------|
| Charges
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/charges",
    authorize("admin"),
    addChargeValidator,
    addRentalCharge
);

/*
|--------------------------------------------------------------------------|
| Adjustments
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/adjustments",
    authorize("admin"),
    addAdjustmentValidator,
    addRentalAdjustment
);

/*
|--------------------------------------------------------------------------|
| Payments
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/payments",
    authorize("admin"),
    addPaymentValidator,
    payment
);

router.post(
    "/:rentalId/payments/verify",
    authorize("admin"),
    verifyPaymentValidator,
    verifyRentalPayment
);

/*
|--------------------------------------------------------------------------|
| Security Deposit
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/security-deposit/hold",
    authorize("admin"),
    holdSecurityDepositValidator,
    holdDeposit
);

router.patch(
    "/:rentalId/security-deposit/deduct",
    authorize("admin"),
    deductSecurityDepositValidator,
    deductDeposit
);

router.patch(
    "/:rentalId/security-deposit/release",
    authorize("admin"),
    releaseSecurityDepositValidator,
    releaseDeposit
);

/*
|--------------------------------------------------------------------------|
| Vehicle Outcome
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/vehicle-outcome",
    authorize("admin"),
    updateVehicleOutcomeValidator,
    vehicleOutcome
);

/*
|--------------------------------------------------------------------------|
| Rental Completion
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:rentalId/complete",
    authorize("admin"),
    completeRentalValidator,
    complete
);

router.patch(
    "/:rentalId/customer-complete",
    authorize("customer"),
    rentalIdValidator,
    customerComplete
);

/*
|--------------------------------------------------------------------------|
| Operational Events
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/events",
    authorize("admin"),
    addOperationalEventValidator,
    addEvent
);

router.patch(
    "/:rentalId/penalty/waive",
    authorize("admin"),
    waivePenaltyValidator,
    waivePenaltyController
);

router.patch(
    "/:rentalId/penalty/adjust",
    authorize("admin"),
    adjustPenaltyValidator,
    adjustPenaltyController
);

router.patch(
    "/:rentalId/penalty/note",
    authorize("admin"),
    addPenaltyNoteValidator,
    addPenaltyNoteController
);

router.post(
    "/:rentalId/penalty/apply",
    authorize("admin"),
    applyPenaltyValidator,
    applyPenaltyController
);

export default router;