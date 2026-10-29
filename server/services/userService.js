
import User from "../models/User.js";
import Blacklist from "../models/Blacklist.js";
import Settings from "../models/Settings.js";
import Notification from "../models/Notification.js";
import { VALID_ID_DOCUMENT_SOURCE } from "../models/ValidIdDocument.js";
import formatUser, { isValidIdExpired } from "../utils/userFormatter.js";
import createError from "../utils/createError.js";
import { formatEmailDateTime } from "../utils/emailTemplates.js";
import { disconnectUserSockets } from "../sockets/index.js";
import {
    addDaysToDateKey,
    businessDayStart,
} from "../utils/businessTime.js";
import { notifyAdmins, notifyUser } from "./notificationService.js";
import {
    markCurrentValidIdVerified,
    recordValidIdUpload,
    snapshotValidId,
} from "./validIdHistoryService.js";
import { setOperatorVehiclesBookable } from "./vehicleService.js";
import {
    assertPhoneAvailable,
    phoneKey,
} from "./accountIdentityService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatManilaDate = (date) =>
    new Date(date).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
    });

/*
 * Sends each valid-ID expiry notice once per expiry date, not once a day:
 *   - one "expiring soon" reminder per configured threshold (e.g. 30, 7 and
 *     1 days before), and
 *   - one "expired" notice once the date passes.
 * Each notice is matched against the expiry date it's about: a notice
 * counts only if it was sent inside that notice's own window (after the
 * threshold was reached / after the ID expired). So a 30-day reminder
 * doesn't stand in for the 7-day one, and a renewed ID with a new expiry
 * date gets its own notices when that date comes around.
 */
export const checkValidIdExpirationNotifications = async (userId) => {
    const user = await User.findById(userId);
    if (!user || !user.validIdExpirationDate) return;

    const settings = await Settings.findOne();
    const expirationSettings = settings?.validIdExpirationSettings;
    const now = new Date();
    const expirationDate = new Date(user.validIdExpirationDate);
    const diffDays = Math.ceil((expirationDate - now) / DAY_MS);

    const sentSince = (type, since) =>
        Notification.exists({
            recipient: user._id,
            type,
            createdAt: { $gte: since },
        });

    if (expirationDate <= now) {
        const notifyOnExpired = expirationSettings?.notifyOnExpired ?? true;
        if (!notifyOnExpired) return;

        if (await sentSince("validIdExpired", expirationDate)) return;

        await Notification.create({
            recipient: user._id,
            type: "validIdExpired",
            title: "Valid ID Expired",
            message: user.isVerified
                ? "Your valid ID has expired, so your account's verification is on hold. Upload a renewed ID from your profile to get verified again."
                : "Your valid ID has expired. Please upload a renewed ID from your profile as soon as possible.",
            variant: "error",
            category: "Document",
            metadata: { reference: "valid-id-expired", relatedId: user._id, relatedModel: "User" },
        });
        return;
    }

    if (!expirationSettings?.enabled) return;

    // The most urgent threshold already reached; any less urgent ones that
    // were skipped (e.g. the date was set 5 days out) are not sent late.
    const reachedThreshold = [
        expirationSettings.firstReminderDays,
        expirationSettings.secondReminderDays,
        expirationSettings.thirdReminderDays,
    ]
        .filter((days) => Number.isFinite(days) && days > 0 && diffDays <= days)
        .sort((a, b) => a - b)[0];

    if (!reachedThreshold) return;

    const windowStart = new Date(expirationDate.getTime() - reachedThreshold * DAY_MS);

    if (await sentSince("validIdExpiringSoon", windowStart)) return;

    await Notification.create({
        recipient: user._id,
        type: "validIdExpiringSoon",
        title: "Valid ID Expiring Soon",
        message: `Your valid ID expires in ${diffDays} day${diffDays === 1 ? "" : "s"} (${formatManilaDate(expirationDate)}). Upload a renewed ID from your profile before then to keep your account verified.`,
        variant: "warning",
        category: "Document",
        metadata: { reference: "valid-id-expiring", relatedId: user._id, relatedModel: "User" },
    });
};

