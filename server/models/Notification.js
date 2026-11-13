import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            trim: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        variant: {
            type: String,
            enum: [
                "info",
                "success",
                "warning",
                "error",
                "system",
                "payment",
                "document",
                "user",
                "consignment",
                "rejected",
            ],
            default: "info",
        },
        category: {
            type: String,
            required: true,
            trim: true,
            enum: [
                "User",
                "Consignment",
                "Vehicle",
                "Booking",
                "Rental",
                "Payment",
                "Payout",
                "Document",
                "System",
                "Agreement",
                "Dispute",
                "Promo",
                "Refund",
                "Review",
                "Account",
                "Support",
            ],
        },
        read: {
            type: Boolean,
            default: false,
            index: true,
        },
        dedupeKey: { type: String, maxlength: 200 },
        dismissed: { type: Boolean, default: false },
        // Saved with the notification so a crash cannot lose the enqueue intent.
        pushPending: { type: Boolean, default: false },
        pushCancelled: { type: Boolean, default: false },
        metadata: {
            reference: {
                type: String,
                trim: true,
            },
            relatedId: {
                type: mongoose.Schema.Types.ObjectId,
            },
            relatedModel: {
                type: String,
                trim: true,
            },
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ pushPending: 1, createdAt: 1 });
notificationSchema.index({ recipient: 1, dedupeKey: 1 }, {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
});

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
