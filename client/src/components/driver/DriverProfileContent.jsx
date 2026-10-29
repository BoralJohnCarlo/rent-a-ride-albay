import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    CalendarDays,
    IdCard,
    Route,
    Star,
} from "lucide-react";

import { getPublicDriverProfile } from "../../api/driverApi";

import {
    fetchDriverAverageRating,
    fetchDriverReviews,
} from "../../services/reviewService";

import Avatar from "../common/Avatar";
import ErrorState from "../common/ErrorState";
import LoadingSpinner from "../common/LoadingSpinner";
import ReviewList from "../reviews/ReviewList";

/* LTO license codes in words a customer understands. */
const LICENSE_CODE_LABELS = {
    A: "Motorcycles",
    A1: "Tricycles",
    B: "Cars & SUVs",
    B1: "Vans (9+ seats)",
    B2: "Light trucks",
    C: "Trucks",
    D: "Buses",
    BE: "Cars with a trailer",
    CE: "Trucks with a trailer",
};

const StatTile = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-3 py-4 text-center dark:bg-gray-800/60">
        <Icon
            size={18}
            className="text-yellow-500 dark:text-yellow-400"
        />
        <span className="text-lg font-black text-gray-900 dark:text-white">
            {value}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {label}
        </span>
    </div>
);

const SectionHeading = ({
    eyebrow,
    title,
    trailing = null,
}) => (
    <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                {eyebrow}
            </p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-3xl">
                {title}
            </h2>
        </div>
        {trailing}
    </div>
);

const getFullName = (driver) =>
    [driver?.firstName, driver?.lastName]
        .filter(Boolean)
        .join(" ") || "Driver";

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
          })
        : null;

/*
 * A driver's public profile (details + reviews). Shared by the /drivers/:id
 * page and the booking form's in-place profile preview, so customers can check
 * a driver without leaving their booking.
 */
const DriverProfileContent = ({ driverId }) => {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    /*
     * Reviews live in local state, not the shared reviews store: this also
     * renders over the vehicle page (booking dialog), whose own vehicle
     * reviews and rating come from that store and must not be replaced.
     */
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [rating, setRating] = useState({
        averageRating: 0,
        reviewCount: 0,
    });

    const { averageRating, reviewCount } = rating;

    useEffect(() => {
        if (!driverId) {
            return;
        }

        let isMounted = true;

        const load = async () => {
            setLoading(true);
            setLoadError(null);

            try {
                const response = await getPublicDriverProfile(driverId);

                if (isMounted) {
                    setDriver(response?.data ?? null);
                }
            } catch (error) {
                if (isMounted) {
                    setLoadError(
                        error?.response?.data?.message ||
                            "We couldn't find this driver."
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            isMounted = false;
        };
    }, [driverId]);

    useEffect(() => {
        if (!driverId) {
            return;
        }

        let isMounted = true;

        setReviewsLoading(true);

        Promise.allSettled([
            fetchDriverReviews(driverId),
            fetchDriverAverageRating(driverId),
        ]).then(([reviewsResult, ratingResult]) => {
            if (!isMounted) {
                return;
            }

            setReviews(
                reviewsResult.status === "fulfilled"
                    ? reviewsResult.value?.data ?? []
                    : []
            );

            const payload =
                ratingResult.status === "fulfilled"
                    ? ratingResult.value?.data ?? {}
                    : {};

            setRating({
                averageRating: payload.averageRating ?? 0,
                reviewCount: payload.reviewCount ?? 0,
            });

            setReviewsLoading(false);
        });

        return () => {
            isMounted = false;
        };
    }, [driverId]);

    const driverReviews = useMemo(
        () =>
            reviews.map((review) => ({
                ...review,
                rating: review.driverRating,
                comment: review.driverComment,
                image: review.driverImage,
            })),
        [reviews]
    );

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (loadError || !driver) {
        return (
            <ErrorState
                title="Driver not found"
                message={
                    loadError ||
                    "We couldn't find this driver's profile."
                }
            />
        );
    }

    const fullName = getFullName(driver);
    const memberSince = formatDate(driver.createdAt);
    const licenseType = driver.license?.licenseType;
    const vehicleClasses = (driver.license?.restrictionCodes ?? [])
        .map((code) => LICENSE_CODE_LABELS[code])
        .filter(Boolean);
    const completedTrips = Number(driver.completedTrips) || 0;

    return (
        <>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                    <Avatar
                        src={driver.profileImage}
                        name={fullName}
                        size="xl"
                    />

                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                            {fullName}
                        </h1>

                        {licenseType && (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                <IdCard size={15} />
                                {licenseType} driver's license
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                    <StatTile
                        icon={Route}
                        label={
                            completedTrips === 1
                                ? "Trip completed"
                                : "Trips completed"
                        }
                        value={completedTrips.toLocaleString("en-PH")}
                    />
                    <StatTile
                        icon={Star}
                        label={
                            reviewCount > 0
                                ? `${reviewCount} ${
                                      reviewCount === 1
                                          ? "review"
                                          : "reviews"
                                  }`
                                : "No reviews yet"
                        }
                        value={
                            reviewCount > 0
                                ? averageRating.toFixed(1)
                                : "—"
                        }
                    />
                    <StatTile
                        icon={CalendarDays}
                        label="Driver with us since"
                        value={memberSince ?? "—"}
                    />
                </div>

                {vehicleClasses.length > 0 && (
                    <div className="mt-6">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Licensed to drive
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {vehicleClasses.map((label) => (
                                <span
                                    key={label}
                                    className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300"
                                >
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-8">
                <SectionHeading
                    eyebrow="Customer Feedback"
                    title="Reviews"
                    trailing={
                        reviewCount > 0 ? (
                            <div className="flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1.5 dark:bg-yellow-500/10">
                                <Star
                                    size={15}
                                    className="fill-yellow-400 text-yellow-400"
                                />
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {averageRating.toFixed(1)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({reviewCount})
                                </span>
                            </div>
                        ) : null
                    }
                />

                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {reviewCount > 0
                        ? `See what customers have to say about riding with ${fullName}.`
                        : "No reviews yet. Reviews appear here after a completed trip with this driver."}
                </p>

                <div className="mt-5">
                    <ReviewList
                        reviews={driverReviews}
                        loading={reviewsLoading}
                    />
                </div>
            </div>
        </>
    );
};

export default DriverProfileContent;
