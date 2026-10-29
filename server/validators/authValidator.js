import { body } from "express-validator";

import {
    licenseCodeValidators,
} from "./licenseValidators.js";
import { VALID_ID_TYPES } from "../constants/userConstants.js";
import {
    FUEL_TYPE_VALUES,
    MAX_VEHICLE_IMAGES,
    MIN_VEHICLE_IMAGES,
    TRANSMISSION_TYPE_VALUES,
    VEHICLE_TYPE_VALUES,
} from "../constants/vehicleConstants.js";
import Settings from "../models/Settings.js";
import { isProofOfBillingEnabled } from "../services/settingsService.js";

/*
 * Shared by customer and partner registration, so both get the same
 * password policy and phone rules.
 */
const passwordRule = () =>
    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 8 })
        .withMessage(
            "Password must be at least 8 characters"
        )
        .matches(/[A-Z]/)
        .withMessage(
            "Password must contain at least one uppercase letter"
        )
        .matches(/[a-z]/)
        .withMessage(
            "Password must contain at least one lowercase letter"
        )
        .matches(/[0-9]/)
        .withMessage(
            "Password must contain at least one number"
        );

// Digits with optional spaces, dashes, parentheses or a leading "+",
// holding 10-15 digits in total.
const phoneRule = () =>
    body("phoneNumber")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .matches(/^\+?[\d\s()-]+$/)
        .withMessage("Phone number can only contain digits.")
        .custom((value) => {
            const digits = value.replace(/\D/g, "").length;

            if (digits < 10 || digits > 15) {
                throw new Error(
                    "Phone number must have 10 to 15 digits."
                );
            }

            return true;
        });

/*
 * Letters (any language, e.g. "Ñ", "é"), spaces, periods, apostrophes and
 * hyphens only. Names end up in emails and notifications, so no markup.
 */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

const nameRule = (field, label, { required = true } = {}) => {
    const chain = required
        ? body(field)
              .trim()
              .notEmpty()
              .withMessage(`${label} is required`)
              .isLength({ min: 2, max: 50 })
              .withMessage(`${label} must be between 2 and 50 characters`)
        : body(field)
              .optional({ nullable: true, checkFalsy: true })
              .isString()
              .withMessage(`${label} must be text.`)
              .trim()
              .isLength({ max: 50 })
              .withMessage(`${label} must not exceed 50 characters`);

    return chain
        .matches(NAME_PATTERN)
        .withMessage(
            `${label} can only contain letters, spaces, periods, apostrophes and hyphens.`
        );
};

// "YYYY-MM-DD" today or later (in the server's local calendar).
const isNotPastDate = (value) => {
    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return !Number.isNaN(date.getTime()) && date >= today;
};

const notPastDateRule = (field, message) =>
    body(field)
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage("Please enter a valid date.")
        .custom((value) => {
            if (!isNotPastDate(value)) {
                throw new Error(message);
            }

            return true;
        });

const termsRule = () =>
    body("termsAgreed")
        .custom((value) => {
            if (value !== true) {
                throw new Error(
                    "You must agree to the Terms and Conditions and the Privacy Notice."
                );
            }

            return true;
        });

const birthdateRule = () =>
    body("birthdate")
        .notEmpty()
        .withMessage("Birthdate is required")
        .isISO8601()
        .withMessage(
            "Birthdate must be a valid date"
        )
        .custom((value) => {
            const [year, month, day] = value
                .split("-")
                .map(Number);

            const birthdate = new Date(year, month - 1, day);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (birthdate >= today) {
                throw new Error(
                    "Birthdate cannot be in the future."
                );
            }

            const age = today.getFullYear() - birthdate.getFullYear();
            const monthDiff = today.getMonth() - birthdate.getMonth();
            const dayDiff = today.getDate() - birthdate.getDate();

            const isOver18 =
                age > 18 ||
                (age === 18 && monthDiff > 0) ||
                (age === 18 && monthDiff === 0 && dayDiff >= 0);

            if (!isOver18) {
                throw new Error(
                    "You must be at least 18 years old."
                );
            }

            return true;
        });

/*
 * Required only while the admin has proof of billing turned on (Settings →
 * Registration). While it's off the field is ignored entirely - registerUser
 * and registerOperator drop whatever was sent - so a stale or half-finished
 * form can never fail on it.
 */
const proofOfBillingRule = () =>
    body("proofOfBillingImage").custom(async (value) => {
        if (!(await isProofOfBillingEnabled())) {
            return true;
        }

        if (!value) {
            throw new Error(
                "Please upload a proof of billing address."
            );
        }

        // The service then checks it is one of this registration's uploads.
        if (typeof value !== "string") {
            throw new Error(
                "Proof of billing address image must be a string."
            );
        }

        return true;
    });

