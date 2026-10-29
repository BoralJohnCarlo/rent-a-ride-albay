import { validationResult } from "express-validator";

import {
    registerUser,
    registerOperator,
    loginUser,
    verifyEmail as verifyEmailService,
    resendVerificationEmail as resendVerificationEmailService,
} from "../services/authService.js";
import {
    requestPasswordReset,
    resetPassword as resetPasswordService,
    verifyPasswordResetCode,
} from "../services/passwordResetService.js";
import {
    createTemporaryValidIdUpload,
    removeTemporaryValidIdUpload as removeTemporaryValidIdUploadService,
} from "../services/temporaryValidIdUploadService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";
import {
    clearAuthCookie,
    setAuthCookie,
} from "../utils/authCookie.js";

// Thrown by the database or by a bug — never meant for the user to read.
const INTERNAL_ERROR_NAMES = new Set([
    "MongoServerError",
    "MongoNetworkError",
    "MongooseServerSelectionError",
    "CastError",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
]);

/*
 * The services throw plain Errors with user-facing messages for anything
 * the user can act on. Everything else (a duplicate-key race, a dropped
 * connection, a bug) gets a generic message instead of the raw internals.
 */
const sendRegistrationError = (res, error, fallbackStatus = 400) => {
    // Two submits racing on the same email (verification races are handled
    // in the service, which knows the account was created).
    if (error?.code === 11000) {
        return errorResponse(
            res,
            "This email is already registered and waiting for verification. Enter the code we emailed you, or request a new one.",
            409
        );
    }

    // A schema rule the request validators don't mirror — report it without
    // the model's internal wording ("PendingRegistration validation failed").
    if (error?.name === "ValidationError") {
        console.error("Registration data failed schema validation:", error);

        return errorResponse(
            res,
            "Some of the details you entered aren't valid. Please check the form and try again.",
            400
        );
    }

    if (INTERNAL_ERROR_NAMES.has(error?.name)) {
        console.error("Registration request failed:", error);

        return errorResponse(
            res,
            "Something went wrong on our side. Please try again in a moment.",
            500
        );
    }

    return errorResponse(
        res,
        error.message,
        error.statusCode || fallbackStatus
    );
};

export const register = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        // Uploads are kept for good only once the email is verified.
        const result = await registerUser(req.body, { ip: req.ip });

        return successResponse(
            res,
            "Registration successful. Please check your email to verify your account.",
            result,
            201
        );
    } catch (error) {
        return sendRegistrationError(res, error);
    }
};

export const registerOperatorAccount = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const result = await registerOperator(req.body, { ip: req.ip });

        return successResponse(
            res,
            "Operator registration successful. Please check your email to verify your account.",
            result,
            201
        );
    } catch (error) {
        return sendRegistrationError(res, error);
    }
};

export const verifyEmail = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const { email, code } = req.body;

        const user =
            await verifyEmailService(email, code);

        return successResponse(
            res,
            "Email verified successfully. You can now log in.",
            user
        );
    } catch (error) {
        return sendRegistrationError(res, error);
    }
};

export const resendVerificationEmail = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const result =
            await resendVerificationEmailService(
                req.body.email
            );

        return successResponse(
            res,
            "Verification email sent successfully.",
            result
        );
    } catch (error) {
        return sendRegistrationError(res, error);
    }
};

export const login = async (req, res) => {
    try {
        const errors =
            validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const { token, user } =
            await loginUser(req.body);

        setAuthCookie(res, token);

        return successResponse(
            res,
            "Login successful.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            401
        );
    }
};

export const logout = (req, res) => {
    clearAuthCookie(res);

    return successResponse(
        res,
        "Logout successful."
    );
};

/*
 * Forgot password. Validation errors answer with the first field's message,
 * since each step's form only shows one at a time.
 */
const firstValidationError = (req, res) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) {
        return null;
    }

    return errorResponse(
        res,
        errors.array()[0]?.msg || "Validation failed.",
        400,
        errors.array()
    );
};

