import crypto from "crypto";

import createError from "../utils/createError.js";

import User from "../models/User.js";
import PendingRegistration from "../models/PendingRegistration.js";
import PendingVehicle from "../models/PendingVehicle.js";
import Vehicle from "../models/Vehicle.js";
import { VALID_ID_DOCUMENT_SOURCE } from "../models/ValidIdDocument.js";
// Used by loginUser's blacklist check.
import Blacklist from "../models/Blacklist.js";
import {
    assertNotRestricted,
    assertPhoneAvailable,
} from "./accountIdentityService.js";
import { assertInspectionSlotAvailable } from "./inspectionSlotService.js";
import {
    claimTemporaryValidIdUploads,
    findUploadsByHandles,
    holdTemporaryUploadsUntil,
} from "./temporaryValidIdUploadService.js";
import generateToken from "../utils/generateToken.js";
import generateVehicleCode from "../utils/generateVehicleCode.js";
import { sendEmail } from "./emailService.js";
import { notifyAdmins, notifyUser } from "./notificationService.js";
import { isProofOfBillingEnabled } from "./settingsService.js";
import { resolveAcceptedLegalVersion } from "./legalDocumentService.js";
import {
    LEGAL_DOCUMENT_TYPES,
    REGISTRATION_TERMS_OUTDATED_MESSAGE,
} from "../constants/legalDocumentConstants.js";
import { recordValidIdUpload } from "./validIdHistoryService.js";
import { isUserEffectivelyVerified } from "../utils/userFormatter.js";

const EMAIL_VERIFICATION_EXPIRATION =
    2 * 60 * 60 * 1000;

// Per registration, whatever IP the requests come from.
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_REGISTRATION = 10;
// Resending a code can't keep a registration (and the inspection slot and
// images it holds) alive past this, counted from when it was submitted.
const MAX_REGISTRATION_LIFETIME = 6 * 60 * 60 * 1000;

// Unverified partner registrations one IP may have holding inspection slots.
const MAX_PENDING_PARTNER_REGISTRATIONS_PER_IP = 2;

const escapeHtml = (value) =>
    String(value ?? "").replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[character]
    );

const createEmailVerificationCode = () => {
    const rawCode = crypto.randomInt(100000, 1000000)
        .toString()
        .padStart(6, "0");

    const hashedCode = crypto
        .createHash("sha256")
        .update(rawCode)
        .digest("hex");

    return {
        rawCode,
        hashedCode,
    };
};

const hashPassword = async (password) => {
    const bcrypt = await import("bcryptjs");
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
};

/*
 * Every image a registration submits must be one this server just uploaded
 * for it: the URL has to be a Cloudinary delivery URL for one of the
 * temporary uploads named in `temporaryUploadIds`. Stops an ID image (or a
 * partner's vehicle photo) from pointing at an arbitrary outside URL.
 */
const assertRegistrationUploads = async (
    urls,
    temporaryUploadIds
) => {
    // Handles carry a secret, so only the uploader's own images resolve.
    const uploads = await findUploadsByHandles(temporaryUploadIds);

    const publicIds = uploads.map((upload) => upload.publicId);

    const isOwnUpload = (url) => {
        let parsed;

        try {
            parsed = new URL(url);
        } catch {
            return false;
        }

        if (
            parsed.protocol !== "https:" ||
            parsed.hostname !== "res.cloudinary.com"
        ) {
            return false;
        }

        const path = decodeURIComponent(parsed.pathname);

        // Must be this app's own Cloudinary account — the path's first
        // segment is the cloud name — not the same public id re-uploaded
        // to someone else's account.
        if (path.split("/")[1] !== process.env.CLOUDINARY_CLOUD_NAME) {
            return false;
        }

        return publicIds.some(
            (publicId) =>
                path.endsWith(`/${publicId}`) ||
                path.includes(`/${publicId}.`)
        );
    };

    if (!urls.every(isOwnUpload)) {
        throw new Error(
            "One of your uploaded images could not be confirmed. Please upload your photos again and resubmit."
        );
    }

    // Record ids, stored on the pending registration so the uploads can be
    // held while it waits and claimed once it is verified.
    return uploads.map((upload) => upload._id);
};

export const PROOF_OF_BILLING_REQUIRED_MESSAGE =
    "Please upload a proof of billing address.";