export const checkAllValidIdExpirations = async () => {
    const users = await User.find({ validIdExpirationDate: { $exists: true, $ne: null } }).select("_id");
    for (const user of users) {
        try {
            await checkValidIdExpirationNotifications(user._id);
        } catch (error) {
            console.error(`Failed to check valid ID expiration for user ${user._id}:`, error);
        }
    }
};

export const createUser = async (userData) => {
    const email = userData.email
    .trim()
    .toLowerCase();

    const existingUser = await User.findOne({
        email,
    });

    if (existingUser) {
        throw createError(
        "Email is already registered.",
        409
    );
    }

    await assertPhoneAvailable(userData.phoneNumber);



    const user = await User.create({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: userData.password,
        phoneNumber: userData.phoneNumber,
        alternativeContact:
            userData.alternativeContact,
        profileImage:
            userData.profileImage ?? "",
        role:
            userData.role ??
            "customer",
        isVerified:
            userData.isVerified ??
            false,
        isApproved:
            userData.isApproved ??
            true,
        isSuspended:
            userData.isSuspended ??
            false,
        address:
            userData.address ?? {},
        emergencyContact:
            userData.emergencyContact ??
            {},
        uploadedDocuments:
            userData.uploadedDocuments ??
            {},
        validIdType:
            userData.validIdType ?? "",
        validIdImage:
            userData.validIdImage ?? "",
        validIdBack:
            userData.validIdBack ?? "",
        licenseNumber:
            userData.licenseNumber ?? "",
        licenseExpirationDate:
            userData.licenseExpirationDate ?? null,
        hasDriversLicense:
            userData.hasDriversLicense ?? null,
        licenseCodes:
            userData.licenseCodes ?? [],
        motorcycleTransmission: userData.motorcycleTransmission ?? [],
        carTransmission: userData.carTransmission ?? [],
        validIdRenewalCount:
            0,
    });

    try {
        await recordValidIdUpload(user, {
            source: VALID_ID_DOCUMENT_SOURCE.REGISTRATION,
        });
    } catch (historyError) {
        console.error("Failed to record valid ID history:", historyError);
    }

    return formatUser(user);
};

export const getAllUsers = async () => {
    const blacklistedUserIds = await Blacklist.find({
        isActive: true,
    }).distinct("user");

    const users = await User.find({
        _id: { $nin: blacklistedUserIds },
    }).sort({ createdAt: -1 });

    return users.map(formatUser);
};

export const getAllBlacklistedUsers = async () => {
    const blacklists = await Blacklist.find({
        isActive: true,
    })
        .populate("user")
        .populate(
            "blacklistedBy",
            "firstName lastName email"
        )
        .sort({
            blacklistedAt: -1,
        });

    return blacklists
        .filter((blacklist) => blacklist.user)
        .map((blacklist) => ({
            ...formatUser(blacklist.user),
            blacklistId: blacklist._id,
            blacklistReason: blacklist.reason,
            blacklistedBy:
                blacklist.blacklistedBy,
            blacklistedAt:
                blacklist.blacklistedAt,
        }));
};

export const getUserById = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    return formatUser(user);
};

export const getCurrentUserProfile = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    return formatUser(user);
};

