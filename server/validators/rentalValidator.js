import mongoose from "mongoose";
import { body, param } from "express-validator";
import { refundCentavos } from "../utils/refundAmount.js";

import {
    RENTAL_INSPECTION_CONDITION_VALUES,
    RENTAL_CHARGE_TYPE_VALUES,
    RENTAL_ADJUSTMENT_TYPE_VALUES,
    RENTAL_PAYMENT_TYPE_VALUES,
    RENTAL_PAYMENT_STATUS_VALUES,
    RENTAL_PAYMENT_METHOD_VALUES,
    RENTAL_REFUND_REASON_VALUES,
    RENTAL_OPERATIONAL_EVENT_VALUES,
    RENTAL_VEHICLE_OUTCOME_VALUES,
    RENTAL_STATUS_VALUES,
} from "../constants/rentalConstants.js";

import {
    VEHICLE_MAINTENANCE_MODE,
    VEHICLE_MAINTENANCE_MODE_VALUES,
    MAX_VEHICLE_MAINTENANCE_DAYS,
} from "../constants/vehicleConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

const validateNonNegativeNumber = (
    value
) => {
    return (
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
};

const validatePositiveNumber = (
    value
) => {
    return (
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
};

const validatePercentage = (value) => {
    return (
        Number.isFinite(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= 100
    );
};

const validateOptionalObjectId = (
    value
) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return true;
    }

    return isValidObjectId(value);
};

const validatePhotos = (
    fieldName
) => [
    body(fieldName)
        .optional()
        .isArray()
        .withMessage(
            `${fieldName} must be an array.`
        ),

    body(`${fieldName}.*.url`)
        .notEmpty()
        .withMessage(
            `${fieldName} photo URL is required.`
        )
        .isString()
        .withMessage(
            `${fieldName} photo URL must be a string.`
        )
        .trim(),

    body(`${fieldName}.*.publicId`)
        .optional()
        .isString()
        .withMessage(
            `${fieldName} photo public ID must be a string.`
        )
        .trim(),

    body(`${fieldName}.*.originalName`)
        .optional()
        .isString()
        .withMessage(
            `${fieldName} photo original name must be a string.`
        )
        .trim(),
];

const validateDamageIssues = [
    body("damageIssues")
        .optional()
        .isArray()
        .withMessage(
            "Damage issues must be an array."
        ),

    body("damageIssues.*.description")
        .if(
            body("damageIssues").exists()
        )
        .notEmpty()
        .withMessage(
            "Damage issue description is required."
        )
        .isString()
        .withMessage(
            "Damage issue description must be a string."
        )
        .trim(),

    body("damageIssues.*.condition")
        .optional({ nullable: true })
        .trim()
        .isIn(
            RENTAL_INSPECTION_CONDITION_VALUES
        )
        .withMessage(
            "Invalid damage issue condition."
        ),

    body("damageIssues.*.chargeReference")
        .optional({ nullable: true })
        .custom(validateOptionalObjectId)
        .withMessage(
            "Damage issue charge reference must be a valid ID."
        ),

    body("damageIssues.*.chargeAmount")
        .optional()
        .isNumeric()
        .withMessage(
            "Damage issue charge amount must be a number."
        )
        .custom(validateNonNegativeNumber)
        .withMessage(
            "Damage issue charge amount cannot be negative."
        ),

    body("damageIssues.*.notes")
        .optional()
        .isString()
        .withMessage(
            "Damage issue notes must be a string."
        )
        .trim(),

    body("damageIssues.*.photos")
        .optional()
        .isArray()
        .withMessage(
            "Damage issue photos must be an array."
        ),

    body("damageIssues.*.photos.*.url")
        .notEmpty()
        .withMessage(
            "Damage issue photo URL is required."
        )
        .isString()
        .withMessage(
            "Damage issue photo URL must be a string."
        )
        .trim(),

    body("damageIssues.*.photos.*.publicId")
        .optional()
        .isString()
        .withMessage(
            "Damage issue photo public ID must be a string."
        )
        .trim(),

    body("damageIssues.*.photos.*.originalName")
        .optional()
        .isString()
        .withMessage(
            "Damage issue photo original name must be a string."
        )
        .trim(),
];

export const rentalIdValidator = [
    param("rentalId")
        .notEmpty()
        .withMessage(
            "Rental ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Rental ID must be valid."
        ),
];

export const createRentalValidator = [
    body("booking")
        .notEmpty()
        .withMessage(
            "Booking ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Booking ID must be valid."
        ),

    body("releaseEarly")
        .optional()
        .isBoolean({ strict: true })
        .withMessage(
            "releaseEarly must be true or false."
        ),
];

export const updateRentalValidator = [
    ...rentalIdValidator,

    body("driver")
        .optional({ nullable: true })
        .custom(isValidObjectId)
        .withMessage(
            "Driver must be a valid ID."
        ),

    body("vehicleOutcome")
        .optional()
        .trim()
        .isIn(
            RENTAL_VEHICLE_OUTCOME_VALUES
        )
        .withMessage(
            "Invalid vehicle outcome."
        ),

    body("status")
        .optional()
        .trim()
        .isIn(
            RENTAL_STATUS_VALUES
        )
        .withMessage(
            "Invalid rental status."
        ),
];

export const pickupRentalValidator = [
    ...rentalIdValidator,

    body("date")
        .optional()
        .isISO8601()
        .withMessage(
            "Pickup date must be a valid date."
        ),

    body("condition")
        .optional()
        .trim()
        .isIn(
            RENTAL_INSPECTION_CONDITION_VALUES
        )
        .withMessage(
            "Invalid pickup condition."
        ),

    body("odometer")
        .optional()
        .isNumeric()
        .withMessage(
            "Pickup odometer must be a number."
        )
        .custom(validateNonNegativeNumber)
        .withMessage(
            "Pickup odometer cannot be negative."
        ),

    body("fuelLevel")
        .notEmpty()
        .withMessage(
            "Pickup fuel level is required."
        )
        .isNumeric()
        .withMessage(
            "Pickup fuel level must be a number."
        )
        .custom(validatePercentage)
        .withMessage(
            "Pickup fuel level must be between 0 and 100."
        ),

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Pickup notes must be a string."
        )
        .trim(),

    ...validatePhotos("photos"),
];