/*
 * The proof of billing image to store for a registration: required while the
 * admin has it turned on, and dropped (never stored, never checked) while it
 * is off - so a form that still sends one after the field was turned off
 * can't fail on it.
 */
const resolveRegistrationProofOfBilling = async (proofOfBillingImage) => {
    if (!(await isProofOfBillingEnabled())) {
        return "";
    }

    if (!proofOfBillingImage || typeof proofOfBillingImage !== "string") {
        throw new Error(PROOF_OF_BILLING_REQUIRED_MESSAGE);
    }

    return proofOfBillingImage;
};

const PENDING_VERIFICATION_MESSAGE =
    "This email is already registered and waiting for verification. Enter the code we emailed you, or request a new one.";

const ACCOUNT_EXISTS_MESSAGE =
    "An account with this email already exists. Please log in instead.";

const VERIFICATION_EMAIL_FAILED_MESSAGE =
    "We couldn't send your verification email. Please check the address and try again.";

const MAX_VERIFICATION_ATTEMPTS = 5;

const ALREADY_VERIFIED_MESSAGE =
    "Your email is already verified. You can log in now.";

/*
 * Runs before anything is saved: a barred person (blacklisted customer or
 * suspended partner) is refused first, with a deliberately vague message,
 * then the one-account-per-phone-number rule applies.
 */
const assertIdentityAllowed = async ({
    email,
    phoneNumber,
    alternativeContact,
    licenseNumber,
}) => {
    await assertNotRestricted({
        phoneNumber,
        alternativeContact,
        licenseNumber,
    });

    await assertPhoneAvailable(phoneNumber, { excludeEmail: email });
};

/*
 * Only the vehicle facts a partner actually fills in at registration.
 * Everything an admin decides — pricing, featured, verification flags, GPS,
 * booking availability — is left to its defaults, whatever the request says.
 */
const pickRegistrationVehicle = (vehicle = {}) => ({
    vehicleType: vehicle.vehicleType,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: typeof vehicle.variant === "string" ? vehicle.variant : "",
    year: vehicle.year ?? null,
    plateNumber: vehicle.plateNumber,
    registrationNumber: vehicle.registrationNumber,
    images: (Array.isArray(vehicle.images) ? vehicle.images : [])
        .filter((image) => image && typeof image.url === "string")
        .map((image, index) => ({
            url: image.url,
            publicId:
                typeof image.publicId === "string" ? image.publicId : "",
            isPrimary: index === 0,
        })),
    specifications: {
        transmission: vehicle.specifications?.transmission,
        fuelType: vehicle.specifications?.fuelType,
        seatingCapacity: vehicle.specifications?.seatingCapacity,
    },
    compliance: {
        licenseExpiration: vehicle.compliance?.licenseExpiration || null,
    },
});

/* The registration calendar sends "YYYY-MM-DDTHH:mm:00". */
const parseInspectionSlot = (inspectionDate) => {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(
        String(inspectionDate || "")
    );

    if (!match) {
        throw new Error(
            "Please choose an inspection appointment from the calendar."
        );
    }

    return { date: match[1], time: match[2] };
};

const escapeRegex = (text) =>
    String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/*
 * Plates are compared ignoring case, spaces and hyphens ("ABC 1234" ===
 * "abc-1234"). A plate is taken when a live vehicle has it, or another
 * partner's vehicle with it is still waiting on review.
 */
const isPlateNumberTaken = async (plateNumber) => {
    const characters = String(plateNumber || "")
        .replace(/[\s-]/g, "")
        .split("");

    if (!characters.length) {
        return false;
    }

    const pattern = new RegExp(
        `^[\\s-]*${characters.map(escapeRegex).join("[\\s-]*")}[\\s-]*$`,
        "i"
    );

    const [vehicle, pendingVehicle] = await Promise.all([
        Vehicle.exists({ plateNumber: pattern }),
        PendingVehicle.exists({
            plateNumber: pattern,
            status: { $in: ["pending_review", "under_inspection"] },
        }),
    ]);

    return Boolean(vehicle || pendingVehicle);
};

const PLATE_TAKEN_MESSAGE =
    "A vehicle with this plate number is already registered or awaiting review. Please check the plate number, or contact us if this is your vehicle.";

