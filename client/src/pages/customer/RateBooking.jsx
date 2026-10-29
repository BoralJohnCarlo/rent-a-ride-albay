import {
    useEffect,
    useRef,
    useState,
} from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
    Camera,
    Car,
    CheckCircle2,
    ChevronLeft,
    Star,
    User,
    X,
} from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

import { getBookingById } from "../../api/bookingApi";
import { uploadReviewImage } from "../../services/reviewService";
import useReview from "../../hooks/reviews/useReview";
import useToast from "../../hooks/toast/useToast";

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "your vehicle";
    }

    const name = [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle.vehicleCode || "your vehicle";
};

const getDriverName = (driver) => {
    if (!driver) {
        return "your driver";
    }

    const name = [driver.firstName, driver.lastName]
        .filter(Boolean)
        .join(" ");

    return name || driver.driverCode || "your driver";
};

const RateBooking = () => {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const fileInputRef = useRef(null);
    const driverFileInputRef = useRef(null);

    const {
        submitReview,
        fetchRentalReview,
    } = useReview();

    const [booking, setBooking] = useState(null);
    const [existingReview, setExistingReview] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [driverRating, setDriverRating] = useState(0);
    const [driverHoverRating, setDriverHoverRating] = useState(0);
    const [driverComment, setDriverComment] = useState("");
    const [driverImageFile, setDriverImageFile] = useState(null);
    const [driverImagePreview, setDriverImagePreview] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            setPageLoading(true);
            setLoadError(null);

            try {
                const response = await getBookingById(bookingId);
                const bookingData = response?.data ?? null;

                if (!isMounted) {
                    return;
                }

                setBooking(bookingData);

                const rentalId = bookingData?.rental?._id;

                if (rentalId) {
                    try {
                        const review = await fetchRentalReview(rentalId);
                        const reviewData = review?.data ?? null;

                        if (isMounted) {
                            setExistingReview(reviewData);
                        }
                    } catch {
                        /* No review yet — that's the expected case. */
                    }
                }
            } catch (error) {
                if (isMounted) {
                    setLoadError(
                        error?.response?.data?.message ||
                            "Unable to load this booking."
                    );
                }
            } finally {
                if (isMounted) {
                    setPageLoading(false);
                }
            }
        };

        void load();

        return () => {
            isMounted = false;
        };
    }, [bookingId, fetchRentalReview]);

    useEffect(() => {
        if (!imageFile) {
            setImagePreview(null);
            return;
        }

        const url = URL.createObjectURL(imageFile);
        setImagePreview(url);

        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    useEffect(() => {
        if (!driverImageFile) {
            setDriverImagePreview(null);
            return;
        }

        const url = URL.createObjectURL(driverImageFile);
        setDriverImagePreview(url);

        return () => URL.revokeObjectURL(url);
    }, [driverImageFile]);

    const validateImageFile = (file) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return false;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be smaller than 5MB.");
            return false;
        }

        return true;
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];

        if (!file || !validateImageFile(file)) {
            return;
        }

        setImageFile(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleDriverFileChange = (event) => {
        const file = event.target.files?.[0];

        if (!file || !validateImageFile(file)) {
            return;
        }

        setDriverImageFile(file);
    };

    const handleRemoveDriverImage = () => {
        setDriverImageFile(null);

        if (driverFileInputRef.current) {
            driverFileInputRef.current.value = "";
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Please select a star rating.");
            return;
        }

        setSubmitting(true);

        try {
            let imageUrl = "";

            if (imageFile) {
                const uploadResult = await uploadReviewImage(imageFile);
                imageUrl = uploadResult?.data?.url || "";
            }

            const reviewData = {
                rating,
                comment: comment.trim(),
                image: imageUrl,
            };

            const canRateDriver =
                booking.driverOption === "With Driver" && booking.driver;

            if (canRateDriver && driverRating > 0) {
                let driverImageUrl = "";

                if (driverImageFile) {
                    const driverUploadResult =
                        await uploadReviewImage(driverImageFile);
                    driverImageUrl = driverUploadResult?.data?.url || "";
                }

                reviewData.driverId = booking.driver._id;
                reviewData.driverRating = driverRating;
                reviewData.driverComment = driverComment.trim();
                reviewData.driverImage = driverImageUrl;
            }

            await submitReview({
                bookingOrRentalId: booking._id,
                reviewData,
            });

            toast.success("Thanks for rating your trip!", "Review submitted");
            navigate("/customer/bookings");
        } catch (error) {
            toast.error(
                error?.response?.data?.message ||
                    error?.message ||
                    "Unable to submit your review.",
                "Error"
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (pageLoading) {
        return (
            <PageContainer>
                <div className="flex min-h-[400px] items-center justify-center">
                    <LoadingSpinner size="lg" />
                </div>
            </PageContainer>
        );
    }

    if (loadError || !booking) {
        return (
            <PageContainer>
                <Section spacing="MD">
                    <EmptyState
                        title="Booking not found"
                        description={
                            loadError ||
                            "We couldn't find this booking."
                        }
                        action={
                            <Button
                                variant="outline"
                                onClick={() => navigate("/customer/bookings")}
                            >
                                Back to My Bookings
                            </Button>
                        }
                    />
                </Section>
            </PageContainer>
        );
    }

    if (booking.status !== "Completed") {
        return (
            <PageContainer>
                <Section spacing="MD">
                    <EmptyState
                        title="This trip isn't completed yet"
                        description="You can rate your vehicle once this trip has been marked as completed."
                        action={
                            <Button
                                variant="outline"
                                onClick={() => navigate("/customer/bookings")}
                            >
                                Back to My Bookings
                            </Button>
                        }
                    />
                </Section>
            </PageContainer>
        );
    }

    const vehicleName = getVehicleName(booking.vehicle);
    const displayRating = hoverRating || rating;

    const canRateDriver =
        booking.driverOption === "With Driver" && Boolean(booking.driver);
    const driverName = getDriverName(booking.driver);
    const driverDisplayRating = driverHoverRating || driverRating;

    return (
        <PageContainer>
            <Section spacing="MD" className="mx-auto w-full max-w-2xl">
                <Link
                    to="/customer/bookings"
                    className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    <ChevronLeft size={16} />
                    Back to My Bookings
                </Link>

                {existingReview ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle2 size={28} />
                        </div>

                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            You already rated this trip
                        </h2>

                        <div className="mt-3 flex items-center justify-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={22}
                                    className={
                                        star <= existingReview.rating
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-gray-300 dark:text-gray-600"
                                    }
                                />
                            ))}
                        </div>

                        {existingReview.comment && (
                            <p className="mx-auto mt-4 max-w-md text-sm text-gray-600 dark:text-gray-300">
                                "{existingReview.comment}"
                            </p>
                        )}

                        {existingReview.image && (
                            <img
                                src={existingReview.image}
                                alt="Your review"
                                className="mx-auto mt-4 max-h-56 rounded-xl object-cover"
                            />
                        )}

                        {canRateDriver && existingReview.driverRating && (
                            <div className="mx-auto mt-6 max-w-md border-t border-gray-100 pt-6 dark:border-gray-800">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Your rating for{" "}
                                    <Link
                                        to={`/drivers/${booking.driver._id}`}
                                        className="font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600 dark:text-white dark:decoration-gray-600"
                                    >
                                        {driverName}
                                    </Link>
                                </p>

                                <div className="mt-2 flex items-center justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={20}
                                            className={
                                                star <= existingReview.driverRating
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-gray-300 dark:text-gray-600"
                                            }
                                        />
                                    ))}
                                </div>

                                {existingReview.driverComment && (
                                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                                        "{existingReview.driverComment}"
                                    </p>
                                )}

                                {existingReview.driverImage && (
                                    <img
                                        src={existingReview.driverImage}
                                        alt="Your review of the driver"
                                        className="mx-auto mt-3 max-h-56 rounded-xl object-cover"
                                    />
                                )}
                            </div>
                        )}

                        <Button
                            className="mt-6"
                            variant="outline"
                            onClick={() => navigate("/customer/bookings")}
                        >
                            Back to My Bookings
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                                <Car size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Rate your trip
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    How was your experience with {vehicleName}?
                                </p>
                            </div>
                        </div>

                        <div className="mt-8">
                            <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Rating
                            </label>

                            <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        className="rounded-md p-2 transition-colors duration-150"
                                    >
                                        <Star
                                            size={32}
                                            className={
                                                star <= displayRating
                                                    ? "fill-yellow-400 text-yellow-400 transition-colors duration-150"
                                                    : "text-gray-300 transition-colors duration-150 dark:text-gray-600"
                                            }
                                        />
                                    </button>
                                ))}

                                {displayRating > 0 && (
                                    <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                                        {displayRating}/5
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            <label
                                htmlFor="rate-comment"
                                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                            >
                                Comment{" "}
                                <span className="text-gray-400">(optional)</span>
                            </label>

                            <textarea
                                id="rate-comment"
                                value={comment}
                                onChange={(event) => setComment(event.target.value)}
                                rows={4}
                                maxLength={1000}
                                placeholder="Share your experience..."
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                            />
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {comment.length}/1000
                            </p>
                        </div>

                        <div className="mt-6">
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Photo{" "}
                                <span className="text-gray-400">(optional)</span>
                            </label>

                            {imagePreview ? (
                                <div className="relative inline-block">
                                    <img
                                        src={imagePreview}
                                        alt="Review preview"
                                        className="h-32 w-32 rounded-xl object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-700"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-gray-400 transition hover:border-gray-400 hover:text-gray-500 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600"
                                >
                                    <Camera size={22} />
                                    <span className="text-xs font-medium">
                                        Add photo
                                    </span>
                                </button>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        {canRateDriver && (
                            <div className="mt-8 border-t border-gray-100 pt-8 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                            Rate your driver
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            How was{" "}
                                            <Link
                                                to={`/drivers/${booking.driver._id}`}
                                                className="font-medium text-gray-700 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600 dark:text-gray-300 dark:decoration-gray-600"
                                            >
                                                {driverName}
                                            </Link>
                                            's driving?{" "}
                                            <span className="text-gray-400">
                                                (optional)
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                        Driver Rating
                                    </label>

                                    <div className="flex items-center gap-0.5">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setDriverRating(star)}
                                                onMouseEnter={() =>
                                                    setDriverHoverRating(star)
                                                }
                                                onMouseLeave={() =>
                                                    setDriverHoverRating(0)
                                                }
                                                className="rounded-md p-2 transition-colors duration-150"
                                            >
                                                <Star
                                                    size={32}
                                                    className={
                                                        star <= driverDisplayRating
                                                            ? "fill-yellow-400 text-yellow-400 transition-colors duration-150"
                                                            : "text-gray-300 transition-colors duration-150 dark:text-gray-600"
                                                    }
                                                />
                                            </button>
                                        ))}

                                        {driverDisplayRating > 0 && (
                                            <span className="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                                                {driverDisplayRating}/5
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <label
                                        htmlFor="rate-driver-comment"
                                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                                    >
                                        Comment{" "}
                                        <span className="text-gray-400">
                                            (optional)
                                        </span>
                                    </label>

                                    <textarea
                                        id="rate-driver-comment"
                                        value={driverComment}
                                        onChange={(event) =>
                                            setDriverComment(event.target.value)
                                        }
                                        rows={4}
                                        maxLength={1000}
                                        placeholder="Share how the driver did..."
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                                    />
                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                        {driverComment.length}/1000
                                    </p>
                                </div>

                                <div className="mt-6">
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                        Photo{" "}
                                        <span className="text-gray-400">
                                            (optional)
                                        </span>
                                    </label>

                                    {driverImagePreview ? (
                                        <div className="relative inline-block">
                                            <img
                                                src={driverImagePreview}
                                                alt="Driver review preview"
                                                className="h-32 w-32 rounded-xl object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveDriverImage}
                                                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-700"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                driverFileInputRef.current?.click()
                                            }
                                            className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-gray-400 transition hover:border-gray-400 hover:text-gray-500 dark:border-gray-700 dark:text-gray-500 dark:hover:border-gray-600"
                                        >
                                            <Camera size={22} />
                                            <span className="text-xs font-medium">
                                                Add photo
                                            </span>
                                        </button>
                                    )}

                                    <input
                                        ref={driverFileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleDriverFileChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex flex-wrap justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate("/customer/bookings")}
                                disabled={submitting}
                            >
                                Skip for now
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                loading={submitting}
                                disabled={rating === 0}
                            >
                                Submit Review
                            </Button>
                        </div>
                    </div>
                )}
            </Section>
        </PageContainer>
    );
};

export default RateBooking;
