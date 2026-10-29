import {
    body,
    param,
    query,
} from "express-validator";

import mongoose from "mongoose";

import {
    VEHICLE_STATUS_VALUES,
    VEHICLE_TYPE_VALUES,
    VEHICLE_CONDITION_VALUES,
    TRANSMISSION_TYPE_VALUES,
    FUEL_TYPE_VALUES,
    VEHICLE_MAINTENANCE_MODE,
    VEHICLE_MAINTENANCE_MODE_VALUES,
    MAX_VEHICLE_MAINTENANCE_DAYS,
} from "../constants/vehicleConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

/*
|--------------------------------------------------------------------------
| Create Vehicle
|--------------------------------------------------------------------------
*/

const createVehicleValidator = [
    body("plateNumber")
        .trim()
        .notEmpty()
        .withMessage("Plate number is required.")
        .isLength({ max: 20 })
        .withMessage(
            "Plate number must not exceed 20 characters."
        ),

    body("registrationNumber")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage(
            "Registration number must not exceed 50 characters."
        ),

    body("compliance.licenseExpiration")
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage(
            "Registration expiration must be a valid date."
        ),

    body("brand")
        .trim()
        .notEmpty()
        .withMessage("Brand is required.")
        .isLength({ max: 100 })
        .withMessage(
            "Brand must not exceed 100 characters."
        ),

    body("model")
        .trim()
        .notEmpty()
        .withMessage("Model is required.")
        .isLength({ max: 100 })
        .withMessage(
            "Model must not exceed 100 characters."
        ),

    body("variant")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Variant must not exceed 100 characters."
        ),

    body("year")
        .notEmpty()
        .withMessage("Year is required.")
        .isInt({
            min: 1900,
            max: new Date().getFullYear() + 1,
        })
        .withMessage(
            "Enter a valid vehicle year."
        ),

    body("vehicleType")
        .trim()
        .notEmpty()
        .withMessage(
            "Vehicle type is required."
        )
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage(
            "Invalid vehicle type."
        ),

    /*
     * Category is intentionally optional. checkFalsy (not just nullable)
     * so an empty string is also treated as absent, not run through
     * isValidObjectId (which rejects "").
     */
    body("category")
        .optional({ checkFalsy: true })
        .custom(isValidObjectId)
        .withMessage(
            "Invalid vehicle category."
        ),

    /*
     * Specifications
     */

    body("specifications.transmission")
        .trim()
        .notEmpty()
        .withMessage(
            "Transmission is required."
        )
        .isIn(TRANSMISSION_TYPE_VALUES)
        .withMessage(
            "Invalid transmission type."
        ),

    body("specifications.fuelType")
        .trim()
        .notEmpty()
        .withMessage(
            "Fuel type is required."
        )
        .isIn(FUEL_TYPE_VALUES)
        .withMessage(
            "Invalid fuel type."
        ),

    /*
     * Engine remains optional because it is not
     * exposed by the current VehicleForm.
     */

    body("specifications.seatingCapacity")
        .notEmpty()
        .withMessage(
            "Seating capacity is required."
        )
        .isInt({ min: 1 })
        .withMessage(
            "Seating capacity must be at least 1."
        ),

    body("pricing.dailyRate")
        .notEmpty()
        .withMessage(
            "Daily rate is required."
        )
        .isFloat({ min: 0 })
        .withMessage(
            "Daily rate must be greater than or equal to 0."
        ),

    body("pricing.reservationFee")
        .notEmpty()
        .withMessage(
            "Reservation fee is required."
        )
        .isFloat({ min: 0 })
        .withMessage(
            "Reservation fee must be greater than or equal to 0."
        ),

    /*
     * Security Deposit
     *
     * Entire feature is optional.
     *
     * If enabled:
     *   amount must be greater than 0.
     *
     * If disabled:
     *   amount must be 0 or omitted.
     */

    body("securityDeposit.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "Security deposit enabled must be true or false."
        ),

    body("securityDeposit.amount")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Security deposit amount must be greater than or equal to 0."
        ),

    body("securityDeposit.amount")
        .if(
            body("securityDeposit.enabled")
                .equals("true")
        )
        .notEmpty()
        .withMessage(
            "Security deposit amount is required when security deposit is enabled."
        )
        .isFloat({ gt: 0 })
        .withMessage(
            "Security deposit amount must be greater than 0 when security deposit is enabled."
        ),

    /*
     * Description
     */

    body("description.public")
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 })
        .withMessage(
            "Public description cannot exceed 2000 characters."
        ),

    body("description.internal")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            "Internal description must not exceed 1000 characters."
        ),

    /*
     * Images
     *
     * The service performs the final minimum-image
     * and primary-image validation.
     */

    body("images")
        .optional()
        .isArray({ max: 10 })
        .withMessage(
            "A vehicle can only have up to 10 images."
        ),

    body("images.*.url")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Image URL is required."
        ),

    body("images.*.publicId")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Image public ID is required."
        ),

    body("images.*.originalName")
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage(
            "Original image name must not exceed 255 characters."
        ),

    body("images.*.isPrimary")
        .optional()
        .isBoolean()
        .withMessage(
            "Primary image flag must be true or false."
        ),

    /*
     * Documents
     */

    body("documents.officialReceipt")
        .optional({ nullable: true })
        .isObject()
        .withMessage(
            "Official Receipt document must be an object."
        ),

    body("documents.officialReceipt.url")
        .optional({ nullable: true })
        .trim()
        .notEmpty()
        .withMessage(
            "Official Receipt document URL is required."
        ),

    body("documents.officialReceipt.publicId")
        .optional({ nullable: true })
        .trim()
        .notEmpty()
        .withMessage(
            "Official Receipt document public ID is required."
        ),

    body("documents.certificateOfRegistration")
        .optional({ nullable: true })
        .isObject()
        .withMessage(
            "Certificate of Registration document must be an object."
        ),

    body("documents.certificateOfRegistration.url")
        .optional({ nullable: true })
        .trim()
        .notEmpty()
        .withMessage(
            "Certificate of Registration document URL is required."
        ),

    body("documents.certificateOfRegistration.publicId")
        .optional({ nullable: true })
        .trim()
        .notEmpty()
        .withMessage(
            "Certificate of Registration document public ID is required."
        ),
];