export const updateUserProfile = async (userId, profileData) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    /*
     * firstName/lastName/middleName/birthdate are intentionally NOT
     * updatable through this endpoint - they must match the customer's/
     * operator's valid ID, so allowing a silent self-service edit here
     * would undermine ID verification. The client already renders them
     * read-only; this is the server-side enforcement so the restriction
     * can't be bypassed by calling the API directly.
     */

    if (profileData.phoneNumber !== undefined) {
        // One account per phone number — checked only when the number
        // actually changes, so older accounts that already share one can
        // still edit their other details.
        if (phoneKey(profileData.phoneNumber) !== phoneKey(user.phoneNumber)) {
            await assertPhoneAvailable(profileData.phoneNumber, {
                excludeUserId: user._id,
            });
        }

        user.phoneNumber = profileData.phoneNumber;
    }

    if (profileData.alternativeContact !== undefined) {
        user.alternativeContact = profileData.alternativeContact;
    }

    if (profileData.profileImage !== undefined) {
        user.profileImage = profileData.profileImage;
    }

    if (profileData.address !== undefined) {
        user.address = {
            ...user.address,
            ...profileData.address,
        };
    }

    if (profileData.currentAddress !== undefined) {
        user.address = {
            ...user.address,
            houseUnitLot: profileData.currentAddress.houseUnitLot ?? user.address.houseUnitLot ?? "",
            region: profileData.currentAddress.region ?? user.address.region ?? "",
            street: profileData.currentAddress.street ?? user.address.street ?? "",
            barangay: profileData.currentAddress.barangay ?? user.address.barangay ?? "",
            city: profileData.currentAddress.cityMunicipality ?? user.address.city ?? "",
            province: profileData.currentAddress.province ?? user.address.province ?? "",
            postalCode: profileData.currentAddress.postalCode ?? user.address.postalCode ?? "",
        };
    }

    if (profileData.emergencyContact !== undefined) {
        user.emergencyContact = {
            ...user.emergencyContact,
            ...profileData.emergencyContact,
        };
    }

    /*
     * Swapping in a different valid ID (type or image) means whatever an
     * admin previously verified no longer reflects what's on file - the
     * account must go back through admin review rather than silently
     * keeping the old "Verified" badge on a document nobody has checked.
     */
    const isChangingValidId =
        (profileData.validIdType !== undefined &&
            profileData.validIdType !== user.validIdType) ||
        (profileData.validIdImage !== undefined &&
            profileData.validIdImage !== user.validIdImage) ||
        (profileData.validIdBack !== undefined &&
            profileData.validIdBack !== user.validIdBack);

    const previousValidId = snapshotValidId(user);

    if (profileData.validIdType !== undefined) {
        user.validIdType = profileData.validIdType;
    }

    if (profileData.validIdImage !== undefined) {
        user.validIdImage = profileData.validIdImage;
    }

    if (profileData.validIdBack !== undefined) {
        user.validIdBack = profileData.validIdBack;
    }

    const verificationWasRevoked =
        isChangingValidId && user.isVerified;

    if (verificationWasRevoked) {
        user.isVerified = false;
    }

    // The expiry date belonged to the old ID; the admin records the new
    // one's when verifying it (verifyValidId).
    if (isChangingValidId) {
        user.validIdExpirationDate = null;
    }

    if (profileData.licenseNumber !== undefined) {
        user.licenseNumber = profileData.licenseNumber;
    }

    if (profileData.licenseExpirationDate !== undefined) {
        user.licenseExpirationDate = profileData.licenseExpirationDate;
    }

    if (profileData.hasDriversLicense !== undefined) {
        user.hasDriversLicense = profileData.hasDriversLicense;
    }

    /*
     * Can't submit "Driver's License" as your ID type while also saying you
     * don't have one - mirrors the same rule enforced at registration.
     */
    if (user.validIdType === "Driver's License") {
        user.hasDriversLicense = true;
    }

    if (profileData.licenseCodes !== undefined) {
        user.licenseCodes = profileData.licenseCodes;
    }

    if (profileData.motorcycleTransmission !== undefined) {
        user.motorcycleTransmission = profileData.motorcycleTransmission;
    }

    if (profileData.carTransmission !== undefined) {
        user.carTransmission = profileData.carTransmission;
    }

    await user.save();

    if (isChangingValidId) {
        try {
            await recordValidIdUpload(user, {
                previous: previousValidId,
                source: VALID_ID_DOCUMENT_SOURCE.PROFILE_UPDATE,
            });
        } catch (historyError) {
            console.error("Failed to record valid ID history:", historyError);
        }
    }

    if (verificationWasRevoked) {
        try {
            await notifyUser(user._id, {
                type: "document",
                title: "Re-verification Needed",
                message: "You updated your valid ID, so it needs to be reviewed and verified again by an admin before your account shows as verified.",
                variant: "warning",
                category: "Document",
                metadata: {
                    reference: "valid-id",
                    relatedId: user._id,
                    relatedModel: "User",
                },
            });
        } catch (notificationError) {
            console.error("Failed to send re-verification notification:", notificationError);
        }
    }

    return formatUser(user);
};

