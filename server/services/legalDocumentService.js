import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import LegalDocument from "../models/LegalDocument.js";

import DEFAULT_LEGAL_DOCUMENTS from "../data/defaultLegalDocuments.js";
import {
    LEGAL_ACCEPTANCE_GRACE_MINUTES,
    LEGAL_DOCUMENT_STATUS,
    LEGAL_DOCUMENT_TYPES,
    LEGAL_DOCUMENT_TYPE_VALUES,
    LEGAL_LIMITS,
    LEGAL_LIVE_BLOCKS,
    LEGAL_SECTION_CONDITIONS,
    LEGAL_SECTION_ICONS,
    TERMS_OUTDATED_MESSAGE,
} from "../constants/legalDocumentConstants.js";
import {
    resolveBookingHours,
    resolvePickupHours,
} from "../utils/bookingHours.js";

const { DRAFT, PUBLISHED } = LEGAL_DOCUMENT_STATUS;

const httpError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const isDuplicateKeyError = (error) => error?.code === 11000;

export const assertLegalDocumentType = (type) => {
    if (!LEGAL_DOCUMENT_TYPE_VALUES.includes(type)) {
        throw httpError("Unknown document.", 404);
    }
};

/* -------------------------------------------------------------------------- */
/*                               Content checks                               */
/* -------------------------------------------------------------------------- */

const cleanText = (value, max, label) => {
    const text = typeof value === "string" ? value.trim() : "";

    if (text.length > max) {
        throw httpError(`${label} can be at most ${max} characters.`);
    }

    return text;
};

const slugify = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);

/*
 * The editable content of a document, checked and trimmed. Drafts may be
 * unfinished (empty titles or bullets); `strict` (publishing) requires a
 * complete document.
 */
