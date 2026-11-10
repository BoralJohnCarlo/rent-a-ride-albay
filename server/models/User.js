import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { assertPasswordByteLimit } from "../utils/passwordPolicy.js";

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
            minlength: 8,
            select: false,
        },

        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },

        alternativeContact: {
            type: String,
            default: "",
            trim: true,
        },

        profileImage: {
            type: String,
            default: "",
        },

        role: {
            type: String,
            enum: ["admin", "customer", "operator"],
            default: "customer",
        },

        isVerified: {
            type: Boolean,
            default: false,
        },

        // When the user accepted the Terms and Conditions / Privacy Notice
        // at registration (null for accounts created before it was asked).
        termsAcceptedAt: {
            type: Date,
            default: null,
        },

        // Which Terms & Conditions version that was (null before versions
        // were recorded).
        termsDocument: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LegalDocument",
            default: null,
        },

        termsVersion: {
            type: Number,
            default: null,
        },

        emailVerificationToken: {
    type: String,
    default: null,
    select: false,
},

emailVerificationExpires: { 
    type: Date,
    default: null,
    select: false,
},

        isApproved: {
            type: Boolean,
            default: true,
        },

        isSuspended: {
            type: Boolean,
            default: false,
        },

        lastLogin: {
            type: Date,
        },

        loginAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },

        lockoutUntil: {
            type: Date,
            default: null,
        },

        address: {
            houseUnitLot: {
                type: String,
                default: "",
            },
            region: {
                type: String,
                default: "",
            },
            province: {
                type: String,
                default: "",
            },
            city: {
                type: String,
                default: "",
            },
            barangay: {
                type: String,
                default: "",
            },
            street: {
                type: String,
                default: "",
            },
            postalCode: {
                type: String,
                default: "",
            },
        },

        emergencyContact: {
            name: {
                type: String,
                default: "",
            },

            relationship: {
                type: String,
                default: "",
            },

            phoneNumber: {
                type: String,
                default: "",
            },
        },

        uploadedDocuments: {
            governmentId: {
                type: String,
                default: "",
            },

            driversLicense: {
                type: String,
                default: "",
            },

            selfieVerification: {
                type: String,
                default: "",
            },
        },

        middleName: {
            type: String,
            default: "",
            trim: true,
        },

        birthdate: {
            type: Date,
            default: null,
        },

        validIdType: {
            type: String,
            default: "",
            trim: true,
        },

        validIdImage: {
            type: String,
            default: "",
            trim: true,
        },

        validIdBack: {
            type: String,
            default: "",
            trim: true,
        },

        /*
         * A utility bill or similar showing the user's address. Only asked
         * for while Settings.registrationSettings.proofOfBillingEnabled is
         * on, and never required for booking - accounts made while it was
         * off (or before it existed) simply have none.
         */
        proofOfBillingImage: {
            type: String,
            default: "",
            trim: true,
        },

        licenseNumber: {
            type: String,
            default: "",
            trim: true,
        },

        licenseExpirationDate: {
            type: Date,
            default: null,
        },

        /*
         * null = not yet answered (every pre-existing account, and never
         * blocked — same profile-completeness carve-out already used
         * elsewhere in this file's license logic). Only an explicit
         * `false` restricts the customer to "With Driver" bookings; new
         * registrations are required to answer one way or the other.
         */
        hasDriversLicense: {
            type: Boolean,
            default: null,
        },

        licenseCodes: [{
            type: String,
            default: "",
            trim: true,
        }],

        motorcycleTransmission: [{
            type: String,
            default: "",
            trim: true,
        }],

        carTransmission: [{
            type: String,
            default: "",
            trim: true,
        }],

        validIdRenewalCount: {
            type: Number,
            default: 0,
        },

        lastValidIdRenewalAt: {
            type: Date,
            default: null,
        },
        validIdRenewalPeriodStartedAt: {
            type: Date,
            default: null,
        },

        validIdExpirationDate: {
            type: Date,
            default: null,
        },
        // Null means an administrator has not recorded a choice for this ID yet.
        validIdHasExpiration: { type: Boolean, default: null },

        // Records password changes for security notices and legacy sessions.
        // credentialVersion invalidates current sessions without clock rounding.
        passwordChangedAt: {
            type: Date,
            default: null,
        },
        credentialVersion: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
         * Forgot-password flow (services/passwordResetService.js): a hashed
         * 6-digit email code, then - once the code checks out - a hashed
         * one-time token that authorizes setting the new password.
         */
        passwordResetCode: {
            type: String,
            default: null,
            select: false,
        },

        passwordResetExpires: {
            type: Date,
            default: null,
            select: false,
        },

        passwordResetAttempts: {
            type: Number,
            default: 0,
            select: false,
        },

        passwordResetSentAt: {
            type: Date,
            default: null,
            select: false,
        },

        passwordResetToken: {
            type: String,
            default: null,
            select: false,
        },

        passwordResetTokenExpires: {
            type: Date,
            default: null,
            select: false,
        },

        // Per-account, so the choice follows the user to every device.
        notificationPreferences: {
            soundVolume: {
                type: Number,
                default: 50,
                min: 0,
                max: 100,
            },
            soundMuted: {
                type: Boolean,
                default: false,
            },
        },

    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function () {
    // Only registration may explicitly supply an already-hashed password.
    // Consume this document-local marker so future edits always get hashed.
    const registrationPasswordHash = this.$locals.registrationPasswordHash;
    delete this.$locals.registrationPasswordHash;

    if (!this.isModified("password")) {
        return;
    }

    assertPasswordByteLimit(this.password);

    if (!this.isNew) {
        this.passwordChangedAt = new Date();
        this.credentialVersion = (this.credentialVersion ?? 0) + 1;
    }

    if (
        this.isNew &&
        registrationPasswordHash === this.password &&
        /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(registrationPasswordHash)
    ) {
        return;
    }

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (password) {
    return bcrypt.compare(password, this.password);
};

// Versions invalidate prior sessions even within the same JWT second.
// Legacy tokens retain the date check until the first versioned change.
userSchema.methods.isTokenStale = function (tokenIssuedAt, tokenCredentialVersion) {
    const version = this.credentialVersion ?? 0;
    if (tokenCredentialVersion !== undefined) {
        if (!Number.isSafeInteger(tokenCredentialVersion) || tokenCredentialVersion !== version) {
            return true;
        }
        if (version > 0) return false;
    } else if (version > 0) {
        return true;
    }
    if (!this.passwordChangedAt) {
        return false;
    }

    return !Number.isFinite(tokenIssuedAt) || tokenIssuedAt * 1000 < this.passwordChangedAt.getTime();
};

const User = mongoose.model("User", userSchema);

export default User;