export const returnRentalValidator = [
    ...rentalIdValidator,

    body("date")
        .optional()
        .isISO8601()
        .withMessage(
            "Return date must be a valid date."
        ),

    body("condition")
        .optional()
        .trim()
        .isIn(
            RENTAL_INSPECTION_CONDITION_VALUES
        )
        .withMessage(
            "Invalid return condition."
        ),

    body("odometer")
        .optional()
        .isNumeric()
        .withMessage(
            "Return odometer must be a number."
        )
        .custom(validateNonNegativeNumber)
        .withMessage(
            "Return odometer cannot be negative."
        ),

    body("fuelLevel")
        .optional()
        .isNumeric()
        .withMessage(
            "Return fuel level must be a number."
        )
        .custom(validatePercentage)
        .withMessage(
            "Return fuel level must be between 0 and 100."
        ),

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Return notes must be a string."
        )
        .trim(),

    ...validatePhotos("photos"),

    ...validateDamageIssues,

    /*
     * No longer collected on the return form itself (see
     * RentalActionModal.jsx) - a dedicated "outcome" step is chained in
     * immediately after a successful return instead (Bookings.jsx's
     * submitAction), which is what actually sets this via
     * updateVehicleOutcome. completeRental still refuses to run without it
     * being set eventually, just not necessarily in this same request.
     */
    body("vehicleOutcome")
        .optional()
        .trim()
        .isIn(
            RENTAL_VEHICLE_OUTCOME_VALUES
        )
        .withMessage(
            "Invalid vehicle outcome."
        ),
];