const sendPasswordResetError = (res, error) =>
    errorResponse(
        res,
        error.statusCode ? error.message : "Something went wrong. Please try again.",
        error.statusCode || 500
    );

export const forgotPassword = async (req, res) => {
    const invalid = firstValidationError(req, res);

    if (invalid) return invalid;

    try {
        const result = await requestPasswordReset(req.body.email);

        return successResponse(
            res,
            "If an account uses this email, a reset code is on its way.",
            result
        );
    } catch (error) {
        console.error("Password reset request failed:", error);

        return sendPasswordResetError(res, error);
    }
};

export const verifyResetCode = async (req, res) => {
    const invalid = firstValidationError(req, res);

    if (invalid) return invalid;

    try {
        const result = await verifyPasswordResetCode(
            req.body.email,
            req.body.code
        );

        return successResponse(res, "Code verified.", result);
    } catch (error) {
        return sendPasswordResetError(res, error);
    }
};

export const resetPassword = async (req, res) => {
    const invalid = firstValidationError(req, res);

    if (invalid) return invalid;

    try {
        const result = await resetPasswordService(
            req.body.email,
            req.body.resetToken,
            req.body.newPassword
        );

        // Whatever session this browser had is now stale; drop its cookie.
        clearAuthCookie(res);

        return successResponse(
            res,
            "Your password has been reset. Please sign in with your new password.",
            result
        );
    } catch (error) {
        return sendPasswordResetError(res, error);
    }
};

export const getCurrentUser = async (
    req,
    res
) => {
    return successResponse(
        res,
        "Authenticated user retrieved successfully.",
        req.user
    );
};

export const uploadValidId = async (
    req,
    res
) => {
    try {
        const validIdImage = req.validIdImage;

        if (!validIdImage) {
            return errorResponse(
                res,
                "Failed to upload valid ID image.",
                400
            );
        }

        const { handle } = await createTemporaryValidIdUpload(
            validIdImage.publicId
        );

        return successResponse(
            res,
            "Valid ID image uploaded successfully.",
            {
                url: validIdImage.url,
                publicId: validIdImage.publicId,
                // Opaque: also proves ownership when removing or claiming it.
                uploadId: handle,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

/*
 * Registration's proof of billing address image, tracked as a temporary
 * upload exactly like the valid ID images: claimed when the email is
 * verified, swept by the cleanup cron if the registration is abandoned.
 */
export const uploadProofOfBilling = async (
    req,
    res
) => {
    try {
        const proofOfBillingImage = req.proofOfBillingImage;

        if (!proofOfBillingImage) {
            return errorResponse(
                res,
                "Failed to upload proof of billing address image.",
                400
            );
        }

        const { handle } = await createTemporaryValidIdUpload(
            proofOfBillingImage.publicId
        );

        return successResponse(
            res,
            "Proof of billing address image uploaded successfully.",
            {
                url: proofOfBillingImage.url,
                publicId: proofOfBillingImage.publicId,
                uploadId: handle,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

/*
 * Same temporary-upload tracking used for valid ID images — it's a plain
 * {publicId, expiresAt} record with no notion of what kind of image it is,
 * so it's reused as-is here rather than duplicating a whole model/service
 * for an identical lifecycle (claimed on successful registration via
 * `temporaryUploadIds`, or swept by the existing cleanup cron if the
 * registration is abandoned).
 */
export const uploadVehicleImageForRegistration = async (
    req,
    res
) => {
    try {
        const vehicleImage = req.vehicleImage;

        if (!vehicleImage) {
            return errorResponse(
                res,
                "Failed to upload vehicle image.",
                400
            );
        }

        const { handle } = await createTemporaryValidIdUpload(
            vehicleImage.publicId
        );

        return successResponse(
            res,
            "Vehicle image uploaded successfully.",
            {
                url: vehicleImage.url,
                publicId: vehicleImage.publicId,
                uploadId: handle,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const removeTemporaryValidIdUpload = async (req, res) => {
    try {
        await removeTemporaryValidIdUploadService(req.params.uploadId);
        return successResponse(res, "Temporary valid ID upload removed.");
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};