export const sanitizeLegalContent = (type, input, { strict = false } = {}) => {
    assertLegalDocumentType(type);

    const raw = input && typeof input === "object" ? input : {};

    const allowsLiveBlocks = type === LEGAL_DOCUMENT_TYPES.BOOKING_TERMS;
    const needsAcceptance = type !== LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE;

    const title = cleanText(raw.title, LEGAL_LIMITS.titleLength, "The title");
    const intro = cleanText(raw.intro, LEGAL_LIMITS.introLength, "The introduction");
    const acceptanceLabel = needsAcceptance
        ? cleanText(
              raw.acceptanceLabel,
              LEGAL_LIMITS.acceptanceLength,
              "The acceptance statement"
          )
        : "";

    const notice = {
        title: cleanText(
            raw.notice?.title,
            LEGAL_LIMITS.noticeTitleLength,
            "The notice title"
        ),
        body: cleanText(
            raw.notice?.body,
            LEGAL_LIMITS.noticeBodyLength,
            "The notice text"
        ),
    };

    const rawHighlights = Array.isArray(raw.highlights) ? raw.highlights : [];

    if (rawHighlights.length > LEGAL_LIMITS.highlights) {
        throw httpError(
            `Up to ${LEGAL_LIMITS.highlights} highlights can be shown.`
        );
    }

    const highlights = rawHighlights
        .map((highlight) => ({
            label: cleanText(
                highlight?.label,
                LEGAL_LIMITS.highlightLength,
                "A highlight label"
            ),
            value: cleanText(
                highlight?.value,
                LEGAL_LIMITS.highlightLength,
                "A highlight value"
            ),
        }))
        .filter((highlight) => !strict || highlight.label || highlight.value);

    if (strict && highlights.some((h) => !h.label || !h.value)) {
        throw httpError("Each highlight needs both a label and a value.");
    }

    const rawSections = Array.isArray(raw.sections) ? raw.sections : [];

    if (rawSections.length > LEGAL_LIMITS.sections) {
        throw httpError(
            `A document can have at most ${LEGAL_LIMITS.sections} sections.`
        );
    }

    const usedKeys = new Set();

    const sections = rawSections.map((rawSection, sectionIndex) => {
        const sectionTitle = cleanText(
            rawSection?.title,
            LEGAL_LIMITS.sectionTitleLength,
            "A section title"
        );
        const label = sectionTitle
            ? `"${sectionTitle}"`
            : `Section ${sectionIndex + 1}`;

        const icon = typeof rawSection?.icon === "string" ? rawSection.icon : "";

        if (!LEGAL_SECTION_ICONS.includes(icon)) {
            throw httpError(`${label} has an unknown icon.`);
        }

        const condition =
            typeof rawSection?.condition === "string"
                ? rawSection.condition
                : "";

        if (
            !LEGAL_SECTION_CONDITIONS.includes(condition) ||
            (condition && !allowsLiveBlocks)
        ) {
            throw httpError(`${label} has an unknown display condition.`);
        }

        // A stable, unique anchor: kept from the client, else from the title.
        const baseKey =
            slugify(rawSection?.key) ||
            slugify(sectionTitle) ||
            `section-${sectionIndex + 1}`;
        let key = baseKey;

        for (let n = 2; usedKeys.has(key); n += 1) {
            key = `${baseKey}-${n}`;
        }

        usedKeys.add(key);

        const rawItems = Array.isArray(rawSection?.items) ? rawSection.items : [];

        if (rawItems.length > LEGAL_LIMITS.items) {
            throw httpError(
                `${label} can have at most ${LEGAL_LIMITS.items} points.`
            );
        }

        const items = rawItems.map((rawItem) => {
            if (rawItem?.kind === "live") {
                if (!allowsLiveBlocks) {
                    throw httpError(
                        "Live policy blocks can only be used in the booking Terms & Conditions."
                    );
                }

                if (!LEGAL_LIVE_BLOCKS.includes(rawItem.liveKey)) {
                    throw httpError(`${label} has an unknown live block.`);
                }

                return { kind: "live", text: "", liveKey: rawItem.liveKey };
            }

            return {
                kind: "text",
                text: cleanText(
                    rawItem?.text,
                    LEGAL_LIMITS.itemLength,
                    `A point in ${label}`
                ),
                liveKey: "",
            };
        });

        if (strict) {
            if (!sectionTitle) {
                throw httpError(`Section ${sectionIndex + 1} needs a title.`);
            }

            if (items.length === 0) {
                throw httpError(`${label} needs at least one point.`);
            }

            if (items.some((item) => item.kind === "text" && !item.text)) {
                throw httpError(
                    `${label} has an empty point. Fill it in or remove it.`
                );
            }
        }

        return { key, title: sectionTitle, icon, condition, items };
    });

    if (strict) {
        if (!title) {
            throw httpError("The document needs a title.");
        }

        if (sections.length === 0) {
            throw httpError("The document needs at least one section.");
        }

        if (needsAcceptance && !acceptanceLabel) {
            throw httpError(
                "The acceptance statement (shown next to the checkbox) is required."
            );
        }
    }

    return {
        title,
        intro,
        highlights,
        notice,
        sections,
        acceptanceLabel,
    };
};

/* -------------------------------------------------------------------------- */
/*                                  Reading                                   */
/* -------------------------------------------------------------------------- */

const PUBLIC_FIELDS =
    "type version title intro highlights notice sections acceptanceLabel changeNote publishedAt";

const latestPublished = (type) =>
    LegalDocument.findOne({ type, status: PUBLISHED })
        .sort({ version: -1 })
        .select(PUBLIC_FIELDS)
        .lean();

/*
 * The first read of a type publishes its built-in wording as version 1. The
 * unique (type, version) index lets only one of two simultaneous first
 * reads create it.
 */
const ensureFirstVersion = async (type) => {
    try {
        await LegalDocument.create({
            type,
            status: PUBLISHED,
            version: 1,
            ...DEFAULT_LEGAL_DOCUMENTS[type],
            changeNote: "Initial version.",
            publishedAt: new Date(),
        });
    } catch (error) {
        if (!isDuplicateKeyError(error)) {
            throw error;
        }
    }
};

