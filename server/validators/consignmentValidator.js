import { body, param } from "express-validator";

import {
    INSPECTION_STATUS_VALUES,
    OWNERSHIP_TYPE_VALUES,
} from "../constants/consignmentConstants.js";

import {
    TRANSMISSION_TYPE_VALUES,
    FUEL_TYPE_VALUES,
    VEHICLE_TYPE_VALUES,
} from "../constants/vehicleConstants.js";



/* -------------------------------------------------------------------------- */
/*                               Path Constants                               */
/* -------------------------------------------------------------------------- */

const VEHICLE = "snapshots.vehicle";
const APPLICATION = "application";

const SPECIFICATIONS = `${VEHICLE}.specifications`;
const DESCRIPTION = `${VEHICLE}.description`;
const COMPLIANCE = `${VEHICLE}.compliance`;
const IMAGES = `${VEHICLE}.images`;
const DOCUMENTS = `${VEHICLE}.documents`;

const SUBMITTED = `${APPLICATION}.submitted`;
const REVIEW = `${APPLICATION}.review`;
const INSPECTION = `${APPLICATION}.inspection`;
const APPROVAL = `${APPLICATION}.approval`;
const WITHDRAWAL = `${APPLICATION}.withdrawal`;

/* -------------------------------------------------------------------------- */
/*                    Vehicle Basic Information Validation                     */
/* -------------------------------------------------------------------------- */

const vehicleBasicInformationValidation = [
    body(`${VEHICLE}.plateNumber`)
        .trim()
        .notEmpty()
        .withMessage("Plate number is required.")
        .isLength({ max: 20 })
        .withMessage("Plate number cannot exceed 20 characters."),

    body(`${VEHICLE}.registrationNumber`)
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("Registration number cannot exceed 50 characters."),

    body(`${VEHICLE}.brand`)
        .trim()
        .notEmpty()
        .withMessage("Vehicle brand is required.")
        .isLength({ max: 100 })
        .withMessage("Vehicle brand cannot exceed 100 characters."),

    body(`${VEHICLE}.model`)
        .trim()
        .notEmpty()
        .withMessage("Vehicle model is required.")
        .isLength({ max: 100 })
        .withMessage("Vehicle model cannot exceed 100 characters."),

    body(`${VEHICLE}.variant`)
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Vehicle variant cannot exceed 100 characters."),

    body(`${VEHICLE}.year`)
        .notEmpty()
        .withMessage("Vehicle year is required.")
        .isInt({
            min: 1900,
            max: new Date().getFullYear() + 1,
        })
        .withMessage("Vehicle year is invalid."),

    body(`${VEHICLE}.vehicleType`)
        .trim()
        .notEmpty()
        .withMessage("Vehicle type is required.")
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage("Invalid vehicle type."),

    /*
     * checkFalsy (not just nullable) is required here — the New Consignment
     * wizard's category field defaults to "" when left unselected (it's
     * optional), and plain `optional({ nullable: true })` only skips
     * undefined/null, not an empty string. Without checkFalsy, "" reached
     * .isMongoId() and failed, rejecting the entire application with a
     * generic "Validation failed" even though every field was filled in.
     */
    body(`${VEHICLE}.category`)
        .optional({ checkFalsy: true })
        .isMongoId()
        .withMessage("Invalid vehicle category ID."),

    body(`${VEHICLE}.ownership`)
        .trim()
        .notEmpty()
        .withMessage("Ownership type is required.")
        .isIn(OWNERSHIP_TYPE_VALUES)
        .withMessage("Invalid ownership type."),
];

/* -------------------------------------------------------------------------- */
/*                    Vehicle Specifications Validation                        */
/* -------------------------------------------------------------------------- */