/*
||--------------------------------------------------------------------------
|| Update Vehicle
||--------------------------------------------------------------------------
*/

const updateVehicleValidator = [
    body("plateNumber")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Plate number cannot be empty."
        )
        .isLength({ max: 20 })
        .withMessage(
            "Plate number must not exceed 20 characters."
        ),

    body("registrationNumber")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage(
            "Registration number must not exceed 50 characters."
        ),

    body("compliance.licenseExpiration")
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601()
        .withMessage(
            "Registration expiration must be a valid date."
        ),

    body("brand")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Brand cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "Brand must not exceed 100 characters."
        ),

    body("model")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Model cannot be empty."
        )
        .isLength({ max: 100 })
        .withMessage(
            "Model must not exceed 100 characters."
        ),

    body("variant")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Variant must not exceed 100 characters."
        ),

    body("year")
        .optional()
        .isInt({
            min: 1900,
            max: new Date().getFullYear() + 1,
        })
        .withMessage(
            "Enter a valid vehicle year."
        ),

    body("vehicleType")
        .optional()
        .trim()
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage(
            "Invalid vehicle type."
        ),

    /*
     * Category remains optional. checkFalsy so an empty string is also
     * treated as absent, not run through isValidObjectId (which rejects
     * "").
     */
    body("category")
        .optional({ checkFalsy: true })
        .custom(isValidObjectId)
        .withMessage(
            "Invalid vehicle category."
        ),

    /*
     * Specifications
     */

    body("specifications.transmission")
        .optional()
        .trim()
        .isIn(TRANSMISSION_TYPE_VALUES)
        .withMessage(
            "Invalid transmission type."
        ),

    body("specifications.fuelType")
        .optional()
        .trim()
        .isIn(FUEL_TYPE_VALUES)
        .withMessage(
            "Invalid fuel type."
        ),

    body("specifications.engine")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage(
            "Engine must not exceed 100 characters."
        ),

    body("specifications.seatingCapacity")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Seating capacity must be at least 1."
        ),

    /*
     * Pricing
     */

    body("pricing.dailyRate")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Daily rate must be greater than or equal to 0."
        ),

    body("pricing.reservationFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Reservation fee must be greater than or equal to 0."
        ),

    /*
     * Security Deposit
     */

    body("securityDeposit.enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "Security deposit enabled must be true or false."
        ),

    body("securityDeposit.amount")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Security deposit amount must be greater than or equal to 0."
        ),

    body("securityDeposit.amount")
        .if(
            body("securityDeposit.enabled")
                .equals("true")
        )
        .notEmpty()
        .withMessage(
            "Security deposit amount is required when security deposit is enabled."
        )
        .isFloat({ gt: 0 })
        .withMessage(
            "Security deposit amount must be greater than 0 when security deposit is enabled."
        ),

    /*
     * Description
     */

    body("description.public")
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 2000 })
        .withMessage(
            "Public description cannot exceed 2000 characters."
        ),

    body("description.internal")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            "Internal description must not exceed 1000 characters."
        ),

    /*
     * Images
     */

    body("images")
        .optional()
        .isArray({ max: 10 })
        .withMessage(
            "A vehicle can only have up to 10 images."
        ),

    body("images.*.url")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Image URL cannot be empty."
        ),

    body("images.*.publicId")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Image public ID cannot be empty."
        ),

    body("images.*.originalName")
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage(
            "Original image name must not exceed 255 characters."
        ),

    body("images.*.isPrimary")
        .optional()
        .isBoolean()
        .withMessage(
            "Primary image flag must be true or false."
        ),

    /*
     * Documents
     */

    body("documents.officialReceipt")
        .optional({ nullable: true })
        .isObject()
        .withMessage(
            "Official Receipt document must be an object."
        ),

    body("documents.certificateOfRegistration")
        .optional({ nullable: true })
        .isObject()
        .withMessage(
            "Certificate of Registration document must be an object."
        ),
];