const currentAddressRules = () => [
    body("currentAddress")
        .optional({ nullable: true })
        .isObject()
        .withMessage("Current address must be an object."),

    ...[
        ["houseUnitLot", "House/unit/lot"],
        ["street", "Street"],
        ["barangay", "Barangay"],
        ["cityMunicipality", "City/municipality"],
        ["province", "Province"],
        ["region", "Region"],
        ["postalCode", "Postal code"],
    ].map(([field, label]) =>
        body(`currentAddress.${field}`)
            .optional({ nullable: true })
            .isString()
            .withMessage(`${label} must be a string.`)
            .trim()
    ),
];

export const registerValidator = [
    nameRule("firstName", "First name"),

    nameRule("lastName", "Last name"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail(),

    passwordRule(),

    phoneRule(),

    body("alternativeContact")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Alternative contact must be a string."
        )
        .trim(),

    nameRule("middleName", "Middle name", { required: false }),

    birthdateRule(),

    body("validIdType")
        .notEmpty()
        .withMessage(
            "Valid ID type is required."
        )
        .isIn(VALID_ID_TYPES)
        .withMessage(
            "Please select a valid ID type."
        ),

    body("validIdImage")
        .notEmpty()
        .withMessage(
            "Valid ID image is required."
        )
        .isString()
        .withMessage(
            "Valid ID image must be a string."
        )
        .isURL()
        .withMessage(
            "Valid ID image must be a valid URL."
        ),

    body("validIdBack")
        .notEmpty()
        .withMessage(
            "Valid ID back image is required."
        )
        .isString()
        .withMessage(
            "Valid ID back image must be a string."
        )
        .isURL()
        .withMessage(
            "Valid ID back image must be a valid URL."
        ),

    proofOfBillingRule(),

    /*
     * Required going forward for every new customer registration, so
     * `hasDriversLicense` is only ever null on pre-existing accounts (see
     * User.js). Forced to true server-side below when the chosen ID type
     * is itself a driver's license, regardless of what was submitted.
     */
    body("hasDriversLicense")
        .customSanitizer((value, { req }) =>
            req.body.validIdType === "Driver's License"
                ? true
                : value
        )
        .isBoolean()
        .withMessage(
            "Please indicate whether you have a driver's license."
        )
        .toBoolean(),

    body("licenseNumber")
        .optional({ nullable: true })
        .isString()
        .withMessage("License number must be a string.")
        .trim(),

    /*
     * A separate, non-optional entry for the same field: `.optional()`
     * above skips its ENTIRE chain (including any `.custom()` tacked onto
     * the end of it) whenever the value is absent, so a conditional
     * "required only when X" rule can't live in that chain - it would
     * simply never run for a customer who omits the field, which is
     * exactly the case this needs to catch.
     */
    body("licenseNumber").custom((value, { req }) => {
        if (req.body.hasDriversLicense === true && !value) {
            throw new Error(
                "License number is required when you have a driver's license."
            );
        }

        return true;
    }),

    notPastDateRule(
        "licenseExpirationDate",
        "Your driver's license has already expired. Please renew it, or register without a license for now."
    ),

    body("licenseExpirationDate").custom((value, { req }) => {
        if (req.body.hasDriversLicense === true && !value) {
            throw new Error(
                "License expiration date is required when you have a driver's license."
            );
        }

        return true;
    }),

    ...licenseCodeValidators,

    /*
     * licenseCodeValidators (shared with profile updates, where a partial
     * edit legitimately shouldn't have to re-declare codes) never requires
     * licenseCodes to be non-empty. At registration, with a declared
     * license, it should be - but only when the admin has license
     * restriction turned on; matches Register.jsx's own client-side rule
     * (validateStep case 1), closing the gap where that requirement was
     * previously enforced only in the browser, never by the API itself.
     */
    body("licenseCodes").custom(async (value, { req }) => {
        if (req.body.hasDriversLicense !== true) {
            return true;
        }

        const settings = await Settings.findOne()
            .select("customerBookingSettings.licenseRestrictionEnabled")
            .lean();

        const restrictionEnabled =
            settings?.customerBookingSettings
                ?.licenseRestrictionEnabled !== false;

        if (
            restrictionEnabled &&
            (!Array.isArray(value) || value.length === 0)
        ) {
            throw new Error(
                "Please select at least one driving category."
            );
        }

        return true;
    }),

    ...currentAddressRules(),

    termsRule(),

    body("temporaryUploadIds")
        .optional({ nullable: true })
        .isArray()
        .withMessage("Temporary upload IDs must be an array."),
];

export const loginValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail(),

    body("password")
        .notEmpty()
        .withMessage("Password is required"),
];

export const verifyEmailValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail(),

    body("code")
        .trim()
        .matches(/^\d{6}$/)
        .withMessage("Verification code must be a 6-digit number."),
];

export const resendVerificationValidator = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail(),
];

const emailRule = () =>
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail();

export const forgotPasswordValidator = [emailRule()];

export const verifyResetCodeValidator = [
    emailRule(),

    body("code")
        .trim()
        .matches(/^\d{6}$/)
        .withMessage("The code must be 6 digits."),
];