const sendVerificationEmail = async (
    user,
    rawCode
) => {
    // The name is whatever the registrant typed, and this email can be sent
    // to any address, so it is escaped before going into the HTML.
    const firstName = String(user.firstName || "").trim().slice(0, 50);
    const safeFirstName = escapeHtml(firstName);

    await sendEmail({
        to: user.email,
        subject:
            "Verify Your Rent-A-Ride Albay Account",
        text:
            `Hello ${firstName},\n\n` +
            `Thank you for registering with Rent-A-Ride Albay.\n\n` +
            `Your email verification code is:\n\n` +
            `${rawCode}\n\n` +
            `This code will expire in 2 hours.\n\n` +
            `If you did not create this account, you can ignore this email.\n\n` +
            `Rent-A-Ride Albay`,

        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2>Verify Your Rent-A-Ride Albay Account</h2>

                <p>
                    Hello ${safeFirstName},
                </p>

                <p>
                    Thank you for registering with
                    Rent-A-Ride Albay.
                </p>

                <p>
                    Your email verification code is:
                </p>

                <p style="margin: 30px 0;">
                    <span
                        style="
                            display: inline-block;
                            padding: 12px 20px;
                            background: #f3f4f6;
                            color: #1f2937;
                            text-decoration: none;
                            border-radius: 6px;
                            font-size: 24px;
                            font-weight: bold;
                            letter-spacing: 4px;
                        "
                    >
                        ${rawCode}
                    </span>
                </p>

                <p>
                    This code will expire in 2 hours.
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

const assertAdult = (birthdate) => {
    if (!birthdate) {
        throw new Error(
            "Birthdate is required."
        );
    }

    const [year, month, day] = String(birthdate).split("-").map(Number);
    const birthdateDate = new Date(year, month - 1, day);

    if (isNaN(birthdateDate.getTime())) {
        throw new Error(
            "Birthdate must be a valid date."
        );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (birthdateDate >= today) {
        throw new Error("Birthdate cannot be in the future.");
    }

    const age = today.getFullYear() - birthdateDate.getFullYear();
    const monthDiff = today.getMonth() - birthdateDate.getMonth();
    const dayDiff = today.getDate() - birthdateDate.getDate();

    const isOver18 =
        age > 18 ||
        (age === 18 && monthDiff > 0) ||
        (age === 18 && monthDiff === 0 && dayDiff >= 0);

    if (!isOver18) {
        throw new Error("You must be at least 18 years old.");
    }
};

/*
 * A verified account and a registration still waiting on its code are told
 * apart, so the form only sends people to the code screen when a code was
 * actually sent. A waiting registration is never overwritten: the code goes
 * to the email's owner, so replacing it would let someone else set the
 * password on an account the owner then verifies.
 */
const assertEmailAvailable = async (email) => {
    if (await User.exists({ email })) {
        throw createError(ACCOUNT_EXISTS_MESSAGE, 409);
    }

    const pending = await PendingRegistration.findOne({ email })
        .select("+emailVerificationExpires")
        .lean();

    if (pending?.emailVerificationExpires > new Date()) {
        throw createError(PENDING_VERIFICATION_MESSAGE, 409);
    }
};

/*
 * Saves the registration (reusing an expired record for the same email),
 * emails its code, and keeps its uploads alive until the code expires.
 * `fields` must set every role-specific field, so nothing from an expired
 * record of the other role carries over.
 */
/*
 * The Terms & Conditions version a registration accepted: the one the
 * form showed (`termsVersionId`), or the current one if none was sent.
 */
const resolveRegistrationTerms = async (termsVersionId) => {
    const accepted = await resolveAcceptedLegalVersion(
        LEGAL_DOCUMENT_TYPES.BOOKING_TERMS,
        termsVersionId,
        { outdatedMessage: REGISTRATION_TERMS_OUTDATED_MESSAGE }
    );

    return {
        termsDocument: accepted.document,
        termsVersion: accepted.version,
    };
};

const savePendingRegistration = async (email, fields) => {
    const { rawCode, hashedCode } = createEmailVerificationCode();
    const verificationExpires = new Date(
        Date.now() + EMAIL_VERIFICATION_EXPIRATION
    );

    const now = new Date();

    const data = {
        ...fields,
        emailVerificationToken: hashedCode,
        emailVerificationExpires: verificationExpires,
        verificationAttempts: 0,
        // Fresh for a new or reused-after-expiry record alike.
        registrationStartedAt: now,
        termsAcceptedAt: now,
        codesSent: 1,
        lastCodeSentAt: now,
    };

    const existingPending = await PendingRegistration.findOne({ email });

    let pendingRegistration;

    if (existingPending) {
        existingPending.set(data);
        pendingRegistration = await existingPending.save();
    } else {
        pendingRegistration = await PendingRegistration.create({
            email,
            ...data,
        });
    }

    try {
        await sendVerificationEmail(pendingRegistration, rawCode);
    } catch (error) {
        console.error("Failed to send verification email:", error);

        await PendingRegistration.deleteOne({
            _id: pendingRegistration._id,
        });

        throw new Error(VERIFICATION_EMAIL_FAILED_MESSAGE);
    }

    await holdTemporaryUploadsUntil(
        fields.temporaryUploadIds,
        verificationExpires
    );

    return {
        email: pendingRegistration.email,
    };
};

export const registerUser = async (
    userData,
    { ip = "" } = {}
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
        licenseNumber,
        licenseExpirationDate,
        hasDriversLicense,
        licenseCodes,
        motorcycleTransmission,
        carTransmission,
        currentAddress,
        temporaryUploadIds,
        termsAgreed,
    } = userData;

    assertAdult(birthdate);

    if (termsAgreed !== true) {
        throw new Error(
            "You must agree to the Terms and Conditions and the Privacy Notice."
        );
    }

    const acceptedTerms = await resolveRegistrationTerms(
        userData.termsVersionId
    );

    const proofOfBillingImage = await resolveRegistrationProofOfBilling(
        userData.proofOfBillingImage
    );

    await assertEmailAvailable(email);
    await assertIdentityAllowed({
        email,
        phoneNumber,
        alternativeContact,
        licenseNumber,
    });

    const uploadIds = await assertRegistrationUploads(
        [
            validIdImage,
            validIdBack,
            ...(proofOfBillingImage ? [proofOfBillingImage] : []),
        ],
        temporaryUploadIds
    );

    return savePendingRegistration(email, {
        firstName,
        lastName,
        password: await hashPassword(password),
        phoneNumber,
        alternativeContact,
        middleName: middleName || "",
        birthdate,
        validIdType,
        validIdImage,
        validIdBack,
        proofOfBillingImage,
        licenseNumber: licenseNumber || "",
        licenseExpirationDate: licenseExpirationDate || null,
        hasDriversLicense: hasDriversLicense ?? null,
        licenseCodes: licenseCodes || [],
        motorcycleTransmission: motorcycleTransmission || [],
        carTransmission: carTransmission || [],
        currentAddress: currentAddress || {},
        temporaryUploadIds: uploadIds,
        termsAgreed: true,
        ...acceptedTerms,
        registrationIp: ip,
        role: "customer",
        vehicleData: undefined,
        inspectionDate: null,
        inspectionSlot: { date: "", time: "" },
    });
};

export const registerOperator = async (
    userData,
    { ip = "" } = {}
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
        licenseNumber,
        licenseExpirationDate,
        licenseCodes,
        motorcycleTransmission,
        carTransmission,
        currentAddress,
        temporaryUploadIds,
        vehicle,
        inspectionDate,
        termsAgreed,
    } = userData;

    assertAdult(birthdate);

    if (termsAgreed !== true) {
        throw new Error(
            "You must agree to the Terms and Conditions and the Privacy Notice."
        );
    }

    const acceptedTerms = await resolveRegistrationTerms(
        userData.termsVersionId
    );

    const inspectionSlot = parseInspectionSlot(inspectionDate);

    const proofOfBillingImage = await resolveRegistrationProofOfBilling(
        userData.proofOfBillingImage
    );

    await assertEmailAvailable(email);
    await assertIdentityAllowed({
        email,
        phoneNumber,
        alternativeContact,
        licenseNumber,
    });

    // Each unverified partner registration holds an inspection slot, so one
    // IP can't hold more than a couple at a time.
    if (ip) {
        const heldFromIp = await PendingRegistration.countDocuments({
            role: "operator",
            registrationIp: ip,
            email: { $ne: email },
            emailVerificationExpires: { $gt: new Date() },
        });

        if (heldFromIp >= MAX_PENDING_PARTNER_REGISTRATIONS_PER_IP) {
            throw createError(
                "There are already partner registrations waiting for email verification from your network. Please verify one of them, or try again later.",
                429
            );
        }
    }

    // Must be a slot the admin offers that still has room — the same rule
    // consignment inspections follow. Holding it on the pending record
    // keeps it from being double-booked while the email is verified.
    await assertInspectionSlotAvailable(
        inspectionSlot.date,
        inspectionSlot.time,
        { excludeRegistrationEmail: email }
    );

    const registrationVehicle = pickRegistrationVehicle(vehicle);

    if (await isPlateNumberTaken(registrationVehicle.plateNumber)) {
        throw new Error(PLATE_TAKEN_MESSAGE);
    }

    const uploadIds = await assertRegistrationUploads(
        [
            validIdImage,
            validIdBack,
            ...(proofOfBillingImage ? [proofOfBillingImage] : []),
            ...registrationVehicle.images.map((image) => image.url),
        ],
        temporaryUploadIds
    );

    return savePendingRegistration(email, {
        firstName,
        lastName,
        password: await hashPassword(password),
        phoneNumber,
        alternativeContact,
        middleName: middleName || "",
        birthdate,
        validIdType,
        validIdImage,
        validIdBack,
        proofOfBillingImage,
        licenseNumber: licenseNumber || "",
        licenseExpirationDate: licenseExpirationDate || null,
        hasDriversLicense: null,
        licenseCodes: licenseCodes || [],
        motorcycleTransmission: motorcycleTransmission || [],
        carTransmission: carTransmission || [],
        currentAddress: currentAddress || {},
        temporaryUploadIds: uploadIds,
        termsAgreed: true,
        ...acceptedTerms,
        registrationIp: ip,
        role: "operator",
        vehicleData: registrationVehicle,
        inspectionDate: inspectionDate || null,
        inspectionSlot,
    });
};

export const verifyEmail = async (
    email,
    code
) => {
    if (!code) {
        throw new Error(
            "Verification code is required."
        );
    }

    if (!email) {
        throw new Error(
            "Email is required."
        );
    }

    const pendingRegistration =
        await PendingRegistration.findOne({
            email,
            emailVerificationExpires: {
                $gt: new Date(),
            },
        }).select(
            "+emailVerificationToken +emailVerificationExpires +password"
        );

    if (!pendingRegistration) {
        // E.g. a second submit of the code arriving after the first one
        // already created the account.
        if (await User.exists({ email })) {
            throw createError(ALREADY_VERIFIED_MESSAGE, 409);
        }

        throw new Error(
            "Verification code is invalid or has expired."
        );
    }

    const hashedCode = crypto
        .createHash("sha256")
        .update(code)
        .digest("hex");

    /*
     * Each code allows MAX_VERIFICATION_ATTEMPTS wrong guesses per
     * registration (not per IP, which an attacker can rotate). After that
     * the code is voided and a new one has to be requested.
     */
    if (!pendingRegistration.emailVerificationToken) {
        throw new Error(
            "This code was locked after too many incorrect attempts. Please request a new code."
        );
    }

    if (
        pendingRegistration.emailVerificationToken !==
        hashedCode
    ) {
        const updated = await PendingRegistration.findOneAndUpdate(
            { _id: pendingRegistration._id },
            { $inc: { verificationAttempts: 1 } },
            { returnDocument: "after" }
        );

        const attempts = updated?.verificationAttempts ?? MAX_VERIFICATION_ATTEMPTS;

        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
            await PendingRegistration.updateOne(
                { _id: pendingRegistration._id },
                { $set: { emailVerificationToken: null } }
            );

            throw new Error(
                "Too many incorrect codes. Please request a new code."
            );
        }

        const remaining = MAX_VERIFICATION_ATTEMPTS - attempts;

        throw new Error(
            `Invalid verification code. ${remaining} ${
                remaining === 1 ? "attempt" : "attempts"
            } left.`
        );
    }

    // Validate vehicle data for operators BEFORE creating user
    let pendingVehicle = null;
    const vehicleData =
        pendingRegistration.role === "operator"
            ? pendingRegistration.vehicleData
            : null;

    if (vehicleData) {
        const hasRequiredVehicleFields =
            vehicleData.vehicleType &&
            vehicleData.brand &&
            vehicleData.model &&
            vehicleData.plateNumber &&
            vehicleData.specifications?.transmission &&
            vehicleData.specifications?.fuelType;

        if (!hasRequiredVehicleFields) {
            throw new Error(
                "Vehicle data is incomplete. Please go back and complete all required vehicle fields."
            );
        }

        // Re-checked here: another partner may have registered the same
        // plate while this email was waiting to be verified.
        if (await isPlateNumberTaken(vehicleData.plateNumber)) {
            throw new Error(PLATE_TAKEN_MESSAGE);
        }
    }

    // Create the actual User account with already-hashed password. A
    // duplicate-key error means a simultaneous submit of the same code got
    // there first — the account exists, so that's reported, not an error.
    let user;

    try {
    user = await User.create({
        firstName: pendingRegistration.firstName,
        lastName: pendingRegistration.lastName,
        email: pendingRegistration.email,
        password: pendingRegistration.password,  // Already hashed from PendingRegistration
        phoneNumber: pendingRegistration.phoneNumber,
        alternativeContact: pendingRegistration.alternativeContact || "",
        middleName: pendingRegistration.middleName || "",
        birthdate: pendingRegistration.birthdate,
        validIdType: pendingRegistration.validIdType,
        validIdImage: pendingRegistration.validIdImage,
        validIdBack: pendingRegistration.validIdBack,
        proofOfBillingImage:
            pendingRegistration.proofOfBillingImage || "",
        licenseNumber: pendingRegistration.licenseNumber || "",
        licenseExpirationDate: pendingRegistration.licenseExpirationDate || null,
        hasDriversLicense:
            pendingRegistration.hasDriversLicense ?? null,
        licenseCodes: pendingRegistration.licenseCodes || [],
        motorcycleTransmission: pendingRegistration.motorcycleTransmission || [],
        carTransmission: pendingRegistration.carTransmission || [],
        role: pendingRegistration.role || "customer",
        /*
         * Confirming the email OTP only proves the email address is real -
         * it says nothing about the valid ID uploaded during registration.
         * That still needs an admin to actually look at it and verify it
         * (see verifyValidId in userService.js / the Verify action in the
         * admin User Moderation page) before the account is "Verified".
         */
        isVerified: false,
        termsAcceptedAt:
            pendingRegistration.termsAcceptedAt ||
            (pendingRegistration.termsAgreed
                ? pendingRegistration.updatedAt || new Date()
                : null),
        termsDocument: pendingRegistration.termsDocument || null,
        termsVersion: pendingRegistration.termsVersion ?? null,
        address: pendingRegistration.currentAddress
            ? {
                houseUnitLot: pendingRegistration.currentAddress.houseUnitLot || "",
                region: pendingRegistration.currentAddress.region || "",
                street: pendingRegistration.currentAddress.street || "",
                barangay: pendingRegistration.currentAddress.barangay || "",
                city: pendingRegistration.currentAddress.cityMunicipality || "",
                province: pendingRegistration.currentAddress.province || "",
                postalCode: pendingRegistration.currentAddress.postalCode || "",
            }
            : undefined,
    });
    } catch (error) {
        if (error?.code === 11000 && (await User.exists({ email }))) {
            throw createError(ALREADY_VERIFIED_MESSAGE, 409);
        }

        throw error;
    }

    /*
     * The partner's vehicle is created, and the uploads kept for good,
     * before the pending registration is deleted. A failure undoes the new
     * account (and vehicle): either everything exists or nothing does, and
     * the same code can simply be entered again.
     *
     * Only partner-entered facts are copied. Pricing, featured, verification
     * flags, GPS and availability are the admin's to set, so they keep their
     * defaults here (records saved before this was sanitized may hold them).
     */
    try {
        if (vehicleData) {
            const vehicleCode = await generateVehicleCode();

            pendingVehicle = await PendingVehicle.create({
                vehicleCode,
                vehicleType: vehicleData.vehicleType,
                brand: vehicleData.brand,
                model: vehicleData.model,
                year: vehicleData.year || null,
                plateNumber: vehicleData.plateNumber,
                registrationNumber: vehicleData.registrationNumber || "",
                images: (vehicleData.images || [])
                    .filter((image) => image?.url)
                    .map((image, index) => ({
                        url: image.url,
                        publicId: image.publicId || "",
                        isPrimary: index === 0,
                    })),
                specifications: {
                    transmission: vehicleData.specifications.transmission,
                    fuelType: vehicleData.specifications.fuelType,
                    seatingCapacity:
                        vehicleData.specifications.seatingCapacity || 1,
                },
                compliance: {
                    licenseExpiration:
                        vehicleData.compliance?.licenseExpiration || null,
                },
                inspection: {
                    scheduledDate:
                        pendingRegistration.inspectionSlot?.date || "",
                    scheduledTime:
                        pendingRegistration.inspectionSlot?.time || "",
                },
                operator: user._id,
                status: "pending_review",
                isPendingInspection: true,
            });
        }

        // The images are now the account's, so the expiry sweep must leave
        // them — done before the pending record goes, so a failure here
        // can still be rolled back and retried.
        await claimTemporaryValidIdUploads(
            pendingRegistration.temporaryUploadIds || []
        );
    } catch (error) {
        console.error(
            "Failed to finish the registration; undoing the new account:",
            error
        );

        if (pendingVehicle) {
            await PendingVehicle.deleteOne({ _id: pendingVehicle._id });
        }

        await User.deleteOne({ _id: user._id });

        throw new Error(
            vehicleData
                ? "We couldn't save your vehicle details. Please try entering the code again in a moment."
                : "We couldn't finish creating your account. Please try entering the code again in a moment."
        );
    }

    // Everything is saved, so the pending registration can go.
    await PendingRegistration.deleteOne({
        _id: pendingRegistration._id,
    });

    try {
        await recordValidIdUpload(user, {
            source: VALID_ID_DOCUMENT_SOURCE.REGISTRATION,
        });
    } catch (historyError) {
        console.error(
            "Failed to record the registration valid ID:",
            historyError
        );
    }

    try {
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        const isOperator = (user.role || "customer") === "operator";

        await notifyAdmins({
            type: "user",
            title: isOperator
                ? "New Partner Registered"
                : "New Customer Registered",
            message: isOperator
                ? `${fullName} (${user.email}) registered as a partner${
                    pendingVehicle
                        ? ` and submitted a vehicle (${pendingVehicle.brand} ${pendingVehicle.model}, plate ${pendingVehicle.plateNumber}) for review.`
                        : "."
                }`
                : `${fullName} (${user.email}) created a customer account.`,
            variant: "user",
            category: "User",
            metadata: {
                reference: user.email,
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of new registration:",
            notificationError
        );
    }

    try {
        await notifyUser(user._id, {
            type: "account",
            title: "Welcome to Rent-A-Ride Albay",
            message: pendingVehicle
                ? "Your email is verified and your account is active. Your submitted vehicle is now pending admin review."
                : "Your email is verified and your account is active. You can now book a vehicle.",
            variant: "success",
            category: "Account",
            metadata: {
                reference: user.email,
                relatedId: user._id,
                relatedModel: "User",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to send welcome notification:",
            notificationError
        );
    }

    return {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: isUserEffectivelyVerified(user),
        pendingVehicle: pendingVehicle ? {
            id: pendingVehicle._id,
            vehicleCode: pendingVehicle.vehicleCode,
            vehicleType: pendingVehicle.vehicleType,
            brand: pendingVehicle.brand,
            model: pendingVehicle.model,
            year: pendingVehicle.year,
            plateNumber: pendingVehicle.plateNumber,
            registrationNumber: pendingVehicle.registrationNumber,
            status: pendingVehicle.status,
            isPendingInspection: pendingVehicle.isPendingInspection
        } : null,
    };
};

export const resendVerificationEmail = async (
    email
) => {
    const pendingRegistration =
        await PendingRegistration.findOne({
            email,
        }).select(
            "+emailVerificationToken +emailVerificationExpires"
        );

    if (!pendingRegistration) {
        if (await User.exists({ email })) {
            throw createError(ACCOUNT_EXISTS_MESSAGE, 409);
        }

        throw new Error(
            "No pending registration found for this email address."
        );
    }

    /*
     * Limits are per registration rather than per IP, so the app can't be
     * used to flood one inbox from many addresses, and resending can't keep
     * a registration (with its inspection slot and images) alive forever.
     */
    const now = Date.now();
    const lastSentAt = pendingRegistration.lastCodeSentAt?.getTime() ?? 0;

    if (now - lastSentAt < RESEND_COOLDOWN_MS) {
        const seconds = Math.ceil(
            (RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000
        );

        throw createError(
            `Please wait ${seconds} second${seconds === 1 ? "" : "s"} before requesting another code.`,
            429
        );
    }

    if (
        pendingRegistration.emailVerificationToken &&
        (pendingRegistration.codesSent || 0) >= MAX_CODES_PER_REGISTRATION
    ) {
        throw createError(
            "You've requested the maximum number of codes for this registration. Please use the latest code we sent, or register again after it expires.",
            429
        );
    }

    const startedAt = (
        pendingRegistration.registrationStartedAt ||
        pendingRegistration.createdAt ||
        new Date(now)
    ).getTime();

    const nextExpiry = Math.min(
        now + EMAIL_VERIFICATION_EXPIRATION,
        startedAt + MAX_REGISTRATION_LIFETIME
    );

    if (nextExpiry - now < 5 * 60 * 1000) {
        throw createError(
            "This registration can't be extended any further. Please register again once it expires in a few minutes.",
            429
        );
    }

    const {
        rawCode,
        hashedCode,
    } = createEmailVerificationCode();

    const previousToken =
        pendingRegistration.emailVerificationToken;
    const previousExpiry =
        pendingRegistration.emailVerificationExpires;
    const previousAttempts =
        pendingRegistration.verificationAttempts;
    const previousCodesSent =
        pendingRegistration.codesSent;
    const previousLastSentAt =
        pendingRegistration.lastCodeSentAt;

    pendingRegistration.emailVerificationToken =
        hashedCode;

    pendingRegistration.emailVerificationExpires =
        new Date(nextExpiry);

    // A fresh code gets a fresh set of attempts. Replacing a code that was
    // locked by wrong guesses doesn't count toward the limit, so someone
    // who knows the email can't use lockouts to exhaust it (they can only
    // make the registrant wait out the cooldown).
    pendingRegistration.verificationAttempts = 0;
    pendingRegistration.codesSent = previousToken
        ? (previousCodesSent || 0) + 1
        : previousCodesSent || 0;
    pendingRegistration.lastCodeSentAt = new Date(now);

    try {
        await pendingRegistration.save();

        await sendVerificationEmail(
            pendingRegistration,
            rawCode
        );
    } catch (error) {
        pendingRegistration.emailVerificationToken =
            previousToken;
        pendingRegistration.emailVerificationExpires =
            previousExpiry;
        pendingRegistration.verificationAttempts =
            previousAttempts;
        pendingRegistration.codesSent = previousCodesSent;
        pendingRegistration.lastCodeSentAt = previousLastSentAt;

        try {
            await pendingRegistration.save();
        } catch (rollbackError) {
            console.error(
                "Failed to restore the previous verification code:",
                rollbackError
            );
        }

        console.error(
            "Failed to send verification email:",
            error
        );
        throw new Error(
            "Failed to send verification email. Please try again."
        );
    }

    // The registration lives on, so its images must too.
    await holdTemporaryUploadsUntil(
        pendingRegistration.temporaryUploadIds || [],
        pendingRegistration.emailVerificationExpires
    );

    return {
        email: pendingRegistration.email,
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
            middleName: user.middleName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            alternativeContact:
                user.alternativeContact,
            birthdate: user.birthdate,
            validIdType: user.validIdType,
            validIdImage: user.validIdImage,
            validIdBack: user.validIdBack,
            proofOfBillingImage: user.proofOfBillingImage,
            licenseNumber: user.licenseNumber,
            licenseExpirationDate: user.licenseExpirationDate,
            hasDriversLicense: user.hasDriversLicense,
            licenseCodes: user.licenseCodes,
            motorcycleTransmission: user.motorcycleTransmission,
            carTransmission: user.carTransmission,
            address: user.address,
            emergencyContact: user.emergencyContact,
            role: user.role,
            isVerified: isUserEffectivelyVerified(user),
            isApproved: user.isApproved,
            isSuspended: user.isSuspended,
            lastLogin: user.lastLogin,
            passwordChangedAt: user.passwordChangedAt ?? null,
            notificationPreferences: user.notificationPreferences,
        },
    };
};
