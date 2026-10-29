import mongoose from "mongoose";
import { body, param } from "express-validator";

import {
    BOOKING_DRIVER_OPTIONS,
} from "../constants/bookingConstants.js";

import {
    PAYMENT_METHOD,
} from "../constants/paymentConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

const validateDateOrder = (
    endDate,
    { req }
) => {
    const startDate =
        req.body.startDate;

    if (!startDate) {
        return true;
    }

    return (
        new Date(endDate) >
        new Date(startDate)
    );
};

const validateDriver = (
    driver,
    { req }
) => {
    const driverOption =
        req.body.driverOption;

    if (
        driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        // Whether one is required depends on Settings → Drivers (admins
        // may assign it at approval) — bookingService decides.
        if (!driver) {
            return true;
        }

        if (!isValidObjectId(driver)) {
            throw new Error(
                "Driver must be a valid ID."
            );
        }

        return true;
    }

    if (
        driverOption ===
        BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
    ) {
        if (driver) {
            throw new Error(
                "Driver must not be provided when booking is without a driver."
            );
        }

        return true;
    }

    return true;
};
export const createBookingValidator = [
    body("vehicle")
        .notEmpty()
        .withMessage(
            "Vehicle is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Vehicle must be a valid ID."
        ),

    /*
     * The Terms & Conditions the customer accepted: the version they were
     * shown, recorded on the booking (bookingService createBooking).
     */
    body("termsAccepted")
        .custom((value) => value === true)
        .withMessage(
            "You must accept the Terms & Conditions to book."
        ),

    body("termsVersionId")
        .notEmpty()
        .withMessage(
            "The Terms & Conditions you accepted are missing. Please reload the page and accept them again."
        )
        .bail()
        .custom(isValidObjectId)
        .withMessage(
            "The Terms & Conditions you accepted are missing. Please reload the page and accept them again."
        ),

    body("driverOption")
        .notEmpty()
        .withMessage(
            "Driver option is required."
        )
        .isIn(
            Object.values(
                BOOKING_DRIVER_OPTIONS
            )
        )
        .withMessage(
            "Invalid driver option."
        ),

    body("driver")
        .optional({ nullable: true })
        .custom(validateDriver)
        .withMessage(
            "Driver must be a valid ID."
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
        )
        .custom(validateDateOrder)
        .withMessage(
            "End date must be after the start date."
        ),

    body("pickupLocation.type")
        .notEmpty()
        .withMessage(
            "Pickup location type is required."
        )
        .isString()
        .withMessage(
            "Pickup location type must be a string."
        )
        .trim(),

    body("pickupLocation.address")
        .notEmpty()
        .withMessage(
            "Pickup location address is required."
        )
        .isString()
        .withMessage(
            "Pickup location address must be a string."
        )
        .trim(),

    /*
     * Optional - a customer may pick a custom (non-predefined) location on
     * the map instead of one of the admin-managed service locations. When
     * omitted, the booking service falls back to the client-supplied
     * address/coordinates directly (see ensureCustomLocationHasCoordinates
     * in bookingService.js).
     */
    body("pickupLocation.serviceLocationId")
        .optional({ nullable: true })
        .custom(isValidObjectId)
        .withMessage(
            "Pickup location service location ID must be a valid ID."
        ),

    body("pickupLocation.name")
        .optional()
        .isString()
        .withMessage(
            "Pickup location name must be a string."
        )
        .trim(),

    body("pickupLocation.region")
        .optional()
        .isString()
        .withMessage(
            "Pickup location region must be a string."
        )
        .trim(),

    body("pickupLocation.province")
        .optional()
        .isString()
        .withMessage(
            "Pickup location province must be a string."
        )
        .trim(),

    body("pickupLocation.city")
        .optional()
        .isString()
        .withMessage(
            "Pickup location city must be a string."
        )
        .trim(),

    body("pickupLocation.barangay")
        .optional()
        .isString()
        .withMessage(
            "Pickup location barangay must be a string."
        )
        .trim(),

    body("pickupLocation.latitude")
        .optional()
        .isFloat()
        .withMessage(
            "Pickup location latitude must be a number."
        ),

    body("pickupLocation.longitude")
        .optional()
        .isFloat()
        .withMessage(
            "Pickup location longitude must be a number."
        ),

    body("returnLocation.type")
        .notEmpty()
        .withMessage(
            "Return location type is required."
        )
        .isString()
        .withMessage(
            "Return location type must be a string."
        )
        .trim(),

    body("returnLocation.address")
        .notEmpty()
        .withMessage(
            "Return location address is required."
        )
        .isString()
        .withMessage(
            "Return location address must be a string."
        )
        .trim(),

    // Optional - see the matching pickupLocation.serviceLocationId comment above.
    body("returnLocation.serviceLocationId")
        .optional({ nullable: true })
        .custom(isValidObjectId)
        .withMessage(
            "Return location service location ID must be a valid ID."
        ),

    body("returnLocation.name")
        .optional()
        .isString()
        .withMessage(
            "Return location name must be a string."
        )
        .trim(),

    body("returnLocation.region")
        .optional()
        .isString()
        .withMessage(
            "Return location region must be a string."
        )
        .trim(),

    body("returnLocation.province")
        .optional()
        .isString()
        .withMessage(
            "Return location province must be a string."
        )
        .trim(),

    body("returnLocation.city")
        .optional()
        .isString()
        .withMessage(
            "Return location city must be a string."
        )
        .trim(),

    body("returnLocation.barangay")
        .optional()
        .isString()
        .withMessage(
            "Return location barangay must be a string."
        )
        .trim(),

    body("returnLocation.latitude")
        .optional()
        .isFloat()
        .withMessage(
            "Return location latitude must be a number."
        ),

    body("returnLocation.longitude")
        .optional()
        .isFloat()
        .withMessage(
            "Return location longitude must be a number."
        ),

    body("customerNotes")
        .optional()
        .isString()
        .withMessage(
            "Customer notes must be a string."
        )
        .trim(),

    body("paymentMethod")
        .optional()
        .isString()
        .withMessage(
            "Payment method must be a string."
        )
        .trim()
        .isIn(
            Object.values(
                PAYMENT_METHOD
            )
        )
        .withMessage(
            "Invalid payment method."
        ),

    /*
     * GCash-only: pay the full rental total now instead of just the
     * reservation fee. Ignored for any other payment method - see
     * createBooking in bookingService.js.
     */
    body("payInFull")
        .optional()
        .isBoolean()
        .withMessage(
            "payInFull must be a boolean."
        ),

    body("pricing.pickupDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup distance must be a non-negative number."
        ),

    body("pricing.returnDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return distance must be a non-negative number."
        ),

    body("pricing.pickupDistanceFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup distance fee must be a non-negative number."
        ),

    body("pricing.returnDistanceFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return distance fee must be a non-negative number."
        ),

    /*
     * Pickup and return may use the SAME service location. Returning a
     * vehicle to the branch it was picked up from is the normal case, and
     * requiring them to differ also deadlocked the "default location only"
     * policy (which forces both to be the default location).
     */
];

