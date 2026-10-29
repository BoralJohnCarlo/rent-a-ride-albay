import User from "../models/User.js";
import ValidIdDocument, {
    VALID_ID_DOCUMENT_SOURCE,
} from "../models/ValidIdDocument.js";
import createError from "../utils/createError.js";

/*
 * Keeps the ValidIdDocument history in step with the valid ID on a User
 * (see the model for what it records). Callers pass the user AFTER saving
 * the new ID, plus a snapshot of the ID it replaced.
 */

export const snapshotValidId = (user) => ({
    validIdType: user.validIdType || "",
    frontImage: user.validIdImage || "",
    backImage: user.validIdBack || "",
    expirationDate: user.validIdExpirationDate || null,
});

const hasImage = (snapshot) =>
    Boolean(snapshot?.frontImage || snapshot?.backImage);

const isDuplicateKeyError = (error) => error?.code === 11000;

/*
 * Records `user`'s current valid ID as a new document and closes the one it
 * replaced. An account from before this history was kept has no record of
 * its previous ID, so that ID (from `previous`) is saved as a past "on_file"
 * document instead of being lost.
 */
export const recordValidIdUpload = async (
    user,
    { previous = null, source }
) => {
    const now = new Date();

    const closed = await ValidIdDocument.updateMany(
        { user: user._id, isCurrent: true },
        { $set: { isCurrent: false, replacedAt: now } }
    );

    if (closed.matchedCount === 0 && hasImage(previous)) {
        await ValidIdDocument.create({
            user: user._id,
            ...previous,
            source: VALID_ID_DOCUMENT_SOURCE.ON_FILE,
            uploadedAt: null,
            isCurrent: false,
            replacedAt: now,
        });
    }

    const current = snapshotValidId(user);

    if (!hasImage(current)) {
        return null;
    }

    try {
        return await ValidIdDocument.create({
            user: user._id,
            ...current,
            source,
            uploadedAt: now,
            isCurrent: true,
        });
    } catch (error) {
        // A simultaneous upload recorded its own current ID first.
        if (isDuplicateKeyError(error)) {
            return null;
        }

        throw error;
    }
};

/*
 * The current ValidIdDocument for `user`, created as an "on_file" record
 * when the account predates this history.
 */
const ensureCurrentRecord = async (user) => {
    const existing = await ValidIdDocument.findOne({
        user: user._id,
        isCurrent: true,
    });

    if (existing) {
        return existing;
    }

    const current = snapshotValidId(user);

    if (!hasImage(current)) {
        return null;
    }

    try {
        return await ValidIdDocument.create({
            user: user._id,
            ...current,
            source: VALID_ID_DOCUMENT_SOURCE.ON_FILE,
            uploadedAt: null,
            isCurrent: true,
        });
    } catch (error) {
        if (isDuplicateKeyError(error)) {
            return ValidIdDocument.findOne({
                user: user._id,
                isCurrent: true,
            });
        }

        throw error;
    }
};

// Stamps the admin's verification (and the expiry they confirmed) on the
// user's current ID record.
export const markCurrentValidIdVerified = async (user, adminId) => {
    const record = await ensureCurrentRecord(user);

    if (!record) {
        return null;
    }

    record.verifiedAt = new Date();
    record.verifiedBy = adminId || null;
    record.expirationDate = user.validIdExpirationDate || null;

    await record.save();

    return record;
};

const formatAdmin = (admin) =>
    admin
        ? {
              id: admin._id,
              name: `${admin.firstName ?? ""} ${admin.lastName ?? ""}`.trim(),
          }
        : null;

const formatRecord = (record) => ({
    id: record._id,
    validIdType: record.validIdType,
    frontImage: record.frontImage,
    backImage: record.backImage,
    source: record.source,
    uploadedAt: record.uploadedAt,
    replacedAt: record.replacedAt,
    expirationDate: record.expirationDate,
    verifiedAt: record.verifiedAt,
    verifiedBy: formatAdmin(record.verifiedBy),
    isCurrent: Boolean(record.isCurrent),
});

/*
 * Every valid ID the user has had, current one first, then past ones newest
 * first. A pre-history account with no records still gets its current ID
 * listed (as "on_file"); nothing is written for a read.
 */
export const getValidIdHistory = async (userId) => {
    const user = await User.findById(userId).select(
        "validIdType validIdImage validIdBack validIdExpirationDate isVerified"
    );

    if (!user) {
        throw createError("User not found.", 404);
    }

    const records = await ValidIdDocument.find({ user: user._id })
        .sort({ createdAt: -1 })
        .populate("verifiedBy", "firstName lastName")
        .lean();

    const documents = records.map(formatRecord);
    const current = documents.find((record) => record.isCurrent);

    if (current) {
        // The User is the source of truth for the live expiry date.
        current.expirationDate = user.validIdExpirationDate || null;
    } else if (hasImage(snapshotValidId(user))) {
        documents.unshift({
            id: null,
            ...snapshotValidId(user),
            source: VALID_ID_DOCUMENT_SOURCE.ON_FILE,
            uploadedAt: null,
            replacedAt: null,
            verifiedAt: null,
            verifiedBy: null,
            isCurrent: true,
        });
    }

    documents.sort(
        (a, b) => Number(b.isCurrent) - Number(a.isCurrent)
    );

    return documents;
};
