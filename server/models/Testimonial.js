import mongoose from "mongoose";

/*
 * Homepage testimonials, curated by admins. Either written by hand
 * ("manual") or copied from a customer's booking review ("review") —
 * copied rather than referenced live, so admins can trim/edit the text
 * and the testimonial survives the review or profile image changing.
 */
const testimonialSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },

        role: {
            type: String,
            default: "Customer",
            trim: true,
            maxlength: 60,
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },

        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: 5,
        },

        // Person's photo (avatar). Empty → initials are shown.
        avatar: {
            type: String,
            default: "",
        },

        // Optional extra image (e.g. trip photo).
        photo: {
            type: String,
            default: "",
        },

        source: {
            type: String,
            enum: ["manual", "review"],
            default: "manual",
        },

        review: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review",
            default: null,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        displayOrder: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// One testimonial per review; manual ones have review: null.
testimonialSchema.index(
    { review: 1 },
    {
        unique: true,
        partialFilterExpression: {
            review: { $type: "objectId" },
        },
    }
);

testimonialSchema.index({ isActive: 1, displayOrder: 1, createdAt: -1 });

const Testimonial = mongoose.model("Testimonial", testimonialSchema);

export default Testimonial;