export const addDamageIssueValidator = [
    ...rentalIdValidator,

    body("description")
        .notEmpty()
        .withMessage(
            "Damage issue description is required."
        )
        .isString()
        .withMessage(
            "Damage issue description must be a string."
        )
        .trim(),

    body("condition")
        .optional({ nullable: true })
        .trim()
        .isIn(
            RENTAL_INSPECTION_CONDITION_VALUES
        )
        .withMessage(
            "Invalid damage issue condition."
        ),

    body("chargeReference")
        .optional({ nullable: true })
        .custom(validateOptionalObjectId)
        .withMessage(
            "Damage issue charge reference must be a valid ID."
        ),

    body("chargeAmount")
        .optional()
        .isNumeric()
        .withMessage(
            "Damage issue charge amount must be a number."
        )
        .custom(validateNonNegativeNumber)
        .withMessage(
            "Damage issue charge amount cannot be negative."
        ),

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Damage issue notes must be a string."
        )
        .trim(),

    body("photos")
        .optional()
        .isArray()
        .withMessage(
            "Damage issue photos must be an array."
        ),

    body("photos.*.url")
        .notEmpty()
        .withMessage(
            "Damage issue photo URL is required."
        )
        .isString()
        .withMessage(
            "Damage issue photo URL must be a string."
        )
        .trim(),

    body("photos.*.publicId")
        .optional()
        .isString()
        .withMessage(
            "Damage issue photo public ID must be a string."
        )
        .trim(),

    body("photos.*.originalName")
        .optional()
        .isString()
        .withMessage(
            "Damage issue photo original name must be a string."
        )
        .trim(),
];

export const addChargeValidator = [
    ...rentalIdValidator,

    body("type")
        .notEmpty()
        .withMessage(
            "Charge type is required."
        )
        .trim()
        .isIn(
            RENTAL_CHARGE_TYPE_VALUES
        )
        .withMessage(
            "Invalid charge type."
        ),

    body("amount")
        .notEmpty()
        .withMessage(
            "Charge amount is required."
        )
        .isNumeric()
        .withMessage(
            "Charge amount must be a number."
        )
        .custom(validatePositiveNumber)
        .withMessage(
            "Charge amount must be greater than zero."
        ),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Charge description must be a string."
        )
        .trim(),

    body("referenceId")
        .optional({ nullable: true })
        .custom(validateOptionalObjectId)
        .withMessage(
            "Charge reference ID must be valid."
        ),
];

export const addAdjustmentValidator = [
    ...rentalIdValidator,

    body("type")
        .notEmpty()
        .withMessage(
            "Adjustment type is required."
        )
        .trim()
        .isIn(
            RENTAL_ADJUSTMENT_TYPE_VALUES
        )
        .withMessage(
            "Invalid adjustment type."
        ),

    body("amount")
        .notEmpty()
        .withMessage(
            "Adjustment amount is required."
        )
        .isNumeric()
        .withMessage(
            "Adjustment amount must be a number."
        )
        .custom(validatePositiveNumber)
        .withMessage(
            "Adjustment amount must be greater than zero."
        ),

    body("reason")
        .notEmpty()
        .withMessage(
            "Adjustment reason is required."
        )
        .isString()
        .withMessage(
            "Adjustment reason must be a string."
        )
        .trim(),
];

export const addPaymentValidator = [
    ...rentalIdValidator,

    body("type")
        .notEmpty()
        .withMessage(
            "Payment type is required."
        )
        .trim()
        .isIn(
            RENTAL_PAYMENT_TYPE_VALUES
        )
        .withMessage(
            "Invalid payment type."
        ),

    body("amount")
        .notEmpty()
        .withMessage(
            "Payment amount is required."
        )
        .isNumeric()
        .withMessage(
            "Payment amount must be a number."
        )
        .custom(validatePositiveNumber)
        .withMessage(
            "Payment amount must be greater than zero."
        ),

    body("paymentDate")
        .optional()
        .isISO8601()
        .withMessage(
            "Payment date must be a valid date."
        ),

    body("paymentMethod")
        .notEmpty()
        .withMessage(
            "Payment method is required."
        )
        .trim()
        .isIn(
            RENTAL_PAYMENT_METHOD_VALUES
        )
        .withMessage(
            "Invalid payment method."
        ),

    body("reference")
        .optional()
        .isString()
        .withMessage(
            "Payment reference must be a string."
        )
        .trim(),

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Payment notes must be a string."
        )
        .trim(),
];

export const verifyPaymentValidator = [
    ...rentalIdValidator,

    body("paymentId")
        .notEmpty()
        .withMessage(
            "Payment ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Payment ID must be valid."
        ),

    body("status")
        .notEmpty()
        .withMessage(
            "Payment verification status is required."
        )
        .trim()
        .isIn(
            RENTAL_PAYMENT_STATUS_VALUES
        )
        .withMessage(
            "Invalid payment verification status."
        ),

    body("rejectionReason")
        .optional()
        .isString()
        .withMessage(
            "Payment rejection reason must be a string."
        )
        .trim(),
];

