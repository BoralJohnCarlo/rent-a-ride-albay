import { body, param } from "express-validator";

import {
    DRIVER_STATUS_VALUES,
    DRIVER_AVAILABILITY_VALUES,
    DRIVER_LICENSE_TYPE_VALUES,
    DRIVER_LICENSE_CODE_VALUES,
} from "../constants/driverConstants.js";

export const createDriverValidator = [
    body("firstName")
        .trim()
        .notEmpty()
        .withMessage("First name is required."),

    body("lastName")
        .trim()
        .notEmpty()
        .withMessage("Last name is required."),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required.")
        .isEmail()
        .withMessage(
            "Please provide a valid email address."
        )
        .normalizeEmail(),

    body("phoneNumber")
        .trim()
        .notEmpty()
        .withMessage(
            "Phone number is required."
        ),

    body("alternativeContact")
        .optional()
        .trim(),

    body("profileImage")
        .optional()
        .trim(),

    body("address.region")
        .optional()
        .isString()
        .trim(),

    body("address.province")
        .optional()
        .trim(),

    body("address.city")
        .optional()
        .trim(),

    body("address.barangay")
        .optional()
        .trim(),

    body("address.street")
        .optional()
        .trim(),

    body("license.licenseNumber")
        .trim()
        .notEmpty()
        .withMessage(
            "Driver's license number is required."
        ),

    body("license.licenseType")
        .trim()
        .notEmpty()
        .withMessage(
            "Driver's license type is required."
        )
        .isIn(DRIVER_LICENSE_TYPE_VALUES)
        .withMessage(
            "Invalid driver's license type."
        ),

    body("license.expiryDate")
        .notEmpty()
        .withMessage(
            "Driver's license expiry date is required."
        )
        .isISO8601()
        .withMessage(
            "Driver's license expiry date must be a valid date."
        ),

    body("license.restrictionCodes")
        .optional()
        .isArray()
        .withMessage(
            "Restriction codes must be an array."
        ),

    body("license.restrictionCodes.*")
        .optional()
        .isIn(DRIVER_LICENSE_CODE_VALUES)
        .withMessage(
            "Invalid driver's license code."
        ),

    body("uploadedDocuments.driversLicense")
        .optional()
        .trim(),

    body("uploadedDocuments.governmentId")
        .optional()
        .trim(),

    body("uploadedDocuments.selfieVerification")
        .optional()
        .trim(),

    body("emergencyContact.name")
        .optional()
        .trim(),

    body("emergencyContact.relationship")
        .optional()
        .trim(),

    body("emergencyContact.phoneNumber")
        .optional()
        .trim(),

    body("status")
        .optional()
        .trim()
        .isIn(DRIVER_STATUS_VALUES)
        .withMessage(
            "Invalid driver status."
        ),

    body("availability")
        .optional()
        .trim()
        .isIn(DRIVER_AVAILABILITY_VALUES)
        .withMessage(
            "Invalid driver availability."
        ),

    // Blank means "use the global driver rate".
    body("pricing.dailyRate")
        .optional({ values: "falsy" })
        .isFloat({ min: 0, max: 1000000 })
        .withMessage(
            "The driver's daily rate must be a number from 0 to 1,000,000."
        ),

    body("schedule.workingDays")
        .optional()
        .isArray()
        .withMessage(
            "Working days must be an array."
        ),

    body("schedule.startTime")
        .optional()
        .trim(),

    body("schedule.endTime")
        .optional()
        .trim(),

    body("schedule.timezone")
        .optional()
        .trim(),
];

export const updateDriverValidator = [
    param("id")
        .isMongoId()
        .withMessage(
            "Driver ID must be a valid MongoDB ID."
        ),

    body("firstName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "First name cannot be empty."
        ),

    body("lastName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Last name cannot be empty."
        ),

    body("email")
        .optional()
        .trim()
        .isEmail()
        .withMessage(
            "Please provide a valid email address."
        )
        .normalizeEmail(),

    body("phoneNumber")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Phone number cannot be empty."
        ),

    body("alternativeContact")
        .optional()
        .trim(),

    body("profileImage")
        .optional()
        .trim(),

    body("address.region")
        .optional()
        .isString()
        .trim(),

    body("address.province")
        .optional()
        .trim(),

    body("address.city")
        .optional()
        .trim(),

    body("address.barangay")
        .optional()
        .trim(),

    body("address.street")
        .optional()
        .trim(),

    body("license.licenseNumber")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "License number cannot be empty."
        ),

    body("license.licenseType")
        .optional()
        .trim()
        .isIn(DRIVER_LICENSE_TYPE_VALUES)
        .withMessage(
            "Invalid driver's license type."
        ),

    body("license.expiryDate")
        .optional()
        .isISO8601()
        .withMessage(
            "Driver's license expiry date must be a valid date."
        ),

    body("license.restrictionCodes")
        .optional()
        .isArray()
        .withMessage(
            "Restriction codes must be an array."
        ),

    body("license.restrictionCodes.*")
        .optional()
        .isIn(DRIVER_LICENSE_CODE_VALUES)
        .withMessage(
            "Invalid driver's license code."
        ),

    body("uploadedDocuments.driversLicense")
        .optional()
        .trim(),

    body("uploadedDocuments.governmentId")
        .optional()
        .trim(),

    body("uploadedDocuments.selfieVerification")
        .optional()
        .trim(),

    body("emergencyContact.name")
        .optional()
        .trim(),

    body("emergencyContact.relationship")
        .optional()
        .trim(),

    body("emergencyContact.phoneNumber")
        .optional()
        .trim(),

    body("status")
        .optional()
        .trim()
        .isIn(DRIVER_STATUS_VALUES)
        .withMessage(
            "Invalid driver status."
        ),

    body("availability")
        .optional()
        .trim()
        .isIn(DRIVER_AVAILABILITY_VALUES)
        .withMessage(
            "Invalid driver availability."
        ),

    // Blank means "use the global driver rate".
    body("pricing.dailyRate")
        .optional({ values: "falsy" })
        .isFloat({ min: 0, max: 1000000 })
        .withMessage(
            "The driver's daily rate must be a number from 0 to 1,000,000."
        ),

    body("schedule.workingDays")
        .optional()
        .isArray()
        .withMessage(
            "Working days must be an array."
        ),

    body("schedule.startTime")
        .optional()
        .trim(),

    body("schedule.endTime")
        .optional()
        .trim(),

    body("schedule.timezone")
        .optional()
        .trim(),
];

export const updateDriverStatusValidator = [
    param("id")
        .isMongoId()
        .withMessage(
            "Driver ID must be a valid MongoDB ID."
        ),

    body("status")
        .trim()
        .notEmpty()
        .withMessage(
            "Driver status is required."
        )
        .isIn(DRIVER_STATUS_VALUES)
        .withMessage(
            "Invalid driver status."
        ),
];

export const updateDriverAvailabilityValidator = [
    param("id")
        .isMongoId()
        .withMessage(
            "Driver ID must be a valid MongoDB ID."
        ),

    body("availability")
        .trim()
        .notEmpty()
        .withMessage(
            "Driver availability is required."
        )
        .isIn(DRIVER_AVAILABILITY_VALUES)
        .withMessage(
            "Invalid driver availability."
        ),
];

export const driverIdValidator = [
    param("id")
        .isMongoId()
        .withMessage(
            "Driver ID must be a valid MongoDB ID."
        ),
];