import crypto from "crypto";

import User from "../models/User.js";
import Blacklist from "../models/Blacklist.js";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "./emailService.js";

const EMAIL_VERIFICATION_EXPIRATION =
    24 * 60 * 60 * 1000;

const createEmailVerificationToken = () => {
    const rawToken =
        crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    return {
        rawToken,
        hashedToken,
    };
};

const sendVerificationEmail = async (
    user,
    rawToken
) => {
    const verificationUrl =
        `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;

    await sendEmail({
        to: user.email,
        subject:
            "Verify Your Rent-A-Ride Albay Account",
        text:
            `Hello ${user.firstName},\n\n` +
            `Thank you for registering with Rent-A-Ride Albay.\n\n` +
            `Please verify your email address by opening this link:\n\n` +
            `${verificationUrl}\n\n` +
            `This verification link will expire in 24 hours.\n\n` +
            `If you did not create this account, you can ignore this email.\n\n` +
            `Rent-A-Ride Albay`,

        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2>Verify Your Rent-A-Ride Albay Account</h2>

                <p>
                    Hello ${user.firstName},
                </p>

                <p>
                    Thank you for registering with
                    Rent-A-Ride Albay.
                </p>

                <p>
                    Please verify your email address by
                    clicking the button below.
                </p>

                <p style="margin: 30px 0;">
                    <a
                        href="${verificationUrl}"
                        style="
                            display: inline-block;
                            padding: 12px 20px;
                            background: #2563eb;
                            color: #ffffff;
                            text-decoration: none;
                            border-radius: 6px;
                        "
                    >
                        Verify Email Address
                    </a>
                </p>

                <p>
                    This verification link will expire in
                    24 hours.
                </p>

                <p>
                    If you did not create this account,
                    you can safely ignore this email.
                </p>

                <p>
                    Rent-A-Ride Albay
                </p>
            </div>
        `,
    });
};

export const registerUser = async (
    userData
) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        alternativeContact,
        middleName,
        birthdate,
        validIdType,
        validIdImage,
        validIdBack,
    } = userData;

    if (!birthdate) {
        throw new Error(
            "Birthdate is required."
        );
    }

    const birthdateDate = new Date(
        birthdate
    );

    if (isNaN(birthdateDate.getTime())) {
        throw new Error(
            "Birthdate must be a valid date."
        );
    }

    const existingUser =
        await User.findOne({ email });

    if (existingUser) {
        throw new Error(
            "Email is already registered."
        );
    }

    const {
        rawToken,
        hashedToken,
    } = createEmailVerificationToken();

    const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        alternativeContact,
        middleName: middleName || "",
        birthdate,
        validIdType,
        validIdImage,
        validIdBack,
        role: "customer",
        isVerified: false,
        emailVerificationToken:
            hashedToken,
        emailVerificationExpires:
            new Date(
                Date.now() +
                    EMAIL_VERIFICATION_EXPIRATION
            ),
    });

    try {
        await sendVerificationEmail(
            user,
            rawToken
        );
    } catch (error) {
        console.error(
            "Failed to send verification email:",
            error
        );

        throw new Error(
            "Registration completed, but the verification email could not be sent. Please request a new verification email."
        );
    }

    return {
        user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            alternativeContact:
                user.alternativeContact,
            role: user.role,
            isVerified: user.isVerified,
            isApproved: user.isApproved,
            isSuspended: user.isSuspended,
        },
    };
};

export const verifyEmail = async (
    rawToken
) => {
    if (!rawToken) {
        throw new Error(
            "Verification token is required."
        );
    }

    const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    const user = await User.findOne({
        emailVerificationToken:
            hashedToken,
        emailVerificationExpires: {
            $gt: new Date(),
        },
    }).select(
        "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
        throw new Error(
            "Verification link is invalid or has expired."
        );
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();

    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified,
    };
};

export const resendVerificationEmail = async (
    email
) => {
    const user = await User.findOne({
        email,
    }).select(
        "+emailVerificationToken +emailVerificationExpires"
    );

    if (!user) {
        throw new Error(
            "No account was found with that email address."
        );
    }

    if (user.isVerified) {
        throw new Error(
            "This email address is already verified."
        );
    }

    const {
        rawToken,
        hashedToken,
    } = createEmailVerificationToken();

    user.emailVerificationToken =
        hashedToken;

    user.emailVerificationExpires =
        new Date(
            Date.now() +
                EMAIL_VERIFICATION_EXPIRATION
        );

    await user.save();

    await sendVerificationEmail(
        user,
        rawToken
    );

    return {
        email: user.email,
    };
};

export const loginUser = async ({
    email,
    password,
}) => {
    const user = await User.findOne({
        email,
    }).select("+password +loginAttempts +lockoutUntil");

    if (!user) {
        throw new Error(
            "Invalid email or password."
        );
    }

    if (user.isSuspended) {
        throw new Error(
            "Your account has been suspended."
        );
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        const remainingMinutes = Math.ceil(
            (user.lockoutUntil - new Date()) /
                60000
        );

        throw new Error(
            `Account is temporarily locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}.`
        );
    }

    const isMatch =
        await user.comparePassword(password);

    if (!isMatch) {
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        if (user.loginAttempts >= 5) {
            user.lockoutUntil = new Date(
                Date.now() + 15 * 60 * 1000
            );

            await user.save();

            throw new Error(
                "Too many failed login attempts. Your account has been locked for 15 minutes."
            );
        }

        await user.save();

        throw new Error(
            "Invalid email or password."
        );
    }

    if (user.role === "customer") {
        const blacklist =
            await Blacklist.findOne({
                user: user._id,
                isActive: true,
            });

        if (blacklist) {
            throw new Error(
                "Your account has been blacklisted."
            );
        }
    }

    user.loginAttempts = 0;
    user.lockoutUntil = null;
    user.lastLogin = new Date();

    await user.save();

    const token = generateToken({
        id: user._id,
        role: user.role,
    });

    return {
        token,

        user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            alternativeContact:
                user.alternativeContact,
            role: user.role,
            isVerified: user.isVerified,
            isApproved: user.isApproved,
            isSuspended: user.isSuspended,
            lastLogin: user.lastLogin,
        },
    };
};