const vehicleSpecificationValidation = [
    body(`${SPECIFICATIONS}.transmission`)
        .trim()
        .notEmpty()
        .withMessage("Transmission is required.")
        .isIn(TRANSMISSION_TYPE_VALUES)
        .withMessage("Invalid transmission type."),

    body(`${SPECIFICATIONS}.fuelType`)
        .trim()
        .notEmpty()
        .withMessage("Fuel type is required.")
        .isIn(FUEL_TYPE_VALUES)
        .withMessage("Invalid fuel type."),

    body(`${SPECIFICATIONS}.engine`)
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Engine specification cannot exceed 100 characters."),

    body(`${SPECIFICATIONS}.seatingCapacity`)
        .notEmpty()
        .withMessage("Seating capacity is required.")
        .isInt({
            min: 1,
            max: 100,
        })
        .withMessage(
            "Seating capacity must be a whole number between 1 and 100."
        ),

    /*
     * Never made it onto the real Vehicle schema — see the matching note
     * on server/models/Consignment.js's specifications.color.
     */
    body(`${SPECIFICATIONS}.color`)
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("Vehicle color cannot exceed 50 characters."),
];

/* -------------------------------------------------------------------------- */
/*                    Vehicle Description Validation                           */
/* -------------------------------------------------------------------------- */

const vehicleDescriptionValidation = [
    body(`${DESCRIPTION}.public`)
        .optional({ checkFalsy: true })
        .trim()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "Public description cannot exceed 2000 characters."
        ),

    body(`${DESCRIPTION}.internal`)
        .optional()
        .trim()
        .isLength({
            max: 2000,
        })
        .withMessage(
            "Internal description cannot exceed 2000 characters."
        ),
];

/* -------------------------------------------------------------------------- */
/*                     Vehicle Compliance Validation                           */
/* -------------------------------------------------------------------------- */

const vehicleComplianceValidation = [
    body(`${COMPLIANCE}.licenseExpiration`)
        .optional({ nullable: true })
        .isISO8601()
        .withMessage(
            "License expiration must be a valid date."
        ),

    body(`${COMPLIANCE}.registrationNumberVerified`)
        .optional()
        .isBoolean()
        .withMessage(
            "Registration verification must be true or false."
        ),
];

/* -------------------------------------------------------------------------- */
/*                      Vehicle Documents Validation (OR/CR)                   */
/* -------------------------------------------------------------------------- */

const vehicleDocumentsValidation = [
    body(`${DOCUMENTS}.officialReceipt.url`)
        .trim()
        .notEmpty()
        .withMessage("Official Receipt (OR) image is required.")
        .isURL({
            protocols: ["http", "https"],
            require_protocol: true,
        })
        .withMessage(
            "Official Receipt image URL must be a valid URL."
        ),

    body(`${DOCUMENTS}.officialReceipt.publicId`)
        .trim()
        .notEmpty()
        .withMessage("Official Receipt (OR) image is required.")
        .isLength({ max: 255 })
        .withMessage(
            "Official Receipt image public ID cannot exceed 255 characters."
        ),

    body(`${DOCUMENTS}.certificateOfRegistration.url`)
        .trim()
        .notEmpty()
        .withMessage(
            "Certificate of Registration (CR) image is required."
        )
        .isURL({
            protocols: ["http", "https"],
            require_protocol: true,
        })
        .withMessage(
            "Certificate of Registration image URL must be a valid URL."
        ),

    body(`${DOCUMENTS}.certificateOfRegistration.publicId`)
        .trim()
        .notEmpty()
        .withMessage(
            "Certificate of Registration (CR) image is required."
        )
        .isLength({ max: 255 })
        .withMessage(
            "Certificate of Registration image public ID cannot exceed 255 characters."
        ),
];

/* -------------------------------------------------------------------------- */
/*                       Vehicle Images Validation                             */
/* -------------------------------------------------------------------------- */