export const holdSecurityDepositValidator = [
    ...rentalIdValidator,
];


export const deductSecurityDepositValidator = [
    ...rentalIdValidator,

    body("amount")
        .notEmpty()
        .withMessage(
            "Security deposit deduction amount is required."
        )
        .isNumeric()
        .withMessage(
            "Security deposit deduction amount must be a number."
        )
        .custom(validatePositiveNumber)
        .withMessage(
            "Security deposit deduction amount must be greater than zero."
        ),

    body("reason")
        .notEmpty()
        .withMessage(
            "Security deposit deduction reason is required."
        )
        .isString()
        .withMessage(
            "Security deposit deduction reason must be a string."
        )
        .trim(),
];


export const releaseSecurityDepositValidator = [
    ...rentalIdValidator,
];

export const addRefundValidator = [
    ...rentalIdValidator,

    body("amount")
        .notEmpty()
        .withMessage(
            "Refund amount is required."
        )
        .bail()
        .isNumeric()
        .withMessage(
            "Refund amount must be a number."
        )
        .bail()
        .custom(validatePositiveNumber)
        .withMessage(
            "Refund amount must be greater than zero."
        )
        .custom((value) => {
            const num = Number(value);
            return Number.isFinite(num) && num <= 999999999.99;
        })
        .withMessage(
            "Refund amount exceeds maximum allowed value."
        )
        .custom((value) => { refundCentavos(value); return true; }),

    body("reason")
        .notEmpty()
        .withMessage(
            "Refund reason is required."
        )
        .bail()
        .trim()
        .isIn(
            RENTAL_REFUND_REASON_VALUES
        )
        .withMessage(
            "Invalid refund reason."
        ),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Refund description must be a string."
        )
        .trim(),

    body("reference")
        .optional()
        .isString()
        .withMessage(
            "Refund reference must be a string."
        )
        .trim(),
];

/*
 * A customer's self-service refund request picks a refundType instead of
 * typing a raw amount for the common "full" case — "full" needs nothing
 * else, "partial" needs a percentage, "custom" needs an amount. All three
 * are capped server-side at the remaining refundable balance (see
 * requestRefund in rentalService.js). Only an admin recording/settling a
 * refund directly (addRefundValidator above) always specifies a raw amount.
 */
export const requestRefundValidator = [
    ...rentalIdValidator,

    body("reason")
        .notEmpty()
        .withMessage(
            "Refund reason is required."
        )
        .bail()
        .trim()
        .isIn(
            RENTAL_REFUND_REASON_VALUES
        )
        .withMessage(
            "Invalid refund reason."
        ),

    body("refundType")
        .optional()
        .trim()
        .isIn(["full", "partial", "custom"])
        .withMessage(
            "Refund type must be full, partial, or custom."
        ),

    body("percentage")
        .if(
            body("refundType").equals("partial")
        )
        .notEmpty()
        .withMessage(
            "Percentage is required for a partial refund."
        )
        .bail()
        .isFloat({ gt: 0, max: 100 })
        .withMessage(
            "Percentage must be greater than 0 and at most 100."
        ),

    body("amount")
        .if(
            body("refundType").equals("custom")
        )
        .notEmpty()
        .withMessage(
            "Amount is required for a custom refund."
        )
        .bail()
        .isFloat({ gt: 0 })
        .withMessage(
            "Refund amount must be greater than zero."
        )
        .custom((value) => { refundCentavos(value); return true; }),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Refund description must be a string."
        )
        .trim(),

    body("reference")
        .optional()
        .isString()
        .withMessage(
            "Refund reference must be a string."
        )
        .trim(),
];

/*
 * An admin approving a pending refund request may optionally approve a
 * smaller amount than what was requested (a partial percentage or a
 * manually-entered figure, computed to a final peso amount client-side) -
 * see approveRefund in rentalService.js, which enforces it can never exceed
 * the originally-requested amount.
 */
export const approveRefundValidator = [
    ...rentalIdValidator,

    param("refundId")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid refund ID."
        ),

    body("amount")
        .optional()
        .isFloat({ gt: 0 })
        .withMessage(
            "Approved amount must be greater than zero."
        )
        .custom((value) => { refundCentavos(value); return true; }),
];

