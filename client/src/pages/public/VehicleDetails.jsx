import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ArrowLeft,
    CarFront,
    CheckCircle2,
    Fuel,
    ImageOff,
    MapPin,
    Palette,
    Settings2,
    Star,
    Users,
} from "lucide-react";

import {
    Link,
    useNavigate,
    useParams,
} from "react-router-dom";

import { motion } from "framer-motion";

import useVehicle from "../../hooks/vehicles/useVehicle";
import useBooking from "../../hooks/bookings";
import usePayment from "../../hooks/payments";
import useToast from "../../hooks/toast/useToast";
import useReview from "../../hooks/reviews/useReview";

import { getAvailableDrivers } from "../../api/driverApi";

import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Price from "../../components/common/Price";
import StatusChip from "../../components/common/StatusChip";

import BookingDialog from "../../components/modals/BookingDialog";
import ReviewList from "../../components/reviews/ReviewList";

const VehicleDetails = () => {
    const { vehicleId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const {
        selectedVehicle,
        loading,
        error,
        getVehicleById,
        clearSelectedVehicle,
    } = useVehicle();

    const {
        addBooking,
        loading: bookingLoading,
        error: bookingError,
        clearError: clearBookingError,
    } = useBooking();

    const {
        fetchPayments,
    } = usePayment();

    const {
        averageRating,
        reviewCount,
        reviews,
        loading: reviewsLoading,
        fetchVehicleAverageRating,
        fetchVehicleReviews,
    } = useReview();

    const [activeImage, setActiveImage] =
        useState(0);

    const [bookingOpen, setBookingOpen] =
        useState(false);

    const [
        isRedirectingToCheckout,
        setIsRedirectingToCheckout,
    ] = useState(false);

    const [availableDrivers, setAvailableDrivers] =
        useState([]);

    const [driversLoading, setDriversLoading] =
        useState(false);

    useEffect(() => {
        if (!vehicleId) {
            return;
        }

        clearSelectedVehicle();
        getVehicleById(vehicleId);

        return () => {
            clearSelectedVehicle();
        };
    }, [
        vehicleId,
        getVehicleById,
        clearSelectedVehicle,
    ]);

    useEffect(() => {
        if (!vehicleId) {
            return;
        }

        void fetchVehicleAverageRating(vehicleId);
    }, [vehicleId, fetchVehicleAverageRating]);

    useEffect(() => {
        if (!vehicleId) {
            return;
        }

        void fetchVehicleReviews(vehicleId);
    }, [vehicleId, fetchVehicleReviews]);

    useEffect(() => {
        setActiveImage(0);
    }, [vehicleId]);

    useEffect(() => {
        let isMounted = true;

        const fetchDrivers = async () => {
            setDriversLoading(true);

            try {
                const result =
                    await getAvailableDrivers();

                if (isMounted) {
                    setAvailableDrivers(
                        result?.data ?? []
                    );
                }
            } catch {
                if (isMounted) {
                    setAvailableDrivers([]);
                    toast.error(
                        "Unable to load available drivers. Please try again later.",
                        "Drivers Unavailable"
                    );
                }
            } finally {
                if (isMounted) {
                    setDriversLoading(false);
                }
            }
        };

        fetchDrivers();

        return () => {
            isMounted = false;
        };
    }, [toast]);

    const vehicleImages = useMemo(() => {
        if (!selectedVehicle?.images?.length) {
            return [];
        }

        return selectedVehicle.images
            .map((image) => {
                if (typeof image === "string") {
                    return {
                        url: image,
                        isPrimary: false,
                    };
                }

                return {
                    url: image?.url ?? null,
                    isPrimary:
                        image?.isPrimary === true,
                };
            })
            .filter((image) => image.url)
            .sort(
                (a, b) =>
                    Number(b.isPrimary) -
                    Number(a.isPrimary)
            );
    }, [selectedVehicle]);

    useEffect(() => {
        if (
            activeImage >= vehicleImages.length &&
            vehicleImages.length > 0
        ) {
            setActiveImage(0);
        }
    }, [
        activeImage,
        vehicleImages.length,
    ]);

    const vehicleName = useMemo(() => {
        return [
            selectedVehicle?.brand,
            selectedVehicle?.model,
        ]
            .filter(Boolean)
            .join(" ");
    }, [selectedVehicle]);

    const handleOpenBooking = () => {
        if (!selectedVehicle) {
            return;
        }

        if (
            selectedVehicle.status !==
                "Available" ||
            selectedVehicle.availability
                ?.bookingEnabled === false
        ) {
            return;
        }

        clearBookingError();
        setBookingOpen(true);
    };

    const handleCloseBooking = () => {
        if (bookingLoading) {
            return;
        }

        setBookingOpen(false);
        clearBookingError();
    };

    const handleBookingSubmit = async (
        bookingData
    ) => {
        const result =
            await addBooking(bookingData);

        if (
            result?.meta?.requestStatus ===
            "fulfilled"
        ) {
            setBookingOpen(false);
            clearBookingError();

            const booking =
                result.payload?.data;

            toast.success(
                "Booking submitted successfully! Please wait for admin approval.",
                "Booking Created"
            );

            if (
                bookingData.paymentMethod ===
                    "GCASH" &&
                booking?._id
            ) {
                setIsRedirectingToCheckout(
                    true
                );

                try {
                    const paymentResponse =
                        await fetchPayments(
                            {
                                bookingId:
                                    booking._id,
                            }
                        );

                    const payments =
                        paymentResponse
                            ?.data || [];

                    const pendingPayment =
                        payments.find(
                            (payment) =>
                                payment.status ===
                                "PENDING"
                        );

                    const payment =
                        pendingPayment ||
                        payments[0];

                    if (payment?._id) {
                        navigate(
                            `/customer/checkout/${payment._id}`
                        );

                        return;
                    }

                    toast.warning(
                        "Payment record not found. Please check your bookings to complete payment.",
                        "Payment Required"
                    );
                } catch {
                    toast.error(
                        "Unable to load payment. Please check your bookings to complete payment.",
                        "Payment Error"
                    );
                } finally {
                    setIsRedirectingToCheckout(
                        false
                    );
                }
            } else {
                navigate("/customer/bookings");
            }
        }
    };

    if (loading && !selectedVehicle) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="flex min-h-[70vh] items-center justify-center">
                    <LoadingSpinner />
                </div>
            </main>
        );
    }

    if (isRedirectingToCheckout) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
                    <LoadingSpinner />

                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Redirecting to checkout...
                    </p>
                </div>
            </main>
        );
    }

    if (error || !selectedVehicle) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
                    <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-12">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                            <CarFront
                                size={30}
                                strokeWidth={1.5}
                            />
                        </div>

                        <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Vehicle Not Found
                        </h1>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {error ||
                                "The vehicle you are looking for is unavailable or may have been removed."}
                        </p>

                        <div className="mt-7">
                            <Link to="/vehicles">
                                <Button
                                    leftIcon={
                                        <ArrowLeft
                                            size={18}
                                        />
                                    }
                                >
                                    Back to Vehicles
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    const specifications =
        selectedVehicle.specifications ?? {};

    const pricing =
        selectedVehicle.pricing ?? {};

    const description =
        selectedVehicle.description?.public ??
        "No public description is available for this vehicle.";

    const availability =
        selectedVehicle.availability ?? {};

    const primaryImage =
        vehicleImages[activeImage]?.url ?? null;

    const categoryName =
        selectedVehicle.category?.name ??
        "Uncategorized";

    const isAvailable =
        selectedVehicle.status ===
            "Available" &&
        availability.bookingEnabled !== false;

    const specificationItems = [
        {
            label: "Vehicle Type",
            value:
                selectedVehicle.vehicleType ??
                "—",
            icon: CarFront,
        },
        {
            label: "Transmission",
            value:
                specifications.transmission ??
                "—",
            icon: Settings2,
        },
        {
            label: "Fuel Type",
            value:
                specifications.fuelType ??
                "—",
            icon: Fuel,
        },
        {
            label: "Seats",
            value:
                specifications.seatingCapacity
                    ? `${specifications.seatingCapacity} Seats`
                    : "—",
            icon: Users,
        },
        {
            label: "Color",
            value:
                specifications.color ??
                "—",
            icon: Palette,
        },
        {
            label: "Category",
            value: categoryName,
            icon: CarFront,
        },
    ];

    return (
        <>
            <main className="min-h-screen bg-[#f8f9fb] dark:bg-gray-950">

                {/* Back Navigation */}
                <section className="border-b border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-950">
                    <div className="mx-auto max-w-7xl px-4 pb-6 pt-12 sm:px-6 sm:pb-7 sm:pt-14 lg:px-8">
                        <Link
                            to="/vehicles"
                            className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        >
                            <ArrowLeft
                                size={17}
                                className="transition-transform group-hover:-translate-x-0.5"
                            />

                            Back to Vehicles
                        </Link>
                    </div>
                </section>

                {/* Vehicle Details */}
                <section>
                    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8 lg:pt-12">

                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 20,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                        >

                            {/* Vehicle Image */}
                            <div className="overflow-hidden rounded-[30px] border border-gray-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.05)] dark:border-gray-800 dark:bg-gray-900">

                                <div className="relative aspect-[16/8.5] overflow-hidden bg-gray-100 dark:bg-gray-800">

                                    {primaryImage ? (
                                        <motion.img
                                            key={
                                                primaryImage
                                            }
                                            initial={{
                                                opacity: 0,
                                                scale: 1.02,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                            }}
                                            transition={{
                                                duration: 0.35,
                                            }}
                                            src={
                                                primaryImage
                                            }
                                            alt={
                                                vehicleName ||
                                                "Vehicle"
                                            }
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500">
                                            <ImageOff
                                                size={
                                                    50
                                                }
                                                strokeWidth={
                                                    1.4
                                                }
                                            />

                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                                    No Vehicle
                                                    Image
                                                </p>

                                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                                    Image not
                                                    available
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Image Gradient */}
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/30 to-transparent" />

                                    {/* Image Badges */}
                                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 sm:p-6">

                                        <div className="flex flex-wrap items-center gap-2">
                                            {selectedVehicle.isFeatured && (
                                                <Badge variant="warning">
                                                    Featured
                                                </Badge>
                                            )}

                                            <Badge
                                                variant={
                                                    selectedVehicle.ownership ===
                                                    "Company"
                                                        ? "info"
                                                        : "warning"
                                                }
                                            >
                                                {selectedVehicle.ownership ??
                                                    "Company"}
                                            </Badge>
                                        </div>

                                        {isAvailable && (
                                            <div className="flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-green-700 shadow-sm backdrop-blur-sm dark:bg-gray-950/90 dark:text-green-400">
                                                <span className="h-2 w-2 rounded-full bg-green-500" />

                                                Available
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Thumbnails */}
                                {vehicleImages.length >
                                    1 && (
                                    <div className="flex gap-3 overflow-x-auto p-4 sm:p-5">
                                        {vehicleImages.map(
                                            (
                                                image,
                                                index
                                            ) => (
                                                <button
                                                    key={`${image.url}-${index}`}
                                                    type="button"
                                                    onClick={() =>
                                                        setActiveImage(
                                                            index
                                                        )
                                                    }
                                                    aria-label={`View ${vehicleName || "vehicle"} image ${index + 1}`}
                                                    aria-pressed={
                                                        activeImage ===
                                                        index
                                                    }
                                                    className={[
                                                        "h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-100 transition-all dark:bg-gray-800 sm:h-20 sm:w-28",
                                                        activeImage ===
                                                        index
                                                            ? "border-yellow-500 ring-2 ring-yellow-100 dark:ring-yellow-500/20"
                                                            : "border-transparent opacity-70 hover:border-gray-300 hover:opacity-100 dark:hover:border-gray-600",
                                                    ]
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            " "
                                                        )}
                                                >
                                                    <img
                                                        src={
                                                            image.url
                                                        }
                                                        alt={`${vehicleName || "Vehicle"} ${index + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Vehicle Information Card */}
                            <div className="mt-7 sm:mt-8">
                                <div className="rounded-[30px] border border-gray-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:border-gray-800 dark:bg-gray-900">

                                    {/* Main Information */}
                                    <div className="p-6 sm:p-8 lg:p-10">

                                        {/* Status */}
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <StatusChip
                                                status={
                                                    selectedVehicle.status
                                                }
                                            />

                                            {isAvailable && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 dark:bg-green-500/10 dark:text-green-400">
                                                    <CheckCircle2
                                                        size={
                                                            14
                                                        }
                                                    />

                                                    Available for
                                                    rental
                                                </span>
                                            )}
                                        </div>

                                        {/* Title + Price */}
                                        <div className="mt-6 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">

                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                                    {selectedVehicle.vehicleCode ??
                                                        "Vehicle"}
                                                </p>

                                                <h1 className="mt-2 text-4xl font-black tracking-tight text-gray-950 dark:text-white sm:text-5xl">
                                                    {vehicleName ||
                                                        "Vehicle"}
                                                </h1>

                                                {selectedVehicle.variant && (
                                                    <p className="mt-2 text-base font-medium text-gray-500 dark:text-gray-400">
                                                        {
                                                            selectedVehicle.variant
                                                        }
                                                    </p>
                                                )}

                                                {reviewCount > 0 && (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <div className="flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map(
                                                                (star) => (
                                                                    <Star
                                                                        key={
                                                                            star
                                                                        }
                                                                        size={16}
                                                                        className={
                                                                            star <=
                                                                                Math.round(
                                                                                    averageRating
                                                                                )
                                                                                ? "fill-yellow-400 text-yellow-400"
                                                                                : "text-gray-300 dark:text-gray-600"
                                                                        }
                                                                    />
                                                                )
                                                            )}
                                                        </div>

                                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                                            {averageRating.toFixed(1)}
                                                        </span>

                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            ({reviewCount}{" "}
                                                            {reviewCount ===
                                                            1
                                                                ? "review"
                                                                : "reviews"}
                                                            )
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Price */}
                                            <div className="shrink-0 lg:text-right">
                                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                                                    Daily Rental Rate
                                                </p>

                                                <div className="mt-1 flex items-baseline gap-1 lg:justify-end">
                                                    <Price
                                                        value={
                                                            pricing.dailyRate
                                                        }
                                                        className="text-4xl font-black tracking-tight text-green-700 dark:text-green-400"
                                                    />

                                                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                                        / day
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Divider */}
                                        <div className="my-8 border-t border-gray-100 dark:border-gray-800" />

                                        {/* Description */}
                                        <div className="max-w-4xl">
                                            <h2 className="text-sm font-bold text-gray-950 dark:text-white">
                                                About this vehicle
                                            </h2>

                                            <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                                                {description}
                                            </p>
                                        </div>

                                        {/* Location + Reservation Fee */}
                                        <div className="mt-8 grid gap-4 sm:grid-cols-2">

                                            {/* Location */}
                                            <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400">
                                                    <MapPin
                                                        size={
                                                            18
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                        Rent-A-Ride
                                                        Albay
                                                    </p>

                                                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                        Available for
                                                        rentals around
                                                        Albay,
                                                        Philippines.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Reservation Fee */}
                                            {pricing.reservationFee !==
                                                undefined && (
                                                <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60">
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                                                            Reservation
                                                            Fee
                                                        </p>

                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Required to
                                                            reserve this
                                                            vehicle
                                                        </p>
                                                    </div>

                                                    <Price
                                                        value={
                                                            pricing.reservationFee
                                                        }
                                                        className="text-lg font-bold text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reservation Footer */}
                                    <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-5 dark:border-gray-800 dark:bg-gray-800/30 sm:px-8 lg:px-10">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                    Ready to book this
                                                    vehicle?
                                                </p>

                                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                    Select your rental
                                                    details to continue.
                                                </p>
                                            </div>

                                            <Button
                                                type="button"
                                                size="lg"
                                                className="h-12 w-full px-8 text-sm font-bold sm:w-auto"
                                                disabled={
                                                    !isAvailable ||
                                                    bookingLoading
                                                }
                                                onClick={
                                                    handleOpenBooking
                                                }
                                                loading={
                                                    bookingLoading
                                                }
                                            >
                                                {isAvailable
                                                    ? "Reserve Vehicle"
                                                    : "Currently Unavailable"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Specifications */}
                <section className="border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">

                        <div className="max-w-2xl">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                                Vehicle Information
                            </p>

                            <h2 className="mt-2 text-3xl font-black tracking-tight text-gray-950 dark:text-white">
                                Specifications
                            </h2>

                            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                Everything you need to know about
                                this vehicle before making your
                                rental decision.
                            </p>
                        </div>

                        <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-3">

                            {specificationItems.map(
                                ({
                                    label,
                                    value,
                                    icon: Icon,
                                }) => (
                                    <motion.div
                                        key={label}
                                        initial={{
                                            opacity: 0,
                                            y: 10,
                                        }}
                                        whileInView={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        viewport={{
                                            once: true,
                                            amount: 0.2,
                                        }}
                                        transition={{
                                            duration: 0.3,
                                        }}
                                        className="group border-b border-gray-200 p-5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                                    >
                                        <div className="flex items-center gap-3">

                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 transition-colors group-hover:bg-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400 dark:group-hover:bg-yellow-500/15">
                                                <Icon
                                                    size={
                                                        17
                                                    }
                                                    strokeWidth={
                                                        1.8
                                                    }
                                                />
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                                                    {label}
                                                </p>

                                                <p className="mt-0.5 truncate text-sm font-bold text-gray-900 dark:text-white">
                                                    {value}
                                                </p>
                                            </div>

                                        </div>
                                    </motion.div>
                                )
                            )}

                        </div>
                    </div>
                </section>

                {/* Reviews */}
                <section className="border-y border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
                        <div className="max-w-2xl">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400">
                                Customer Feedback
                            </p>

                            <div className="mt-2 flex items-end gap-4">
                                <h2 className="text-3xl font-black tracking-tight text-gray-950 dark:text-white">
                                    Reviews
                                </h2>

                                {reviewCount > 0 && (
                                    <div className="flex items-center gap-2 pb-1">
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
                                                                Math.round(
                                                                    averageRating
                                                                )
                                                                ? "fill-yellow-400 text-yellow-400"
                                                                : "text-gray-300 dark:text-gray-600"
                                                        }
                                                    />
                                                )
                                            )}
                                        </div>

                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {averageRating.toFixed(1)}
                                        </span>

                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                            (
                                            {reviewCount}
                                            )
                                        </span>
                                    </div>
                                )}
                            </div>

                            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                {reviewCount > 0
                                    ? "See what our customers have to say about their experience with this vehicle."
                                    : "No reviews yet. Be the first to review this vehicle after your rental."}
                            </p>
                        </div>

                        <div className="mt-8">
                            <ReviewList
                                reviews={reviews}
                                loading={reviewsLoading}
                            />
                        </div>
                    </div>
                </section>

                {/* Bottom CTA */}
                <section className="bg-[#f8f9fb] dark:bg-gray-950">
                    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">

                        <div className="flex flex-col gap-5 rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-8">

                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                                    Ready to explore Albay?
                                </h2>

                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Browse more vehicles and find
                                    the right ride for your trip.
                                </p>
                            </div>

                            <Link to="/vehicles">
                                <Button
                                    variant="outline"
                                    leftIcon={
                                        <ArrowLeft
                                            size={17}
                                        />
                                    }
                                >
                                    Back to Fleet
                                </Button>
                            </Link>

                        </div>
                    </div>
                </section>
            </main>

            <BookingDialog
                open={bookingOpen}
                vehicle={selectedVehicle}
                drivers={availableDrivers}
                loading={bookingLoading || driversLoading}
                errors={bookingError}
                onSubmit={handleBookingSubmit}
                onClose={handleCloseBooking}
            />
        </>
    );
};

export default VehicleDetails;