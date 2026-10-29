import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    AlertTriangle,
    Banknote,
    CalendarDays,
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Clock,
    CreditCard,
    FileSignature,
    Flag,
    Gift,
    Info,
    Map as MapIcon,
    MapPin,
    MessageSquareText,
    Navigation,
    Receipt,
    Repeat,
    Route,
    Ticket,
    UserRound,
    Wallet,
} from "lucide-react";

import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";
import Modal from "../common/Modal";
import Select from "../common/Select";
import Textarea from "../common/Textarea";
import ReviewSection from "../common/ReviewSection";
import ReviewField from "../common/ReviewField";
import TermsAgreement from "../booking/TermsAgreement";
import { isTermsOutdatedError } from "../../constants/legalDocuments";
import DriverProfileModal from "../driver/DriverProfileModal";
import DriverPicker from "../booking/DriverPicker";
import DriverOptionCards from "../booking/DriverOptionCards";
import PaymentMethodPicker from "../booking/PaymentMethodPicker";
import VoucherTickets from "../booking/VoucherTickets";
import LocationPicker from "../maps/LocationPicker";
import BookingDateRangeCalendar from "../vehicle/BookingDateRangeCalendar";

import useServiceLocation from "../../hooks/serviceLocations/useServiceLocation";

import useSettings from "../../hooks/settings/useSettings";

import useVoucher from "../../hooks/promotions/useVoucher";

import useToast from "../../hooks/toast/useToast";

import { calculateDistanceKm } from "../../utils/distance";
import {
    getActiveDiscount,
    getDiscountBadgeText,
    getEffectiveDailyRate,
} from "../../utils/vehicleDiscount";

import { reverseGeocode } from "../../services/geocodingService";

import {
    calculateDistanceFeesPreview,
} from "../../api/bookingApi";

import {
    checkVehicleAvailability,
    getVehiclePickupTimes,
} from "../../api/vehicleApi";
import { getAvailableDrivers } from "../../api/driverApi";

import {
    DEFAULT_PICKUP_TIME,
    MIN_BOOKING_LEAD_HOURS,
    formatPickupHours,
    formatPickupTime,
    getEarliestPickupMs,
    getNextPickupTime,
    getPickupTimeOptions,
    isPickupTooSoon,
    toPickupDateTime,
} from "../../utils/pickupTime";

/* "14:30" → 870. */
const timeToMinutes = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);

    return hour * 60 + minute;
};
import { describeBookingHours } from "../../utils/bookingPolicyText";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import {
    getDriverDailyRate,
    getDriverListRate,
} from "../../utils/driverPricing";

/* An earliest-pickup moment as "Thu, Oct 2, 10:00 AM" (Philippine time). */
const formatEarliestPickup = (ms) =>
    new Date(ms).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/* "Wed, Oct 1, 2026" for a "YYYY-MM-DD" key, independent of the viewer's timezone. */
const formatDateKey = (dateKey) =>
    dateKey
        ? new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-PH", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "—";

const STEP_VARIANTS = {
    initial: {
        opacity: 0,
        x: 20,
    },

    animate: {
        opacity: 1,
        x: 0,
    },

    exit: {
        opacity: 0,
        x: -20,
    },
};

const STEP_TRANSITION = {
    duration: 0.2,
    ease: "easeOut",
};

const FORM_STEPS = [
    {
        title: "Rental Details",
        label: "Details",
        icon: CalendarDays,
        description:
            "Choose your rental dates, driver option, and pickup and return locations.",
    },
    {
        title: "Terms and Agreements",
        label: "Terms",
        icon: FileSignature,
        description:
            "Review and accept the terms before proceeding.",
    },
    {
        title: "Review Booking",
        label: "Review",
        icon: ClipboardCheck,
        description:
            "Review your booking details before submitting your request.",
    },
];

/* Shared look for every form section card. */
const SECTION_CARD_CLASS =
    "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6";

const SectionHeader = ({ icon: Icon, title, description, size = "lg" }) => (
    <div
        className={`flex items-start gap-3 ${
            size === "lg"
                ? "mb-5 border-b border-gray-100 pb-4 dark:border-gray-800"
                : "mb-3"
        }`}
    >
        <span
            className={`flex shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400 ${
                size === "lg" ? "h-10 w-10" : "h-8 w-8"
            }`}
        >
            <Icon size={size === "lg" ? 19 : 16} />
        </span>

        <div className="min-w-0">
            <h3
                className={`font-semibold tracking-tight text-gray-900 dark:text-white ${
                    size === "lg" ? "text-base sm:text-lg" : "text-sm sm:text-base"
                }`}
            >
                {title}
            </h3>

            {description && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            )}
        </div>
    </div>
);

const EMPTY_ERRORS = {};

const PAYMENT_METHOD_OPTIONS = [
    {
        label: "GCash",
        value: "GCASH",
        icon: CreditCard,
        description:
            "Pay now via GCash or QRPh through PayMongo",
        timing: "Due immediately",
        note: "You will be redirected to PayMongo to complete payment after booking. Unless you pay in full now, the rest of the rental can be paid in cash when you pick up the vehicle.",
    },
    /*
     * No "Cash on Pickup" for the reservation fee: it must be paid online
     * before a booking is approved (the server refuses it), so a customer who
     * doesn't show up can't hold a vehicle for free. The rest of the rental
     * is still paid at pickup.
     */
];

const createInitialState = () => ({
    // Manila "YYYY-MM-DD" keys from the calendar, plus one pickup time
    // (the return is at the same time on endDate).
    startDate: "",
    endDate: "",
    pickupTime: DEFAULT_PICKUP_TIME,

    driverOption: "Without Driver",

    driver: "",

    paymentMethod: "",

    pickupLocation: {
        serviceLocationId: "",
        type: "",
        address: "",
        name: "",
        region: "",
        province: "",
        city: "",
        barangay: "",
        latitude: null,
        longitude: null,
        fee: 0,
    },

    returnLocation: {
        serviceLocationId: "",
        type: "",
        address: "",
        name: "",
        region: "",
        province: "",
        city: "",
        barangay: "",
        latitude: null,
        longitude: null,
        fee: 0,
    },

    customerNotes: "",
});

