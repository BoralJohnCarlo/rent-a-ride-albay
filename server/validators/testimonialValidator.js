import { body, param } from "express-validator";

export const testimonialIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid testimonial ID."),
];

export const reviewIdParamValidator = [
    param("reviewId")
        .isMongoId()
        .withMessage("Invalid review ID."),
];

const imageUrl = (field) =>
    body(field)
        .optional({ values: "falsy" })
        .isString()
        .isLength({ max: 2048 })
        .withMessage(`${field} must be a valid image URL.`);

const fields = (required) => [
    (required
        ? body("name").exists({ values: "falsy" }).withMessage("Name is required.")
        : body("name").optional()
    )
        .bail()
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Name is required.")
        .isLength({ max: 80 })
        .withMessage("Name must be at most 80 characters."),

    (required
        ? body("message").exists({ values: "falsy" }).withMessage("Description is required.")
        : body("message").optional()
    )
        .bail()
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Description is required.")
        .isLength({ max: 1000 })
        .withMessage("Description must be at most 1000 characters."),

    body("role")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 60 })
        .withMessage("Role must be at most 60 characters."),

    body("rating")
        .optional()
        .isInt({ min: 1, max: 5 })
        .withMessage("Rating must be between 1 and 5."),

    imageUrl("avatar"),
    imageUrl("photo"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be true or false."),

    body("displayOrder")
        .optional()
        .isInt()
        .withMessage("Display order must be a whole number."),
];

export const createTestimonialValidator = fields(true);

export const updateTestimonialValidator = [
    ...testimonialIdValidator,
    ...fields(false),
];