export const getCurrentLegalDocument = async (type) => {
    assertLegalDocumentType(type);

    const current = await latestPublished(type);

    if (current) {
        return current;
    }

    await ensureFirstVersion(type);

    return latestPublished(type);
};

export const getPublishedLegalDocumentById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw httpError("Document version not found.", 404);
    }

    const document = await LegalDocument.findOne({
        _id: id,
        status: PUBLISHED,
    })
        .select(PUBLIC_FIELDS)
        .lean();

    if (!document) {
        throw httpError("Document version not found.", 404);
    }

    return document;
};

/* What the admin editor needs: the live version, the draft and the history. */
export const getLegalDocumentAdminView = async (type) => {
    const current = await getCurrentLegalDocument(type);

    const [draft, history] = await Promise.all([
        LegalDocument.findOne({ type, status: DRAFT })
            .populate("updatedBy", "firstName lastName")
            .lean(),
        LegalDocument.find({ type, status: PUBLISHED })
            .sort({ version: -1 })
            .select("version changeNote publishedAt publishedBy")
            .populate("publishedBy", "firstName lastName")
            .lean(),
    ]);

    // How many bookings accepted each booking-terms version.
    let acceptedCounts = {};

    if (type === LEGAL_DOCUMENT_TYPES.BOOKING_TERMS) {
        const counts = await Booking.aggregate([
            { $match: { "termsAcceptance.document": { $ne: null } } },
            {
                $group: {
                    _id: "$termsAcceptance.document",
                    count: { $sum: 1 },
                },
            },
        ]);

        acceptedCounts = Object.fromEntries(
            counts.map((row) => [String(row._id), row.count])
        );
    }

    return {
        current,
        draft,
        history: history.map((version) => ({
            ...version,
            acceptedBookings: acceptedCounts[String(version._id)] ?? null,
        })),
    };
};

/* -------------------------------------------------------------------------- */
/*                                  Editing                                   */
/* -------------------------------------------------------------------------- */

/*
 * Drafts are shared between admins. The editor sends when the draft it
 * started from was last saved (`baseUpdatedAt`; null when there was none),
 * so one admin can't silently overwrite, discard or (by publishing) delete
 * a draft another admin saved meanwhile. Leaving it out (undefined) skips
 * the check.
 */
const DRAFT_CHANGED_MESSAGE =
    "Another admin changed this draft after you opened it. Copy anything you want to keep, then reload the page to see their version.";

const parseDraftStamp = (value) => {
    if (value === null || value === "") {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw httpError("Invalid draft timestamp.");
    }

    return date;
};

const findDraftView = (filter) =>
    LegalDocument.findOne(filter)
        .populate("updatedBy", "firstName lastName")
        .lean();

export const saveLegalDocumentDraft = async (
    type,
    content,
    userId,
    { baseUpdatedAt } = {}
) => {
    const sanitized = sanitizeLegalContent(type, content);
    const changes = { ...sanitized, updatedBy: userId || null };

    if (baseUpdatedAt === undefined) {
        const save = () =>
            LegalDocument.findOneAndUpdate(
                { type, status: DRAFT },
                {
                    $set: changes,
                    $setOnInsert: { type, status: DRAFT, version: null },
                },
                { upsert: true, returnDocument: "after", runValidators: true }
            )
                .populate("updatedBy", "firstName lastName")
                .lean();

        try {
            return await save();
        } catch (error) {
            // Two first saves at once: the other one created it; update it.
            if (isDuplicateKeyError(error)) {
                return save();
            }

            throw error;
        }
    }

    const base = parseDraftStamp(baseUpdatedAt);

    if (base) {
        // Only the draft as this editor last saw it.
        const updated = await LegalDocument.findOneAndUpdate(
            { type, status: DRAFT, updatedAt: base },
            { $set: changes },
            { returnDocument: "after", runValidators: true }
        )
            .populate("updatedBy", "firstName lastName")
            .lean();

        if (updated) {
            return updated;
        }

        if (await LegalDocument.exists({ type, status: DRAFT })) {
            throw httpError(DRAFT_CHANGED_MESSAGE, 409);
        }

        // Published or discarded elsewhere meanwhile: start a new draft.
    }

    try {
        const created = await LegalDocument.create({
            type,
            status: DRAFT,
            version: null,
            ...changes,
        });

        return findDraftView({ _id: created._id });
    } catch (error) {
        // Someone else started a draft after this editor loaded.
        if (isDuplicateKeyError(error)) {
            throw httpError(DRAFT_CHANGED_MESSAGE, 409);
        }

        throw error;
    }
};

