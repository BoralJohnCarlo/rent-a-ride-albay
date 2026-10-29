import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    AlertTriangle,
    ArrowLeft,
    CarFront,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Fuel,
    Heart,
    ImageOff,
    Info,
    MapPin,
    Settings2,
    Star,
    Users,
    Wrench,
    CalendarX2,
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
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import useToast from "../../hooks/toast/useToast";
import useReview from "../../hooks/reviews/useReview";
import useAuth from "../../hooks/auth/useAuth";
import useFavorite from "../../hooks/useFavorite";
import {
    getVehicleMaintenanceWindow,
    isVehicleBookable,
} from "../../constants/vehicleConstants";
import {
    isVehicleDrivableByCustomer,
    customerRequiresDriver,
} from "../../utils/vehicleEligibility";

import { getAvailableDrivers } from "../../api/driverApi";

import Button from "../../components/common/Button";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Price from "../../components/common/Price";
import DiscountBadge from "../../components/vehicle/DiscountBadge";
import OriginalPrice from "../../components/vehicle/OriginalPrice";
import {
    getActiveDiscount,
    getEffectiveDailyRate,
} from "../../utils/vehicleDiscount";

import BookingDialog from "../../components/modals/BookingDialog";
import ReviewList from "../../components/reviews/ReviewList";
import AvailabilityCalendar from "../../components/vehicle/AvailabilityCalendar";
import SimilarVehicles from "../../components/vehicle/SimilarVehicles";

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