export const resetPasswordValidator = [
    emailRule(),

    body("resetToken")
        .isString()
        .matches(/^[a-f0-9]{64}$/)
        .withMessage("Your reset session has expired. Please start again."),

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
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage("Passwords do not match."),
];

export const registerOperatorValidator = [
    nameRule("firstName", "First name"),

    nameRule("lastName", "Last name"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email address")
        .normalizeEmail(),

    passwordRule(),

    phoneRule(),

    body("alternativeContact")
        .optional({ nullable: true })
        .isString()
        .withMessage(
            "Alternative contact must be a string."
        )
        .trim(),

    nameRule("middleName", "Middle name", { required: false }),

    birthdateRule(),

    body("validIdType")
        .notEmpty()
        .withMessage(
            "Valid ID type is required."
        )
        .isIn(VALID_ID_TYPES)
        .withMessage(
            "Please select a valid ID type."
        ),

    body("validIdImage")
        .notEmpty()
        .withMessage(
            "Valid ID image is required."
        )
        .isString()
        .withMessage(
            "Valid ID image must be a string."
        )
        .isURL()
        .withMessage(
            "Valid ID image must be a valid URL."
        ),

    body("validIdBack")
        .notEmpty()
        .withMessage(
            "Valid ID back image is required."
        )
        .isString()
        .withMessage(
            "Valid ID back image must be a string."
        )
        .isURL()
        .withMessage(
            "Valid ID back image must be a valid URL."
        ),

    proofOfBillingRule(),

    body("vehicle")
        .notEmpty()
        .withMessage("Vehicle data is required.")
        .isObject()
        .withMessage("Vehicle data must be an object."),

    body("vehicle.vehicleType")
        .notEmpty()
        .withMessage("Vehicle type is required.")
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage("Please choose a car or a motorcycle."),

    body("vehicle.brand")
        .notEmpty()
        .withMessage("Brand is required.")
        .isString()
        .withMessage("Brand must be a string.")
        .trim(),

    body("vehicle.model")
        .notEmpty()
        .withMessage("Model is required.")
        .isString()
        .withMessage("Model must be a string.")
        .trim(),

    body("vehicle.year")
        .notEmpty()
        .withMessage("Year is required.")
        .isInt({ min: 1900, max: 2100 })
        .withMessage("Year must be a valid integer."),

    body("vehicle.plateNumber")
        .notEmpty()
        .withMessage("Plate number is required.")
        .isString()
        .withMessage("Plate number must be a string.")
        .trim(),

    body("vehicle.registrationNumber")
        .notEmpty()
        .withMessage("Registration number is required.")
        .isString()
        .withMessage("Registration number must be a string.")
        .trim(),

    // Same bounds a listed vehicle needs, so an approved one isn't refused.
    body("vehicle.images")
        .isArray({ min: MIN_VEHICLE_IMAGES, max: MAX_VEHICLE_IMAGES })
        .withMessage(
            `Please add ${MIN_VEHICLE_IMAGES} to ${MAX_VEHICLE_IMAGES} vehicle photos.`
        ),

    body("vehicle.images.*.url")
        .isString()
        .withMessage("Each vehicle photo must have a URL.")
        .isURL()
        .withMessage("Each vehicle photo must have a valid URL."),

    notPastDateRule(
        "vehicle.compliance.licenseExpiration",
        "The vehicle's registration has already expired. Please renew it before registering the vehicle."
    ),

    body("vehicle.specifications")
        .notEmpty()
        .withMessage("Specifications are required.")
        .isObject()
        .withMessage("Specifications must be an object."),

    body("vehicle.specifications.transmission")
        .notEmpty()
        .withMessage("Transmission is required.")
        .isIn(TRANSMISSION_TYPE_VALUES)
        .withMessage("Please choose a valid transmission."),

    body("vehicle.specifications.fuelType")
        .notEmpty()
        .withMessage("Fuel type is required.")
        .isIn(FUEL_TYPE_VALUES)
        .withMessage("Please choose a valid fuel type."),

    body("vehicle.specifications.seatingCapacity")
        .notEmpty()
        .withMessage("Seating capacity is required.")
        .isInt({ min: 1, max: 50 })
        .withMessage("Seating capacity must be a valid integer."),

    body("inspectionDate")
        .notEmpty()
        .withMessage("Inspection date is required.")
        .isISO8601()
        .withMessage("Inspection date must be a valid date.")
        .custom((value) => {
            const selectedDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                throw new Error(
                    "Inspection date cannot be in the past."
                );
            }

            return true;
        }),

    termsRule(),

    body("licenseNumber")
        .optional({ nullable: true })
        .isString()
        .withMessage("License number must be a string.")
        .trim(),

    notPastDateRule(
        "licenseExpirationDate",
        "Your driver's license has already expired. Please renew it, or leave the license details blank."
    ),

    ...licenseCodeValidators,

    ...currentAddressRules(),

    body("temporaryUploadIds")
        .optional({ nullable: true })
        .isArray()
        .withMessage("Temporary upload IDs must be an array."),
];
