
import express from "express";
import rateLimit from "express-rate-limit";

import {
    getUsers,
    getBlacklistedUsers,
    getUser,
    getProfile,
    updateProfile,
    changePassword,
    changeNotificationPreferences,
    editUser,
    changeUserStatus,
    blacklistUserAccount,
    unblacklistUserAccount,
    removeUser,
    verifyUserValidId,
    unverifyUserValidId,
    getUserValidIdHistory,
    uploadProfileImage,
    uploadProofOfBilling,
    handleRenewedValidIdUpload,
    grantRenewalAttempt,
    requestRenewalAttemptController,
} from "../controllers/userController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    updateProfileValidator,
    changePasswordValidator,
    notificationPreferencesValidator,
    updateUserValidator,
    updateUserStatusValidator,
    blacklistUserValidator,
    userIdValidator,
    renewValidIdValidator,
    verifyValidIdValidator,
} from "../validators/userValidator.js";

import {
    uploadProfileImage as uploadProfileImageMiddleware,
    uploadProofOfBillingImage,
    uploadValidIdImage,
} from "../middleware/uploadMiddleware.js";

const renewIdRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many valid ID renewal attempts. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const proofOfBillingRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: "Too many proof of billing uploads. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Per account, so guessing the current password from a hijacked session
// stays slow no matter how many IPs it comes from.
const changePasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `change-password:${req.user._id}`,
    message: {
        success: false,
        message: "Too many password change attempts. Please try again in 15 minutes.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Current User
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| User Profile
|--------------------------------------------------------------------------
*/

router.get(
    "/profile",
    protect,
    getProfile
);

router.patch(
    "/profile",
    protect,
    updateProfileValidator,
    updateProfile
);

router.post(
    "/profile/upload-image",
    protect,
    uploadProfileImageMiddleware,
    uploadProfileImage
);

router.patch(
    "/change-password",
    protect,
    changePasswordRateLimiter,
    changePasswordValidator,
    changePassword
);

router.patch(
    "/notification-preferences",
    protect,
    notificationPreferencesValidator,
    changeNotificationPreferences
);

router.post(
    "/profile/renew-valid-id",
    protect,
    renewIdRateLimiter,
    uploadValidIdImage,
    renewValidIdValidator,
    handleRenewedValidIdUpload
);

router.post(
    "/profile/proof-of-billing",
    protect,
    proofOfBillingRateLimiter,
    uploadProofOfBillingImage,
    uploadProofOfBilling
);

/*
|--------------------------------------------------------------------------
| Administrator Routes
|--------------------------------------------------------------------------
*/

router.get(
    "/",
    protect,
    authorize("admin"),
    getUsers
);

router.get(
    "/blacklisted",
    protect,
    authorize("admin"),
    getBlacklistedUsers
);

router.get(
    "/:id",
    protect,
    authorize("admin"),
    userIdValidator,
    getUser
);

router.patch(
    "/:id",
    protect,
    authorize("admin"),
    userIdValidator,
    updateUserValidator,
    editUser
);

router.patch(
    "/:id/status",
    protect,
    authorize("admin"),
    userIdValidator,
    updateUserStatusValidator,
    changeUserStatus
);

router.post(
    "/:id/blacklist",
    protect,
    authorize("admin"),
    userIdValidator,
    blacklistUserValidator,
    blacklistUserAccount
);

router.delete(
    "/:id/blacklist",
    protect,
    authorize("admin"),
    userIdValidator,
    unblacklistUserAccount
);

router.delete(
    "/:id",
    protect,
    authorize("admin"),
    userIdValidator,
    removeUser
);

router.post(
    "/:id/verify-valid-id",
    protect,
    authorize("admin"),
    userIdValidator,
    verifyValidIdValidator,
    verifyUserValidId
);

router.get(
    "/:id/valid-id-history",
    protect,
    authorize("admin"),
    userIdValidator,
    getUserValidIdHistory
);

router.post(
    "/:id/unverify-valid-id",
    protect,
    authorize("admin"),
    userIdValidator,
    unverifyUserValidId
);

router.post(
    "/:id/grant-renewal-attempt",
    protect,
    authorize("admin"),
    userIdValidator,
    grantRenewalAttempt
);

router.post(
    "/request-renewal-attempt",
    protect,
    authorize("customer"),
    requestRenewalAttemptController
);

export default router;