export const updateBookingValidator = [
    param("bookingId")
        .notEmpty()
        .withMessage(
            "Booking ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Booking ID must be valid."
        ),

    body("vehicle")
        .optional()
        .custom(isValidObjectId)
        .withMessage(
            "Vehicle must be a valid ID."
        ),

    body("driverOption")
        .optional()
        .isIn(
            Object.values(
                BOOKING_DRIVER_OPTIONS
            )
        )
        .withMessage(
            "Invalid driver option."
        ),

    body("driver")
        .optional({ nullable: true })
        .custom((value, { req }) => {
            const driverOption =
                req.body.driverOption;

            if (
                driverOption ===
                BOOKING_DRIVER_OPTIONS.WITH_DRIVER
            ) {
                if (!value) {
                    throw new Error(
                        "Driver is required when booking includes a driver."
                    );
                }

                if (!isValidObjectId(value)) {
                    throw new Error(
                        "Driver must be a valid ID."
                    );
                }

                return true;
            }

            if (
                driverOption ===
                BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
            ) {
                if (value) {
                    throw new Error(
                        "Driver must not be provided when booking is without a driver."
                    );
                }

                return true;
            }

            if (!value) {
                return true;
            }

            return isValidObjectId(value);
        })
        .withMessage(
            "Driver must be a valid ID."
        ),

    body("startDate")
        .optional()
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    body("endDate")
        .optional()
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        )
        .custom((value, { req }) => {
            if (!req.body.startDate) {
                return true;
            }

            return (
                new Date(value) >
                new Date(req.body.startDate)
            );
        })
        .withMessage(
            "End date must be after the start date."
        ),

    body("pickupLocation.type")
        .optional()
        .isString()
        .withMessage(
            "Pickup location type must be a string."
        )
        .trim(),

    body("pickupLocation.address")
        .optional()
        .isString()
        .withMessage(
            "Pickup location address must be a string."
        )
        .trim(),

    body("pickupLocation.serviceLocationId")
        .optional()
        .custom(isValidObjectId)
        .withMessage(
            "Pickup location service location ID must be a valid ID."
        ),

    body("pickupLocation.name")
        .optional()
        .isString()
        .withMessage(
            "Pickup location name must be a string."
        )
        .trim(),

    body("pickupLocation.region")
        .optional()
        .isString()
        .withMessage(
            "Pickup location region must be a string."
        )
        .trim(),

    body("pickupLocation.province")
        .optional()
        .isString()
        .withMessage(
            "Pickup location province must be a string."
        )
        .trim(),

    body("pickupLocation.city")
        .optional()
        .isString()
        .withMessage(
            "Pickup location city must be a string."
        )
        .trim(),

    body("pickupLocation.barangay")
        .optional()
        .isString()
        .withMessage(
            "Pickup location barangay must be a string."
        )
        .trim(),

    body("pickupLocation.latitude")
        .optional()
        .isFloat()
        .withMessage(
            "Pickup location latitude must be a number."
        ),

    body("pickupLocation.longitude")
        .optional()
        .isFloat()
        .withMessage(
            "Pickup location longitude must be a number."
        ),

    body("returnLocation.type")
        .optional()
        .isString()
        .withMessage(
            "Return location type must be a string."
        )
        .trim(),

    body("returnLocation.address")
        .optional()
        .isString()
        .withMessage(
            "Return location address must be a string."
        )
        .trim(),

    body("returnLocation.serviceLocationId")
        .optional()
        .custom(isValidObjectId)
        .withMessage(
            "Return location service location ID must be a valid ID."
        ),

    body("returnLocation.name")
        .optional()
        .isString()
        .withMessage(
            "Return location name must be a string."
        )
        .trim(),

    body("returnLocation.region")
        .optional()
        .isString()
        .withMessage(
            "Return location region must be a string."
        )
        .trim(),

    body("returnLocation.province")
        .optional()
        .isString()
        .withMessage(
            "Return location province must be a string."
        )
        .trim(),

    body("returnLocation.city")
        .optional()
        .isString()
        .withMessage(
            "Return location city must be a string."
        )
        .trim(),

    body("returnLocation.barangay")
        .optional()
        .isString()
        .withMessage(
            "Return location barangay must be a string."
        )
        .trim(),

    body("returnLocation.latitude")
        .optional()
        .isFloat()
        .withMessage(
            "Return location latitude must be a number."
        ),

    body("returnLocation.longitude")
        .optional()
        .isFloat()
        .withMessage(
            "Return location longitude must be a number."
        ),

    body("customerNotes")
        .optional()
        .isString()
        .withMessage(
            "Customer notes must be a string."
        )
        .trim(),

    body("pricing.pickupDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup distance must be a non-negative number."
        ),

    body("pricing.returnDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return distance must be a non-negative number."
        ),

    body("pricing.pickupDistanceFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup distance fee must be a non-negative number."
        ),

    body("pricing.returnDistanceFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return distance fee must be a non-negative number."
        ),

    /*
     * Pickup and return may use the SAME service location. Returning a
     * vehicle to the branch it was picked up from is the normal case, and
     * requiring them to differ also deadlocked the "default location only"
     * policy (which forces both to be the default location).
     */
];