export const changeUserPassword = async (
    userId,
    currentPassword,
    newPassword
) => {
    const user = await User.findById(userId).select("+password");

    if (!user) {
        throw new Error("User not found.");
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
        throw new Error("Current password is incorrect.");
    }

    if (await user.comparePassword(newPassword)) {
        throw new Error(
            "Your new password must be different from your current password."
        );
    }

    user.password = newPassword;

    // The pre-save hook stamps passwordChangedAt, which signs out every
    // other device (auth rejects tokens issued before it).
    await user.save();

    // Live sockets authenticated with the old token would otherwise keep
    // receiving events until they reconnect. This device reconnects itself
    // with its fresh cookie after the response.
    disconnectUserSockets(user._id);

    const changedAt = formatEmailDateTime(user.passwordChangedAt);

    try {
        await notifyUser(user._id, {
            type: "security",
            title: "Password Changed",
            message: `Your account password was changed on ${changedAt}. Other devices were signed out. If this wasn't you, contact support right away.`,
            variant: "warning",
            category: "User",
            metadata: {
                reference: "password",
                relatedId: user._id,
                relatedModel: "User",
            },
            email: {
                subject: "Your Rent-A-Ride Albay password was changed",
                heading: "Your password was changed",
                paragraphs: [
                    `The password for your Rent-A-Ride Albay account was changed on ${changedAt}.`,
                    "For your security, every other device signed in to your account was signed out.",
                    "If you made this change, no action is needed. If you didn't, contact our support team right away so we can secure your account.",
                ],
                footnote: "This is an automatic security notice sent whenever your password changes.",
            },
        });
    } catch (notificationError) {
        console.error("Failed to send password-changed notification:", notificationError);
    }

    return user;
};

export const updateNotificationPreferences = async (
    userId,
    { soundVolume, soundMuted }
) => {
    const update = {};

    if (soundVolume !== undefined) {
        update["notificationPreferences.soundVolume"] = Math.round(
            Number(soundVolume)
        );
    }

    if (soundMuted !== undefined) {
        update["notificationPreferences.soundMuted"] = Boolean(soundMuted);
    }

    const user = await User.findByIdAndUpdate(
        userId,
        { $set: update },
        { returnDocument: "after", runValidators: true }
    );

    if (!user) {
        throw createError("User not found.", 404);
    }

    return formatUser(user).notificationPreferences;
};

export const updateUser = async (
    currentUserId,
    userId,
    updateData
) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    if (updateData.firstName !== undefined) {
        user.firstName = updateData.firstName;
    }

    if (updateData.lastName !== undefined) {
        user.lastName = updateData.lastName;
    }

    if (updateData.phoneNumber !== undefined) {
        if (phoneKey(updateData.phoneNumber) !== phoneKey(user.phoneNumber)) {
            await assertPhoneAvailable(updateData.phoneNumber, {
                excludeUserId: user._id,
            });
        }

        user.phoneNumber = updateData.phoneNumber;
    }

    if (updateData.alternativeContact !== undefined) {
        user.alternativeContact = updateData.alternativeContact;
    }

    if (updateData.profileImage !== undefined) {
        user.profileImage = updateData.profileImage;
    }

    if (updateData.role !== undefined) {
        user.role = updateData.role;
    }

    if (updateData.isVerified !== undefined) {
        user.isVerified = updateData.isVerified;
    }

    if (updateData.isApproved !== undefined) {
        user.isApproved = updateData.isApproved;
    }

    if (updateData.isSuspended !== undefined) {
        user.isSuspended = updateData.isSuspended;
    }

    if (updateData.address !== undefined) {
        user.address = {
            ...user.address,
            ...updateData.address,
        };
    }

    if (updateData.emergencyContact !== undefined) {
        user.emergencyContact = {
            ...user.emergencyContact,
            ...updateData.emergencyContact,
        };
    }

    if (updateData.uploadedDocuments !== undefined) {
        user.uploadedDocuments = {
            ...user.uploadedDocuments,
            ...updateData.uploadedDocuments,
        };
    }

    await user.save();

    return formatUser(user);
};

