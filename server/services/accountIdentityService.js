import createError from "../utils/createError.js";

import Blacklist from "../models/Blacklist.js";
import PendingRegistration from "../models/PendingRegistration.js";
import User from "../models/User.js";

/*
 * One phone number per account. Numbers are compared on their last 10
 * digits, so "+63 917 123 4567", "0917-123-4567" and "09171234567" are the
 * same number.
 */
export const phoneKey = (value) =>
    String(value || "").replace(/\D/g, "").slice(-10);

const licenseKey = (value) =>
    String(value || "").replace(/[\s-]/g, "").toUpperCase();

/*
 * Matches a stored phone number whose digits end with `key`, whatever
 * separators it was saved with (stored numbers were never normalized).
 */
const phonePattern = (key) =>
    new RegExp(`${key.split("").join("\\D*")}\\D*$`);

export const PHONE_TAKEN_MESSAGE =
    "This phone number is already used by another account. Please use a different number, or log in to your existing account.";

export const ACCOUNT_RESTRICTED_MESSAGE =
    "We're unable to create an account with these details. Please contact support if you think this is a mistake.";

/*
 * Throws when another account (or another registration still waiting on its
 * email code) already uses this phone number.
 */
export const assertPhoneAvailable = async (
    phoneNumber,
    { excludeUserId, excludeEmail } = {}
) => {
    const key = phoneKey(phoneNumber);

    if (key.length < 10) {
        return;
    }

    const pattern = phonePattern(key);

    const [user, pending] = await Promise.all([
        User.exists({
            phoneNumber: pattern,
            ...(excludeUserId && { _id: { $ne: excludeUserId } }),
        }),
        PendingRegistration.exists({
            phoneNumber: pattern,
            emailVerificationExpires: { $gt: new Date() },
            ...(excludeEmail && { email: { $ne: excludeEmail } }),
        }),
    ]);

    if (user || pending) {
        throw createError(PHONE_TAKEN_MESSAGE, 409);
    }
};

/*
 * A person who is barred — a blacklisted customer or a suspended partner —
 * can't simply sign up again under a new email: a registration is refused
 * when its phone number or driver's license number matches theirs.
 */
export const assertNotRestricted = async ({
    phoneNumber,
    alternativeContact,
    licenseNumber,
}) => {
    const blacklisted = await Blacklist.find({ isActive: true })
        .select("user")
        .lean();

    const restrictedUsers = await User.find({
        $or: [
            { _id: { $in: blacklisted.map((entry) => entry.user) } },
            { role: "operator", isSuspended: true },
        ],
    })
        .select("phoneNumber alternativeContact licenseNumber")
        .lean();

    if (!restrictedUsers.length) {
        return;
    }

    const phones = [phoneNumber, alternativeContact]
        .map(phoneKey)
        .filter((key) => key.length === 10);
    const license = licenseKey(licenseNumber);

    const matches = restrictedUsers.some(
        (user) =>
            [user.phoneNumber, user.alternativeContact]
                .map(phoneKey)
                .some((key) => key.length === 10 && phones.includes(key)) ||
            (license && licenseKey(user.licenseNumber) === license)
    );

    if (matches) {
        throw createError(ACCOUNT_RESTRICTED_MESSAGE, 403);
    }
};