export const requestBookingExtensionValidator = [
    param("bookingId")
        .notEmpty()
        .withMessage(
            "Booking ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Booking ID must be valid."
        ),

    body("requestedEndDate")
        .notEmpty()
        .withMessage(
            "Requested end date is required."
        )
        .isISO8601()
        .withMessage(
            "Requested end date must be a valid date."
        ),

    body("reason")
        .optional()
        .isString()
        .withMessage(
            "Extension reason must be a string."
        )
        .trim(),
];

const bookingIdParam = () =>
    param("bookingId")
        .notEmpty()
        .withMessage("Booking ID is required.")
        .custom(isValidObjectId)
        .withMessage("Booking ID must be valid.");

const rescheduleDatesValidator = [
    body("startDate")
        .notEmpty()
        .withMessage("New pickup date is required.")
        .isISO8601()
        .withMessage("New pickup date must be a valid date."),

    body("endDate")
        .notEmpty()
        .withMessage("New return date is required.")
        .isISO8601()
        .withMessage("New return date must be a valid date."),
];

export const previewRescheduleValidator = [
    bookingIdParam(),
    ...rescheduleDatesValidator,
];

export const requestRescheduleValidator = [
    bookingIdParam(),
    ...rescheduleDatesValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage("Reschedule reason must be a string.")
        .trim()
        .isLength({ max: 500 })
        .withMessage("Reschedule reason must be 500 characters or fewer."),
];

