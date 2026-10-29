import { body, param } from "express-validator";

import {
    licenseCodeValidators,
} from "./licenseValidators.js";
import { VALID_ID_TYPES } from "../constants/userConstants.js";

export const updateProfileValidator = [
    body("firstName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters."),

    body("lastName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters."),

    body("phoneNumber")
        .optional()
        .trim()
        .if((value) => value && String(value).trim() !== "")
        .isMobilePhone("any")
        .withMessage("Invalid phone number."),

    body("alternativeContact")
        .optional()
        .trim()
        .if((value) => value && String(value).trim() !== "")
        .isMobilePhone("any")
        .withMessage("Invalid alternative contact number."),

    body("address.region")
        .optional()
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

    body("address.houseUnitLot")
        .optional()
        .trim(),

    body("address.postalCode")
        .optional()
        .trim(),

    body("currentAddress.province")
        .optional()
        .trim(),

    body("currentAddress.cityMunicipality")
        .optional()
        .trim(),

    body("currentAddress.barangay")
        .optional()
        .trim(),

    body("currentAddress.region")
        .optional()
        .trim(),

    body("currentAddress.street")
        .optional()
        .trim(),

    body("currentAddress.houseUnitLot")
        .optional()
        .trim(),

    body("currentAddress.postalCode")
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
        .trim()
        .if((value) => value && String(value).trim() !== "")
        .isMobilePhone("any")
        .withMessage("Invalid emergency contact number."),

    body("middleName")
        .optional()
        .trim(),

    body("birthdate")
        .optional()
        .isISO8601()
        .withMessage("Invalid birthdate."),

    body("validIdType")
        .optional()
        .trim()
        .isIn(VALID_ID_TYPES)
        .withMessage("Please select a valid ID type."),

    body("validIdImage")
        .optional()
        .trim(),

    body("validIdBack")
        .optional()
        .trim(),

    body("licenseNumber")
        .optional()
        .trim(),

    body("licenseExpirationDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid license expiration date."),

    body("hasDriversLicense")
        .optional()
        .isBoolean()
        .withMessage(
            "Please indicate whether you have a driver's license."
        )
        .toBoolean(),

    ...licenseCodeValidators,
];

/*
 * The valid-ID renewal endpoint only ever required an image before; these
 * fields are optional additions for a customer upgrading their ID type to
 * a driver's license in the same request (see uploadRenewedValidId). Only
 * the type + basic identity fields - licenseCodes/transmissions are edited
 * separately afterward via updateProfileValidator, once hasDriversLicense
 * is true and that section becomes relevant.
 */
export const renewValidIdValidator = [
    body("validIdType")
        .optional()
        .trim()
        .isIn(VALID_ID_TYPES)
        .withMessage("Please select a valid ID type."),

    body("licenseNumber")
        .optional()
        .trim(),

    body("licenseExpirationDate")
        .optional({ checkFalsy: true })
        .isISO8601()
        .withMessage("Invalid license expiration date."),
];

export const changePasswordValidator = [
    body("currentPassword")
        .notEmpty()
        .withMessage("Current password is required."),

    body("newPassword")
        .notEmpty()
        .withMessage("New password is required.")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters.")
        .matches(/[A-Z]/)
        .withMessage("Password must contain at least one uppercase letter.")
        .matches(/[a-z]/)
        .withMessage("Password must contain at least one lowercase letter.")
        .matches(/[0-9]/)
        .withMessage("Password must contain at least one number."),

    body("confirmPassword")
        .notEmpty()
        .withMessage("Confirm password is required.")
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage("Passwords do not match."),
];

export const notificationPreferencesValidator = [
    body("soundVolume")
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage("Volume must be a whole number from 0 to 100.")
        .toInt(),

    body("soundMuted")
        .optional()
        .isBoolean({ strict: true })
        .withMessage("Mute must be true or false."),

    body()
        .custom(
            (value) =>
                value?.soundVolume !== undefined ||
                value?.soundMuted !== undefined
        )
        .withMessage("Nothing to update."),
];

export const updateUserValidator = [
    body("firstName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters."),

    body("lastName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters."),

    body("phoneNumber")
        .optional()
        .trim()
        .isMobilePhone("any")
        .withMessage("Invalid phone number."),

    body("alternativeContact")
        .optional()
        .trim()
        .isMobilePhone("any")
        .withMessage("Invalid alternative contact number."),

    body("role")
        .optional()
        .isIn(["admin", "customer", "operator"])
        .withMessage("Invalid user role."),

    body("isVerified")
        .optional()
        .isBoolean()
        .withMessage("Verification status must be true or false."),

    body("isApproved")
        .optional()
        .isBoolean()
        .withMessage("Approval status must be true or false."),

    body("isSuspended")
        .optional()
        .isBoolean()
        .withMessage("Suspension status must be true or false."),
];

export const updateUserStatusValidator = [
    body("isSuspended")
        .notEmpty()
        .withMessage("Suspension status is required.")
        .isBoolean()
        .withMessage("Suspension status must be true or false."),
];

export const blacklistUserValidator = [
    body("reason")
        .trim()
        .notEmpty()
        .withMessage(
            "Blacklist reason is required."
        )
        .isLength({
            min: 5,
            max: 500,
        })
        .withMessage(
            "Blacklist reason must be between 5 and 500 characters."
        ),
];

export const verifyOperatorValidator = [
    body("status")
        .isIn(["Approved", "Rejected"])
        .withMessage("Invalid verification status."),
];

export const userIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid user ID."),
];

// The expiry printed on the ID; null = the ID has no expiry, omitted =
// keep the date on file.
export const verifyValidIdValidator = [
    body("expirationDate")
        .optional({ values: "null" })
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("Enter the ID's expiry date as YYYY-MM-DD.")
        .bail()
        .isISO8601({ strict: true })
        .withMessage("Invalid ID expiry date."),
];

export const createUserValidator = [
    body("firstName")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage(
            "First name must be between 2 and 50 characters."
        ),

    body("lastName")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage(
            "Last name must be between 2 and 50 characters."
        ),

    body("email")
        .trim()
        .isEmail()
        .withMessage("Invalid email address."),

    body("password")
        .isLength({ min: 8 })
        .withMessage(
            "Password must be at least 8 characters."
        )
        .matches(/[A-Z]/)
        .withMessage(
            "Password must contain at least one uppercase letter."
        )
        .matches(/[a-z]/)
        .withMessage(
            "Password must contain at least one lowercase letter."
        )
        .matches(/[0-9]/)
        .withMessage(
            "Password must contain at least one number."
        ),

    body("phoneNumber")
        .trim()
        .isMobilePhone("any")
        .withMessage("Invalid phone number."),

    body("alternativeContact")
        .optional()
        .trim()
        .isMobilePhone("any")
        .withMessage(
            "Invalid alternative contact number."
        ),

    body("role")
        .optional()
        .isIn([
            "admin",
            "customer",
            "operator",
        ])
        .withMessage("Invalid user role."),
];