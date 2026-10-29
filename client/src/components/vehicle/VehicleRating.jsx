import { Star } from "lucide-react";

/*
 * Star rating for vehicle cards and list rows, from the `rating` summary the
 * vehicle list / favorites endpoints attach ({ averageRating, reviewCount }).
 * Renders nothing when the vehicle came without rating data, so it's safe to
 * drop into any card regardless of where its vehicles were fetched.
 */
const SIZES = {
    sm: {
        text: "text-[11px]",
        icon: 12,
    },
    md: {
        text: "text-xs",
        icon: 13,
    },
};

const VehicleRating = ({
    rating,
    size = "sm",
    className = "",
}) => {
    if (!rating) {
        return null;
    }

    const { text, icon } = SIZES[size] ?? SIZES.sm;

    const reviewCount = Number(rating.reviewCount) || 0;
    const averageRating = Number(rating.averageRating) || 0;

    if (reviewCount === 0) {
        return (
            <span
                className={`inline-flex items-center gap-1 ${text} text-gray-400 dark:text-gray-500 ${className}`}
            >
                <Star
                    size={icon}
                    className="text-gray-300 dark:text-gray-600"
                />
                No reviews yet
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1 ${text} font-semibold text-gray-700 dark:text-gray-200 ${className}`}
            aria-label={`Rated ${averageRating.toFixed(1)} out of 5 from ${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
        >
            <Star
                size={icon}
                className="fill-yellow-400 text-yellow-400"
            />
            {averageRating.toFixed(1)}
            <span className="font-normal text-gray-400 dark:text-gray-500">
                ({reviewCount})
            </span>
        </span>
    );
};

export default VehicleRating;
