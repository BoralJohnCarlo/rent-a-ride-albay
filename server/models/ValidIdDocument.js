import mongoose from "mongoose";

/*
 * One valid ID a user has had on file. The User document only holds the
 * current one (validIdType / validIdImage / validIdBack), so every time it
 * changes - at registration, a profile edit, or a renewal upload - the new
 * ID is recorded here and the previous record is closed (isCurrent false,
 * replacedAt set).
 * That gives admins the full history of a customer's or partner's IDs.
 *
 * Old images are never deleted from Cloudinary when an ID is replaced, so a
 * past record's image links keep working.
 *
 * Sources:
 *   registration   - uploaded when the account was created
 *   profile_update - changed from the profile page
 *   renewal        - uploaded through "Renew valid ID"
 *   on_file        - the ID an account already had before this history was
 *                    kept; its upload date is unknown
 */
export const VALID_ID_DOCUMENT_SOURCE = Object.freeze({
    REGISTRATION: "registration",
    PROFILE_UPDATE: "profile_update",
    RENEWAL: "renewal",
    ON_FILE: "on_file",
});

const validIdDocumentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        validIdType: {
            type: String,
            default: "",
            trim: true,
        },

        frontImage: {
            type: String,
            default: "",
            trim: true,
        },

        backImage: {
            type: String,
            default: "",
            trim: true,
        },

        source: {
            type: String,
            enum: Object.values(VALID_ID_DOCUMENT_SOURCE),
            required: true,
        },

        // null only for "on_file" records, whose upload date is unknown.
        uploadedAt: {
            type: Date,
            default: null,
        },

        // The user's ID on file right now; false once it's been replaced.
        isCurrent: {
            type: Boolean,
            default: true,
        },

        replacedAt: {
            type: Date,
            default: null,
        },

        // The expiry date the platform held for this ID while it was current.
        expirationDate: {
            type: Date,
            default: null,
        },

        // The last time an admin verified this ID while it was current.
        verifiedAt: {
            type: Date,
            default: null,
        },

        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

validIdDocumentSchema.index({ user: 1, createdAt: -1 });

// At most one current ID per user.
validIdDocumentSchema.index(
    { user: 1 },
    {
        unique: true,
        partialFilterExpression: { isCurrent: true },
        name: "one_current_valid_id_per_user",
    }
);

const ValidIdDocument = mongoose.model(
    "ValidIdDocument",
    validIdDocumentSchema
);

export default ValidIdDocument;