export const updateUserStatus = async (
    userId,
    isSuspended
) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    const statusChanged =
        user.isSuspended !== isSuspended;

    user.isSuspended = isSuspended;

    await user.save();

    /*
     * Suspending/unsuspending an operator only ever locked their own account
     * access (see the `protect` middleware) — their vehicles stayed bookable
     * and their payouts kept releasing on schedule regardless. Take their
     * vehicles off/back on the booking market here to match; already-
     * ongoing rentals are untouched (admin/customer-driven, not gated on the
     * operator's own account), and scheduled payouts are held separately by
     * releaseScheduledPayouts (payoutService.js) checking isSuspended itself.
     */
    if (statusChanged && user.role === "operator") {
        let affectedVehicles = 0;

        try {
            affectedVehicles =
                await setOperatorVehiclesBookable(
                    user._id,
                    !isSuspended
                );
        } catch (vehicleError) {
            console.error(
                `Failed to update vehicle bookability for operator ${user._id}:`,
                vehicleError
            );
        }

        try {
            const vehicleNote =
                affectedVehicles > 0
                    ? isSuspended
                        ? `${affectedVehicles} of your vehicle${affectedVehicles === 1 ? "" : "s"} ${affectedVehicles === 1 ? "has" : "have"} been taken off the booking market. `
                        : `${affectedVehicles} of your vehicle${affectedVehicles === 1 ? "" : "s"} ${affectedVehicles === 1 ? "is" : "are"} bookable again. `
                    : "";

            await notifyUser(user._id, {
                type: "account",
                title: isSuspended
                    ? "Account Suspended"
                    : "Account Reactivated",
                message: isSuspended
                    ? `Your account has been suspended. ${vehicleNote}Any pending payouts are on hold until your account is reactivated.`
                    : `Your account has been reactivated. ${vehicleNote}Any held payouts will resume on their normal schedule.`,
                variant: isSuspended
                    ? "warning"
                    : "success",
                category: "Account",
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify operator of account status change:",
                notificationError
            );
        }
    }

    return formatUser(user);
};

export const blacklistUser = async (
    currentUserId,
    userId,
    reason
) => {
    if (currentUserId === userId) {
        throw createError(
            "You cannot blacklist your own account.",
            400
        );
    }

    const user = await User.findById(userId);

    if (!user) {
        throw createError(
            "User not found.",
            404
        );
    }

    if (user.role !== "customer") {
        throw createError(
            "Only customer accounts can be blacklisted.",
            400
        );
    }

    const existingBlacklist =
        await Blacklist.findOne({
            user: userId,
            isActive: true,
        });

    if (existingBlacklist) {
        throw createError(
            "User is already blacklisted.",
            409
        );
    }

    const blacklist = await Blacklist.findOne({
        user: userId,
    });

    if (blacklist) {
        blacklist.reason = reason;
        blacklist.blacklistedBy =
            currentUserId;
        blacklist.blacklistedAt =
            new Date();
        blacklist.isActive = true;

        await blacklist.save();

        return blacklist;
    }

    return Blacklist.create({
        user: userId,
        reason,
        blacklistedBy: currentUserId,
        blacklistedAt: new Date(),
        isActive: true,
    });
};

export const removeBlacklist = async (
    userId
) => {
    const blacklist =
        await Blacklist.findOne({
            user: userId,
            isActive: true,
        });

    if (!blacklist) {
        throw createError(
            "Active blacklist record not found.",
            404
        );
    }

    blacklist.isActive = false;

    await blacklist.save();

    return blacklist;
};