const VehicleDetails = () => {
    const { vehicleId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const {
        offRoadVehicles,
        motorcycleDriversEnabled,
        licenseRestrictionEnabled,
    } = usePublicRefundSettings();

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
        initiateCheckout,
    } = usePayment();

    const {
        averageRating,
        reviewCount,
        reviews,
        loading: reviewsLoading,
        fetchVehicleAverageRating,
        fetchVehicleReviews,
    } = useReview();

    const {
        user,
        isAuthenticated,
    } = useAuth();

    const {
        favoriteIds,
        loading: favoriteLoading,
        toggleVehicleFavoriteStatus,
        fetchUserFavorites,
    } = useFavorite();

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
        // Favoriting is a customer-only feature — /favorites 403s for any
        // other role, so only fetch it for the role that can actually use it.
        if (
            !isAuthenticated ||
            user?.role !== "customer" ||
            !vehicleId
        ) {
            return;
        }

        void fetchUserFavorites();
    }, [
        isAuthenticated,
        user?.role,
        vehicleId,
        fetchUserFavorites,
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

    const hasExpiredLicense = useMemo(() => {
        if (
            !isAuthenticated ||
            user?.role !== "customer" ||
            !user?.licenseExpirationDate
        ) {
            return false;
        }

        return (
            new Date(
                user.licenseExpirationDate
            ) < new Date()
        );
    }, [isAuthenticated, user]);

    const isNotLicensedForVehicle = useMemo(() => {
        if (
            !isAuthenticated ||
            user?.role !== "customer" ||
            !selectedVehicle
        ) {
            return false;
        }

        return !isVehicleDrivableByCustomer(
            selectedVehicle,
            user
        );
    }, [
        isAuthenticated,
        user,
        selectedVehicle,
    ]);

    /*
     * A customer who explicitly said they have no driver's license at all
     * (not just "not licensed for this particular vehicle") can still book
     * - just only "With Driver". Same non-blocking treatment as
     * isNotLicensedForVehicle below; the real enforcement lives in
     * BookingForm (forced to "With Driver") and server-side.
     */
    const noLicenseAtAll = customerRequiresDriver(user);

    /*
     * Unlike an expired license (which also serves as an ID credential and
     * blocks booking outright), not being licensed to personally drive this
     * vehicle only matters for a self-drive booking - the customer can still
     * book it "With Driver", where a company driver does the driving under
     * their own separate license. So this never blocks opening the booking
     * dialog; it's surfaced as a heads-up, and the actual gate lives
     * server-side once the customer picks a driver option.
     */
    /*
     * Settings → Drivers can make motorcycles self-drive only. A customer who
     * may not self-drive this one (no license, or none covering motorcycles,
     * while Settings → Customers enforces that) then has no way to book it —
     * treated like an expired license: send them to update it.
     */
    const selfDriveOnly =
        selectedVehicle?.vehicleType === "Motorcycle" &&
        motorcycleDriversEnabled === false;

    const selfDriveBlocked =
        selfDriveOnly &&
        licenseRestrictionEnabled &&
        (noLicenseAtAll || isNotLicensedForVehicle);

    const licenseBlocked = hasExpiredLicense || selfDriveBlocked;

    const handleOpenBooking = () => {
        if (!selectedVehicle) {
            return;
        }

        if (
            !isVehicleBookable(selectedVehicle) ||
            getVehicleMaintenanceWindow(selectedVehicle)?.end === Infinity
        ) {
            return;
        }

        if (!isAuthenticated) {
            navigate("/login");

            return;
        }

        if (isNonCustomerRole) {
            toast.info(
                "Only customer accounts can book vehicles.",
                "Not Available"
            );

            return;
        }

        if (hasExpiredLicense) {
            toast.error(
                "Your driver's license has expired. Please update it in your profile before booking.",
                "License Expired"
            );

            return;
        }

        if (selfDriveBlocked) {
            toast.error(
                "Motorcycles are self-drive only, and your license info doesn't cover riding one. Update it in your profile to book this motorcycle.",
                "License Required"
            );

            return;
        }

        if (selfDriveOnly) {
            // No driver hints: there's no driver option for this vehicle.
        } else if (isNotLicensedForVehicle) {
            toast.info(
                availableDrivers.length > 0
                    ? "Your license doesn't cover self-driving this vehicle. You can still book it with a driver."
                    : "Your license doesn't cover self-driving this vehicle, and no drivers are currently available. Update your license info to self-drive it.",
                "Driver Required"
            );
        } else if (noLicenseAtAll) {
            toast.info(
                "You don't have a driver's license on file, so this booking will be with a driver.",
                "Driver Required"
            );
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

    const handleToggleFavorite = async (
        event
    ) => {
        event.preventDefault();

        event.stopPropagation();

        if (
            !isAuthenticated ||
            favoriteLoading ||
            !vehicleId
        ) {
            return;
        }

        await toggleVehicleFavoriteStatus(
            vehicleId
        );
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

            if (
                bookingData.paymentMethod ===
                    "GCASH" &&
                booking?._id
            ) {
                /*
                 * One continuous step: the Pay button created the booking,
                 * and now goes straight on to PayMongo for its reservation
                 * fee. If that can't start, the booking is safe and the
                 * Checkout page (or My Bookings → Pay now) takes over.
                 */
                setIsRedirectingToCheckout(
                    true
                );

                let payment = null;
                let lookupFailed = false;

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

                    payment =
                        payments.find(
                            (item) =>
                                item.status ===
                                "PENDING"
                        ) ?? null;
                } catch {
                    lookupFailed = true;
                }

                if (!payment?._id) {
                    setIsRedirectingToCheckout(
                        false
                    );

                    if (lookupFailed) {
                        toast.warning(
                            "Your booking was saved, but we couldn't open the payment. Use Pay now in My Bookings to pay the reservation fee.",
                            "Payment Required"
                        );
                    } else {
                        // Nothing to pay online (e.g. a voucher covered it).
                        toast.success(
                            "Booking submitted successfully! Please wait for admin approval.",
                            "Booking Created"
                        );
                    }

                    navigate("/customer/bookings");

                    return;
                }

                const checkout =
                    await initiateCheckout(
                        payment._id
                    );

                const checkoutUrl =
                    checkout?.meta?.requestStatus ===
                    "fulfilled"
                        ? checkout.payload?.data
                              ?.checkoutUrl
                        : null;

                if (checkoutUrl) {
                    // Leaving the app for PayMongo; keep the redirect screen.
                    window.location.href =
                        checkoutUrl;

                    return;
                }

                setIsRedirectingToCheckout(
                    false
                );

                toast.warning(
                    "Your booking was saved, but we couldn't open the payment page. Please complete the payment here.",
                    "Payment Required"
                );

                navigate(
                    `/customer/checkout/${payment._id}`
                );
            } else {
                toast.success(
                    "Booking submitted successfully! Please wait for admin approval.",
                    "Booking Created"
                );

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
                        Booking saved. Taking you to PayMongo to pay...
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

    // A running sale (Promotions → Discounts); the booking is priced with it.
    const activeDiscount =
        getActiveDiscount(selectedVehicle);
    const effectiveDailyRate =
        getEffectiveDailyRate(selectedVehicle);

    const description =
        selectedVehicle.description?.public ??
        "No public description is available for this vehicle.";

    const primaryImage =
        vehicleImages[activeImage]?.url ?? null;

    const categoryName =
        selectedVehicle.category?.name ??
        "Uncategorized";

    /*
     * Reserved or out on a rental can still be booked for other times, and
     * so can a vehicle under maintenance for dates after it — only off road
     * (no end date) has nothing bookable at all.
     */
    const maintenanceWindow = getVehicleMaintenanceWindow(selectedVehicle);
    const isOffRoad = maintenanceWindow?.end === Infinity;
    const isAvailable = isVehicleBookable(selectedVehicle) && !isOffRoad;
    // Settings → Bookings: off road can read as plain blocked dates instead.
    const hideOffRoadNotice = isOffRoad && !offRoadVehicles.showNotice;

    // Booking a rental is a customer action — an operator or admin viewing
    // this page (e.g. from "My Vehicles") shouldn't see a working "Reserve"
    // flow, since the booking endpoint itself is customer-only server-side.
    const isNonCustomerRole =
        isAuthenticated &&
        user?.role !== "customer";

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
            label: "Reviews",
            value:
                reviewCount > 0 ? (
                    <span className="flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                    key={star}
                                    size={14}
                                    className={
                                        star <= Math.round(averageRating)
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-gray-300 dark:text-gray-600"
                                    }
                                />
                            ))}
                        </span>
                        <span>{averageRating.toFixed(1)}</span>
                        <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                            ({reviewCount}{" "}
                            {reviewCount === 1 ? "review" : "reviews"})
                        </span>
                    </span>
                ) : (
                    "No reviews yet"
                ),
            icon: Star,
        },
        {
            label: "Category",
            value: categoryName,
            icon: CarFront,
        },
    ];

    const goToImage = (direction) => {
        setActiveImage((current) => {
            const count = vehicleImages.length;

            if (!count) {
                return 0;
            }

            return (current + direction + count) % count;
        });
    };

    const panelFacts = [
        {
            label: "Seats",
            value: specifications.seatingCapacity
                ? String(specifications.seatingCapacity)
                : "\u2014",
            icon: Users,
        },
        {
            label: "Transmission",
            value: specifications.transmission ?? "\u2014",
            icon: Settings2,
        },
        {
            label: "Fuel",
            value: specifications.fuelType ?? "\u2014",
            icon: Fuel,
        },
        {
            label: "Category",
            value: categoryName,
            icon: CarFront,
        },
    ];

    const renderBookingPanel = ({ sticky = false } = {}) => (
        <div
            className={[
                "rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900",
                sticky
                    ? "shadow-xl shadow-black/5"
                    : "shadow-sm",
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-lg font-black leading-tight tracking-tight text-gray-950 dark:text-white">
                        {vehicleName || "Vehicle"}
                    </p>

                    <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                        Daily Total Price
                    </p>

                    {activeDiscount && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <DiscountBadge
                                discount={activeDiscount}
                                size="md"
                            />
                            <OriginalPrice
                                discount={activeDiscount}
                                reservationFee={pricing.reservationFee}
                                className="text-base"
                            />
                        </div>
                    )}

                    <div className="mt-1 flex items-baseline gap-1">
                        <Price
                            value={
                                effectiveDailyRate +
                                Number(pricing.reservationFee || 0)
                            }
                            className="text-3xl font-black tracking-tight text-green-700 dark:text-green-400"
                        />
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            / day
                        </span>
                    </div>

                    {activeDiscount?.endDate && (
                        <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                            Book by{" "}
                            {new Date(
                                activeDiscount.endDate
                            ).toLocaleDateString("en-PH", {
                                timeZone: "Asia/Manila",
                                month: "short",
                                day: "numeric",
                            })}{" "}
                            to get this price
                        </p>
                    )}
                </div>

                {reviewCount > 0 && (
                    <div className="flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 dark:bg-yellow-500/10">
                        <Star
                            size={14}
                            className="fill-yellow-400 text-yellow-400"
                        />
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {averageRating.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>

            <div
                className={[
                    "mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm font-semibold",
                    isAvailable
                        ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                ].join(" ")}
            >
                {isAvailable ? (
                    <CheckCircle2 size={16} />
                ) : (
                    <Info size={16} />
                )}
                {isAvailable
                    ? "Available for rental"
                    : hideOffRoadNotice
                      ? "Not available to book"
                      : isOffRoad
                        ? "Temporarily off the road"
                        : "Currently unavailable"}
            </div>

            {hideOffRoadNotice && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-gray-100 px-3.5 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <CalendarX2 size={16} className="mt-0.5 shrink-0" />
                    <span>
                        You can&apos;t book this vehicle right now because
                        its dates are blocked. Please choose another
                        vehicle.
                    </span>
                </div>
            )}

            {maintenanceWindow && !hideOffRoadNotice && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <Wrench size={16} className="mt-0.5 shrink-0" />
                    <span>
                        {isOffRoad ? (
                            "This vehicle is off the road for maintenance, so no dates can be booked right now. Check back soon, or choose another vehicle."
                        ) : (
                            <>
                                Under maintenance until{" "}
                                <strong>
                                    {new Date(
                                        maintenanceWindow.until
                                    ).toLocaleString("en-PH", {
                                        month: "long",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </strong>
                                . Those dates are greyed out on the
                                calendar — any date after that can be
                                booked.
                            </>
                        )}
                    </span>
                </div>
            )}

            {hasExpiredLicense && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    <AlertTriangle
                        size={16}
                        className="mt-0.5 shrink-0"
                    />
                    <span>
                        Your driver's license has
                        expired.{" "}
                        <Link
                            to="/customer/profile"
                            className="underline underline-offset-2"
                        >
                            Update it in your profile
                        </Link>{" "}
                        to book a vehicle.
                    </span>
                </div>
            )}

            {!hasExpiredLicense &&
                selfDriveBlocked && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        <AlertTriangle
                            size={16}
                            className="mt-0.5 shrink-0"
                        />
                        <span>
                            Motorcycles are self-drive only, and your
                            license info doesn't cover riding one.{" "}
                            <Link
                                to="/customer/profile"
                                className="underline underline-offset-2"
                            >
                                Update it in your profile
                            </Link>{" "}
                            to book this motorcycle.
                        </span>
                    </div>
                )}

            {!hasExpiredLicense &&
                !selfDriveOnly &&
                isNotLicensedForVehicle && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-3 text-sm font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        <Info
                            size={16}
                            className="mt-0.5 shrink-0"
                        />
                        <span>
                            Your license doesn't
                            cover self-driving this
                            vehicle
                            {availableDrivers.length >
                            0
                                ? " - you can still book it with a driver, or "
                                : " - no drivers are currently available, so "}
                            <Link
                                to="/customer/profile"
                                className="underline underline-offset-2"
                            >
                                update your license
                                info
                            </Link>{" "}
                            to self-drive.
                        </span>
                    </div>
                )}

            <dl className="mt-4 grid grid-cols-2 gap-2.5">
                {panelFacts.map(
                    ({ label, value, icon: Icon }) => (
                        <div
                            key={label}
                            className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/50"
                        >
                            <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                                <Icon size={13} />
                                {label}
                            </dt>
                            <dd className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">
                                {value}
                            </dd>
                        </div>
                    )
                )}
            </dl>

            {pricing.reservationFee !== undefined && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-gray-300 px-3.5 py-3 dark:border-gray-700">
                    <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                            Reservation fee
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Required to reserve
                        </p>
                    </div>

                    <Price
                        value={pricing.reservationFee}
                        className="text-base font-black text-gray-900 dark:text-white"
                    />
                </div>
            )}

            <Button
                type="button"
                size="lg"
                className="mt-5 h-12 w-full text-sm font-bold"
                disabled={
                    !isAvailable ||
                    bookingLoading ||
                    isNonCustomerRole
                }
                onClick={
                    isAvailable && licenseBlocked
                        ? () =>
                              navigate(
                                  "/customer/profile"
                              )
                        : handleOpenBooking
                }
                loading={bookingLoading}
            >
                {!isAvailable
                    ? "Currently Unavailable"
                    : isNonCustomerRole
                      ? "Customers Only"
                      : licenseBlocked
                        ? "Update License to Book"
                        : "Reserve Vehicle"}
            </Button>

            <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
                {!isAvailable
                    ? "Check back later for availability."
                    : selfDriveBlocked && !hasExpiredLicense
                      ? "This motorcycle is self-drive only."
                      : licenseBlocked
                      ? "Your license must be current to book."
                      : isAuthenticated
                        ? "Continue to select your rental details."
                        : "You'll be asked to sign in to reserve."}
            </p>
        </div>
    );

    return (
        <>
            <main className="min-h-screen bg-[#f8f9fb] pb-28 dark:bg-gray-950 lg:pb-0">
                {/* Breadcrumb */}
                <div className="border-b border-gray-200/70 bg-white dark:border-gray-800 dark:bg-gray-950">
                    <div className="mx-auto max-w-7xl px-4 pb-5 pt-24 sm:px-6 lg:px-8">
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
                </div>

                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
                        {/* LEFT COLUMN */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            className="lg:col-span-7 xl:col-span-8"
                        >
                            {/* Gallery */}
                            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <div className="group relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-800">
                                    {primaryImage ? (
                                        <motion.img
                                            key={primaryImage}
                                            initial={{
                                                opacity: 0,
                                                scale: 1.03,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                            }}
                                            transition={{
                                                duration: 0.4,
                                            }}
                                            src={primaryImage}
                                            alt={
                                                vehicleName ||
                                                "Vehicle"
                                            }
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500">
                                            <ImageOff
                                                size={48}
                                                strokeWidth={1.4}
                                            />
                                            <p className="text-sm font-semibold">
                                                No vehicle image
                                            </p>
                                        </div>
                                    )}

                                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-black/10" />

                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pr-20 sm:p-6 sm:pr-24">
                                        <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-sm sm:text-4xl">
                                            {vehicleName || "Vehicle"}
                                        </h1>

                                        {selectedVehicle.variant && (
                                            <p className="mt-1 text-sm font-medium text-white/85 sm:text-base">
                                                {selectedVehicle.variant}
                                            </p>
                                        )}
                                    </div>

                                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5">
                                        <div className="flex flex-wrap gap-2">
                                            {selectedVehicle.isFeatured && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-400/95 px-3 py-1.5 text-xs font-bold text-yellow-950 shadow-sm backdrop-blur-sm">
                                                    <Star
                                                        size={13}
                                                        className="fill-yellow-950"
                                                    />
                                                    Featured
                                                </span>
                                            )}
                                        </div>

                                        {isAuthenticated &&
                                            user?.role ===
                                                "customer" && (
                                                <motion.button
                                                    type="button"
                                                    onClick={
                                                        handleToggleFavorite
                                                    }
                                                    whileTap={{
                                                        scale: 0.85,
                                                    }}
                                                    animate={
                                                        favoriteIds.includes(
                                                            vehicleId
                                                        )
                                                            ? {
                                                                  scale: [
                                                                      1,
                                                                      1.25,
                                                                      1,
                                                                  ],
                                                              }
                                                            : {}
                                                    }
                                                    transition={
                                                        favoriteIds.includes(
                                                            vehicleId
                                                        )
                                                            ? {
                                                                  duration: 0.35,
                                                                  ease: "easeOut",
                                                              }
                                                            : {}
                                                    }
                                                    aria-label="Toggle favorite"
                                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:bg-white dark:bg-gray-950/90 dark:hover:bg-gray-900"
                                                >
                                                    <Heart
                                                        size={19}
                                                        strokeWidth={2}
                                                        className={
                                                            favoriteIds.includes(
                                                                vehicleId
                                                            )
                                                                ? "fill-red-500 text-red-500"
                                                                : "text-gray-500 dark:text-gray-400"
                                                        }
                                                    />
                                                </motion.button>
                                            )}
                                    </div>

                                    {vehicleImages.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    goToImage(-1)
                                                }
                                                aria-label="Previous image"
                                                className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-white group-hover:opacity-100 dark:bg-gray-950/85 dark:text-gray-200"
                                            >
                                                <ChevronLeft
                                                    size={18}
                                                />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    goToImage(1)
                                                }
                                                aria-label="Next image"
                                                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-white group-hover:opacity-100 dark:bg-gray-950/85 dark:text-gray-200"
                                            >
                                                <ChevronRight
                                                    size={18}
                                                />
                                            </button>

                                            <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                                {activeImage + 1} /{" "}
                                                {vehicleImages.length}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {vehicleImages.length > 1 && (
                                    <div className="flex gap-2.5 overflow-x-auto p-3 sm:p-4">
                                        {vehicleImages.map(
                                            (image, index) => (
                                                <button
                                                    key={`${image.url}-${index}`}
                                                    type="button"
                                                    onClick={() =>
                                                        setActiveImage(
                                                            index
                                                        )
                                                    }
                                                    aria-label={`View image ${index + 1}`}
                                                    aria-pressed={
                                                        activeImage ===
                                                        index
                                                    }
                                                    className={[
                                                        "h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-gray-100 transition-all dark:bg-gray-800 sm:h-[72px] sm:w-28",
                                                        activeImage ===
                                                        index
                                                            ? "border-yellow-500 ring-2 ring-yellow-100 dark:ring-yellow-500/20"
                                                            : "border-transparent opacity-70 hover:border-gray-300 hover:opacity-100 dark:hover:border-gray-600",
                                                    ].join(" ")}
                                                >
                                                    <img
                                                        src={image.url}
                                                        alt={`${vehicleName || "Vehicle"} ${index + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Booking panel (mobile / tablet) */}
                            <div className="mt-7 lg:hidden">
                                {renderBookingPanel()}
                            </div>

                            {/* Specifications */}
                            <div className="mt-8">
                                <SectionHeading
                                    eyebrow="Vehicle Information"
                                    title="Specifications"
                                />

                                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                                                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-yellow-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-yellow-500/30"
                                            >
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400">
                                                    <Icon
                                                        size={18}
                                                        strokeWidth={
                                                            1.8
                                                        }
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                                                        {label}
                                                    </p>
                                                    <div className="mt-0.5 truncate text-sm font-bold text-gray-900 dark:text-white">
                                                        {value}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Availability calendar */}
                            <div className="mt-8">
                                <AvailabilityCalendar
                                    vehicleId={
                                        vehicleId
                                    }
                                    showPickupTimes
                                />
                            </div>

                            {/* Reviews */}
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
                                                    {averageRating.toFixed(
                                                        1
                                                    )}
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
                                        ? "See what our customers have to say about their experience with this vehicle."
                                        : "No reviews yet. Be the first to review this vehicle after your rental."}
                                </p>

                                <div className="mt-5">
                                    <ReviewList
                                        reviews={reviews}
                                        loading={reviewsLoading}
                                    />
                                </div>
                            </div>
                        </motion.div>

                        {/* RIGHT COLUMN - sticky booking panel */}
                        <div className="hidden lg:col-span-5 lg:block xl:col-span-4">
                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.4,
                                    delay: 0.1,
                                }}
                                className="lg:sticky lg:top-24"
                            >
                                {renderBookingPanel({
                                    sticky: true,
                                })}
                            </motion.div>
                        </div>
                    </div>

                    {/* Explore more */}
                    <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight text-gray-950 dark:text-white">
                                Ready to explore Albay?
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Browse more vehicles and find the
                                right ride for your trip.
                            </p>
                        </div>

                        <Link to="/vehicles">
                            <Button
                                variant="outline"
                                leftIcon={
                                    <ArrowLeft size={17} />
                                }
                            >
                                Back to Fleet
                            </Button>
                        </Link>
                    </div>

                    <SimilarVehicles vehicle={selectedVehicle} />
                </div>

                {/* Mobile sticky action bar */}
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95 lg:hidden">
                    <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Daily total
                            </p>
                            <div className="flex items-baseline gap-1">
                                <OriginalPrice
                                    discount={activeDiscount}
                                    reservationFee={pricing.reservationFee}
                                    className="mr-1 text-xs"
                                />
                                <Price
                                    value={
                                        effectiveDailyRate +
                                        Number(pricing.reservationFee || 0)
                                    }
                                    className="text-xl font-black tracking-tight text-green-700 dark:text-green-400"
                                />
                                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    / day
                                </span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            size="lg"
                            className="h-12 flex-1 text-sm font-bold"
                            disabled={
                                !isAvailable ||
                                bookingLoading ||
                                isNonCustomerRole
                            }
                            onClick={
                                isAvailable && licenseBlocked
                                    ? () =>
                                          navigate(
                                              "/customer/profile"
                                          )
                                    : handleOpenBooking
                            }
                            loading={bookingLoading}
                        >
                            {!isAvailable
                                ? "Unavailable"
                                : isNonCustomerRole
                                  ? "Customers Only"
                                  : licenseBlocked
                                    ? "Update License"
                                    : "Reserve"}
                        </Button>
                    </div>
                </div>
            </main>

            <BookingDialog
                open={bookingOpen}
                vehicle={selectedVehicle}
                drivers={selfDriveOnly ? [] : availableDrivers}
                loading={bookingLoading || driversLoading}
                errors={bookingError}
                forceWithDriver={noLicenseAtAll}
                onSubmit={handleBookingSubmit}
                onClose={handleCloseBooking}
            />
        </>
    );
};

export default VehicleDetails;
