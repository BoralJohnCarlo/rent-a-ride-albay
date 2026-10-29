import mongoose from "mongoose";

const temporaryValidIdUploadSchema = new mongoose.Schema({
    publicId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    // SHA-256 of the secret half of the handle given to the uploader (see
    // temporaryValidIdUploadService). Records from before this field existed
    // have none and can only be removed by the expiry sweep.
    tokenHash: { type: String, default: "" },
});

export default mongoose.model(
    "TemporaryValidIdUpload",
    temporaryValidIdUploadSchema
);