const BookingForm = ({
    vehicle = null,
    drivers = [],
    loading = false,
    errors = EMPTY_ERRORS,
    errorMessage = "",
    forceWithDriver = false,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] =
        useState(
            createInitialState()
        );

    const [currentStep, setCurrentStep] =
        useState(0);

    const stepTopRef =
        useScrollTopOnChange(currentStep);

    const [
        validationErrors,
        setValidationErrors,
    ] = useState({});

    const [
        termsAccepted,
        setTermsAccepted,
    ] = useState(false);

    /*
     * The Terms & Conditions version shown on the Terms step: sent with the
     * booking so the server records the one the customer accepted. Bumping
     * the reload key makes that step fetch the newest version.
     */
    const [termsVersionId, setTermsVersionId] =
        useState(null);

    const [termsReloadKey, setTermsReloadKey] =
        useState(0);

    /*
     * The terms were republished long enough ago that the version shown
     * can't be accepted any more: back to the Terms step with the new one,
     * unticked, so the customer reads it before booking.
     */
    useEffect(() => {
        if (!isTermsOutdatedError(errorMessage)) {
            return;
        }

        setTermsAccepted(false);
        setTermsVersionId(null);
        setTermsReloadKey((key) => key + 1);
        setCurrentStep(1);
    }, [errorMessage]);

    /*
     * GCash-only choice: pay just the reservation fee now (the rest due at
     * pickup, in cash) or the full rental total now. Reset
     * whenever the customer picks a payment method, so switching away from
     * and back to GCash doesn't carry over a stale choice.
     */
    // Driver profile previewed from the review step (opens in place).
    const [profileDriverId, setProfileDriverId] =
        useState(null);

    // The driver search pop-up (see DriverPicker).
    const [driverPickerOpen, setDriverPickerOpen] =
        useState(false);

    const [payInFull, setPayInFull] =
        useState(false);

    const {
        serviceLocations,
        loading: locationsLoading,
        getEnabledServiceLocations,
    } = useServiceLocation();

    const {
        settings,
        getSettings,
    } = useSettings();

    const defaultsAppliedRef = useRef(false);

    const geocodingInProgressRef = useRef(false);

    const [geocodingSection, setGeocodingSection] =
        useState(null);

    const [geocodeError, setGeocodeError] =
        useState(null);

    /* "pickupLocation" | "returnLocation" while its map dialog is open. */
    const [mapPickerSection, setMapPickerSection] =
        useState(null);

    const [distanceFeePreview, setDistanceFeePreview] =
        useState(null);

    const [distanceFeeLoading, setDistanceFeeLoading] =
        useState(false);

    const [distanceFeeError, setDistanceFeeError] =
        useState(null);

    const [availabilityCheck, setAvailabilityCheck] =
        useState(null);

    const [availabilityLoading, setAvailabilityLoading] =
        useState(false);

    /*
     * Which pickup times work for the chosen dates ({ "14:30": true, ... }),
     * or null until both dates are picked / if the lookup fails (then the
     * live check below still catches a clash).
     */
    const [pickupTimeAvailability, setPickupTimeAvailability] =
        useState(null);

    // Set when a date change moved the customer off a now-taken time.
    const [pickupTimeMovedFrom, setPickupTimeMovedFrom] =
        useState(null);

    // Settings → Bookings: booking hours (overnight bookings start later)
    // and the pickup window.
    const {
        bookingHours,
        pickupHours,
        enableDistanceFeeCalculation,
        driverPricing,
        requireAdminDriverAssignment: publicRequireAdminDriverAssignment,
        motorcycleDriversEnabled: publicMotorcycleDriversEnabled,
    } = usePublicRefundSettings();

    /*
     * Whether admins pick the driver. Customers can't read the admin-only
     * settings, so this comes from the public settings (admins booking on a
     * customer's behalf have both).
     */
    const requireAdminDriverAssignment = Boolean(
        publicRequireAdminDriverAssignment ||
            settings?.driverAssignmentSettings?.requireAdminDriverAssignment
    );

    /*
     * Settings → Drivers can make motorcycles self-drive only: no driver
     * option for them (the server refuses one too). That also outranks a
     * no-license account's forced "With Driver" — VehicleDetails stops such
     * a customer before the form opens.
     */
    const selfDriveOnly =
        vehicle?.vehicleType === "Motorcycle" &&
        (publicMotorcycleDriversEnabled === false ||
            settings?.driverAssignmentSettings?.motorcycleDriversEnabled ===
                false);

    const mustUseDriver = forceWithDriver && !selfDriveOnly;

    const toast = useToast();

    const [showCancelModal, setShowCancelModal] =
        useState(false);

    const {
        availableVouchers,
        appliedVoucher: storedAppliedVoucher,
        fetchAvailableVouchers,
        applyExistingVoucher,
        clearAppliedVoucherAction,
    } = useVoucher();

    useEffect(() => {
        getEnabledServiceLocations();
    }, [getEnabledServiceLocations]);

    useEffect(() => {
        fetchAvailableVouchers();
    }, [fetchAvailableVouchers]);

    useEffect(() => {
        getSettings();
    }, [getSettings]);

    /*
     * Unlike the admin-assignment fixed-value case below (which only
     * changes what's rendered, not formData itself), this actually syncs
     * the submitted value - a disabled dropdown showing "With Driver"
     * means nothing if the payload still sends whatever driverOption
     * defaulted to.
     */
    useEffect(() => {
        if (!mustUseDriver) {
            return;
        }

        setFormData((previous) =>
            previous.driverOption === "With Driver"
                ? previous
                : {
                      ...previous,
                      driverOption: "With Driver",
                  }
        );
    }, [mustUseDriver]);

    // Self-drive only: never submit a driver for this vehicle.
    useEffect(() => {
        if (!selfDriveOnly) {
            return;
        }

        setFormData((previous) =>
            previous.driverOption === "Without Driver" &&
            !previous.driver
                ? previous
                : {
                      ...previous,
                      driverOption: "Without Driver",
                      driver: "",
                  }
        );
    }, [selfDriveOnly]);

    useEffect(() => {
        if (defaultsAppliedRef.current) {
            return;
        }

        if (
            serviceLocations.length === 0 ||
            locationsLoading
        ) {
            return;
        }

        const defaultLocation =
            serviceLocations.find(
                (loc) => loc.isDefault
            );

        if (!defaultLocation) {
            return;
        }

        const addressParts = [
            defaultLocation.barangay,
            defaultLocation.city,
            defaultLocation.province,
            defaultLocation.region,
        ].filter(Boolean);

        const address =
            addressParts.join(", ") ||
            defaultLocation.address ||
            "";

        const type = address || "Office";

        const baseLocation = {
            serviceLocationId:
                defaultLocation._id,
            type,
            address,
            name: defaultLocation.name || "",
            region:
                defaultLocation.region || "",
            province:
                defaultLocation.province || "",
            city: defaultLocation.city || "",
            barangay:
                defaultLocation.barangay || "",
            latitude:
                defaultLocation.latitude ??
                null,
            longitude:
                defaultLocation.longitude ??
                null,
        };

        setFormData((previous) => {
            if (
                previous
                    .pickupLocation
                    .serviceLocationId &&
                !settings?.allowOnlyDefaultLocation
            ) {
                return previous;
            }

            return {
                ...previous,
                pickupLocation: {
                    ...baseLocation,
                    fee:
                        defaultLocation.pickupFee ??
                        0,
                },
                returnLocation: {
                    ...baseLocation,
                    fee:
                        defaultLocation.returnFee ??
                        0,
                },
            };
        });

        defaultsAppliedRef.current = true;
    }, [
        serviceLocations,
        locationsLoading,
        settings?.allowOnlyDefaultLocation,
    ]);

    const distanceFeeRequestKey = JSON.stringify([
        enableDistanceFeeCalculation, formData.driverOption,
        formData.pickupLocation.serviceLocationId, formData.pickupLocation.latitude, formData.pickupLocation.longitude,
        formData.returnLocation.serviceLocationId, formData.returnLocation.latitude, formData.returnLocation.longitude,
    ]);
    const [confirmedDistanceFeeKey, setConfirmedDistanceFeeKey] = useState(null);
    const feesPending = enableDistanceFeeCalculation && formData.driverOption !== "With Driver" &&
        (confirmedDistanceFeeKey !== distanceFeeRequestKey || distanceFeeLoading || Boolean(distanceFeeError) || !distanceFeePreview);

    useEffect(() => {
        const pickupLat =
            formData.pickupLocation.latitude;
        const pickupLng =
            formData.pickupLocation.longitude;
        const returnLat =
            formData.returnLocation.latitude;
        const returnLng =
            formData.returnLocation.longitude;

        if (
            (!formData.pickupLocation.serviceLocationId && (pickupLat == null || pickupLng == null)) ||
            (!formData.returnLocation.serviceLocationId && (returnLat == null || returnLng == null))
        ) {
            setDistanceFeePreview(null);
            setDistanceFeeError(null);
            setDistanceFeeLoading(false);
            return;
        }

        if (!enableDistanceFeeCalculation) {
            setDistanceFeePreview(null);
            setDistanceFeeError(null);
            setDistanceFeeLoading(false);
            return undefined;
        }

        setDistanceFeePreview(null);

        let isCancelled = false;

        const calculateFees =
            async () => {
                setDistanceFeeLoading(true);
                setDistanceFeeError(null);

                try {
                    const { data } =
                        await calculateDistanceFeesPreview(
                            {
                                pickupServiceLocationId: formData.pickupLocation.serviceLocationId,
                                returnServiceLocationId: formData.returnLocation.serviceLocationId,
                                driverOption: formData.driverOption,
                                pickupLatitude:
                                    pickupLat,
                                pickupLongitude:
                                    pickupLng,
                                returnLatitude:
                                    returnLat,
                                returnLongitude:
                                    returnLng,
                            }
                        );

                    if (!isCancelled) {
                        setConfirmedDistanceFeeKey(distanceFeeRequestKey);
                        setDistanceFeePreview(
                            data?.data ||
                                null
                        );
                    }
                } catch (error) {
                    if (!isCancelled) {
                        setDistanceFeePreview(
                            null
                        );
                        setDistanceFeeError(
                            error.response?.data?.message || "Unable to calculate distance fees."
                        );
                    }
                } finally {
                    if (!isCancelled) {
                        setDistanceFeeLoading(
                            false
                        );
                    }
                }
            };

        calculateFees();

        return () => {
            isCancelled = true;
        };
    }, [
        distanceFeeRequestKey,
        formData.driverOption,
        formData.pickupLocation.serviceLocationId,
        formData.returnLocation.serviceLocationId,
        formData.pickupLocation.latitude,
        formData.pickupLocation.longitude,
        formData.returnLocation.latitude,
        formData.returnLocation.longitude,
        enableDistanceFeeCalculation,
    ]);

    const pickupTimesDriverId =
        formData.driverOption === "With Driver" &&
        formData.driver
            ? formData.driver
            : null;

    /*
     * Free pickup times for the chosen dates (and driver), so taken times
     * can be disabled in the list instead of failing the check below.
     */
    useEffect(() => {
        const vehicleId = vehicle?._id ?? vehicle?.id;

        setPickupTimeAvailability(null);

        if (
            !vehicleId ||
            !formData.startDate ||
            !formData.endDate ||
            formData.endDate <= formData.startDate
        ) {
            return undefined;
        }

        let isCancelled = false;

        getVehiclePickupTimes(
            vehicleId,
            formData.startDate,
            formData.endDate,
            pickupTimesDriverId
        )
            .then((response) => {
                if (isCancelled || !response?.data?.times) {
                    return;
                }

                setPickupTimeAvailability(
                    Object.fromEntries(
                        response.data.times.map(({ time, available }) => [
                            time,
                            available,
                        ])
                    )
                );
            })
            .catch(() => {});

        return () => {
            isCancelled = true;
        };
    }, [
        vehicle,
        formData.startDate,
        formData.endDate,
        pickupTimesDriverId,
    ]);

    /*
     * Drivers who can't take the chosen dates — already booked then, or a
     * license that runs out first — so the picker can mark them instead of
     * the booking failing at payment. The dated list leaves out the second
     * kind, so anyone in `drivers` it doesn't list as free counts.
     */
    const [unavailableDriverIds, setUnavailableDriverIds] = useState(
        () => new Set()
    );

    // Stable across renders (`drivers` may be a fresh default array).
    const driverIdsKey = drivers
        .map((driver) => driver._id ?? driver.id)
        .join(",");

    useEffect(() => {
        setUnavailableDriverIds((previous) =>
            previous.size ? new Set() : previous
        );

        const driverIds = driverIdsKey ? driverIdsKey.split(",") : [];

        if (
            formData.driverOption !== "With Driver" ||
            requireAdminDriverAssignment ||
            driverIds.length === 0 ||
            !formData.startDate ||
            !formData.endDate ||
            formData.endDate <= formData.startDate
        ) {
            return undefined;
        }

        let isCancelled = false;

        getAvailableDrivers({
            startDate: toPickupDateTime(
                formData.startDate,
                formData.pickupTime
            ).toISOString(),
            endDate: toPickupDateTime(
                formData.endDate,
                formData.pickupTime
            ).toISOString(),
        })
            .then((response) => {
                if (isCancelled) {
                    return;
                }

                const free = new Set(
                    (response?.data ?? [])
                        .filter((driver) => !driver.busy)
                        .map((driver) => driver._id ?? driver.id)
                );

                setUnavailableDriverIds(
                    new Set(
                        driverIds.filter((driverId) => !free.has(driverId))
                    )
                );
            })
            .catch(() => {});

        return () => {
            isCancelled = true;
        };
    }, [
        driverIdsKey,
        formData.driverOption,
        formData.startDate,
        formData.endDate,
        formData.pickupTime,
        requireAdminDriverAssignment,
    ]);

    /*
     * Live conflict check as soon as the customer has picked dates, so a
     * clash with an existing booking surfaces immediately instead of only
     * after the whole multi-step form is submitted.
     */
    useEffect(() => {
        const vehicleId = vehicle?._id ?? vehicle?.id;

        if (
            !vehicleId ||
            !formData.startDate ||
            !formData.endDate
        ) {
            setAvailabilityCheck(null);
            return;
        }

        const start = new Date(
            `${formData.startDate}T00:00:00`
        );

        const end = new Date(
            `${formData.endDate}T00:00:00`
        );

        if (end <= start) {
            setAvailabilityCheck(null);
            return;
        }

        const driverId =
            formData.driverOption ===
                "With Driver" &&
            formData.driver
                ? formData.driver
                : null;

        let isCancelled = false;

        const runCheck = async () => {
            setAvailabilityLoading(true);

            try {
                const { data } =
                    await checkVehicleAvailability(
                        vehicleId,
                        toPickupDateTime(
                            formData.startDate,
                            formData.pickupTime
                        ).toISOString(),
                        toPickupDateTime(
                            formData.endDate,
                            formData.pickupTime
                        ).toISOString(),
                        driverId
                    );

                if (!isCancelled) {
                    setAvailabilityCheck(
                        data || null
                    );
                }
            } catch {
                if (!isCancelled) {
                    setAvailabilityCheck(null);
                }
            } finally {
                if (!isCancelled) {
                    setAvailabilityLoading(false);
                }
            }
        };

        runCheck();

        return () => {
            isCancelled = true;
        };
    }, [
        vehicle,
        formData.startDate,
        formData.endDate,
        formData.pickupTime,
        formData.driverOption,
        formData.driver,
    ]);

    const defaultServiceLocation =
        serviceLocations.find(
            (loc) => loc.isDefault
        );

    const pickupDistanceKm = useMemo(() => {
        if (!defaultServiceLocation) {
            return null;
        }

        const defaultLat =
            defaultServiceLocation.latitude;
        const defaultLng =
            defaultServiceLocation.longitude;

        if (
            defaultLat == null ||
            defaultLng == null
        ) {
            return null;
        }

        return calculateDistanceKm(
            defaultLat,
            defaultLng,
            formData.pickupLocation.latitude,
            formData.pickupLocation.longitude
        );
    }, [
        defaultServiceLocation,
        formData.pickupLocation.latitude,
        formData.pickupLocation.longitude,
    ]);

    const returnDistanceKm = useMemo(() => {
        if (!defaultServiceLocation) {
            return null;
        }

        const defaultLat =
            defaultServiceLocation.latitude;
        const defaultLng =
            defaultServiceLocation.longitude;

        if (
            defaultLat == null ||
            defaultLng == null
        ) {
            return null;
        }

        return calculateDistanceKm(
            defaultLat,
            defaultLng,
            formData.returnLocation.latitude,
            formData.returnLocation.longitude
        );
    }, [
        defaultServiceLocation,
        formData.returnLocation.latitude,
        formData.returnLocation.longitude,
    ]);

    const getFieldError = (path) =>
        validationErrors?.[path] ||
        errors?.[path] ||
        "";

    /*
     * A clock for the pickup-time list: times sooner than the minimum
     * notice drop out of it as they pass (mainly when booking for today).
     */
    const [clockNow, setClockNow] = useState(0);

    useEffect(() => {
        const tick = () => setClockNow(Date.now());

        tick();

        const timer = setInterval(tick, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    // Every time in the configured pickup window (Settings → Bookings).
    const allPickupTimes = useMemo(
        () => getPickupTimeOptions(pickupHours),
        [pickupHours]
    );

    /*
     * Only the times that can actually be booked: too-soon times (already
     * passed, or inside the minimum notice / booking hours) and times taken
     * for the chosen dates aren't listed at all.
     */
    const pickupTimeOptions = useMemo(
        () =>
            allPickupTimes.filter(
                (option) =>
                    !(
                        formData.startDate &&
                        clockNow > 0 &&
                        isPickupTooSoon(
                            formData.startDate,
                            option.value,
                            clockNow,
                            bookingHours
                        )
                    ) &&
                    pickupTimeAvailability?.[option.value] !== false
            ),
        [
            allPickupTimes,
            formData.startDate,
            clockNow,
            pickupTimeAvailability,
            bookingHours,
        ]
    );

    // First/last free time for the chosen dates, for the hint under the list.
    const freePickupTimes = pickupTimeAvailability
        ? allPickupTimes.filter(
              ({ value }) => pickupTimeAvailability[value]
          )
        : null;

    const noPickupTimeFree =
        freePickupTimes !== null && freePickupTimes.length === 0;

    const pickupTimesLimited =
        freePickupTimes !== null &&
        freePickupTimes.length > 0 &&
        freePickupTimes.length < allPickupTimes.length;

    // A date is chosen but every one of its times has passed or is taken.
    const noPickupTimeLeft =
        Boolean(formData.startDate) &&
        pickupTimeOptions.length === 0 &&
        !noPickupTimeFree;

    /*
     * Keep the chosen time one that's listed: when the dates, driver, pickup
     * hours or the clock make it invalid, move to the nearest valid time
     * (and say so once dates are picked).
     */
    useEffect(() => {
        if (
            pickupTimeOptions.length === 0 ||
            pickupTimeOptions.some(
                ({ value }) => value === formData.pickupTime
            )
        ) {
            return;
        }

        const chosenMinute = timeToMinutes(formData.pickupTime);

        const nearest = [...pickupTimeOptions].sort(
            (a, b) =>
                Math.abs(timeToMinutes(a.value) - chosenMinute) -
                    Math.abs(timeToMinutes(b.value) - chosenMinute) ||
                timeToMinutes(a.value) - timeToMinutes(b.value)
        )[0].value;

        if (formData.startDate) {
            setPickupTimeMovedFrom(formData.pickupTime);
        }

        setFormData((previous) => ({
            ...previous,
            pickupTime: nearest,
        }));
    }, [pickupTimeOptions, formData.pickupTime, formData.startDate]);

    const rentalDays = useMemo(() => {
        if (
            !formData.startDate ||
            !formData.endDate
        ) {
            return 0;
        }

        const start = new Date(
            `${formData.startDate}T00:00:00`
        );

        const end = new Date(
            `${formData.endDate}T00:00:00`
        );

        const difference =
            end.getTime() -
            start.getTime();

        if (difference <= 0) {
            return 0;
        }

        // Round, not ceil: in a daylight-saving timezone two local
        // midnights can be 23 or 25 hours apart.
        return Math.round(
            difference /
                (1000 * 60 * 60 * 24)
        );
    }, [
        formData.startDate,
        formData.endDate,
    ]);

    // After any running vehicle discount, as the server will price it.
    const vehicleDiscount = getActiveDiscount(vehicle);
    const effectiveDailyRate = getEffectiveDailyRate(vehicle);

    const estimatedSubtotal = useMemo(() => {
        const dailyRate = getEffectiveDailyRate(vehicle);

        if (
            !dailyRate ||
            !rentalDays
        ) {
            return 0;
        }

        return dailyRate * rentalDays;
    }, [
        vehicle,
        rentalDays,
    ]);

    const driverDailyRate = useMemo(() => {
        const chosenDriver = drivers.find(
            (driver) => (driver._id ?? driver.id) === formData.driver
        );
        return getDriverDailyRate({
            driverOption: formData.driverOption,
            driver: chosenDriver,
            driverPricing,
            requireAdminDriverAssignment,
        });
    }, [drivers, formData.driver, formData.driverOption, driverPricing, requireAdminDriverAssignment]);
    const driverFee = Math.round(driverDailyRate * rentalDays * 100) / 100;

    /*
     * When distance-fee calculation is enabled the server returns a preview;
     * otherwise the fee is the selected service location's own configured
     * pickup/return fee, which handleLocationChange stores on the location.
     */
    const effectivePickupFee = useMemo(
        () => {
            if (formData.driverOption === "With Driver") return 0;
            const fee = enableDistanceFeeCalculation
                ? distanceFeePreview?.pickupDistanceFee
                : formData.pickupLocation.fee;
            return Number(fee ?? 0) || 0;
        },
        [
            enableDistanceFeeCalculation,
            distanceFeePreview,
            formData.pickupLocation.fee,
            formData.driverOption,
        ]
    );

    const effectiveReturnFee = useMemo(
        () => {
            if (formData.driverOption === "With Driver") return 0;
            const fee = enableDistanceFeeCalculation
                ? distanceFeePreview?.returnDistanceFee
                : formData.returnLocation.fee;
            return Number(fee ?? 0) || 0;
        },
        [
            enableDistanceFeeCalculation,
            distanceFeePreview,
            formData.returnLocation.fee,
            formData.driverOption,
        ]
    );

    const estimatedTotalBeforeVoucher =
        useMemo(
            () =>
                estimatedSubtotal +
                driverFee +
                (vehicle?.pricing
                    ?.reservationFee ||
                    0) +
                effectivePickupFee +
                effectiveReturnFee,
            [
                estimatedSubtotal,
                driverFee,
                vehicle,
                effectivePickupFee,
                effectiveReturnFee,
            ]
        );

    const basePricing = useMemo(
        () => ({
            dailyRate:
                getEffectiveDailyRate(vehicle),
            reservationFee:
                Number(
                    vehicle?.pricing
                        ?.reservationFee ??
                    0
                ),
            rentalDays:
                rentalDays,
            subtotal:
                estimatedSubtotal,
            driverDailyRate,
            driverFee,
            pickupDistanceFee:
                effectivePickupFee,
            returnDistanceFee:
                effectiveReturnFee,
            totalAmount:
                estimatedTotalBeforeVoucher,
        }),
        [
            estimatedSubtotal,
            driverDailyRate,
            driverFee,
            estimatedTotalBeforeVoucher,
            vehicle,
            effectivePickupFee,
            effectiveReturnFee,
            rentalDays,
        ]
    );

    const pricingKey = JSON.stringify(basePricing);
    const voucherCode = storedAppliedVoucher?.voucher?.code;
    const [confirmedVoucher, setConfirmedVoucher] = useState(null);
    const voucherMatches = confirmedVoucher?.key === pricingKey && confirmedVoucher?.code === voucherCode;
    const appliedVoucher = voucherMatches ? confirmedVoucher.value : null;
    const voucherPending = Boolean(voucherCode) && (!voucherMatches || feesPending);

    useEffect(() => {
        if (!voucherCode || feesPending || voucherMatches) return;
        let cancelled = false;
        const request = applyExistingVoucher(voucherCode, basePricing);
        request.then((result) => {
            if (cancelled) return;
            if (result.meta.requestStatus === "fulfilled") {
                setConfirmedVoucher({ key: pricingKey, code: voucherCode, value: result.payload.data });
            } else {
                clearAppliedVoucherAction();
                toast.error("This voucher no longer applies to the updated booking.");
            }
        });
        return () => { cancelled = true; request.abort?.(); };
    }, [voucherCode, feesPending, voucherMatches, pricingKey, basePricing, applyExistingVoucher, clearAppliedVoucherAction, toast]);

    const voucherDiscount =
        useMemo(() => {
            const discountObject =
                appliedVoucher
                    ?.pricing
                    ?.voucher
                    ?.discount;

            if (
                !appliedVoucher ||
                !discountObject
            ) {
                return 0;
            }

            const discountFields =
                Object.entries(
                    discountObject
                ).filter(
                    ([key]) =>
                        key.endsWith(
                            "Discount"
                        )
                );

            if (
                discountFields.length ===
                0
            ) {
                return 0;
            }

            const discount =
                discountFields.reduce(
                    (
                        sum,
                        [, val]
                    ) =>
                        sum +
                        (Number(
                            val
                        ) ||
                            0),
                    0
                );

            return discount;
        }, [
            appliedVoucher
        ]);

    const finalTotal =
        useMemo(
            () =>
                Math.max(
                    0,
                    estimatedTotalBeforeVoucher -
                        voucherDiscount
                ),
            [
                estimatedTotalBeforeVoucher,
                voucherDiscount,
            ]
        );

    /*
     * What's paid at booking: the reservation and pickup distance fees, less
     * a voucher on either of them (the server's getUpfrontFees). Other
     * voucher types lower only what's left to pay.
     */
    const upfrontFees = useMemo(() => {
        const discount =
            appliedVoucher?.pricing?.voucher?.discount || {};

        const reservationFee = Math.max(
            0,
            basePricing.reservationFee -
                (Number(discount.reservationFeeDiscount) || 0)
        );

        const pickupDistanceFee = Math.max(
            0,
            basePricing.pickupDistanceFee -
                (Number(discount.pickupFeeDiscount) || 0)
        );

        return {
            reservationFee,
            total: reservationFee + pickupDistanceFee,
        };
    }, [appliedVoucher, basePricing]);

    /*
     * What the Pay button charges, as the server sizes the payment: the full
     * total when paying in full, otherwise the upfront fees. Nothing to pay
     * online means a plain "Submit Booking".
     */
    const amountDueNow =
        formData.paymentMethod === "GCASH" && payInFull
            ? finalTotal
            : upfrontFees.total;

    const paysOnline =
        formData.paymentMethod === "GCASH" && amountDueNow > 0;

    const formatCurrency = (
        value
    ) =>
        `₱${Number(
            value || 0
        ).toLocaleString(
            "en-PH",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        )}`;

    // Each driver's own daily rate in the driver picker; null unless
    // drivers are priced individually (otherwise they all cost the same).
    const getListRate = useCallback(
        (driver) => getDriverListRate(driver, driverPricing),
        [driverPricing]
    );

    const getListRateText = (driver) => {
        const rate = getListRate(driver);

        return rate === null ? null : `${formatCurrency(rate)}/day`;
    };

    /*
     * Price shown on the With Driver card even before it's picked: the
     * chosen driver's rate once there is one, else the rate every driver
     * shares, else (individual pricing) the cheapest driver's.
     */
    const withDriverRateText = useMemo(() => {
        if (
            formData.driverOption === "With Driver" &&
            (formData.driver || requireAdminDriverAssignment)
        ) {
            return `${formatCurrency(driverDailyRate)}/day`;
        }

        const rates = (
            requireAdminDriverAssignment || drivers.length === 0
                ? [null]
                : drivers
        ).map((driver) =>
            getDriverDailyRate({
                driverOption: "With Driver",
                driver,
                driverPricing,
                requireAdminDriverAssignment,
            })
        );

        const lowest = Math.min(...rates);

        return `${new Set(rates).size > 1 ? "From " : ""}${formatCurrency(lowest)}/day`;
    }, [
        formData.driverOption,
        formData.driver,
        driverDailyRate,
        drivers,
        driverPricing,
        requireAdminDriverAssignment,
    ]);

    const handleChange = (
        event
    ) => {
        const {
            name,
            value,
        } = event.target;

        setFormData(
            (previous) => ({
                ...previous,
                [name]: value,
            })
        );

        if (
            validationErrors?.[name]
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    delete updated[name];

                    return updated;
                }
            );
        }
    };

    const handleDateRangeChange = ({
        startDate,
        endDate,
    }) => {
        // Picking today: move off pickup times that have already passed.
        const nowMs = Date.now();

        setPickupTimeMovedFrom(null);

        setFormData(
            (previous) => {
                const pickupPassed =
                    startDate &&
                    isPickupTooSoon(
                        startDate,
                        previous.pickupTime,
                        nowMs,
                        bookingHours
                    );

                return {
                    ...previous,
                    startDate,
                    endDate,
                    pickupTime: pickupPassed
                        ? getNextPickupTime(
                              startDate,
                              nowMs,
                              bookingHours,
                              allPickupTimes
                          ) ??
                          previous.pickupTime
                        : previous.pickupTime,
                };
            }
        );

        setValidationErrors(
            (previous) => {
                const updated = {
                    ...previous,
                };

                delete updated.startDate;
                delete updated.endDate;

                return updated;
            }
        );
    };

    const handlePickupTimeChange = (event) => {
        const pickupTime = event.target.value;

        setPickupTimeMovedFrom(null);

        setFormData((previous) => ({
            ...previous,
            pickupTime,
        }));

        setValidationErrors((previous) => {
            const updated = { ...previous };

            delete updated.startDate;

            return updated;
        });
    };

    const handleDriverOptionChange = (
        event
    ) => {
        const value =
            event.target.value;

        setFormData(
            (previous) => ({
                ...previous,
                driverOption: value,
                driver:
                    value ===
                    "With Driver"
                        ? previous.driver
                        : "",
            })
        );

        setValidationErrors(
            (previous) => {
                const updated = {
                    ...previous,
                };

                delete updated.driverOption;
                delete updated.driver;

                return updated;
            }
        );
    };

    const handlePaymentMethodChange = (value) => {
        setFormData((previous) => ({
            ...previous,
            paymentMethod: value,
        }));

        setPayInFull(false);

        if (validationErrors.paymentMethod) {
            setValidationErrors((previous) => {
                const updated = { ...previous };

                delete updated.paymentMethod;

                return updated;
            });
        }
    };

    const handleApplyVoucher = async (code) => {
        if (feesPending) return;
        try {
            // A plain thunk dispatch: a rejection resolves (not throws).
            const result = await applyExistingVoucher(code, basePricing);

            if (result?.meta?.requestStatus === "rejected") {
                const reason = result.payload;

                toast.error(
                    (typeof reason === "string" ? reason : reason?.message) ||
                        "Voucher cannot be applied."
                );

                return;
            }

            if (result?.payload?.data) {
                setConfirmedVoucher({ key: pricingKey, code, value: result.payload.data });
                toast.success("Voucher applied successfully!");
            }
        } catch {
            toast.error("Voucher cannot be applied.");
        }
    };

    const validateStep = () => {
        const nextErrors = {};

        if (currentStep === 0) {
            if (
                !formData.startDate
            ) {
                nextErrors.startDate =
                    "Start date is required.";
            }

            if (
                !formData.endDate
            ) {
                nextErrors.endDate =
                    "End date is required.";
            }

            if (
                formData.startDate &&
                formData.endDate
            ) {
                const start =
                    new Date(
                        `${formData.startDate}T00:00:00`
                    );

                const end =
                    new Date(
                        `${formData.endDate}T00:00:00`
                    );

                if (end <= start) {
                    nextErrors.endDate =
                        "End date must be after the start date.";
                }

                if (
                    isPickupTooSoon(
                        formData.startDate,
                        formData.pickupTime,
                        Date.now(),
                        bookingHours
                    )
                ) {
                    nextErrors.startDate = bookingHours?.enabled
                        ? `${describeBookingHours(bookingHours)} The earliest pickup you can book now is ${formatEarliestPickup(
                              getEarliestPickupMs(Date.now(), bookingHours)
                          )}. Please choose a later time.`
                        : `Pickup must be at least ${MIN_BOOKING_LEAD_HOURS} hours from now, so there's time to pay and get your booking approved. Please choose a later time.`;
                }

                if (
                    !allPickupTimes.some(
                        ({ value }) => value === formData.pickupTime
                    )
                ) {
                    nextErrors.startDate = `Pickup time must be between ${formatPickupHours(
                        pickupHours
                    )} (Philippine time).`;
                }
            }

            if (
                availabilityCheck &&
                availabilityCheck.available === false
            ) {
                nextErrors.endDate =
                    availabilityCheck.reasons?.[0] ||
                    "This booking is not available for the selected dates.";
            }

            if (noPickupTimeFree) {
                nextErrors.endDate =
                    "No pickup time is available for these dates. Please choose different dates.";
            }

            if (
                !formData.driverOption
            ) {
                nextErrors.driverOption =
                    "Driver option is required.";
            }

            if (
                formData.driverOption ===
                    "With Driver" &&
                !formData.driver &&
                !requireAdminDriverAssignment
            ) {
                nextErrors.driver =
                    "Please select a driver.";
            } else if (
                formData.driverOption ===
                    "With Driver" &&
                unavailableDriverIds.has(formData.driver)
            ) {
                nextErrors.driver =
                    "This driver isn't available for your dates. Please choose another driver.";
            }

            if (
                upfrontFees.total > 0 &&
                !formData.paymentMethod
            ) {
                nextErrors.paymentMethod =
                    "Please select a payment method for the reservation fee.";
            }

            if (
                formData.pickupLocation
                    .latitude == null ||
                formData.pickupLocation
                    .longitude == null
            ) {
                nextErrors[
                    "pickupLocation.serviceLocationId"
                ] =
                    "Pickup location is required. Select one from the list or pick one on the map.";
            }

            if (
                !formData.pickupLocation
                    .type
                    .trim()
            ) {
                nextErrors[
                    "pickupLocation.type"
                ] =
                    "Pickup location type is required.";
            }

            if (
                !formData.pickupLocation
                    .address
                    .trim()
            ) {
                nextErrors[
                    "pickupLocation.address"
                ] =
                    "Pickup location address is required.";
            }

            if (
                formData.returnLocation
                    .latitude == null ||
                formData.returnLocation
                    .longitude == null
            ) {
                nextErrors[
                    "returnLocation.serviceLocationId"
                ] =
                    "Return location is required. Select one from the list or pick one on the map.";
            }

            if (
                !formData.returnLocation
                    .type
                    .trim()
            ) {
                nextErrors[
                    "returnLocation.type"
                ] =
                    "Return location type is required.";
            }

            if (
                !formData.returnLocation
                    .address
                    .trim()
            ) {
                nextErrors[
                    "returnLocation.address"
                ] =
                    "Return location address is required.";
            }
        }

        if (currentStep === 1) {
            if (!termsAccepted) {
                nextErrors.terms =
                    "You must accept the terms and agreements to proceed.";
            } else if (!termsVersionId) {
                nextErrors.terms =
                    "The Terms & Conditions haven't loaded yet. Please wait a moment and try again.";
            }
        }

        setValidationErrors(
            nextErrors
        );

        return (
            Object.keys(
                nextErrors
            ).length === 0
        );
    };

    const handleNext = () => {
        if (!validateStep()) {
            return;
        }

        setCurrentStep(
            (previous) =>
                previous + 1
        );
    };

    const handlePrevious = () => {
        setCurrentStep(
            (previous) =>
                previous - 1
        );
    };

    const handleCancelClick = () => {
        setShowCancelModal(true);
    };

    const handleCancelConfirm = () => {
        setShowCancelModal(false);
        onCancel?.();
    };

    const buildPayload = () => {
        const payload = {
            vehicle:
                vehicle?._id ??
                vehicle?.id,

            driverOption:
                formData.driverOption,

            // Full instants: the chosen pickup time on both dates (Manila).
            startDate: toPickupDateTime(
                formData.startDate,
                formData.pickupTime
            ).toISOString(),

            endDate: toPickupDateTime(
                formData.endDate,
                formData.pickupTime
            ).toISOString(),

            pickupLocation: {
                serviceLocationId:
                    formData
                        .pickupLocation
                        .serviceLocationId ||
                    null,

                type:
                    formData
                        .pickupLocation
                        .type
                        .trim(),

                address:
                    formData
                        .pickupLocation
                        .address
                        .trim(),

                name:
                    formData
                        .pickupLocation
                        .name
                        .trim(),

                region:
                    formData
                        .pickupLocation
                        .region
                        .trim(),

                province:
                    formData
                        .pickupLocation
                        .province
                        .trim(),

                city:
                    formData
                        .pickupLocation
                        .city
                        .trim(),

                barangay:
                    formData
                        .pickupLocation
                        .barangay
                        .trim(),

                latitude:
                    formData
                        .pickupLocation
                        .latitude,

                longitude:
                    formData
                        .pickupLocation
                        .longitude,

                fee:
                    formData
                        .pickupLocation
                        .fee ?? 0,
            },

            returnLocation: {
                serviceLocationId:
                    formData
                        .returnLocation
                        .serviceLocationId ||
                    null,

                type:
                    formData
                        .returnLocation
                        .type
                        .trim(),

                address:
                    formData
                        .returnLocation
                        .address
                        .trim(),

                name:
                    formData
                        .returnLocation
                        .name
                        .trim(),

                region:
                    formData
                        .returnLocation
                        .region
                        .trim(),

                province:
                    formData
                        .returnLocation
                        .province
                        .trim(),

                city:
                    formData
                        .returnLocation
                        .city
                        .trim(),

                barangay:
                    formData
                        .returnLocation
                        .barangay
                        .trim(),

                latitude:
                    formData
                        .returnLocation
                        .latitude,

                longitude:
                    formData
                        .returnLocation
                        .longitude,

                fee:
                    formData
                        .returnLocation
                        .fee ?? 0,
            },

             customerNotes:
                formData.customerNotes.trim(),

            paymentMethod:
                formData.paymentMethod,

            payInFull:
                formData.paymentMethod ===
                    "GCASH" && payInFull,

            voucherCode:
                appliedVoucher
                    ?.voucher
                    ?.code
                    ? appliedVoucher.voucher.code
                    : "",

            termsAccepted,

            termsVersionId,
        };

        if (
            formData.driverOption ===
                "With Driver"
        ) {
            payload.driver =
                formData.driver;
        }

        return payload;
    };

    const handleSubmit = (
        event
    ) => {
        event.preventDefault();

        /*
         * Only the Review step's Pay button submits. Pressing Enter in a
         * field on an earlier step would otherwise submit the whole form
         * (the browser's implicit submission) - ignore it there.
         */
        if (currentStep !== FORM_STEPS.length - 1) {
            return;
        }

        if (
            !validateStep()
        ) {
            return;
        }

        if (feesPending || voucherPending || geocodingSection) {
            toast.error("Please wait until location fees and voucher pricing are confirmed.");
            return;
        }

        const payload =
            buildPayload();

        onSubmit?.(payload);
    };

    const selectedDriver = useMemo(
        () =>
            drivers.find(
                (driver) =>
                    (driver._id ??
                        driver.id) ===
                    formData.driver
            ),
        [drivers, formData.driver]
    );

    const selectedDriverName =
        selectedDriver
            ? [
                  selectedDriver.firstName,
                  selectedDriver.lastName,
              ]
                  .filter(Boolean)
                  .join(" ") ||
              selectedDriver.driverCode ||
              "Selected driver"
            : "Selected driver";

    const locationOptions = useMemo(() => {
        if (locationsLoading) {
            return [
                {
                    label: "Loading locations...",
                    value: "",
                },
            ];
        }

        if (
            serviceLocations.length === 0
        ) {
            return [
                {
                    label:
                        "No locations available",
                    value: "",
                },
            ];
        }

        const locations =
            settings?.allowOnlyDefaultLocation
            ? serviceLocations.filter(
                    (loc) => loc.isDefault
                )
                : serviceLocations;

        if (locations.length === 0) {
            return [
                {
                    label:
                        "No locations available",
                    value: "",
                },
            ];
        }

        return [
            {
                label: "Select a location",
                value: "",
            },
            ...locations.map(
                (location) => ({
                    label:
                        location.isDefault
                            ? `${location.name} (Default)`
                            : location.name,
                    value:
                        location._id,
                })
            ),
        ];
    }, [
        serviceLocations,
        locationsLoading,
        settings?.allowOnlyDefaultLocation,
    ]);

    const handleLocationChange = (
        section,
        locationId
    ) => {
        if (
            settings?.allowOnlyDefaultLocation
        ) {
            return;
        }

        const location =
            serviceLocations.find(
                (loc) =>
                    loc._id ===
                    locationId
            );

        if (!locationId || !location) {
            setFormData((previous) => ({
                ...previous,
                [section]: {
                    serviceLocationId: "",
                    type: "",
                    address: "",
                    name: "",
                    region: "",
                    province: "",
                    city: "",
                    barangay: "",
                    latitude: null,
                    longitude: null,
                    fee: 0,
                },
            }));

            return;
        }

        const addressParts = [
            location.barangay,
            location.city,
            location.province,
            location.region,
        ].filter(Boolean);

        const address =
            addressParts.join(", ") ||
            location.address ||
            "";

        const type = address || "Office";

        setFormData((previous) => ({
            ...previous,
            [section]: {
                serviceLocationId:
                    location._id,
                type,
                address,
                name: location.name || "",
                region:
                    location.region || "",
                province:
                    location.province || "",
                city: location.city || "",
                barangay:
                    location.barangay || "",
                latitude:
                    location.latitude ??
                    null,
                longitude:
                    location.longitude ??
                    null,
                fee:
                    section === "pickupLocation"
                        ? location.pickupFee ?? 0
                        : location.returnFee ?? 0,
            },
        }));
    };

    const handleMapLocationChange = async (
        section,
        coordinates
    ) => {
        if (geocodingInProgressRef.current) {
            return;
        }

        geocodingInProgressRef.current = true;
        setGeocodingSection(section);
        setGeocodeError(null);

        setFormData((previous) => ({
            ...previous,
            [section]: {
                ...previous[section],
                serviceLocationId: "",
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                fee: 0,
            },
        }));

        try {
            const parsed = await reverseGeocode(
                coordinates.latitude,
                coordinates.longitude
            );

            setFormData((previous) => ({
                ...previous,
                [section]: {
                    ...previous[section],
                    ...parsed,
                    name: "",
                    serviceLocationId: "",
                    type:
                        parsed.address ||
                        previous[section].type ||
                        "Office",
                    fee: 0,
                },
            }));
        } catch {
            setGeocodeError(
                "Unable to load address details. Please try again or enter the address manually."
            );
        } finally {
            geocodingInProgressRef.current = false;
            setGeocodingSection(null);
        }
    };

    const mapSelectionDisabled =
        loading ||
        locationsLoading ||
        Boolean(settings?.allowOnlyDefaultLocation);

    /* Square icon button beside a location dropdown, the same height as
       the dropdown trigger. */
    const renderMapButton = (section) => {
        const label =
            section === "pickupLocation"
                ? "Pick the pickup location on the map"
                : "Pick the return location on the map";

        return (
            <button
                type="button"
                onClick={() => setMapPickerSection(section)}
                disabled={mapSelectionDisabled}
                aria-label={label}
                title={
                    settings?.allowOnlyDefaultLocation
                        ? "Default location only - map selection is disabled."
                        : label
                }
                className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:border-yellow-400 hover:text-yellow-600 focus-visible:border-yellow-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400/10 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:hover:border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-yellow-400 dark:hover:text-yellow-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
            >
                <MapIcon size={20} />
            </button>
        );
    };

    const mapPickerLocation = mapPickerSection
        ? formData[mapPickerSection]
        : null;

    const pickupLocation = formData.pickupLocation;
    const returnLocation = formData.returnLocation;

    const hasPickupLocation =
        pickupLocation.latitude != null &&
        pickupLocation.longitude != null;

    const returnMatchesPickup =
        hasPickupLocation &&
        returnLocation.latitude === pickupLocation.latitude &&
        returnLocation.longitude === pickupLocation.longitude;

    /* Return the vehicle where it was picked up. */
    const copyPickupToReturn = () => {
        if (pickupLocation.serviceLocationId) {
            handleLocationChange(
                "returnLocation",
                pickupLocation.serviceLocationId
            );
        } else if (hasPickupLocation) {
            handleMapLocationChange("returnLocation", {
                latitude: pickupLocation.latitude,
                longitude: pickupLocation.longitude,
            });
        }
    };

    const LOCATION_STOPS = {
        pickupLocation: {
            label: "Pickup",
            icon: MapPin,
            when: formData.startDate
                ? `${formatDateKey(formData.startDate)} · ${formatPickupTime(formData.pickupTime)}`
                : "Pick your dates above",
            fee: effectivePickupFee,
            distanceKm: pickupDistanceKm,
            marker: "bg-gradient-to-br from-emerald-400 to-green-600 shadow-emerald-500/30",
            chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
            panel: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/20 dark:bg-emerald-500/5",
            pin: "text-emerald-600 dark:text-emerald-400",
        },
        returnLocation: {
            label: "Return",
            icon: Flag,
            when: formData.endDate
                ? `${formatDateKey(formData.endDate)} · by ${formatPickupTime(formData.pickupTime)}`
                : "Pick your dates above",
            fee: effectiveReturnFee,
            distanceKm: returnDistanceKm,
            marker: "bg-gradient-to-br from-rose-400 to-red-600 shadow-rose-500/30",
            chip: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
            panel: "border-rose-200 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/5",
            pin: "text-rose-600 dark:text-rose-400",
        },
    };

    /* One stop on the pickup -> return route (marker, picker, details). */
    const renderLocationStop = (section) => {
        const stop = LOCATION_STOPS[section];
        const location = formData[section];
        const isPickup = section === "pickupLocation";
        const StopIcon = stop.icon;
        const noun = stop.label.toLowerCase();

        const area = [
            location.barangay,
            location.city,
            location.province,
        ]
            .filter(Boolean)
            .join(", ");

        const feeText =
            formData.driverOption === "With Driver"
                ? "Fee waived with driver"
                : distanceFeeLoading
                  ? "Updating fee…"
                  : stop.fee > 0
                    ? `${stop.label} fee ${formatCurrency(stop.fee)}`
                    : `No ${noun} fee`;

        return (
            <li className="relative flex gap-4">
                {/* Marker, plus the dashed route line down to the next stop. */}
                <div className="flex flex-col items-center">
                    <span
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white dark:ring-gray-900 ${stop.marker}`}
                    >
                        <StopIcon size={18} />
                    </span>

                    {isPickup && (
                        <span
                            aria-hidden="true"
                            className="my-1 w-0 flex-1 border-l-2 border-dashed border-gray-300 dark:border-gray-700"
                        />
                    )}
                </div>

                <div className={`min-w-0 flex-1 ${isPickup ? "pb-6" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${stop.chip}`}
                        >
                            {stop.label}
                            <span className="ml-0.5 text-yellow-500">*</span>
                        </span>

                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {stop.when}
                        </span>
                    </div>

                    <div className="mt-2.5 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <Select
                                name={section}
                                aria-label={`${stop.label} location`}
                                autoComplete="off"
                                placeholder={`Choose a ${noun} location`}
                                value={location.serviceLocationId}
                                onChange={(event) =>
                                    handleLocationChange(
                                        section,
                                        event.target.value
                                    )
                                }
                                error={getFieldError(
                                    `${section}.serviceLocationId`
                                )}
                                disabled={mapSelectionDisabled}
                                required
                                options={locationOptions}
                                helperText={
                                    serviceLocations.length === 0 &&
                                    !locationsLoading
                                        ? `No ${noun} locations are currently available - tap the map icon to pin one.`
                                        : undefined
                                }
                            />
                        </div>

                        {renderMapButton(section)}
                    </div>

                    {!isPickup &&
                        hasPickupLocation &&
                        !returnMatchesPickup &&
                        !settings?.allowOnlyDefaultLocation && (
                            <button
                                type="button"
                                onClick={copyPickupToReturn}
                                disabled={
                                    mapSelectionDisabled ||
                                    Boolean(geocodingSection)
                                }
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 underline decoration-gray-300 underline-offset-2 transition hover:text-gray-900 hover:decoration-gray-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:decoration-gray-600 dark:hover:text-gray-200"
                            >
                                <Repeat size={12} />
                                Same as pickup
                            </button>
                        )}

                    {geocodingSection === section ? (
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            Finding the address…
                        </p>
                    ) : (
                        location.address && (
                            <div
                                className={`mt-3 rounded-xl border p-3 ${stop.panel}`}
                            >
                                <div className="flex items-start gap-2">
                                    <MapPin
                                        size={14}
                                        className={`mt-0.5 shrink-0 ${stop.pin}`}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {location.address}
                                        </p>
                                        {area && (
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {area}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-2.5 flex flex-wrap gap-1.5 pl-5.5">
                                    {!location.serviceLocationId && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                                            <MapIcon size={11} />
                                            Pinned on map
                                        </span>
                                    )}

                                    {stop.distanceKm !== null && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                                            <Navigation size={11} />
                                            {stop.distanceKm} km from our office
                                        </span>
                                    )}

                                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-800 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700">
                                        <Receipt size={11} />
                                        {feeText}
                                    </span>
                                </div>
                            </div>
                        )
                    )}
                </div>
            </li>
        );
    };

    return (
        <form
            ref={stepTopRef}
            onSubmit={
                handleSubmit
            }
            className="space-y-6"
        >
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                            {FORM_STEPS[currentStep].title}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {FORM_STEPS[currentStep].description}
                        </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">
                        Step {currentStep + 1} of {FORM_STEPS.length}
                    </span>
                </div>

                <ol className="flex px-2 pb-4 pt-5">

                    {FORM_STEPS.map(
                        (step, index) => {
                            const StepIcon = step.icon;
                            const isDone = index < currentStep;
                            const isCurrent = index === currentStep;

                            return (
                                <li
                                    key={step.title}
                                    aria-current={isCurrent ? "step" : undefined}
                                    className="relative flex min-w-0 flex-1 flex-col items-center"
                                >
                                    {index < FORM_STEPS.length - 1 && (
                                        <div className="absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-4.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                            <div
                                                className={`h-full rounded-full bg-yellow-400 transition-all duration-500 ${
                                                    isDone ? "w-full" : "w-0"
                                                }`}
                                            />
                                        </div>
                                    )}

                                    <div
                                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
                                            isDone
                                                ? "bg-yellow-400 text-gray-950"
                                                : isCurrent
                                                  ? "bg-yellow-400 text-gray-950 shadow-lg shadow-yellow-400/40 ring-4 ring-yellow-400/25"
                                                  : "border-2 border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
                                        }`}
                                    >
                                        {isDone ? (
                                            <Check size={18} strokeWidth={3} />
                                        ) : (
                                            <StepIcon size={17} />
                                        )}
                                    </div>

                                    <span
                                        className={`mt-2 text-[11px] font-bold uppercase tracking-[0.12em] ${
                                            isCurrent
                                                ? "text-yellow-600 dark:text-yellow-400"
                                                : isDone
                                                  ? "text-gray-700 dark:text-gray-300"
                                                  : "text-gray-400 dark:text-gray-500"
                                        }`}
                                    >
                                        {step.label}
                                    </span>

                                </li>
                            );
                        }
                    )}
                </ol>

                <div className="h-1 bg-gray-100 dark:bg-gray-800">
                    <div
                        className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all duration-500"
                        style={{
                            width: `${((currentStep + 1) / FORM_STEPS.length) * 100}%`,
                        }}
                    />
                </div>
            </div>

            {errorMessage && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10"
                >
                    <AlertTriangle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500"
                    />
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                        {errorMessage}
                    </p>
                </div>
            )}

            <AnimatePresence
                mode="wait"
            >
                <motion.div
                    key={
                        currentStep
                    }
                    variants={
                        STEP_VARIANTS
                    }
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={
                        STEP_TRANSITION
                    }
                    className="space-y-6"
                >
                    {currentStep ===
                        0 && (
                        <>
                            <section className={`@container ${SECTION_CARD_CLASS}`}>
                                <SectionHeader
                                    icon={CalendarDays}
                                    title="Rental Dates"
                                    description="Select when you want to pick up and return the vehicle."
                                />

                                {/* Compact calendar beside the pickup time and trip
                                    summary once the card is wide enough; stacked
                                    on narrow screens. */}
                                <div className="grid gap-5 @xl:grid-cols-[16rem_minmax(0,1fr)] @xl:items-start">
                                    <BookingDateRangeCalendar
                                        vehicleId={
                                            vehicle?._id ??
                                            vehicle?.id
                                        }
                                        startDate={
                                            formData.startDate
                                        }
                                        endDate={
                                            formData.endDate
                                        }
                                        onChange={
                                            handleDateRangeChange
                                        }
                                        disabled={loading}
                                        compact
                                    />

                                    <div className="space-y-4">
                                         <Select
                                             name="pickupTime"
                                             label="Preferred pickup time"
                                             leftIcon={<Clock size={16} />}
                                             value={formData.pickupTime}
                                             options={pickupTimeOptions}
                                             onChange={handlePickupTimeChange}
                                             disabled={
                                                 loading ||
                                                 pickupTimeOptions.length === 0
                                             }
                                             placeholder="No pickup times left"
                                             required
                                         />

                                        <div className="space-y-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                            <p>
                                                {formData.endDate
                                                    ? `Return by ${formatPickupTime(formData.pickupTime)} on ${formatDateKey(formData.endDate)}.`
                                                    : "You return the vehicle at the same time on your return date."}
                                            </p>
                                            <p>
                                                Pickup hours:{" "}
                                                {formatPickupHours(pickupHours)}{" "}
                                                (Philippine time). Your rental
                                                starts at the time you pick up
                                                the vehicle.
                                            </p>
                                            {bookingHours?.enabled && (
                                                <p>
                                                    {describeBookingHours(
                                                        bookingHours
                                                    )}
                                                </p>
                                            )}
                                        </div>

                                        {rentalDays >
                                            0 && (
                                            <div className="overflow-hidden rounded-xl border border-yellow-200 bg-yellow-50/70 dark:border-yellow-500/20 dark:bg-yellow-500/10">
                                                <div className="divide-y divide-yellow-200/80 dark:divide-yellow-500/15">
                                                    {[
                                                        {
                                                            icon: Clock,
                                                            label: "Duration",
                                                            value: `${rentalDays} ${rentalDays === 1 ? "day" : "days"}`,
                                                        },
                                                        {
                                                            icon: Receipt,
                                                            label: "Estimated total",
                                                            value: formatCurrency(
                                                                estimatedTotalBeforeVoucher
                                                            ),
                                                        },
                                                        upfrontFees.total > 0 && {
                                                            icon: CreditCard,
                                                            label: "Due at booking",
                                                            value: formatCurrency(
                                                                upfrontFees.total
                                                            ),
                                                        },
                                                    ]
                                                        .filter(Boolean)
                                                        .map(({ icon: StatIcon, label, value }) => (
                                                            <div
                                                                key={label}
                                                                className="flex items-center gap-2.5 px-3 py-2"
                                                            >
                                                                <StatIcon
                                                                    size={14}
                                                                    className="shrink-0 text-yellow-700 dark:text-yellow-400"
                                                                />
                                                                <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                                    {label}
                                                                </p>
                                                                <p className="text-xs font-bold text-gray-900 dark:text-white">
                                                                    {value}
                                                                </p>
                                                            </div>
                                                        ))}
                                                </div>

                                                {vehicle?.pricing
                                                    ?.returnDistanceFee >
                                                    0 && (
                                                    <p className="border-t border-yellow-200/80 px-3 py-1.5 text-[11px] text-gray-600 dark:border-yellow-500/15 dark:text-gray-400">
                                                        Return distance fee:{" "}
                                                        {formatCurrency(
                                                            vehicle
                                                                .pricing
                                                                .returnDistanceFee
                                                        )}
                                                        {" "}(due at pickup)
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {pickupTimesLimited && (
                                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                        {freePickupTimes.length === 1
                                            ? `For these dates, pickup is only available at ${freePickupTimes[0].label}.`
                                            : `For these dates, pickup is available from ${freePickupTimes[0].label} to ${freePickupTimes.at(-1).label}.`}
                                    </p>
                                )}

                                {pickupTimeMovedFrom &&
                                    pickupTimeMovedFrom !==
                                        formData.pickupTime &&
                                    pickupTimeOptions.length > 0 && (
                                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                            {formatPickupTime(
                                                pickupTimeMovedFrom
                                            )}{" "}
                                            isn&apos;t available any more,
                                            so we moved your pickup to{" "}
                                            {formatPickupTime(
                                                formData.pickupTime
                                            )}
                                            .
                                        </p>
                                    )}

                                {noPickupTimeLeft && (
                                    <p
                                        className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                        role="alert"
                                    >
                                        There are no pickup times left on{" "}
                                        {formatDateKey(formData.startDate)}.
                                        Please choose a later pickup date.
                                    </p>
                                )}

                                {noPickupTimeFree &&
                                    availabilityCheck?.available !==
                                        false && (
                                    <p
                                        className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                        role="alert"
                                    >
                                        No pickup time is available for
                                        these dates. Please choose
                                        different dates.
                                    </p>
                                )}

                                {(getFieldError("startDate") ||
                                    getFieldError(
                                        "endDate"
                                    )) && (
                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            text-red-600
                                            dark:text-red-400
                                        "
                                        role="alert"
                                    >
                                        {getFieldError(
                                            "startDate"
                                        ) ||
                                            getFieldError(
                                                "endDate"
                                            )}
                                    </p>
                                )}

                                {availabilityLoading && (
                                    <p
                                        className="
                                            mt-4
                                            text-xs
                                            text-gray-500
                                            dark:text-gray-400
                                        "
                                    >
                                        Checking vehicle availability
                                        for these dates...
                                    </p>
                                )}

                                {!availabilityLoading &&
                                    availabilityCheck &&
                                    availabilityCheck.available ===
                                        false && (
                                        <div
                                            className="
                                                mt-4
                                                flex
                                                items-start
                                                gap-2
                                                rounded-xl
                                                border
                                                border-red-200
                                                bg-red-50
                                                px-4
                                                py-3
                                                dark:border-red-500/20
                                                dark:bg-red-500/10
                                            "
                                        >
                                            <AlertTriangle
                                                size={16}
                                                className="
                                                    mt-0.5
                                                    shrink-0
                                                    text-red-500
                                                "
                                            />
                                            <div>
                                                <p
                                                    className="
                                                        text-sm
                                                        font-semibold
                                                        text-red-800
                                                        dark:text-red-300
                                                    "
                                                >
                                                    This booking isn't
                                                    available for the
                                                    selected dates.
                                                </p>
                                                {availabilityCheck.reasons?.map(
                                                    (reason) => (
                                                        <p
                                                            key={reason}
                                                            className="
                                                                mt-1
                                                                text-xs
                                                                text-red-700
                                                                dark:text-red-400
                                                            "
                                                        >
                                                            {reason}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}
                            </section>

                            <section className={SECTION_CARD_CLASS}>
                                <SectionHeader
                                    icon={UserRound}
                                    title="Driver Option"
                                    description="Choose whether you will drive the vehicle yourself or request a driver."
                                />

                                <DriverOptionCards
                                    value={formData.driverOption}
                                    onChange={(value) => {
                                        handleDriverOptionChange({
                                            target: { value },
                                        });

                                        // Straight into the driver search
                                        // when there's no driver yet.
                                        if (
                                            value === "With Driver" &&
                                            !formData.driver &&
                                            !requireAdminDriverAssignment &&
                                            drivers.length > 0
                                        ) {
                                            setDriverPickerOpen(true);
                                        }
                                    }}
                                    disabled={loading}
                                    error={getFieldError("driverOption")}
                                    withDriverRateText={withDriverRateText}
                                    adminAssignsDriver={
                                        requireAdminDriverAssignment
                                    }
                                    selfDriveLockedReason={
                                        mustUseDriver
                                            ? "This account has no driver's license on file, so bookings require a driver."
                                            : null
                                    }
                                    withDriverLockedReason={
                                        selfDriveOnly
                                            ? "Motorcycles are self-drive only — we don't offer drivers for them."
                                            : !mustUseDriver &&
                                                !requireAdminDriverAssignment &&
                                                drivers.length === 0
                                              ? "No drivers are available right now."
                                              : null
                                    }
                                />

                                {formData.driverOption === "With Driver" &&
                                    requireAdminDriverAssignment && (
                                        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                                            A driver will be assigned by our
                                            team when your booking is
                                            approved.
                                        </p>
                                    )}

                                  {formData.driverOption === "With Driver" &&
                                      !requireAdminDriverAssignment && (
                                          <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
                                              <SectionHeader
                                                  size="sm"
                                                  icon={UserRound}
                                                  title="Your Driver"
                                                  description="Search drivers by name and compare their ratings and bookings."
                                              />

                                              <div className="mt-4">
                                                  <DriverPicker
                                                      drivers={drivers}
                                                      unavailableIds={
                                                          unavailableDriverIds
                                                      }
                                                      value={formData.driver}
                                                      disabled={loading}
                                                      error={getFieldError(
                                                          "driver"
                                                      )}
                                                      pickerOpen={
                                                          driverPickerOpen
                                                      }
                                                      onPickerOpenChange={
                                                          setDriverPickerOpen
                                                      }
                                                      getRate={getListRate}
                                                      getRateText={
                                                          getListRateText
                                                      }
                                                      onChange={(
                                                          driverId
                                                      ) => {
                                                          setFormData(
                                                              (previous) => ({
                                                                  ...previous,
                                                                  driver: driverId,
                                                              })
                                                          );

                                                          setValidationErrors(
                                                              (previous) => {
                                                                  const updated =
                                                                      {
                                                                          ...previous,
                                                                      };

                                                                  delete updated.driver;

                                                                  return updated;
                                                              }
                                                          );
                                                      }}
                                                  />
                                              </div>
                                          </div>
                                      )}
                            </section>

                            {/* Pickup -> Return as a two-stop trip route; each
                                stop's map opens in a dialog from the icon
                                button beside its dropdown. */}
                            <section className={SECTION_CARD_CLASS}>
                                <SectionHeader
                                    icon={Route}
                                    title="Pickup & Return"
                                    description="Where your trip starts and where you'll bring the vehicle back."
                                />

                                {settings?.allowOnlyDefaultLocation &&
                                    !defaultServiceLocation && (
                                        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                                            The default service location has not been configured. Please contact support.
                                        </p>
                                    )}

                                <ol>
                                    {renderLocationStop("pickupLocation")}
                                    {renderLocationStop("returnLocation")}
                                </ol>

                                {(settings?.allowOnlyDefaultLocation ||
                                    distanceFeeLoading ||
                                    distanceFeeError ||
                                    geocodeError) && (
                                    <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                                        {settings?.allowOnlyDefaultLocation && (
                                            <p className="text-gray-500 dark:text-gray-400">
                                                Pickup and return are at our
                                                default location only.
                                            </p>
                                        )}
                                        {distanceFeeLoading && (
                                            <p className="text-blue-600 dark:text-blue-400">
                                                Calculating distance fees...
                                            </p>
                                        )}
                                        {distanceFeeError && (
                                            <p className="text-red-600 dark:text-red-400">
                                                {distanceFeeError}
                                            </p>
                                        )}
                                        {geocodeError && (
                                            <p className="text-red-600 dark:text-red-400">
                                                {geocodeError}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </section>

                            <Modal
                                isOpen={Boolean(mapPickerSection)}
                                onClose={() => setMapPickerSection(null)}
                                title={
                                    mapPickerSection === "returnLocation"
                                        ? "Pick Return Location"
                                        : "Pick Pickup Location"
                                }
                                description="Tap the map to drop a pin. We'll fill in the address for you."
                                size="lg"
                                footer={
                                    <Button
                                        type="button"
                                        onClick={() => setMapPickerSection(null)}
                                        disabled={Boolean(geocodingSection)}
                                    >
                                        Done
                                    </Button>
                                }
                            >
                                {mapPickerSection && (
                                    <div className="space-y-3">
                                        <LocationPicker
                                            latitude={mapPickerLocation.latitude}
                                            longitude={mapPickerLocation.longitude}
                                            onLocationChange={(coordinates) =>
                                                handleMapLocationChange(mapPickerSection, coordinates)
                                            }
                                            disabled={mapSelectionDisabled}
                                            loading={geocodingSection === mapPickerSection}
                                            label=""
                                            helperText=""
                                        />

                                        {geocodeError ? (
                                            <p className="text-sm text-red-600 dark:text-red-400">
                                                {geocodeError}
                                            </p>
                                        ) : (
                                            mapPickerLocation.address && (
                                                <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                                                    <MapPin
                                                        size={16}
                                                        className="mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400"
                                                    />
                                                    <span className="text-gray-800 dark:text-gray-200">
                                                        {mapPickerLocation.address}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </Modal>

                            <section className={SECTION_CARD_CLASS}>
                                <SectionHeader
                                    icon={Wallet}
                                    title="Payment Method"
                                    description={
                                        upfrontFees.total > 0
                                            ? "Choose how you want to pay the reservation fee."
                                            : "Nothing to pay online for this booking."
                                    }
                                />

                                <PaymentMethodPicker
                                    options={PAYMENT_METHOD_OPTIONS}
                                    value={formData.paymentMethod}
                                    onChange={handlePaymentMethodChange}
                                    payInFull={payInFull}
                                    onPayInFullChange={setPayInFull}
                                    upfrontTotal={upfrontFees.total}
                                    reservationFee={upfrontFees.reservationFee}
                                    finalTotal={finalTotal}
                                    amountDueNow={amountDueNow}
                                    formatCurrency={formatCurrency}
                                    disabled={loading}
                                    error={getFieldError("paymentMethod")}
                                />
                            </section>

                            <section className={SECTION_CARD_CLASS}>
                                <SectionHeader
                                    icon={Ticket}
                                    title="Apply Voucher"
                                    description="Tap Apply on a voucher to take it off your total."
                                />

                                <VoucherTickets
                                    vouchers={availableVouchers}
                                    appliedVoucher={appliedVoucher}
                                    discount={voucherDiscount}
                                    onApply={handleApplyVoucher}
                                    onRemove={clearAppliedVoucherAction}
                                    formatCurrency={formatCurrency}
                                    disabled={loading || feesPending || voucherPending}
                                />
                            </section>

                            <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Estimated booking total</h3>
                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Includes rental, selected locations, reservation fee, and driver if requested.</p>
                                    </div>
                                    {distanceFeeLoading && <span className="text-xs text-blue-700 dark:text-blue-300">Updating fees…</span>}
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between gap-4 text-gray-700 dark:text-gray-300">
                                        <span>Vehicle rental{rentalDays > 0 ? ` (${rentalDays} day${rentalDays === 1 ? "" : "s"})` : ""}</span>
                                        <span>{formatCurrency(estimatedSubtotal)}</span>
                                    </div>
                                    {driverFee > 0 && (
                                        <div className="flex justify-between gap-4 text-gray-700 dark:text-gray-300">
                                            <span>Driver fee ({formatCurrency(driverDailyRate)}/day)</span>
                                            <span>{formatCurrency(driverFee)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-4 text-gray-700 dark:text-gray-300">
                                        <span>Pickup fee</span>
                                        <span>{formatCurrency(effectivePickupFee)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-gray-700 dark:text-gray-300">
                                        <span>Return fee</span>
                                        <span>{formatCurrency(effectiveReturnFee)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4 text-gray-700 dark:text-gray-300">
                                        <span>Reservation fee</span>
                                        <span>{formatCurrency(vehicle?.pricing?.reservationFee ?? 0)}</span>
                                    </div>
                                    {voucherDiscount > 0 && (
                                        <div className="flex justify-between gap-4 text-green-700 dark:text-green-400">
                                            <span>Voucher discount</span>
                                            <span>−{formatCurrency(voucherDiscount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-4 border-t border-amber-300 pt-3 text-base font-bold text-gray-900 dark:border-amber-500/30 dark:text-white">
                                        <span>Total</span>
                                        <span>{formatCurrency(finalTotal)}</span>
                                    </div>
                                </div>
                            </section>

                            <section className={SECTION_CARD_CLASS}>
                                <SectionHeader
                                    icon={MessageSquareText}
                                    title="Additional Notes"
                                    description="Add any additional information you want us to know about your reservation."
                                />

                                <Textarea
                                    label="Customer Notes"
                                    value={
                                        formData.customerNotes
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    name="customerNotes"
                                    autoComplete="off"
                                    error={getFieldError(
                                        "customerNotes"
                                    )}
                                    disabled={
                                        loading
                                    }
                                    rows={4}
                                    placeholder="Optional notes or special requests."
                                />
                            </section>
                         </>
                     )}

                    {currentStep ===
                        1 && (
                        <TermsAgreement
                            accepted={termsAccepted}
                            onChange={(value) => {
                                setTermsAccepted(value);

                                if (
                                    value &&
                                    validationErrors.terms
                                ) {
                                    setValidationErrors(
                                        (previous) => {
                                            const updated = {
                                                ...previous,
                                            };

                                            delete updated.terms;

                                            return updated;
                                        }
                                    );
                                }
                            }}
                            error={getFieldError("terms")}
                            showAcceptButton={false}
                            stickyAcceptance={false}
                            onVersionChange={setTermsVersionId}
                            reloadKey={termsReloadKey}
                        />
                    )}

                    {currentStep ===
                        2 && (
                        <div className="space-y-6">
                            <ReviewSection
                                title="Vehicle"
                            >
                                <div
                                    className="
                                        grid
                                        gap-6
                                        md:grid-cols-2
                                    "
                                >
                                    <ReviewField
                                        label="Vehicle"
                                        value={
                                            [
                                                vehicle?.brand,
                                                vehicle?.model,
                                                vehicle?.variant,
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    " "
                                                )
                                        }
                                    />

                                    <ReviewField
                                        label="Daily Rate"
                                        value={
                                            vehicleDiscount
                                                ? `${formatCurrency(
                                                      effectiveDailyRate
                                                  )} (was ${formatCurrency(
                                                      vehicleDiscount.originalDailyRate
                                                  )} — ${getDiscountBadgeText(
                                                      vehicleDiscount
                                                  )})`
                                                : formatCurrency(
                                                      effectiveDailyRate
                                                  )
                                        }
                                    />

                                    <ReviewField
                                        label="Rental Duration"
                                        value={
                                            rentalDays
                                                ? `${rentalDays} ${
                                                      rentalDays ===
                                                      1
                                                          ? "day"
                                                          : "days"
                                                  }`
                                                : "—"
                                        }
                                    />

                                    <ReviewField
                                        label="Estimated Subtotal"
                                        value={formatCurrency(
                                            estimatedSubtotal
                                        )}
                                    />

                                    {vehicle?.pricing
                                        ?.reservationFee >
                                        0 && (
                                        <ReviewField
                                            label="Reservation Fee"
                                            value={formatCurrency(
                                                vehicle.pricing
                                                    .reservationFee
                                            )}
                                        />
                                    )}

                                        {estimatedSubtotal > 0 && (
                                            <>
                                                <ReviewField
                                                    label="Total Amount"
                                                    value={formatCurrency(
                                                        estimatedTotalBeforeVoucher
                                                    )}
                                                />
                                                {voucherDiscount > 0 && (
                                                    <ReviewField
                                                        label="Voucher Discount"
                                                        value={formatCurrency(
                                                            -voucherDiscount
                                                        )}
                                                    />
                                                )}
                                                <ReviewField
                                                    label="Final Total"
                                                    value={formatCurrency(
                                                        finalTotal
                                                    )}
                                                />
                                            </>
                                        )}
                                </div>
                            </ReviewSection>

                            <ReviewSection
                                title="Rental Details"
                            >
                                <div
                                    className="
                                        grid
                                        gap-6
                                        md:grid-cols-2
                                    "
                                >
                                    <ReviewField
                                        label="Pickup"
                                        value={`${formatDateKey(formData.startDate)}, ${formatPickupTime(formData.pickupTime)}`}
                                    />

                                    <ReviewField
                                        label="Return"
                                        value={`${formatDateKey(formData.endDate)}, ${formatPickupTime(formData.pickupTime)}`}
                                    />

                                    <ReviewField
                                        label="Driver Option"
                                        value={
                                            formData.driverOption
                                        }
                                    />

                                    {formData.paymentMethod && (
                                        <ReviewField
                                            label="Payment Method"
                                            value={
                                                formData.paymentMethod ===
                                                    "GCASH"
                                                    ? "GCash"
                                                    : formData.paymentMethod ===
                                                        "CASH_ON_PICKUP"
                                                      ? "Cash on Pickup"
                                                      : formData.paymentMethod
                                            }
                                        />
                                    )}

                                    {formData.driverOption ===
                                        "With Driver" && (
                                        <ReviewField
                                            label="Driver"
                                            value={
                                                selectedDriver ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setProfileDriverId(
                                                                selectedDriver._id ??
                                                                    selectedDriver.id
                                                            )
                                                        }
                                                        className="text-left underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600 dark:decoration-gray-600"
                                                    >
                                                        {
                                                            selectedDriverName
                                                        }
                                                    </button>
                                                ) : (
                                                    selectedDriverName
                                                )
                                            }
                                        />
                                    )}
                                </div>
                            </ReviewSection>

                            <ReviewSection
                                title="Pickup & Return"
                            >
                                <div
                                    className="
                                        grid
                                        gap-6
                                        md:grid-cols-2
                                    "
                                >
                                    <ReviewField
                                        label="Pickup Location"
                                        value={
                                            formData
                                                .pickupLocation
                                                .name || formData.pickupLocation.type
                                        }
                                    />

                                    <ReviewField
                                        label="Pickup Address"
                                        value={
                                            formData
                                                .pickupLocation
                                                .address
                                        }
                                    />

                                    <ReviewField
                                        label="Return Location"
                                        value={
                                            formData
                                                .returnLocation
                                                .name || formData.returnLocation.type
                                        }
                                    />

                                    <ReviewField
                                        label="Return Address"
                                        value={
                                            formData
                                                .returnLocation
                                                .address
                                        }
                                    />
                                </div>
                            </ReviewSection>
                            <ReviewSection
                                title="Location Charges"
                            >
                                <div
                                    className="
                                        grid
                                        gap-6
                                        md:grid-cols-2
                                    "
                                >
                                    <ReviewField
                                        label="Pickup Distance"
                                        value={
                                            pickupDistanceKm !==
                                            null
                                                ? `${pickupDistanceKm} km`
                                                : "Distance unavailable"
                                        }
                                    />

                                    <ReviewField
                                        label="Return Distance"
                                        value={
                                            returnDistanceKm !==
                                            null
                                                ? `${returnDistanceKm} km`
                                                : "Distance unavailable"
                                        }
                                    />
                                </div>

                                <div
                                    className="
                                        mt-4
                                        rounded-xl
                                        border
                                        border-gray-200
                                        bg-gray-50
                                        p-4
                                        dark:border-gray-700
                                        dark:bg-gray-800/50
                                    "
                                >
                                    {distanceFeePreview ? (
                                        <div
                                            className="
                                                space-y-1
                                            "
                                        >
                                            {distanceFeePreview.pickupDistanceFee > 0 && (
                                                <p
                                                    className="
                                                        text-sm
                                                        text-gray-600
                                                        dark:text-gray-300
                                                    "
                                                >
                                                    Pickup distance fee:{" "}
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(
                                                            distanceFeePreview.pickupDistanceFee
                                                        )}
                                                    </span>
                                                </p>
                                            )}

                                            {distanceFeePreview.returnDistanceFee > 0 && (
                                                <p
                                                    className="
                                                        text-sm
                                                        text-gray-600
                                                        dark:text-gray-300
                                                    "
                                                >
                                                    Return distance fee:{" "}
                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(
                                                            distanceFeePreview.returnDistanceFee
                                                        )}
                                                    </span>
                                                </p>
                                            )}

                                            {(distanceFeePreview.pickupDistanceFee === 0 &&
                                                distanceFeePreview.returnDistanceFee === 0) && (
                                                <p
                                                    className="
                                                        text-sm
                                                        text-gray-600
                                                        dark:text-gray-300
                                                    "
                                                >
                                                    No distance fees apply.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p
                                            className="
                                                text-sm
                                                text-gray-600
                                                dark:text-gray-300
                                            "
                                        >
                                            Distance fee:{" "}
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                Calculated by server
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </ReviewSection>
                            {formData.customerNotes && (
                                <ReviewSection
                                    title="Customer Notes"
                                >
                                    <ReviewField
                                        label="Notes"
                                        value={
                                            formData.customerNotes
                                        }
                                    />
                                </ReviewSection>
                            )}

                            <section className="rounded-2xl border-2 border-yellow-300 bg-gradient-to-b from-yellow-50 to-white p-5 shadow-sm dark:border-yellow-500/30 dark:from-yellow-500/10 dark:to-gray-900 sm:p-6">
                                <SectionHeader
                                    icon={Receipt}
                                    title="Pricing Summary"
                                    description={
                                        upfrontFees.reservationFee > 0
                                            ? "A reservation fee is required to confirm this booking."
                                            : "No reservation fee is required for this booking."
                                    }
                                />

                                <div
                                    className="
                                        mt-4
                                        space-y-3
                                    "
                                >
                                    <div
                                        className="
                                            flex
                                            items-center
                                            justify-between
                                            text-sm
                                        "
                                    >
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Daily Rate
                                        </span>

                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {vehicleDiscount && (
                                                <span className="mr-1.5 text-xs text-gray-400 line-through">
                                                    {formatCurrency(
                                                        vehicleDiscount.originalDailyRate
                                                    )}
                                                </span>
                                            )}
                                            {formatCurrency(
                                                effectiveDailyRate
                                            )}
                                        </span>
                                    </div>

                                    {vehicleDiscount && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-rose-600 dark:text-rose-400">
                                                {getDiscountBadgeText(
                                                    vehicleDiscount
                                                )}
                                            </span>
                                            <span className="font-medium text-rose-600 dark:text-rose-400">
                                                −
                                                {formatCurrency(
                                                    Number(
                                                        vehicleDiscount.amountOff ||
                                                            0
                                                    ) *
                                                        (rentalDays ||
                                                            0)
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {driverFee > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-300">Driver Fee ({formatCurrency(driverDailyRate)} × {rentalDays} day{rentalDays === 1 ? "" : "s"})</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(driverFee)}</span>
                                        </div>
                                    )}

                                    <div
                                        className="
                                            flex
                                            items-center
                                            justify-between
                                            text-sm
                                        "
                                    >
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Rental Duration
                                        </span>

                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {rentalDays}{" "}
                                            {rentalDays ===
                                            1
                                                ? "day"
                                                : "days"}
                                        </span>
                                    </div>

                                    <div
                                        className="
                                            flex
                                            items-center
                                            justify-between
                                            text-sm
                                        "
                                    >
                                        <span className="text-gray-600 dark:text-gray-300">
                                            Rental Fee
                                        </span>

                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formatCurrency(
                                                estimatedSubtotal
                                            )}
                                        </span>
                                    </div>

                                    {vehicle?.pricing
                                        ?.reservationFee >
                                        0 && (
                                        <div
                                            className="
                                                flex
                                                items-center
                                                justify-between
                                                text-sm
                                            "
                                        >
                                            <span className="text-gray-600 dark:text-gray-300">
                                                Reservation
                                                Fee
                                            </span>

                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {formatCurrency(
                                                    vehicle
                                                        .pricing
                                                        .reservationFee
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {(effectivePickupFee > 0 || effectiveReturnFee > 0) && (
                                        <>
                                            {effectivePickupFee > 0 && (
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        justify-between
                                                        text-sm
                                                    "
                                                >
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        Pickup
                                                        Distance
                                                        Fee
                                                    </span>

                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(
                                                            effectivePickupFee
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {effectiveReturnFee > 0 && (
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        justify-between
                                                        text-sm
                                                    "
                                                >
                                                    <span className="text-gray-600 dark:text-gray-300">
                                                        Return
                                                        Distance
                                                        Fee
                                                    </span>

                                                    <span className="font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(
                                                            effectiveReturnFee
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {(estimatedSubtotal > 0 || voucherDiscount > 0) && (
                                        <div
                                            className="
                                                border-t
                                                border-yellow-200
                                                pt-3
                                                dark:border-yellow-500/20
                                            "
                                        >
                                            <div
                                                className="
                                                    flex
                                                    items-center
                                                    justify-between
                                                "
                                            >
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    Total
                                                    Amount
                                                </span>

                                                <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(
                                                        estimatedTotalBeforeVoucher
                                                    )}
                                                </span>
                                            </div>

                                            {voucherDiscount > 0 && (
                                                <div
                                                    className="
                                                        flex
                                                        items-center
                                                        justify-between
                                                        text-sm
                                                    "
                                                >
                                                    <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                        <Gift size={14} />
                                                        Voucher Discount
                                                    </span>

                                                    <span className="font-semibold text-green-600 dark:text-green-400">
                                                        -{formatCurrency(
                                                            voucherDiscount
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-white dark:bg-yellow-400 dark:text-gray-950">
                                                <span className="text-sm font-semibold">
                                                    Final Total
                                                </span>

                                                <span className="text-2xl font-bold tracking-tight">
                                                    {formatCurrency(
                                                        finalTotal
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {formData.paymentMethod && (
                                        <div
                                            className="
                                                mt-4
                                                rounded-xl
                                                border
                                                border-gray-200
                                                bg-white
                                                p-4
                                                dark:border-gray-600
                                                dark:bg-gray-800
                                            "
                                        >
                                            <h4
                                                className="
                                                    text-sm
                                                    font-semibold
                                                    text-gray-900
                                                    dark:text-white
                                                "
                                            >
                                                Payment
                                                Breakdown
                                            </h4>

                                            <div
                                                className="
                                                    mt-3
                                                    space-y-2
                                                "
                                            >
                                                {formData.paymentMethod ===
                                                "GCASH" ? (
                                                    <>
                                                        <div
                                                            className="
                                                                flex
                                                                items-center
                                                                justify-between
                                                                text-sm
                                                            "
                                                        >
                                                            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                                <CreditCard
                                                                    size={
                                                                        14
                                                                    }
                                                                    className="
                                                                        text-green-600
                                                                    "
                                                                />
                                                                Due
                                                                Now
                                                            </span>

                                                            <span className="font-semibold text-green-600 dark:text-green-400">
                                                                {formatCurrency(
                                                                    (vehicle
                                                                        .pricing
                                                                        .reservationFee ||
                                                                        0) +
                                                                        effectivePickupFee
                                                                )}
                                                            </span>
                                                        </div>

                                                        {effectiveReturnFee > 0 && (
                                                            <div
                                                                className="
                                                                    flex
                                                                    items-center
                                                                    justify-between
                                                                    text-sm
                                                                "
                                                            >
                                                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                                    <Banknote
                                                                        size={
                                                                            14
                                                                        }
                                                                        className="
                                                                            text-blue-600
                                                                        "
                                                                    />
                                                                    Due
                                                                    at
                                                                    Pickup
                                                                </span>

                                                                <span className="font-medium text-gray-900 dark:text-white">
                                                                    {formatCurrency(
                                                                        effectiveReturnFee
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div
                                                        className="
                                                            flex
                                                            items-center
                                                            justify-between
                                                            text-sm
                                                        "
                                                    >
                                                        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                                            <Banknote
                                                                size={
                                                                    14
                                                                }
                                                                className="
                                                                    text-blue-600
                                                                "
                                                            />
                                                            Due
                                                            at
                                                            Pickup
                                                        </span>

                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {formatCurrency(
                                                                (vehicle
                                                                    .pricing
                                                                    .reservationFee ||
                                                                    0) +
                                                                    effectivePickupFee +
                                                                    effectiveReturnFee
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {formData.paymentMethod ===
                                                "GCASH" && (
                                                <p
                                                    className="
                                                        mt-3
                                                        flex
                                                        items-start
                                                        gap-1.5
                                                        text-xs
                                                        text-gray-500
                                                        dark:text-gray-400
                                                    "
                                                >
                                                    <Info
                                                        size={
                                                            12
                                                        }
                                                        className="
                                                            mt-0.5
                                                            shrink-0
                                                        "
                                                    />
                                                    <span>
                                                        You
                                                        will
                                                        be
                                                        redirected
                                                        to
                                                        PayMongo
                                                        to
                                                        complete
                                                        the
                                                        reservation
                                                        fee
                                                        payment
                                                        after
                                                        submitting
                                                        this
                                                        booking.
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div
                                        className="
                                            rounded-xl
                                            border
                                            border-blue-200
                                            bg-blue-50
                                            p-3
                                            dark:border-blue-500/20
                                            dark:bg-blue-500/10
                                        "
                                    >
                                        <p
                                            className="
                                                flex
                                                items-start
                                                gap-2
                                                text-xs
                                                text-blue-700
                                                dark:text-blue-400
                                            "
                                        >
                                            <Info
                                                size={
                                                    14
                                                }
                                                className="
                                                    mt-0.5
                                                    shrink-0
                                                "
                                            />
                                            <span>
                                                Your
                                                booking
                                                will
                                                be
                                                reviewed
                                                by
                                                our
                                                team.
                                                {formData.paymentMethod ===
                                                "GCASH"
                                                    ? " Please complete the reservation fee payment to confirm your booking."
                                                    : ""}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {(feesPending || voucherPending) && (
                <p role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                    {distanceFeeError || (feesPending
                        ? "Location fees must be confirmed before you can pay."
                        : "Updating your voucher for the current booking?")}
                </p>
            )}
            <div className="sticky bottom-0 z-20 -mx-1 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
                <div>
                    {currentStep ===
                    0 ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                handleCancelClick
                            }
                            disabled={
                                loading
                            }
                        >
                            Cancel
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                handlePrevious
                            }
                            disabled={
                                loading
                            }
                            leftIcon={<ChevronLeft size={16} />}
                        >
                            Previous
                        </Button>
                    )}
                </div>

                <p className="hidden text-xs font-medium text-gray-500 dark:text-gray-400 sm:block">
                    {currentStep < FORM_STEPS.length - 1
                        ? `Next: ${FORM_STEPS[currentStep + 1].title}`
                        : paysOnline
                          ? "Your booking is submitted when you pay"
                          : "Ready to submit"}
                </p>

                <div>
                    {/*
                     * Distinct keys: without them React reuses the Next
                     * button's element for this one, flipping its type to
                     * "submit" in the middle of the click that opened the
                     * Review step - and the browser then submits the form.
                     */}
                    {currentStep ===
                    FORM_STEPS.length -
                        1 ? (
                        <Button
                            key="submit-booking"
                            type="submit"
                            disabled={feesPending || voucherPending || Boolean(geocodingSection)}
                            loading={
                                loading
                            }
                            leftIcon={
                                paysOnline ? (
                                    <CreditCard
                                        size={16}
                                    />
                                ) : undefined
                            }
                        >
                            {paysOnline
                                ? `Pay ${formatCurrency(
                                      amountDueNow
                                  )}`
                                : "Submit Booking"}
                        </Button>
                    ) : (
                        <Button
                            key="next-step"
                            type="button"
                            onClick={
                                handleNext
                            }
                            disabled={
                                loading
                            }
                            rightIcon={<ChevronRight size={16} />}
                        >
                            Next
                        </Button>
                    )}
                </div>
            </div>
            <Modal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            <AlertTriangle size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Cancel Booking
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Please confirm your action.
                            </p>
                        </div>
                    </div>
                }
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowCancelModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleCancelConfirm}
                        >
                            Yes, Cancel
                        </Button>
                    </>
                }
                size="sm"
            >
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/30">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Are you sure you want to cancel this booking? All entered information will be lost.
                    </p>
                </div>
            </Modal>

            <DriverProfileModal
                driverId={profileDriverId}
                onClose={() => setProfileDriverId(null)}
            />
        </form>
    );
};

export default BookingForm;
