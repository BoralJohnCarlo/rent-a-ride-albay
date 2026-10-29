import {
    useEffect,
    useMemo,
    useState,
} from "react";

import { Star } from "lucide-react";

import Button from "../../../components/common/Button";
import TableToolbar from "../../../components/tables/TableToolbar";
import ReviewList from "../../../components/reviews/ReviewList";

import useReview from "../../../hooks/reviews/useReview";

const ReviewManagement = () => {
    const {
        reviews = [],
        loading = false,
        error = null,
        fetchAllReviews,
    } = useReview();

    const [search, setSearch] = useState("");

    useEffect(() => {
        void fetchAllReviews();
    }, [fetchAllReviews]);

    const filteredReviews = useMemo(() => {
        const normalizedSearch =
            search.trim().toLowerCase();

        if (!normalizedSearch) {
            return reviews;
        }

        return reviews.filter((review) => {
            const customerName = [
                review.customer?.firstName,
                review.customer?.lastName,
                review.customer?.email,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const vehicleName = [
                review.vehicle?.brand,
                review.vehicle?.model,
                review.vehicle?.plateNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const driverName = [
                review.driver?.firstName,
                review.driver?.lastName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const searchableText = [
                review.rental?.bookingCode,
                customerName,
                vehicleName,
                driverName,
                review.comment,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(
                normalizedSearch
            );
        });
    }, [reviews, search]);

    const formatDate = (dateString) => {
        if (!dateString) {
            return "—";
        }

        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

return (
        <div className="mx-auto w-full max-w-[1600px]">
                <TableToolbar
                    search={search}
                    onSearch={setSearch}
                    searchPlaceholder="Search reviews..."
                    filters={
                        <Button
                            type="button"
                            variant="outline"
                            disabled
                        >
                            Filters
                        </Button>
                    }
                />

                {error && (
                    <div
                        className="
                            mb-5
                            rounded-xl
                            border
                            border-red-200
                            bg-red-50
                            px-4
                            py-3
                            text-sm
                            font-medium
                            text-red-700
                            dark:border-red-900/50
                            dark:bg-red-950/30
                            dark:text-red-400
                        "
                    >
                        {typeof error === "string"
                            ? error
                            : "Unable to load reviews."}
                    </div>
                )}

                {filteredReviews.length === 0 ? (
                    <div
                        className="
                            rounded-xl
                            border
                            border-gray-200
                            bg-white
                            px-6
                            py-12
                            text-center
                            dark:border-gray-700
                            dark:bg-gray-900
                        "
                    >
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {search
                                ? "No reviews match your search."
                                : "No reviews have been submitted yet."}
                        </p>
                    </div>
                ) : (
                    <div className="mt-6 space-y-4">
                        {filteredReviews.map(
                            (review) => (
                                <div
                                    key={
                                        review._id
                                    }
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
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {[
                                                        review
                                                            .customer
                                                            ?.firstName,
                                                        review
                                                            .customer
                                                            ?.lastName,
                                                    ]
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            " "
                                                        ) ||
                                                        review
                                                            .customer
                                                            ?.email ||
                                                        "Unknown Customer"}
                                                </h3>

                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    reviewed on{" "}
                                                    {formatDate(
                                                        review
                                                            .createdAt
                                                    )}
                                                </span>
                                            </div>

                                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                <span>
                                                    Vehicle:{" "}
                                                    {[
                                                        review
                                                            .vehicle
                                                            ?.brand,
                                                        review
                                                            .vehicle
                                                            ?.model,
                                                        review
                                                            .vehicle
                                                            ?.plateNumber,
                                                    ]
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            " "
                                                        )}
                                                </span>

                                                {review
                                                    .driver && (
                                                    <span>
                                                        • Driver:{" "}
                                                        {[
                                                            review
                                                                .driver
                                                                ?.firstName,
                                                            review
                                                                .driver
                                                                ?.lastName,
                                                        ]
                                                            .filter(
                                                                Boolean
                                                            )
                                                            .join(
                                                                " "
                                                            )}
                                                    </span>
                                                )}
                                            </div>

                                            {review.comment && (
                                                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                                    {
                                                        review.comment
                                                    }
                                                </p>
                                            )}

                                            {review.image && (
                                                <img
                                                    src={
                                                        review.image
                                                    }
                                                    alt="Review of the rented vehicle"
                                                    className="mt-3 max-h-48 rounded-xl object-cover"
                                                />
                                            )}
                                        </div>

                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map(
                                                (star) => (
                                                    <Star
                                                        key={
                                                            star
                                                        }
                                                        size={18}
                                                        className={
                                                            star <=
                                                                review
                                                                    .rating
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-gray-300 dark:text-gray-600"
                                                        }
                                                    />
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
    );
};

export default ReviewManagement;
