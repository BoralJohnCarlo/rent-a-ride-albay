import crypto from "crypto";

import User from "../models/User.js";
import createError from "../utils/createError.js";
import { renderEmail } from "../utils/emailTemplates.js";
import { disconnectUserSockets } from "../sockets/index.js";
import { sendEmail } from "./emailService.js";
import { notifyUser } from "./notificationService.js";

/*
 * Forgot password, in three steps:
 *   1. requestPasswordReset - emails a 6-digit code (hashed at rest).
 *   2. verifyPasswordResetCode - trades a correct code for a one-time reset
 *      token (also hashed at rest), so step 3 never re-sends the code.
 *   3. resetPassword - the token sets the new password. The User pre-save
 *      hook stamps passwordChangedAt, which signs out every device.
 */

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const RESET_RESEND_COOLDOWN_MS = 60 * 1000;
export const RESET_MAX_ATTEMPTS = 5;
export const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

export const INVALID_CODE_MESSAGE =
    "That code is invalid or has expired. Please request a new one.";

export const RESET_SESSION_EXPIRED_MESSAGE =
    "Your reset session has expired. Please start again.";

const sha256 = (value) =>
    crypto.createHash("sha256").update(String(value)).digest("hex");

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a || ""));
    const right = Buffer.from(String(b || ""));

    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/*
 * Same answer whether or not the email has an account, so the form can't be
 * used to find out who's registered. The cooldown is reported either way.
 */
const requestResult = () => ({
    resendAvailableIn: RESET_RESEND_COOLDOWN_MS / 1000,
    codeExpiresIn: RESET_CODE_TTL_MS / 1000,
});

const sendResetCodeEmail = (user, rawCode) => {
    const message = {
        to: user.email,
        ...renderEmail({
            subject: "Your Rent-A-Ride Albay password reset code",
            heading: "Reset your password",
            greetingName: user.firstName || "there",
            paragraphs: [
                "We received a request to reset the password for your Rent-A-Ride Albay account. Enter this code on the reset page to continue:",
            ],
            code: {
                value: rawCode,
                caption: "This code expires in 15 minutes and can only be used once.",
            },
            footnote: [
                "If you didn't ask to reset your password, you can ignore this email - your password won't change.",
                "Never share this code. Our team will never ask you for it.",
            ],
        }),
    };

    // Not awaited: the response mustn't take longer for real accounts than
    // for unknown emails. A failed send is logged; the user can resend.
    sendEmail(message).catch((error) => {
        console.error(
            `Failed to send password reset code to ${user.email}:`,
            error?.message || error
        );
    });
};

export const requestPasswordReset = async (email) => {
    const user = await User.findOne({ email }).select("_id email firstName isSuspended");

    if (!user || user.isSuspended) {
        return requestResult();
    }

    const now = Date.now();
    const rawCode = crypto.randomInt(0, 1000000).toString().padStart(6, "0");

    // Conditional on the cooldown, so two quick submits send one email.
    const updated = await User.findOneAndUpdate(
        {
            _id: user._id,
            $or: [
                { passwordResetSentAt: null },
                {
                    passwordResetSentAt: {
                        $lte: new Date(now - RESET_RESEND_COOLDOWN_MS),
                    },
                },
            ],
        },
        {
            $set: {
                passwordResetCode: sha256(rawCode),
                passwordResetExpires: new Date(now + RESET_CODE_TTL_MS),
                passwordResetAttempts: 0,
                passwordResetSentAt: new Date(now),
                // A new code voids any half-finished reset.
                passwordResetToken: null,
                passwordResetTokenExpires: null,
            },
        },
        { returnDocument: "after" }
    );

    if (updated) {
        sendResetCodeEmail(user, rawCode);
    }

    return requestResult();
};

export const verifyPasswordResetCode = async (email, code) => {
    const user = await User.findOne({ email }).select(
        "+passwordResetCode +passwordResetExpires +passwordResetAttempts"
    );

    if (
        !user ||
        user.isSuspended ||
        !user.passwordResetCode ||
        !user.passwordResetExpires ||
        user.passwordResetExpires <= new Date()
    ) {
        throw createError(INVALID_CODE_MESSAGE, 400);
    }

    const hashedCode = sha256(code);

    if (!safeEqual(user.passwordResetCode, hashedCode)) {
        // Counted per account (not per IP, which can be rotated).
        const counted = await User.findOneAndUpdate(
            { _id: user._id, passwordResetCode: user.passwordResetCode },
            { $inc: { passwordResetAttempts: 1 } },
            { returnDocument: "after" }
        ).select("+passwordResetAttempts");

        const attempts = counted?.passwordResetAttempts ?? RESET_MAX_ATTEMPTS;

        if (attempts >= RESET_MAX_ATTEMPTS) {
            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        passwordResetCode: null,
                        passwordResetExpires: null,
                    },
                }
            );

            throw createError(
                "Too many incorrect codes. Please request a new code.",
                400
            );
        }

        const remaining = RESET_MAX_ATTEMPTS - attempts;

        throw createError(
            `Incorrect code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} left.`,
            400
        );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    // Single use: only succeeds while this exact code is still on file.
    const claimed = await User.findOneAndUpdate(
        { _id: user._id, passwordResetCode: hashedCode },
        {
            $set: {
                passwordResetCode: null,
                passwordResetExpires: null,
                passwordResetAttempts: 0,
                passwordResetToken: sha256(rawToken),
                passwordResetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            },
        }
    );

    if (!claimed) {
        throw createError(INVALID_CODE_MESSAGE, 400);
    }

    return {
        resetToken: rawToken,
        expiresIn: RESET_TOKEN_TTL_MS / 1000,
    };
};

export const resetPassword = async (email, resetToken, newPassword) => {
    const user = await User.findOne({ email }).select(
        "+password +passwordResetToken +passwordResetTokenExpires"
    );

    if (
        !user ||
        user.isSuspended ||
        !user.passwordResetToken ||
        !user.passwordResetTokenExpires ||
        user.passwordResetTokenExpires <= new Date() ||
        !safeEqual(user.passwordResetToken, sha256(resetToken))
    ) {
        throw createError(RESET_SESSION_EXPIRED_MESSAGE, 400);
    }

    if (await user.comparePassword(newPassword)) {
        throw createError(
            "Your new password must be different from your old one.",
            400
        );
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetTokenExpires = null;
    // Proving access to the email is enough to lift a failed-login lockout.
    user.loginAttempts = 0;
    user.lockoutUntil = null;

    // Stamps passwordChangedAt: every existing session is now signed out.
    await user.save();

    disconnectUserSockets(user._id);

    try {
        await notifyUser(user._id, {
            type: "security",
            title: "Password Reset",
            message:
                "Your password was reset using a code sent to your email, and every device was signed out. If this wasn't you, contact support right away.",
            variant: "warning",
            category: "User",
            metadata: {
                reference: "password",
                relatedId: user._id,
                relatedModel: "User",
            },
            email: {
                subject: "Your Rent-A-Ride Albay password was reset",
                heading: "Your password was reset",
                paragraphs: [
                    "The password for your Rent-A-Ride Albay account was just reset using a code sent to this email address.",
                    "For your security, every device signed in to your account was signed out. Sign in again with your new password.",
                    "If you didn't do this, contact our support team right away so we can secure your account.",
                ],
                actionLabel: "Sign in",
                actionPath: "/login",
                footnote: "This is an automatic security notice sent whenever your password changes.",
            },
        });
    } catch (notificationError) {
        console.error("Failed to send password-reset notification:", notificationError);
    }

    return { email: user.email };
};
