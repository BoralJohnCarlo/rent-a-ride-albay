import Testimonial from "../models/Testimonial.js";
import Review from "../models/Review.js";

const httpError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const EDITABLE_FIELDS = [
    "name",
    "role",
    "message",
    "rating",
    "avatar",
    "photo",
    "isActive",
    "displayOrder",
];

const pickEditable = (data = {}) =>
    Object.fromEntries(
        EDITABLE_FIELDS.filter((field) => data[field] !== undefined).map(
            (field) => [field, data[field]]
        )
    );

const SORT = { displayOrder: 1, createdAt: -1 };

export const getPublicTestimonials = async () =>
    Testimonial.find({ isActive: true })
        .select("name role message rating avatar photo")
        .sort(SORT)
        .limit(12)
        .lean();

export const getAllTestimonials = async () =>
    Testimonial.find().sort(SORT).lean();

export const createTestimonial = async (data) =>
    Testimonial.create({
        ...pickEditable(data),
        source: "manual",
        review: null,
    });

export const createTestimonialFromReview = async (reviewId) => {
    const review = await Review.findById(reviewId).populate(
        "customer",
        "firstName lastName profileImage"
    );

    if (!review) {
        throw httpError("Review not found.", 404);
    }

    if (!review.comment?.trim()) {
        throw httpError(
            "This review has no comment to use as a testimonial.",
            400
        );
    }

    const existing = await Testimonial.exists({ review: review._id });

    if (existing) {
        throw httpError(
            "This review is already a testimonial.",
            409
        );
    }

    const firstName = review.customer?.firstName?.trim() ?? "";
    const lastInitial = review.customer?.lastName?.trim()?.charAt(0);

    const name =
        [firstName, lastInitial ? `${lastInitial}.` : ""]
            .filter(Boolean)
            .join(" ") || "Verified Customer";

    return Testimonial.create({
        name,
        role: "Verified Customer",
        message: review.comment.trim(),
        rating: review.rating,
        avatar: review.customer?.profileImage || "",
        photo: review.image || "",
        source: "review",
        review: review._id,
    });
};

export const updateTestimonial = async (id, data) => {
    const testimonial = await Testimonial.findByIdAndUpdate(
        id,
        { $set: pickEditable(data) },
        { new: true, runValidators: true }
    );

    if (!testimonial) {
        throw httpError("Testimonial not found.", 404);
    }

    return testimonial;
};

export const deleteTestimonial = async (id) => {
    const testimonial = await Testimonial.findByIdAndDelete(id);

    if (!testimonial) {
        throw httpError("Testimonial not found.", 404);
    }

    return testimonial;
};