const driverChangeReason = (field, required) => {
    const chain = body(field);

    return (required ? chain.exists({ values: "falsy" }).withMessage("Please give a reason.") : chain.optional())
        .isString()
        .withMessage("Reason must be text.")
        .trim()
        .isLength({ max: 500 })
        .withMessage("Reason must be 500 characters or fewer.");
};

const optionalDriverId = (field) =>
    body(field)
        .optional({ values: "falsy" })
        .custom(isValidObjectId)
        .withMessage("Driver must be a valid ID.");

const driverChangeRequestIdParam = () =>
    param("requestId")
        .notEmpty()
        .withMessage("Request ID is required.")
        .custom(isValidObjectId)
        .withMessage("Request ID must be valid.");

// Admin: change the driver directly (reason required).
export const changeBookingDriverValidator = [
    bookingIdParam(),
    body("driverId")
        .notEmpty()
        .withMessage("Choose the new driver.")
        .custom(isValidObjectId)
        .withMessage("Driver must be a valid ID."),
    driverChangeReason("reason", true),
];

// Customer: ask for a different driver (reason required, driver optional).
export const requestDriverChangeValidator = [
    bookingIdParam(),
    driverChangeReason("reason", true),
    optionalDriverId("preferredDriverId"),
];

export const approveDriverChangeValidator = [
    bookingIdParam(),
    driverChangeRequestIdParam(),
    optionalDriverId("driverId"),
    driverChangeReason("note", false),
];

export const declineDriverChangeValidator = [
    bookingIdParam(),
    driverChangeRequestIdParam(),
    driverChangeReason("note", false),
];

export const driverChangeRequestIdValidator = [
    bookingIdParam(),
    driverChangeRequestIdParam(),
];

export const rescheduleIdValidator = [
    bookingIdParam(),

    param("rescheduleId")
        .notEmpty()
        .withMessage("Reschedule ID is required.")
        .custom(isValidObjectId)
        .withMessage("Reschedule ID must be valid."),
];

export const rescheduleReasonValidator = [
    ...rescheduleIdValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage("Reason must be a string.")
        .trim()
        .isLength({ max: 500 })
        .withMessage("Reason must be 500 characters or fewer."),
];

export const extensionIdValidator = [
    param("bookingId")
        .notEmpty()
        .withMessage(
            "Booking ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Booking ID must be valid."
        ),

    param("extensionId")
        .notEmpty()
        .withMessage(
            "Extension ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Extension ID must be valid."
        ),
];

export const rejectBookingExtensionValidator = [
    ...extensionIdValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage(
            "Rejection reason must be a string."
        )
        .trim(),
];

export const cancelBookingExtensionValidator = [
    ...extensionIdValidator,

    body("reason")
        .optional()
        .isString()
        .withMessage(
            "Cancellation reason must be a string."
        )
        .trim(),
];

export const bookingIdValidator = [
    param("bookingId")
        .notEmpty()
        .withMessage(
            "Booking ID is required."
        )
        .custom(isValidObjectId)
        .withMessage(
            "Booking ID must be valid."
        ),
];

export const maintenanceChangeVehicleValidator = [
    ...bookingIdValidator,

    body("vehicleId")
        .notEmpty()
        .withMessage("Choose a vehicle.")
        .custom(isValidObjectId)
        .withMessage("Vehicle ID must be valid."),
];

export const approveBookingValidator = [
    ...bookingIdValidator,

    body("driverId")
        .optional({ nullable: true })
        .custom((value) => !value || isValidObjectId(value))
        .withMessage(
            "Driver ID must be a valid ID."
        ),
];