/*
||--------------------------------------------------------------------------
|| Common Validators
||--------------------------------------------------------------------------
*/

const vehicleIdValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid vehicle ID."
        ),
];

const vehicleBlockedDateIdValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid vehicle ID."
        ),

    param("blockedDateId")
        .custom(isValidObjectId)
        .withMessage(
            "Invalid blocked date ID."
        ),
];

const updateVehicleStatusValidator = [
    body("status")
        .trim()
        .notEmpty()
        .withMessage(
            "Vehicle status is required."
        )
        .isIn(VEHICLE_STATUS_VALUES)
        .withMessage(
            "Invalid vehicle status."
        ),

    body("maintenance.mode")
        .optional({ values: "falsy" })
        .isIn(VEHICLE_MAINTENANCE_MODE_VALUES)
        .withMessage("Invalid maintenance type."),

    body("maintenance.days")
        .if(body("maintenance.mode").equals(VEHICLE_MAINTENANCE_MODE.EXTENDED))
        .isInt({ min: 1, max: MAX_VEHICLE_MAINTENANCE_DAYS })
        .withMessage(
            `Maintenance must last between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`
        ),

    body("maintenance.reason")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage("The maintenance note can be up to 500 characters."),
];

/* PUT /vehicles/:id/maintenance */
const setVehicleMaintenanceValidator = [
    body("mode")
        .isIn(VEHICLE_MAINTENANCE_MODE_VALUES)
        .withMessage("Choose a maintenance type."),

    body("days")
        .if(body("mode").equals(VEHICLE_MAINTENANCE_MODE.EXTENDED))
        .isInt({ min: 1, max: MAX_VEHICLE_MAINTENANCE_DAYS })
        .withMessage(
            `Maintenance must last between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`
        ),

    body("reason")
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage("The maintenance note can be up to 500 characters."),
];

/* GET /vehicles/:id/maintenance/preview */
const previewVehicleMaintenanceValidator = [
    query("mode")
        .isIn(VEHICLE_MAINTENANCE_MODE_VALUES)
        .withMessage("Choose a maintenance type."),

    query("days")
        .if(query("mode").equals(VEHICLE_MAINTENANCE_MODE.EXTENDED))
        .isInt({ min: 1, max: MAX_VEHICLE_MAINTENANCE_DAYS })
        .withMessage(
            `Maintenance must last between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`
        ),

    query("from")
        .optional({ values: "falsy" })
        .isISO8601()
        .withMessage("Start must be a valid date."),
];

const updateVehicleConditionValidator = [
    body("condition")
        .trim()
        .notEmpty()
        .withMessage(
            "Vehicle condition is required."
        )
        .isIn(VEHICLE_CONDITION_VALUES)
        .withMessage(
            "Invalid vehicle condition."
        ),
];

const updateVehicleBookingValidator = [
    body("availability.bookingEnabled")
        .optional()
        .isBoolean()
        .withMessage(
            "Booking enabled must be true or false."
        ),

    body("availability.availableFrom")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage(
            "Available from must be a valid date."
        ),
];

