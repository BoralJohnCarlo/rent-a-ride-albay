import mongoose from "mongoose";

const blacklistSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },

        blacklistedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        blacklistedAt: {
            type: Date,
            default: Date.now,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

blacklistSchema.index({
    user: 1,
    isActive: 1,
});

const Blacklist = mongoose.model(
    "Blacklist",
    blacklistSchema
);

export default Blacklist;