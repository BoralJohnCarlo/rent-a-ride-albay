import {
    Star,
    User,
} from "lucide-react";

const ReviewList = ({
    reviews = [],
    loading = false,
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    if (!reviews.length) {
        return (
            <div className="py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    No reviews yet.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <div
                    key={review._id}
                    className="
                        rounded-xl
                        border
                        border-gray-200
                        bg-white
                        p-5
                        dark:border-gray-700
                        dark:bg-gray-900
                    "
                >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                {review.customer?.profileImage ? (
                                    <img
                                        src={
                                            review.customer.profileImage
                                        }
                                        alt={
                                            review.customer.firstName
                                        }
                                        className="h-full w-full rounded-full object-cover"
                                    />
                                ) : (
                                    <User size={18} />
                                )}
                            </div>

                            <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900 dark:text-white">
                                    {review.customer?.firstName}{" "}
                                    {review.customer?.lastName}
                                </p>

                                <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map(
                                        (star) => (
                                            <Star
                                                key={star}
                                                size={14}
                                                className={
                                                    star <=
                                                        review.rating
                                                        ? "fill-yellow-400 text-yellow-400"
                                                        : "text-gray-300 dark:text-gray-600"
                                                }
                                            />
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(
                                review.createdAt
                            ).toLocaleDateString(
                                "en-PH",
                                {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                }
                            )}
                        </p>
                    </div>

                    {review.comment && (
                        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                            {review.comment}
                        </p>
                    )}

                    {review.image && (
                        <img
                            src={review.image}
                            alt="Review of the rented vehicle"
                            className="mt-3 max-h-64 rounded-xl object-cover"
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export default ReviewList;
