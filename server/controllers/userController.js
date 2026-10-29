
import { validationResult } from "express-validator";

import {
    createUser,
    getAllUsers,
    getAllBlacklistedUsers,
    getUserById,
    getCurrentUserProfile,
    updateUserProfile,
    changeUserPassword,
    updateUser,
    updateUserStatus,
    blacklistUser,
    removeBlacklist,
    deleteUser,
    verifyValidId,
    unverifyValidId,
    uploadRenewedValidId,
    updateProofOfBilling,
    grantExtraRenewalAttempt,
    requestRenewalAttempt,
    updateNotificationPreferences,
} from "../services/userService.js";
import {
    createVehicle,
} from "../services/vehicleService.js";
import { getValidIdHistory } from "../services/validIdHistoryService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";
import { setAuthCookie } from "../utils/authCookie.js";
import generateToken from "../utils/generateToken.js";

export const createUserAccount = async (
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

        // Extract vehicle data before creating user
        const {
            vehicle: vehicleData,
            ...userData
        } = req.body;

        const user =
            await createUser(userData);

        // If vehicle data is provided, create the vehicle linked directly to
        // the new operator.
        if (
            vehicleData &&
            vehicleData.images &&
            Array.isArray(vehicleData.images)
        ) {
            const vehicle = await createVehicle({
                ...vehicleData,
                operator: user._id,
                createdBy: req.user?._id,
            });

            return successResponse(
                res,
                "User and vehicle created successfully.",
                {
                    user,
                    vehicle,
                },
                201
            );
        }

        return successResponse(
            res,
            "User created successfully.",
            user,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getUsers = async (req, res) => {
    try {
        const users = await getAllUsers();

        return successResponse(
            res,
            "Users retrieved successfully.",
            users
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message
        );
    }
};

export const getBlacklistedUsers = async (
    req,
    res
) => {
    try {
        const users =
            await getAllBlacklistedUsers();

        return successResponse(
            res,
            "Blacklisted users retrieved successfully.",
            users
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message
        );
    }
};

export const getUser = async (req, res) => {
    try {
        const user = await getUserById(req.params.id);

        return successResponse(
            res,
            "User retrieved successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            404
        );
    }
};

export const getProfile = async (req, res) => {
    try {
        const user = await getCurrentUserProfile(req.user.id);

        return successResponse(
            res,
            "Profile retrieved successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            404
        );
    }
};

export const updateProfile = async (req, res) => {
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

        const user = await updateUserProfile(
            req.user.id,
            req.body
        );

        return successResponse(
            res,
            "Profile updated successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const uploadProfileImage = async (
    req,
    res
) => {
    try {
        const profileImage =
            req.profileImage;

        return successResponse(
            res,
            "Profile image uploaded successfully.",
            profileImage,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

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

        const user = await updateProofOfBilling(
            req.user.id,
            proofOfBillingImage.url
        );

        return successResponse(
            res,
            "Proof of billing address updated successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const changePassword = async (req, res) => {
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

        const user = await changeUserPassword(
            req.user.id,
            req.body.currentPassword,
            req.body.newPassword
        );

        // The change made every existing token stale, this device's
        // included - issue it a fresh one so only the others sign out.
        setAuthCookie(
            res,
            generateToken({
                id: user._id,
                role: user.role,
            })
        );

        return successResponse(
            res,
            "Password changed successfully.",
            {
                passwordChangedAt: user.passwordChangedAt,
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

export const changeNotificationPreferences = async (req, res) => {
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

        const preferences = await updateNotificationPreferences(
            req.user.id,
            req.body
        );

        return successResponse(
            res,
            "Notification preferences saved.",
            preferences
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const editUser = async (req, res) => {
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

        const user = await updateUser(
            req.user.id,
            req.params.id,
            req.body
        );

        return successResponse(
            res,
            "User updated successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const changeUserStatus = async (req, res) => {
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

        const user = await updateUserStatus(
            req.params.id,
            req.body.isSuspended
        );

        return successResponse(
            res,
            "User status updated successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const blacklistUserAccount = async (
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

        const blacklist =
            await blacklistUser(
                req.user.id,
                req.params.id,
                req.body.reason
            );

        return successResponse(
            res,
            "User blacklisted successfully.",
            blacklist,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const unblacklistUserAccount = async (
    req,
    res
) => {
    try {
        const blacklist =
            await removeBlacklist(
                req.params.id
            );

        return successResponse(
            res,
            "User removed from blacklist successfully.",
            blacklist
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const removeUser = async (req, res) => {
    try {
        await deleteUser(
            req.user.id,
            req.params.id
        );

        return successResponse(
            res,
            "User deleted successfully."
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const verifyUserValidId = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                errors.array()[0]?.msg || "Validation failed.",
                400,
                errors.array()
            );
        }

        const user = await verifyValidId(
            req.params.id,
            {
                adminId: req.user.id,
                expirationDate: req.body?.expirationDate,
            }
        );

        return successResponse(
            res,
            "Valid ID verified successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getUserValidIdHistory = async (
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

        const history = await getValidIdHistory(
            req.params.id
        );

        return successResponse(
            res,
            "Valid ID history retrieved successfully.",
            history
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const unverifyUserValidId = async (
    req,
    res
) => {
    try {
        const user = await unverifyValidId(
            req.params.id
        );

        return successResponse(
            res,
            "Valid ID unverified successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const handleRenewedValidIdUpload = async (
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

        const validIdImage = req.validIdImage;

        if (!validIdImage) {
            return errorResponse(
                res,
                "Failed to upload valid ID image.",
                400
            );
        }

        const {
            validIdType,
            licenseNumber,
            licenseExpirationDate,
        } = req.body;

        const user = await uploadRenewedValidId(
            req.user.id,
            {
                url: validIdImage.url,
            },
            {
                validIdType,
                licenseNumber,
                licenseExpirationDate,
            }
        );

        return successResponse(
            res,
            "Valid ID renewed successfully.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const grantRenewalAttempt = async (
    req,
    res
) => {
    try {
        const { amount } = req.body;

        const user = await grantExtraRenewalAttempt(
            req.params.id,
            req.user.id,
            parseInt(amount) || 1
        );

        return successResponse(
            res,
            `Granted ${amount || 1} additional renewal attempt(s).`,
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const requestRenewalAttemptController = async (
    req,
    res
) => {
    try {
        const user = await requestRenewalAttempt(
            req.user.id
        );

        return successResponse(
            res,
            "Renewal attempt request submitted. Admins will be notified.",
            user
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