/*
 * An admin confirming a refund they paid outside the app (or couldn't):
 * `succeeded` defaults to true, `notes` is an optional reference/explanation.
 */
export const settleRefundValidator = [
    ...rentalIdValidator,

    param("refundId")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid refund ID."
        ),

    body("succeeded")
        .optional()
        .isBoolean()
        .withMessage(
            "succeeded must be true or false."
        )
        .toBoolean(),

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Notes must be a string."
        )
        .isLength({ max: 255 })
        .withMessage(
            "Notes can be at most 255 characters."
        )
        .trim(),
];

// Settling an owed (manual) refund: same body as settleRefundValidator.
export const settleOwedRefundValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid refund ID."
        ),

    ...settleRefundValidator.slice(-2),
];

export const approveEarlyReturnValidator = [
    ...rentalIdValidator,

    body("unusedDays")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Unused days must be a positive whole number."
        ),
];

export const rejectEarlyReturnValidator = [
    ...rentalIdValidator,

    body("note")
        .optional()
        .isString()
        .withMessage("Note must be a string.")
        .trim(),
];

export const reassignDriverValidator = [
    ...rentalIdValidator,

    body("newDriver")
        .notEmpty()
        .withMessage(
            "New driver is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "New driver must be a valid ID."
        ),

    body("reason")
        .optional()
        .isString()
        .withMessage(
            "Reassignment reason must be a string."
        )
        .trim(),
];

export const addOperationalEventValidator = [
    ...rentalIdValidator,

    body("type")
        .notEmpty()
        .withMessage(
            "Operational event type is required."
        )
        .trim()
        .isIn(
            RENTAL_OPERATIONAL_EVENT_VALUES
        )
        .withMessage(
            "Invalid operational event type."
        ),

    body("date")
        .optional()
        .isISO8601()
        .withMessage(
            "Operational event date must be a valid date."
        ),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Operational event description must be a string."
        )
        .trim(),

    body("referenceId")
        .optional({ nullable: true })
        .custom(validateOptionalObjectId)
        .withMessage(
            "Operational event reference ID must be valid."
        ),
];

export const updateVehicleOutcomeValidator = [
    ...rentalIdValidator,

    body("vehicleOutcome")
        .notEmpty()
        .withMessage(
            "Vehicle outcome is required."
        )
        .trim()
        .isIn(
            RENTAL_VEHICLE_OUTCOME_VALUES
        )
        .withMessage(
            "Invalid vehicle outcome."
        ),

    body("maintenancePlan.mode")
        .optional({ values: "falsy" })
        .isIn(VEHICLE_MAINTENANCE_MODE_VALUES)
        .withMessage("Invalid maintenance type."),

    body("maintenancePlan.days")
        .if(
            body("maintenancePlan.mode").equals(
                VEHICLE_MAINTENANCE_MODE.EXTENDED
            )
        )
        .isInt({ min: 1, max: MAX_VEHICLE_MAINTENANCE_DAYS })
        .withMessage(
            `Maintenance must last between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`
        ),

    body("maintenancePlan.reason")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage(
            "The maintenance note can be up to 500 characters."
        ),
];

export const completeRentalValidator = [
    ...rentalIdValidator,

    body("notes")
        .optional()
        .isString()
        .withMessage(
            "Completion notes must be a string."
        )
        .trim(),

    body("overrideOutstandingBalance")
        .optional()
        .isBoolean()
        .withMessage(
            "overrideOutstandingBalance must be true or false."
        ),
];

export const waivePenaltyValidator = [
    ...rentalIdValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage("Reason must be a string.")
        .trim(),
];

export const adjustPenaltyValidator = [
    ...rentalIdValidator,

    body("newAmount")
        .notEmpty()
        .withMessage(
            "New amount is required."
        )
        .isFloat({ min: 0 })
        .withMessage(
            "New amount must be a non-negative number."
        ),

    body("reason")
        .optional()
        .isString()
        .withMessage("Reason must be a string.")
        .trim(),
];

export const addPenaltyNoteValidator = [
    ...rentalIdValidator,

    body("reason")
        .notEmpty()
        .withMessage("Reason is required.")
        .isString()
        .withMessage("Reason must be a string.")
        .trim(),
];

export const applyPenaltyValidator = [
    ...rentalIdValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage("Reason must be a string.")
        .trim(),
];
