import express from "express";

import {
    register,
    registerOperatorAccount,
    login,
    logout,
    getCurrentUser,
    verifyEmail,
    resendVerificationEmail,
    uploadValidId,
    uploadProofOfBilling,
    uploadVehicleImageForRegistration,
    removeTemporaryValidIdUpload,
    forgotPassword,
    verifyResetCode,
    resetPassword,
} from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

import {
    registerValidator,
    registerOperatorValidator,
    loginValidator,
    verifyEmailValidator,
    resendVerificationValidator,
    forgotPasswordValidator,
    verifyResetCodeValidator,
    resetPasswordValidator,
} from "../validators/authValidator.js";

import {
    uploadProofOfBillingImage,
    uploadValidIdImage,
    uploadVehicleImage,
} from "../middleware/uploadMiddleware.js";

import rateLimit from "express-rate-limit";

const router = express.Router();

const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many login attempts from this IP. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const verifyEmailRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many verification attempts. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const registrationRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many registration attempts from this IP. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const resendVerificationRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many verification email requests. Please try again in 5 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many reset code requests. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const verifyResetCodeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many code attempts. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const resetPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many password reset attempts. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const validIdUploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many valid ID upload attempts. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Its own budget, so the proof of billing never eats into the ID uploads'.
const proofOfBillingUploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many proof of billing upload attempts. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Separate from the upload limits: a failed registration attempt removes
// its several uploads at once, and that mustn't use up the upload budget.
const temporaryUploadRemovalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const vehicleImageUploadRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: "Too many vehicle image upload attempts. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post(
    "/register",
    registrationRateLimiter,
    registerValidator,
    register
);

router.post(
    "/register-operator",
    registrationRateLimiter,
    registerOperatorValidator,
    registerOperatorAccount
);

// Only the uploader holds the handle's secret (see temporaryValidIdUploadService).
router.delete(
    "/temporary-valid-id/:uploadId",
    temporaryUploadRemovalRateLimiter,
    removeTemporaryValidIdUpload
);

router.post(
    "/login",
    loginRateLimiter,
    loginValidator,
    login
);

router.post(
    "/logout",
    logout
);

router.get(
    "/me",
    protect,
    getCurrentUser
);

router.post(
    "/verify-email",
    verifyEmailRateLimiter,
    verifyEmailValidator,
    verifyEmail
);

router.post(
    "/resend-verification",
    resendVerificationRateLimiter,
    resendVerificationValidator,
    resendVerificationEmail
);

/*
 * Forgot password: request a code → verify it for a reset token → set the
 * new password. The per-account limits (resend cooldown, wrong-code lock)
 * live in passwordResetService; these cap each IP on top.
 */
router.post(
    "/forgot-password",
    forgotPasswordRateLimiter,
    forgotPasswordValidator,
    forgotPassword
);

router.post(
    "/forgot-password/verify",
    verifyResetCodeRateLimiter,
    verifyResetCodeValidator,
    verifyResetCode
);

router.post(
    "/reset-password",
    resetPasswordRateLimiter,
    resetPasswordValidator,
    resetPassword
);

router.post(
    "/upload-valid-id",
    validIdUploadRateLimiter,
    uploadValidIdImage,
    uploadValidId
);

router.post(
    "/upload-proof-of-billing",
    proofOfBillingUploadRateLimiter,
    uploadProofOfBillingImage,
    uploadProofOfBilling
);

/*
 * Public: a new operator has no account (let alone an admin role) yet when
 * uploading their vehicle's photos during registration, so this can't reuse
 * the admin-only POST /vehicles/upload-image. Tracked as a temporary upload
 * the same way valid ID images are — claimed on successful registration,
 * swept by the existing cleanup cron otherwise.
 */
router.post(
    "/upload-vehicle-image",
    vehicleImageUploadRateLimiter,
    uploadVehicleImage,
    uploadVehicleImageForRegistration
);

export default router;