export const deleteUser = async (
    currentUserId,
    userId
) => {
    if (currentUserId === userId) {
        throw new Error("You cannot delete your own account.");
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    await user.deleteOne();

    return true;
};

/*
 * `expirationDate` is the expiry printed on the ID, read off the image by
 * the admin verifying it: a "YYYY-MM-DD" Manila date (the ID is good through
 * the end of that day), null for an ID with no expiry, or undefined to keep
 * whatever date is on file. An ID that is already expired can't be
 * verified - verification would be on hold the moment it was given
 * (isUserEffectivelyVerified).
 */
export const verifyValidId = async (
    userId,
    { adminId = null, expirationDate } = {}
) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    if (expirationDate === null) {
        user.validIdExpirationDate = null;
    } else if (expirationDate !== undefined) {
        user.validIdExpirationDate = new Date(
            businessDayStart(addDaysToDateKey(expirationDate, 1)).getTime() - 1
        );
    }

    if (isValidIdExpired(user)) {
        throw createError(
            `This valid ID expired on ${new Date(user.validIdExpirationDate).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}. Enter the expiry date shown on the ID, or ask the user to upload a renewed one.`,
            400
        );
    }

    user.isVerified = true;

    await user.save();

    try {
        await markCurrentValidIdVerified(user, adminId);
    } catch (historyError) {
        console.error("Failed to record valid ID verification:", historyError);
    }

    try {
        await notifyUser(user._id, {
            type: "document",
            title: "ID Verified",
            message: "Your valid ID has been verified. Your account is now fully verified.",
            variant: "success",
            category: "Document",
            metadata: {
                reference: "valid-id",
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    } catch (notificationError) {
        console.error("Failed to send ID verification notification:", notificationError);
    }

    return formatUser(user);
};

export const unverifyValidId = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    user.isVerified = false;

    await user.save();

    await checkValidIdExpirationNotifications(user._id);

    try {
        await notifyUser(user._id, {
            type: "document",
            title: "ID Verification Revoked",
            message: "Your valid ID verification was revoked. Please re-upload a valid ID to continue booking.",
            variant: "warning",
            category: "Document",
            metadata: {
                reference: "valid-id",
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    } catch (notificationError) {
        console.error("Failed to send ID unverification notification:", notificationError);
    }

    return formatUser(user);
};

/*
 * Adds or replaces the user's proof of billing address from their profile
 * (any role), e.g. an account created while the requirement was turned off.
 * Not part of ID verification, so it never touches isVerified.
 */
export const updateProofOfBilling = async (userId, imageUrl) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    user.proofOfBillingImage = imageUrl;

    await user.save();

    return formatUser(user);
};

export const uploadRenewedValidId = async (
    userId,
    imageData,
    licenseUpgrade = {}
) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    const settings = await Settings.findOne();
    const maxUploadsPerYear = settings?.validIdRenewalSettings?.maxUploadsPerYear ?? 1;
    const renewalPeriodYears = settings?.validIdRenewalSettings?.renewalPeriodYears ?? 1;

    // Reset renewal count if the renewal period has passed since the last renewal
    const renewalPeriodMs = renewalPeriodYears * 365 * 24 * 60 * 60 * 1000;
    if (user.lastValidIdRenewalAt && Date.now() - user.lastValidIdRenewalAt >= renewalPeriodMs) {
        user.validIdRenewalCount = 0;
    }

    if (user.validIdRenewalCount >= maxUploadsPerYear) {
        throw createError(
            `You have reached the maximum number of valid ID renewals (${maxUploadsPerYear}) per year. Contact support for assistance.`,
            400
        );
    }

    const previousValidId = snapshotValidId(user);

    user.validIdImage = imageData.url;
    user.validIdBack = "";
    user.validIdRenewalCount += 1;
    user.lastValidIdRenewalAt = new Date();
    // A default until an admin verifies it and records the date printed on
    // the new ID (verifyValidId).
    user.validIdExpirationDate = new Date(Date.now() + renewalPeriodMs);

    /*
     * Optional upgrade: a customer renewing can also switch their ID type
     * (typically to "Driver's License") and supply the license fields in
     * the same request.
     */
    if (
        licenseUpgrade.validIdType &&
        licenseUpgrade.validIdType !== user.validIdType
    ) {
        user.validIdType = licenseUpgrade.validIdType;

        if (licenseUpgrade.validIdType === "Driver's License") {
            user.hasDriversLicense = true;
        }

        if (licenseUpgrade.licenseNumber !== undefined) {
            user.licenseNumber = licenseUpgrade.licenseNumber;
        }

        if (licenseUpgrade.licenseExpirationDate !== undefined) {
            user.licenseExpirationDate =
                licenseUpgrade.licenseExpirationDate;
        }
    }

    /*
     * The renewed ID is a new image nobody has looked at yet, so it goes
     * back through admin review - exactly like a profile edit that changes
     * the ID (updateUserProfile). Without this, renewing would silently
     * lift an expired ID's "on hold" verification with an unchecked image.
     */
    const verificationWasRevoked = user.isVerified;

    user.isVerified = false;

    await user.save();

    try {
        await recordValidIdUpload(user, {
            previous: previousValidId,
            source: VALID_ID_DOCUMENT_SOURCE.RENEWAL,
        });
    } catch (historyError) {
        console.error("Failed to record valid ID history:", historyError);
    }

    try {
        await notifyUser(user._id, {
            type: "document",
            title: verificationWasRevoked
                ? "Re-verification Needed"
                : "Renewed ID Received",
            message: "We received your renewed valid ID. An admin will review and verify it before your account shows as verified.",
            variant: "info",
            category: "Document",
            metadata: {
                reference: "valid-id",
                relatedId: user._id,
                relatedModel: "User",
            },
        });

        await notifyAdmins({
            type: "document",
            title: "Renewed Valid ID to Review",
            message: `${user.firstName} ${user.lastName} (${user.role === "operator" ? "partner" : user.role}) uploaded a renewed valid ID. Review and verify it in User Moderation.`,
            variant: "warning",
            category: "Document",
            metadata: {
                reference: "valid-id-renewal",
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    } catch (notificationError) {
        console.error("Failed to send renewed ID notifications:", notificationError);
    }

    await checkValidIdExpirationNotifications(user._id);

    return formatUser(user);
};

export const grantExtraRenewalAttempt = async (userId, adminId, amount) => {
    if (adminId === userId) {
        throw createError("You cannot grant renewal attempts to yourself.", 400);
    }

    if (!Number.isInteger(amount) || amount <= 0) {
        throw createError("Renewal attempt amount must be a positive integer.", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    user.validIdRenewalCount = Math.max(0, user.validIdRenewalCount - amount);

    await user.save();

    return formatUser(user);
};

export const requestRenewalAttempt = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw createError("User not found.", 404);
    }

    const settings = await Settings.findOne();
    const maxAttempts = settings?.validIdRenewalSettings?.maxAttempts ?? 3;
    const renewalPeriodYears = settings?.validIdRenewalSettings?.renewalPeriodYears ?? 1;

    // Reset renewal count if the renewal period has passed since the last renewal
    const renewalPeriodMs = renewalPeriodYears * 365 * 24 * 60 * 60 * 1000;
    if (user.lastValidIdRenewalAt && Date.now() - user.lastValidIdRenewalAt >= renewalPeriodMs) {
        user.validIdRenewalCount = 0;
    }

    // Check if user has exceeded their maximum renewal attempts
    if (user.validIdRenewalCount >= maxAttempts) {
        throw createError(
            `You have reached the maximum number of valid ID renewal attempts (${maxAttempts}) per period.`,
            400
        );
    }

    // Increment the renewal request count (requesting an attempt consumes request quota)
    user.validIdRenewalCount += 1;

    // Notify all admins about the renewal request
    const admins = await User.find({ role: "admin" }).select("_id");
    for (const admin of admins) {
        await Notification.create({
            recipient: admin._id,
            type: "renewal_request",
            title: "Valid ID Renewal Request",
            message: `${user.firstName} ${user.lastName} has requested a valid ID renewal attempt.`,
            variant: "warning",
            category: "Document",
            metadata: {
                reference: "valid-id-renewal",
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    }

    await user.save();

    return formatUser(user);
};

