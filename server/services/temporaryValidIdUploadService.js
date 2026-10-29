import crypto from "crypto";
import mongoose from "mongoose";

import TemporaryValidIdUpload from "../models/TemporaryValidIdUpload.js";
import { deleteImage } from "../utils/cloudinary.js";

const EXPIRATION_MS = 60 * 60 * 1000;

// Kept a little past the pending registration's own expiry, so a code
// entered in its last minute still finds its images.
const HOLD_GRACE_MS = 15 * 60 * 1000;

const hashToken = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");

/*
 * An upload is referred to by a handle "<recordId>.<secret>". Only the
 * uploader receives the secret, so nobody else can delete or claim the
 * image just by knowing (or guessing) its record id.
 */
const parseHandle = (handle) => {
    const [id, token] = String(handle || "").split(".");

    if (!mongoose.isValidObjectId(id) || !token) {
        return null;
    }

    return { id, tokenHash: hashToken(token) };
};

export const createTemporaryValidIdUpload = async (publicId) => {
    const token = crypto.randomBytes(24).toString("hex");

    const upload = await TemporaryValidIdUpload.create({
        publicId,
        expiresAt: new Date(Date.now() + EXPIRATION_MS),
        tokenHash: hashToken(token),
    });

    return { upload, handle: `${upload._id}.${token}` };
};

/* The live uploads the given handles prove ownership of. */
export const findUploadsByHandles = async (handles = []) => {
    const parsed = (Array.isArray(handles) ? handles : [])
        .map(parseHandle)
        .filter(Boolean);

    if (!parsed.length) {
        return [];
    }

    const uploads = await TemporaryValidIdUpload.find({
        _id: { $in: parsed.map((entry) => entry.id) },
    }).lean();

    return uploads.filter((upload) =>
        parsed.some(
            (entry) =>
                entry.id === String(upload._id) &&
                upload.tokenHash &&
                entry.tokenHash === upload.tokenHash
        )
    );
};

export const removeTemporaryValidIdUpload = async (handle) => {
    const [upload] = await findUploadsByHandles([handle]);

    if (!upload) {
        return;
    }

    await TemporaryValidIdUpload.deleteOne({ _id: upload._id });
    await deleteImage(upload.publicId);
};

/*
 * Keep uploads alive while their registration awaits email verification.
 * If it is never verified they expire with it, and the sweep below deletes
 * the images instead of leaving them in storage indefinitely.
 */
export const holdTemporaryUploadsUntil = async (ids = [], until) => {
    if (!ids.length) {
        return;
    }

    await TemporaryValidIdUpload.updateMany(
        { _id: { $in: ids } },
        { $set: { expiresAt: new Date(until.getTime() + HOLD_GRACE_MS) } }
    );
};

/* The registration was verified, so its images are kept for good. */
export const claimTemporaryValidIdUploads = async (ids = []) => {
    if (!ids.length) {
        return;
    }

    await TemporaryValidIdUpload.deleteMany({ _id: { $in: ids } });
};

export const cleanupExpiredTemporaryValidIdUploads = async () => {
    const uploads = await TemporaryValidIdUpload.find({
        expiresAt: { $lte: new Date() },
    });
    await Promise.all(uploads.map((upload) => deleteImage(upload.publicId)));
    if (uploads.length) {
        await TemporaryValidIdUpload.deleteMany({
            _id: { $in: uploads.map((upload) => upload._id) },
        });
    }
};