const vehicleImagesValidation = [
    body(IMAGES)
        .isArray({ min: 1, max: 10 })
        .withMessage("A vehicle must have between 1 and 10 images."),

    body(`${IMAGES}.*.url`)
        .trim()
        .notEmpty()
        .withMessage("Image URL is required.")
        .isURL({
            protocols: ["http", "https"],
            require_protocol: true,
        })
        .withMessage("Image URL must be a valid URL."),

    body(`${IMAGES}.*.publicId`)
        .trim()
        .notEmpty()
        .withMessage("Image public ID is required.")
        .isLength({ max: 255 })
        .withMessage("Image public ID cannot exceed 255 characters."),

    body(`${IMAGES}.*.originalName`)
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage("Original filename cannot exceed 255 characters."),

    body(`${IMAGES}.*.isPrimary`)
        .optional()
        .isBoolean()
        .withMessage("Primary image flag must be true or false."),

    body(IMAGES).custom((images) => {
        if (!Array.isArray(images) || images.length === 0) {
            return true;
        }

        const primaryImages = images.filter(
            (image) => image?.isPrimary === true
        );

        if (primaryImages.length !== 1) {
            throw new Error(
                "Exactly one vehicle image must be marked as the primary image."
            );
        }

        return true;
    }),
];

/* -------------------------------------------------------------------------- */
/*                        Submission Validation                               */
/* -------------------------------------------------------------------------- */

const submissionValidation = [
    body(`${SUBMITTED}.remarks`)
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Submission remarks cannot exceed 1000 characters."),

    /*
     * Optional rather than required — the New Consignment wizard's Terms &
     * Agreement step always sends true, but other submission paths (e.g.
     * admin submitting on an operator's behalf) don't collect this at all
     * and shouldn't be blocked for its absence.
     */
    body(`${SUBMITTED}.termsAgreed`)
        .optional()
        .isBoolean()
        .withMessage(
            "termsAgreed must be true or false."
        ),
];

/* -------------------------------------------------------------------------- */
/*                          Review Validation                                 */
/* -------------------------------------------------------------------------- */

const reviewValidation = [
    body("decision")
        .trim()
        .notEmpty()
        .withMessage(
            "Review decision is required."
        )
        .isIn([
            "review",
            "revision",
            "reject",
        ])
        .withMessage(
            "Invalid review decision."
        ),

    body("remarks")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            "Review remarks cannot exceed 1000 characters."
        ),
];

/* -------------------------------------------------------------------------- */
/*                        Inspection Validation                               */
/* -------------------------------------------------------------------------- */

const inspectionValidation = [
    body("status")
        .notEmpty()
        .withMessage("Inspection status is required.")
        .isIn(INSPECTION_STATUS_VALUES)
        .withMessage("Invalid inspection status."),

    body("remarks")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Inspection remarks cannot exceed 1000 characters."),
];

/* -------------------------------------------------------------------------- */
/*                         Approval Validation                                */
/* -------------------------------------------------------------------------- */

const approvalValidation = [
    body("remarks")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Approval remarks cannot exceed 1000 characters."),

    /*
     * Pricing is no longer collected from the operator at submission — it's
     * set here by admin, since approving is also the moment the vehicle is
     * created and goes live as Available (see approveConsignment).
     */
    body("pricing.dailyRate")
        .notEmpty()
        .withMessage("Daily rate is required.")
        .isFloat({ min: 0 })
        .withMessage("Daily rate must be greater than or equal to 0."),

    body("pricing.reservationFee")
        .notEmpty()
        .withMessage("Reservation fee is required.")
        .isFloat({ min: 0 })
        .withMessage("Reservation fee must be greater than or equal to 0."),

    body("pricing").custom((pricing) => {
        const dailyRate = Number(pricing?.dailyRate);
        const reservationFee = Number(pricing?.reservationFee);

        if (
            Number.isFinite(dailyRate) &&
            Number.isFinite(reservationFee) &&
            reservationFee > dailyRate
        ) {
            throw new Error(
                "Reservation fee cannot be greater than the daily rate."
            );
        }

        return true;
    }),

    /*
     * Always optional here — sending it at all is what marks this vehicle
     * as getting an individually-negotiated rate (see approveConsignment);
     * omitting it means it falls back to the platform's default rate. This
     * only validates the shape when it's present.
     */
    body("commission")
        .optional({ nullable: true })
        .isObject()
        .withMessage("commission must be an object."),

    body("commission.mode")
        .if(body("commission").exists())
        .isIn(["PERCENTAGE", "FIXED"])
        .withMessage("commission.mode must be PERCENTAGE or FIXED."),

    body("commission.value")
        .if(body("commission").exists())
        .isFloat({ min: 0 })
        .withMessage("commission.value must be a non-negative number."),
];