export const discardLegalDocumentDraft = async (
    type,
    { baseUpdatedAt } = {}
) => {
    assertLegalDocumentType(type);

    if (baseUpdatedAt === undefined) {
        await LegalDocument.deleteOne({ type, status: DRAFT });
        return;
    }

    const base = parseDraftStamp(baseUpdatedAt);

    const { deletedCount } = base
        ? await LegalDocument.deleteOne({
              type,
              status: DRAFT,
              updatedAt: base,
          })
        : { deletedCount: 0 };

    if (
        deletedCount === 0 &&
        (await LegalDocument.exists({ type, status: DRAFT }))
    ) {
        throw httpError(DRAFT_CHANGED_MESSAGE, 409);
    }
};

/*
 * Publishes `content` as the next version and clears the draft it came
 * from — only that one (`baseDraftUpdatedAt`, see saveLegalDocumentDraft):
 * a draft another admin saved meanwhile is kept. Earlier versions are left
 * exactly as they were, so whatever accepted them keeps pointing at the
 * wording that was agreed to.
 */
export const publishLegalDocument = async (
    type,
    content,
    { changeNote = "", userId = null, baseDraftUpdatedAt, baseVersion } = {}
) => {
    const sanitized = sanitizeLegalContent(type, content, { strict: true });
    const draftBase =
        baseDraftUpdatedAt === undefined
            ? undefined
            : parseDraftStamp(baseDraftUpdatedAt);
    const note = cleanText(
        changeNote,
        LEGAL_LIMITS.changeNoteLength,
        "The change note"
    );

    const current = await getCurrentLegalDocument(type);

    /*
     * The editor sends the live version it was looking at (and compared
     * against). If another admin published since, publishing now would
     * silently replace their wording, so stop and let them review it.
     */
    if (
        baseVersion !== undefined &&
        baseVersion !== null &&
        Number(baseVersion) !== current.version
    ) {
        throw httpError(
            `Version ${current.version} was published after you opened this page. Copy anything you want to keep, then reload to review it before publishing.`,
            409
        );
    }

    let published;

    try {
        published = await LegalDocument.create({
            type,
            status: PUBLISHED,
            version: (current?.version ?? 0) + 1,
            ...sanitized,
            changeNote: note,
            publishedAt: new Date(),
            publishedBy: userId,
            updatedBy: userId,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            throw httpError(
                "Another version was published just now. Reload the page to see it before publishing again.",
                409
            );
        }

        throw error;
    }

    if (draftBase === undefined) {
        await LegalDocument.deleteOne({ type, status: DRAFT });
    } else if (draftBase) {
        await LegalDocument.deleteOne({
            type,
            status: DRAFT,
            updatedAt: draftBase,
        });
    }

    return getPublishedLegalDocumentById(published._id);
};

/* -------------------------------------------------------------------------- */
/*                                 Accepting                                  */
/* -------------------------------------------------------------------------- */

/*
 * The version someone accepted, recorded as { document, version }. They
 * accept the version they were shown (`versionId`): if a newer one went live
 * since, theirs still counts for LEGAL_ACCEPTANCE_GRACE_MINUTES after that,
 * then they're asked to review the new one. Without an id (older clients,
 * admin paths), the current version is recorded.
 */
export const resolveAcceptedLegalVersion = async (
    type,
    versionId,
    { now = new Date(), outdatedMessage = TERMS_OUTDATED_MESSAGE } = {}
) => {
    assertLegalDocumentType(type);

    if (!versionId) {
        const current = await getCurrentLegalDocument(type);

        return { document: current._id, version: current.version };
    }

    const accepted = mongoose.Types.ObjectId.isValid(versionId)
        ? await LegalDocument.findOne({
              _id: versionId,
              type,
              status: PUBLISHED,
          })
              .select("version")
              .lean()
        : null;

    if (!accepted) {
        throw httpError(
            "The terms you accepted couldn't be found. Please reload the page and accept them again.",
            400
        );
    }

    const newer = await LegalDocument.findOne({
        type,
        status: PUBLISHED,
        version: { $gt: accepted.version },
    })
        .sort({ version: 1 })
        .select("publishedAt")
        .lean();

    if (
        newer &&
        now.getTime() - new Date(newer.publishedAt).getTime() >
            LEGAL_ACCEPTANCE_GRACE_MINUTES * 60 * 1000
    ) {
        throw httpError(outdatedMessage, 409);
    }

    return { document: accepted._id, version: accepted.version };
};

/*
 * The settings the booking terms' live blocks are written from. The public
 * settings endpoint serves these, and each booking keeps a copy from when
 * it was made, so the terms it agreed to can be shown exactly as they read
 * then even after the settings change.
 */
export const buildTermsPolicySnapshot = (settings) => ({
    cancellationPolicy: settings?.refundSettings?.cancellationPolicy,
    requireCancellationReason:
        settings?.refundSettings?.requireCancellationReason ?? true,
    refundRequestWindowHours:
        settings?.refundSettings?.gracePeriodHours ?? 24,
    noShowGraceHours: settings?.refundSettings?.noShowGraceHours,
    noShowRefundPercent:
        settings?.refundSettings?.noShowRefundPercent ?? 0,
    noShowKeepsDistanceFee:
        settings?.refundSettings?.noShowKeepsDistanceFee !== false,
    noShowAutoMark: settings?.refundSettings?.noShowAutoMark !== false,
    latePenalty: {
        gracePeriodMinutes:
            settings?.penaltySettings?.gracePeriodMinutes ?? 0,
        chargingUnit: settings?.penaltySettings?.chargingUnit || "Hour",
        maximumCap: settings?.penaltySettings?.maximumCap ?? 0,
    },
    earlyReturn: {
        enabled: settings?.earlyReturnSettings?.enabled ?? true,
        autoApprove: settings?.earlyReturnSettings?.autoApprove ?? false,
        minUnusedDaysToQualify:
            settings?.earlyReturnSettings?.minUnusedDaysToQualify ?? 1,
        voucherValidityMonths:
            settings?.earlyReturnSettings?.voucherValidityMonths ?? 12,
    },
    turnaroundBufferMinutes:
        settings?.bookingSettings?.turnaroundBufferMinutes,
    bookingHours: resolveBookingHours(settings?.bookingSettings?.bookingHours),
    pickupHours: resolvePickupHours(settings?.bookingSettings?.pickupHours),
});

/* What a booking stores about the terms its customer accepted. */
export const buildBookingTermsAcceptance = async (
    versionId,
    settings,
    { now = new Date() } = {}
) => {
    const accepted = await resolveAcceptedLegalVersion(
        LEGAL_DOCUMENT_TYPES.BOOKING_TERMS,
        versionId,
        { now }
    );

    const snapshot = buildTermsPolicySnapshot(settings);

    /*
     * Also how the late-return rate is worked out, which the public
     * settings leave out: the booking's late charge is locked to these too
     * (lockedTermsService).
     */
    snapshot.latePenalty = {
        ...snapshot.latePenalty,
        rateType: settings?.penaltySettings?.rateType || "derived",
        customRate: Number(settings?.penaltySettings?.customRate) || 0,
        rateMultiplier: Number(settings?.penaltySettings?.rateMultiplier) || 1,
    };

    return {
        ...accepted,
        acceptedAt: now,
        // Plain JSON: it's stored as-is and read back by the client.
        policySnapshot: JSON.parse(JSON.stringify(snapshot)),
    };
};
