import { body } from "express-validator";

/*
 * Shared across registration (customer + operator) and profile-update
 * validation — kept in one place so the accepted license code / transmission
 * vocabulary and the code-requires-transmission rule can't drift between the
 * places that enforce it.
 */
export const LICENSE_CODE_VALUES = [
    "A",
    "B",
];

export const TRANSMISSION_VALUES = [
    "automatic",
    "manual",
];

/*
 * Field-shape + vocabulary checks, plus the two cross-field rules: license
 * code A (Motorcycle) requires at least one motorcycle transmission, and
 * code B (Passenger Car) requires at least one car transmission. The
 * cross-field checks only fire when `licenseCodes` is present in the same
 * request — a partial update that doesn't touch `licenseCodes` at all isn't
 * asserting anything about it, so there's nothing to re-validate.
 */
export const licenseCodeValidators = [
    body("licenseCodes")
        .optional({ nullable: true })
        .isArray()
        .withMessage(
            "License codes must be an array."
        ),

    body("licenseCodes.*")
        .optional()
        .isIn(LICENSE_CODE_VALUES)
        .withMessage(
            "License codes must be A (Motorcycle) or B (Passenger Car)."
        ),

    body("motorcycleTransmission")
        .optional({ nullable: true })
        .isArray()
        .withMessage(
            "Motorcycle transmission must be an array."
        ),

    body("motorcycleTransmission.*")
        .optional()
        .isIn(TRANSMISSION_VALUES)
        .withMessage(
            "Motorcycle transmission must be automatic or manual."
        ),

    body("carTransmission")
        .optional({ nullable: true })
        .isArray()
        .withMessage(
            "Car transmission must be an array."
        ),

    body("carTransmission.*")
        .optional()
        .isIn(TRANSMISSION_VALUES)
        .withMessage(
            "Car transmission must be automatic or manual."
        ),

    body("motorcycleTransmission")
        .custom((value, { req }) => {
            const codes = req.body.licenseCodes;

            if (
                Array.isArray(codes) &&
                codes.includes("A") &&
                (!Array.isArray(value) ||
                    value.length === 0)
            ) {
                throw new Error(
                    "Motorcycle transmission is required when license code A is selected."
                );
            }

            return true;
        }),

    body("carTransmission")
        .custom((value, { req }) => {
            const codes = req.body.licenseCodes;

            if (
                Array.isArray(codes) &&
                codes.includes("B") &&
                (!Array.isArray(value) ||
                    value.length === 0)
            ) {
                throw new Error(
                    "Car transmission is required when license code B is selected."
                );
            }

            return true;
        }),
];