/* -------------------------------------------------------------------------- */
/*                        Withdrawal Validation                               */
/* -------------------------------------------------------------------------- */

const withdrawalValidation = [
    body("remarks")
        .notEmpty()
        .withMessage(
            "Withdrawal remarks are required."
        )
        .trim()
        .isLength({
            min: 5,
            max: 1000,
        })
        .withMessage(
            "Withdrawal remarks must be between 5 and 1000 characters."
        ),
];

const archiveValidation = [
    body("remarks")
        .optional()
        .trim()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Archive remarks cannot exceed 1000 characters."
        ),
];



/* -------------------------------------------------------------------------- */
/*                           Public Validators                                */
/* -------------------------------------------------------------------------- */

/*
 * The applicant is whichever operator is logged in — their profile is
 * snapshotted onto the consignment automatically in the service layer
 * (createConsignment), not collected on this form. Only the vehicle being
 * submitted for consignment needs validating here.
 */
const createConsignmentValidator = [
    ...vehicleBasicInformationValidation,
    ...vehicleSpecificationValidation,
    ...vehicleDescriptionValidation,
    ...vehicleComplianceValidation,
    ...vehicleDocumentsValidation,
    ...vehicleImagesValidation,
];

const updateDraftConsignmentValidator = [
    ...createConsignmentValidator,
];

/*
 * Submitting doesn't touch any vehicle fields — submitConsignment only ever
 * reads remarks/termsAgreed off the body (the vehicle snapshot itself was
 * already validated in full at create/updateDraft time and lives in the
 * stored document, not in this request). Re-requiring the whole vehicle
 * payload here would reject every real caller, since none of them
 * (admin/operator "Submit" actions, or this wizard's Terms step) send one.
 */
const submitConsignmentValidator = [
    ...submissionValidation,
];

const reviewConsignmentValidator = [
    ...reviewValidation,
];

const inspectionValidator = [
    ...inspectionValidation,
];

const approvalValidator = [
    ...approvalValidation,
];

const withdrawalValidator = [
    ...withdrawalValidation,
];

const archiveValidator = [
    ...archiveValidation,
];

const consignmentIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid consignment ID."),
];

const rescheduleRequestValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid consignment ID."),

    body("proposedDate")
        .isISO8601()
        .withMessage("Proposed date is required and must be a valid date."),

    body("proposedTime")
        .isString()
        .trim()
        .isLength({ min: 1, max: 10 })
        .withMessage("Proposed time is required and must be a string."),

    body("reason")
        .isString()
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage("Reason is required and must be a string (1-500 characters)."),
];

const rescheduleApproveValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid consignment ID."),

    body("remarks")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Remarks must be a string (max 500 characters)."),
];

const rescheduleRejectValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid consignment ID."),

    body("remarks")
        .isString()
        .trim()
        .isLength({ min: 1, max: 500 })
        .withMessage("Remarks are required and must be a string (1-500 characters)."),
];

const inspectionAppointmentValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid consignment ID."),

    body("date")
        .isString()
        .trim()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("Date is required in YYYY-MM-DD format."),

    body("time")
        .isString()
        .trim()
        .matches(/^\d{2}:\d{2}$/)
        .withMessage("Time is required in HH:mm format."),
];

export {
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
};