import mongoose from "mongoose";

import {
    LEGAL_DOCUMENT_STATUS,
    LEGAL_DOCUMENT_TYPE_VALUES,
} from "../constants/legalDocumentConstants.js";

/*
 * One version of an admin-editable legal document (Settings → Terms &
 * Policies). Per type there is at most one draft (version null) and any
 * number of published versions numbered 1, 2, 3… A published version is
 * never edited: bookings, registrations and consignments point at the one
 * that was accepted, so it has to keep saying what the person agreed to.
 */

const itemSchema = new mongoose.Schema(
    {
        // "text": the admin's own wording. "live": a booking rule written
        // from current settings (see LEGAL_LIVE_BLOCKS), never reworded.
        kind: {
            type: String,
            enum: ["text", "live"],
            default: "text",
        },

        text: {
            type: String,
            default: "",
        },

        liveKey: {
            type: String,
            default: "",
        },
    },
    { _id: false }
);

const sectionSchema = new mongoose.Schema(
    {
        // Anchor id on the page (#cancellation); unique within the document.
        key: { type: String, default: "" },
        title: { type: String, default: "" },
        icon: { type: String, default: "" },
        // See LEGAL_SECTION_CONDITIONS; "" = always shown.
        condition: { type: String, default: "" },
        items: { type: [itemSchema], default: [] },
    },
    { _id: false }
);

const legalDocumentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: LEGAL_DOCUMENT_TYPE_VALUES,
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(LEGAL_DOCUMENT_STATUS),
            required: true,
        },

        // Null on the draft.
        version: {
            type: Number,
            default: null,
        },

        title: { type: String, default: "" },
        intro: { type: String, default: "" },

        // Small label/value facts under the booking terms' heading.
        highlights: {
            type: [
                new mongoose.Schema(
                    {
                        label: { type: String, default: "" },
                        value: { type: String, default: "" },
                    },
                    { _id: false }
                ),
            ],
            default: [],
        },

        notice: {
            title: { type: String, default: "" },
            body: { type: String, default: "" },
        },

        sections: { type: [sectionSchema], default: [] },

        // The sentence next to the acceptance checkbox.
        acceptanceLabel: { type: String, default: "" },

        // What changed, shown in the version history.
        changeNote: { type: String, default: "" },

        publishedAt: { type: Date, default: null },

        publishedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
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

// Version numbers can't repeat, so two admins publishing at once can't
// both become "version 4" (the loser is asked to reload).
legalDocumentSchema.index(
    { type: 1, version: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: LEGAL_DOCUMENT_STATUS.PUBLISHED,
        },
    }
);

// One draft per document type.
legalDocumentSchema.index(
    { type: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: LEGAL_DOCUMENT_STATUS.DRAFT,
        },
    }
);

const LegalDocument = mongoose.model(
    "LegalDocument",
    legalDocumentSchema
);

export default LegalDocument;