const addBlockedDateValidator = [
    body("startDate")
        .notEmpty()
        .withMessage(
            "Start date is required."
        )
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    body("endDate")
        .notEmpty()
        .withMessage(
            "End date is required."
        )
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        ),

    /*
     * Required - an admin-facing-only record of why the vehicle was pulled
     * from booking. Never shown to customers (see AvailabilityCalendar.jsx
     * on the client, which only ever renders bookable/unavailable, never a
     * reason).
     */
    body("reason")
        .trim()
        .notEmpty()
        .withMessage(
            "A reason is required when blocking dates."
        )
        .isLength({ max: 500 })
        .withMessage(
            "Block reason must not exceed 500 characters."
        ),
];

const checkVehicleAvailabilityValidator = [
    query("startDate")
        .notEmpty()
        .withMessage(
            "Start date is required."
        )
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    query("endDate")
        .notEmpty()
        .withMessage(
            "End date is required."
        )
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        ),

    query("driver")
        .optional()
        .custom(isValidObjectId)
        .withMessage(
            "Invalid driver ID."
        ),
];

const checkVehiclesAvailabilityBulkValidator = [
    body("vehicleIds")
        .isArray({ min: 1 })
        .withMessage(
            "vehicleIds must be a non-empty array."
        ),

    body("vehicleIds.*")
        .custom(isValidObjectId)
        .withMessage(
            "vehicleIds must contain valid vehicle IDs."
        ),

    body("startDate")
        .notEmpty()
        .withMessage(
            "Start date is required."
        )
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    body("endDate")
        .notEmpty()
        .withMessage(
            "End date is required."
        )
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        ),
];

const vehicleAvailabilityCalendarValidator = [
    query("startDate")
        .notEmpty()
        .withMessage(
            "Start date is required."
        )
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    query("endDate")
        .notEmpty()
        .withMessage(
            "End date is required."
        )
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        ),
];

const vehiclePickupTimesValidator = [
    query("startDate")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage(
            "Start date must be in YYYY-MM-DD format."
        ),

    query("endDate")
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage(
            "End date must be in YYYY-MM-DD format."
        ),

    query("driver")
        .optional()
        .custom(isValidObjectId)
        .withMessage(
            "Invalid driver ID."
        ),
];

const updateFeaturedVehicleValidator = [
    body("isFeatured")
        .isBoolean()
        .withMessage(
            "Featured status must be true or false."
        ),
];

const checkPlateNumberValidator = [
    query("plateNumber")
        .trim()
        .notEmpty()
        .withMessage("Plate number is required."),

    query("excludeId")
        .optional()
        .custom(isValidObjectId)
        .withMessage("Invalid vehicle ID to exclude."),
];

const checkRegistrationNumberValidator = [
    query("registrationNumber")
        .trim()
        .notEmpty()
        .withMessage("Registration number is required."),

    query("excludeId")
        .optional()
        .custom(isValidObjectId)
        .withMessage("Invalid vehicle ID to exclude."),
];

const renewVehicleRegistrationValidator = [
    body("officialReceipt.url")
        .trim()
        .notEmpty()
        .withMessage(
            "A new official receipt image is required."
        )
        .isURL({
            protocols: ["http", "https"],
            require_protocol: true,
        })
        .withMessage(
            "Official receipt image URL must be a valid URL."
        ),

    body("officialReceipt.publicId")
        .trim()
        .notEmpty()
        .withMessage(
            "A new official receipt image is required."
        )
        .isLength({ max: 255 })
        .withMessage(
            "Official receipt public ID cannot exceed 255 characters."
        ),

    body("expirationDate")
        .notEmpty()
        .withMessage(
            "Registration expiration is required."
        )
        .isISO8601()
        .withMessage(
            "Registration expiration must be a valid date."
        ),
];

const setRegistrationAvailabilityValidator = [
    body("availableFrom")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage(
            "Available from must be a valid date."
        ),
];

const grantRegistrationRenewalAttemptValidator = [
    body("amount")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Amount must be a positive integer."
        ),
];

export {
    createVehicleValidator,
    updateVehicleValidator,
    vehicleIdValidator,
    vehicleBlockedDateIdValidator,
    updateVehicleStatusValidator,
    setVehicleMaintenanceValidator,
    previewVehicleMaintenanceValidator,
    updateVehicleConditionValidator,
    updateVehicleBookingValidator,
    addBlockedDateValidator,
    checkVehicleAvailabilityValidator,
    checkVehiclesAvailabilityBulkValidator,
    vehicleAvailabilityCalendarValidator,
    vehiclePickupTimesValidator,
    updateFeaturedVehicleValidator,
    checkPlateNumberValidator,
    checkRegistrationNumberValidator,
    renewVehicleRegistrationValidator,
    setRegistrationAvailabilityValidator,
    grantRegistrationRenewalAttemptValidator,
};