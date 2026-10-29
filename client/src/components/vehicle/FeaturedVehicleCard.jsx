import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    CalendarClock,
    CalendarX2,
    ChevronDown,
    ChevronUp,
    Eye,
    FileText,
    Heart,
    ImageOff,
    Pencil,
    RefreshCw,
    RotateCcw,
    Trash2,
    Wrench,
} from "lucide-react";

import {
    describeMaintenanceMode,
    describeVehicleMaintenance,
    getVehicleMaintenanceWindow,
    isVehicleOffRoad,
} from "../../constants/vehicleConstants";
import { Link } from "react-router-dom";
import { useState } from "react";

import {
    CARD_FADE_UP,
    CARD_LAYOUT_TRANSITION,
    COLLAPSE_TRANSITION,
} from "../../constants/motionConstants";

import getVehicleCardData from "../../utils/getVehicleCardData";
import formatCommission from "../../utils/formatCommission";
import { trackCardSpotlight } from "../../utils/spotlightHover";

import Badge from "../common/Badge";
import Button from "../common/Button";
import CardActionMenu from "../cards/CardActionMenu";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import AvailabilityCalendar from "./AvailabilityCalendar";
import DiscountBadge from "./DiscountBadge";
import OriginalPrice from "./OriginalPrice";
import RequestUnavailabilityDialog from "./RequestUnavailabilityDialog";
import RenewRegistrationDialog from "./RenewRegistrationDialog";
import VehicleDocumentsDialog from "./VehicleDocumentsDialog";
import VehicleRating from "./VehicleRating";

import useAuth from "../../hooks/auth/useAuth";
import useFavorite from "../../hooks/useFavorite";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

const FeaturedVehicleCard = ({
    vehicle,
    expanded = false,
    isLeaving = false,
    isArchivedView = false,
    publicView = false,
    allowAvailabilityRequests = false,
    platformCommissionRate = null,
    onCollapse,
    onView,
    onEdit,
    onArchive,
    onRestore,
    children,
}) => {
    const {
        user,
        isAuthenticated,
    } = useAuth();

    const {
        favoriteIds,
        loading: favoriteLoading,
        toggleVehicleFavoriteStatus,
    } = useFavorite();

    const [calendarOpen, setCalendarOpen] =
        useState(false);

    const [requestDialogOpen, setRequestDialogOpen] =
        useState(false);

    const [renewDialogOpen, setRenewDialogOpen] =
        useState(false);

    const [documentsDialogOpen, setDocumentsDialogOpen] =
        useState(false);

    const { offRoadVehicles } = usePublicRefundSettings();

    if (!vehicle) {
        return null;
    }

    const item = getVehicleCardData(vehicle);

    // Still listed while under maintenance; say until when. Off road says
    // so only when the admin allows it, otherwise just "Dates blocked".
    const maintenanceLabel = describeVehicleMaintenance(vehicle, {
        showOffRoadNotice: offRoadVehicles.showNotice,
    });
    const hideOffRoadNotice =
        !offRoadVehicles.showNotice && isVehicleOffRoad(vehicle);
    const maintenanceWindow = getVehicleMaintenanceWindow(vehicle);

    const commissionInfo = formatCommission(
        item.commission,
        platformCommissionRate
    );

    const ownership =
        vehicle.ownership ?? "Company";

    const vehicleId =
        vehicle._id ?? vehicle.id;

    const isFav =
        isAuthenticated &&
        favoriteIds.includes(
            vehicleId
        );

    const handleToggleFavorite =
        async (event) => {
            event.preventDefault();

            event.stopPropagation();

            if (
                !isAuthenticated ||
                favoriteLoading
            ) {
                return;
            }

            await toggleVehicleFavoriteStatus(
                vehicleId
            );
        };

    if (publicView) {
        return (
            <motion.article
                layout
                initial={{
                    opacity: 0,
                    y: 24,
                }}
                whileInView={{
                    opacity: 1,
                    y: 0,
                }}
                viewport={{
                    once: true,
                    amount: 0.15,
                }}
                transition={{
                    duration: 0.5,
                }}
                whileHover={{
                    y: -6,
                }}
                onMouseMove={trackCardSpotlight}
                // vehicle-hover-fx: dark-mode hover effect, mode/colour set by the
                // admin (styles/vehicle-hover.css)
                className="
                    vehicle-hover-fx
                    group
                    overflow-hidden
                    rounded-3xl
                    border
                    border-gray-200
                    bg-white
                    shadow-sm
                    transition-all
                    duration-300
                    hover:shadow-xl
                    dark:border-gray-700
                    dark:bg-gray-800
                "
            >
                        <div
                            className={[
                                "relative",
                                "overflow-hidden",
                                "bg-gray-100",
                                "dark:bg-gray-900",
                                // Phones (single column, wide card): keep a
                                // photo-shaped 16:10 box so the vehicle isn't
                                // over-cropped. md+ keeps the fixed heights.
                                "aspect-16/10",
                                "md:aspect-auto",
                                publicView
                                    ? "md:h-48"
                                    : "md:h-56",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                    {item.image ? (
                        <img
                            src={item.image}
                            alt={item.name}
                            className="
                                h-full
                                w-full
                                object-cover
                                transition-transform
                                duration-500
                                group-hover:scale-105
                            "
                        />
                    ) : (
                        <div
                            className="
                                flex
                                h-full
                                flex-col
                                items-center
                                justify-center
                                gap-2
                                bg-gray-50
                                text-gray-400
                                dark:bg-gray-800
                                dark:text-gray-500
                            "
                        >
                            <ImageOff
                                size={36}
                                strokeWidth={1.5}
                            />

                            <p
                                className="
                                    text-sm
                                    font-medium
                                "
                            >
                                No Vehicle Image
                            </p>
                        </div>
                    )}

                    <div
                        className="
                            absolute
                            inset-x-0
                            top-0
                            flex
                            items-start
                            justify-between
                            p-3
                        "
                    >
                        <div className="flex min-w-0 flex-col items-start gap-1.5">
                            {item.featured && (
                                <Badge variant="warning">
                                    Featured
                                </Badge>
                            )}

                            <DiscountBadge
                                discount={item.activeDiscount}
                                size={publicView ? "sm" : "md"}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {isAuthenticated && user?.role === "customer" && (
                                <motion.button
                                    type="button"
                                    onClick={
                                        handleToggleFavorite
                                    }
                                    whileTap={{
                                        scale: 0.85,
                                    }}
                                    animate={
                                        isFav
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
                                        isFav
                                            ? {
                                                  duration: 0.35,
                                                  ease:
                                                      "easeOut",
                                              }
                                            : {}
                                    }
                                    className="
                                        inline-flex
                                        h-8
                                        w-8
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-full
                                        bg-white/95
                                        shadow-sm
                                        backdrop-blur-sm
                                        transition-colors
                                        duration-200
                                        hover:bg-white
                                        dark:bg-gray-950/90
                                        dark:hover:bg-gray-900
                                    "
                                >
                                    <Heart
                                        size={18}
                                        strokeWidth={
                                            2
                                        }
                                        className={
                                            isFav
                                                ? "fill-red-500 text-red-500"
                                                : "text-gray-500 dark:text-gray-400"
                                        }
                                    />
                                </motion.button>
                            )}
                        </div>
                    </div>

                    {maintenanceLabel && (
                        <div className="absolute inset-x-0 bottom-0 p-3">
                            <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm ${
                                    hideOffRoadNotice
                                        ? "bg-gray-900/85"
                                        : "bg-amber-500/95"
                                }`}
                            >
                                {hideOffRoadNotice ? (
                                    <CalendarX2 size={12} />
                                ) : (
                                    <Wrench size={12} />
                                )}
                                {maintenanceLabel}
                            </span>
                        </div>
                    )}
                </div>

                    <div className={
                        publicView
                            ? "flex flex-col p-3"
                            : "flex flex-col p-6"
                    }>
                        <div className="min-w-0">
                            <h3
                                className={[
                                    "truncate",
                                    "font-bold",
                                    "tracking-tight",
                                    "text-gray-900",
                                    "dark:text-white",
                                    publicView
                                        ? "text-sm"
                                        : "text-xl",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                {item.name}
                            </h3>

                            <div className="mt-1 flex items-center justify-between gap-2">
                                <p
                                    className={[
                                        "truncate",
                                        "font-medium",
                                        "text-gray-500",
                                        "dark:text-gray-400",
                                        publicView
                                            ? "text-[10px]"
                                            : "text-sm",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    {item.vehicleType}
                                </p>

                                <VehicleRating
                                    rating={vehicle.rating}
                                    className="shrink-0"
                                />
                            </div>
                        </div>

                        <div
                            className={[
                                "flex",
                                "flex-wrap",
                                "items-center",
                                "gap-x-3",
                                "gap-y-1.5",
                                "text-gray-600",
                                "dark:text-gray-300",
                                publicView
                                    ? "mt-2 text-[10px]"
                                    : "mt-5 text-sm",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                        <span>
                            {item.transmission}
                        </span>

                        <span>
                            {item.fuelType}
                        </span>

                        <span>
                            {item.seats} Seats
                        </span>
                    </div>

                    <div
                        className={[
                            "mt-2",
                            "flex",
                            "items-center",
                            "justify-between",
                            "gap-3",
                            "border-t",
                            "border-gray-100",
                            "dark:border-gray-700",
                            "pt-2",
                            publicView
                                ? "mt-2 pt-2"
                                : "mt-6 pt-5",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <div
                            className={[
                                "inline-flex",
                                publicView ? "flex-col items-start" : "items-end",
                                "gap-1",
                                "rounded-full",
                                "border",
                                "border-green-200",
                                "bg-green-100/70",
                                "px-3",
                                "py-1.5",
                                "dark:border-green-900/50",
                                "dark:bg-green-900/20",
                                "transition-colors",
                                "duration-300",
                                "dark:group-hover:border-yellow-400/40",
                                "dark:group-hover:bg-yellow-400/10",
                                publicView
                                    ? ""
                                    : "px-4 py-2",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            <OriginalPrice
                                discount={item.activeDiscount}
                                reservationFee={item.reservationFee}
                                className={
                                    publicView
                                        ? "text-[11px] leading-none"
                                        : "text-sm"
                                }
                            />

                            <div className="inline-flex items-baseline gap-1">
                            <Price
                                value={Number(item.effectiveDailyRate) + Number(item.reservationFee || 0)}
                                className={[
                                    "font-black",
                                    "tracking-tight",
                                    "text-green-800",
                                    "dark:text-green-400",
                                    "transition-colors",
                                    "duration-300",
                                    "dark:group-hover:text-yellow-300",
                                    publicView
                                        ? "text-base"
                                        : "text-2xl",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            />

                            <span
                                className={[
                                    "mb-0.5",
                                    "font-semibold",
                                    "uppercase",
                                    "tracking-wide",
                                    "text-green-700",
                                    "dark:text-green-500",
                                    "transition-colors",
                                    "duration-300",
                                    "dark:group-hover:text-yellow-400",
                                    publicView
                                        ? "text-[10px]"
                                        : "text-xs",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                /day
                            </span>
                            </div>
                        </div>

                        <Link
                            to={`/vehicles/${item.id}`}
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                            className={[
                                "inline-flex",
                                "items-center",
                                "gap-1.5",
                                "rounded-full",
                                "bg-blue-600",
                                "px-3",
                                "py-2",
                                "text-sm",
                                "font-semibold",
                                "text-white",
                                "transition-all",
                                "duration-200",
                                "hover:bg-blue-700",
                                "hover:shadow-md",
                                "dark:group-hover:bg-yellow-400",
                                "dark:group-hover:shadow-[0_0_18px_-4px_rgba(250,204,21,0.7)]",
                                "dark:hover:bg-yellow-300",
                                publicView
                                    ? "text-[10px] py-1 px-2.5"
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            {/* Colour on a span: the unlayered `a { color }`
                                in index.css beats utilities on the link. */}
                            <span className="inline-flex items-center gap-1.5 text-white transition-colors duration-200 dark:group-hover:text-gray-950">
                            View Vehicle

                            <ArrowRight
                                size={
                                    publicView
                                        ? 14
                                        : 16
                                }
                                className={[
                                    "transition-transform",
                                    "duration-200",
                                    "group-hover:translate-x-0.5",
                                    publicView
                                        ? ""
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            />
                            </span>
                        </Link>
                    </div>
                </div>
            </motion.article>
        );
    }

    const cardActions = [
        onView && {
            label: "View",
            icon: Eye,
            onClick: () => onView?.(vehicle),
        },

        !isArchivedView &&
            onEdit && {
                label: "Edit",
                icon: Pencil,
                onClick: () => onEdit?.(vehicle),
            },

        !publicView && {
            label: "Documents",
            icon: FileText,
            onClick: () =>
                setDocumentsDialogOpen(true),
        },

        /*
         * Not gated by allowAvailabilityRequests (that prop controls the
         * unrelated availability-withdrawal feature below) — this only
         * depends on the vehicle's own status, so it appears for both
         * admin's Fleet cards and the operator's My Vehicles cards
         * automatically, the one deliberate exception to that page's
         * otherwise read-only convention.
         */
        !publicView &&
            vehicle.status ===
                "RegistrationExpired" && {
                label: "Renew Registration",
                icon: RefreshCw,
                onClick: () =>
                    setRenewDialogOpen(true),
            },

        !isArchivedView
            ? onArchive && {
                  label: "Archive",
                  icon: Trash2,
                  variant: "danger",
                  onClick: () =>
                      onArchive?.(vehicle),
              }
            : onRestore && {
                  label: "Restore",
                  icon: RotateCcw,
                  variant: "success",
                  onClick: () =>
                      onRestore?.(vehicle),
              },
    ].filter(Boolean);

    return (
        <>
        <AnimatePresence>
            <motion.article
                layout
                layoutId={`vehicle-${item.id}`}
                initial={CARD_FADE_UP.initial}
                animate={
                    isLeaving
                        ? {
                              opacity: 0,
                              scale: 0.94,
                              y: -12,
                          }
                        : CARD_FADE_UP.animate
                }
                exit={CARD_FADE_UP.exit}
                transition={{
                    ...CARD_FADE_UP.transition,
                    layout: CARD_LAYOUT_TRANSITION,
                }}
                onClick={onCollapse}
                className="
                    mb-8
                    overflow-hidden
                    rounded-3xl
                    border-2
                    border-blue-500
                    bg-white
                    shadow-2xl
                "
            >
                <div className="flex flex-col lg:flex-row">
                    <motion.div
                        layoutId={`vehicle-image-${item.id}`}
                        className="
                            relative
                            h-72
                            overflow-hidden
                            bg-gray-100
                            lg:w-96
                        "
                    >
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                className="
                                    h-full
                                    w-full
                                    object-cover
                                    transition-transform
                                    duration-500
                                    hover:scale-105
                                "
                            />
                        ) : (
                            <div
                                className="
                                    flex
                                    h-full
                                    flex-col
                                    items-center
                                    justify-center
                                    gap-3
                                    bg-gray-50
                                    text-gray-400
                                "
                            >
                                <ImageOff
                                    size={42}
                                    strokeWidth={1.5}
                                />

                                <div className="text-center">
                                    <p className="font-medium text-gray-500">
                                        No Vehicle Image
                                    </p>

                                    <p className="mt-1 text-sm text-gray-400">
                                        Upload an image later
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    <div className="flex flex-1 flex-col px-10 py-9">
                        <motion.div
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.04,
                            }}
                            className="
                                flex
                                items-center
                                justify-between
                                gap-2
                            "
                        >
                            <div className="min-w-0 flex-1">
                                <motion.h2
                                    layoutId={`vehicle-title-${item.id}`}
                                    className="
                                        truncate
                                        text-3xl
                                        font-bold
                                        tracking-tight
                                        text-gray-900
                                    "
                                >
                                    {item.name}
                                </motion.h2>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        font-medium
                                        tracking-wide
                                        text-gray-500
                                    "
                                >
                                    {item.vehicleCode}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {item.featured && (
                                    <Badge variant="warning">
                                        Featured
                                    </Badge>
                                )}

                                {allowAvailabilityRequests && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setCalendarOpen(
                                                (previous) =>
                                                    !previous
                                            );
                                        }}
                                        leftIcon={
                                            <CalendarClock
                                                size={
                                                    15
                                                }
                                            />
                                        }
                                        rightIcon={
                                            calendarOpen ? (
                                                <ChevronUp
                                                    size={
                                                        14
                                                    }
                                                />
                                            ) : (
                                                <ChevronDown
                                                    size={
                                                        14
                                                    }
                                                />
                                            )
                                        }
                                    >
                                        Availability
                                    </Button>
                                )}

                                <div className="flex-shrink-0">
                                    <CardActionMenu
                                        actions={
                                            cardActions
                                        }
                                    />
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.08,
                            }}
                            className="
                                mt-7
                                flex
                                flex-wrap
                                items-center
                                gap-3
                            "
                        >
                            <StatusChip
                                status={item.status}
                            />

                            {maintenanceWindow && (
                                <Badge variant="warning" size="sm">
                                    {describeMaintenanceMode(
                                        maintenanceWindow.mode,
                                        vehicle.maintenance?.days
                                    )}
                                    {maintenanceWindow.until
                                        ? ` · until ${new Date(
                                              maintenanceWindow.until
                                          ).toLocaleString("en-PH", {
                                              month: "short",
                                              day: "numeric",
                                              hour: "numeric",
                                              minute: "2-digit",
                                          })}`
                                        : ""}
                                </Badge>
                            )}

                            <Badge
                                variant={
                                    ownership ===
                                    "Company"
                                        ? "primary"
                                        : "operator"
                                }
                                size="sm"
                            >
                                {ownership}
                            </Badge>
                        </motion.div>

                        <motion.div
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.12,
                            }}
                            className="
                                mt-7
                                flex
                                flex-wrap
                                gap-x-8
                                gap-y-2
                                text-sm
                                text-gray-600
                            "
                        >
                            <span>
                                {item.vehicleType}
                            </span>

                            <span>
                                {item.transmission}
                            </span>

                            <span>
                                {item.fuelType}
                            </span>

                            <span>
                                {item.seats} Seats
                            </span>
                        </motion.div>

                        <motion.div
                            layoutId={`vehicle-price-${item.id}`}
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.16,
                            }}
                            className="mt-10"
                        >
                            <div
                                className="
                                    inline-flex
                                flex-col
                                items-start
                                    gap-1
                                    rounded-full
                                    border
                                    border-green-200
                                    bg-green-100/70
                                    px-5
                                    py-2
                                    shadow-sm
                                "
                            >
                                <DiscountBadge
                                    discount={item.activeDiscount}
                                    size="md"
                                />

                                <OriginalPrice
                                    discount={item.activeDiscount}
                                    reservationFee={item.reservationFee}
                                    className="text-base"
                                />

                                <Price
                                    value={
                                        Number(item.effectiveDailyRate) + Number(item.reservationFee || 0)
                                    }
                                    className="
                                        text-3xl
                                        font-black
                                        tracking-tight
                                        text-green-800
                                    "
                                />

                                <span
                                    className="
                                        mb-1
                                        text-xs
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-green-700
                                    "
                                >
                                    /day
                                </span>
                            </div>

                            {!publicView &&
                                ownership !== "Company" && (
                                    <div className="mt-3">
                                        <Badge
                                            variant={
                                                commissionInfo.isIndividual
                                                    ? "info"
                                                    : "secondary"
                                            }
                                            size="sm"
                                        >
                                            Commission:{" "}
                                            {
                                                commissionInfo.label
                                            }
                                        </Badge>
                                    </div>
                                )}
                        </motion.div>

                        <AnimatePresence
                            initial={false}
                        >
                            {expanded && (
                                <motion.div
                                    initial={{
                                        height: 0,
                                        opacity: 0,
                                    }}
                                    animate={{
                                        height: "auto",
                                        opacity: 1,
                                    }}
                                    exit={{
                                        height: 0,
                                        opacity: 0,
                                    }}
                                    transition={
                                        COLLAPSE_TRANSITION
                                    }
                                    onClick={(event) =>
                                        event.stopPropagation()
                                    }
                                    className="
                                        mt-8
                                        overflow-hidden
                                        border-t
                                        border-gray-200
                                        pt-7
                                    "
                                >
                                    <div className="flex flex-wrap gap-3">
                                        {children}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {allowAvailabilityRequests && (
                            <AnimatePresence
                                initial={false}
                            >
                                {calendarOpen && (
                                    <motion.div
                                        initial={{
                                            height: 0,
                                            opacity: 0,
                                        }}
                                        animate={{
                                            height: "auto",
                                            opacity: 1,
                                        }}
                                        exit={{
                                            height: 0,
                                            opacity: 0,
                                        }}
                                        transition={
                                            COLLAPSE_TRANSITION
                                        }
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                        className="
                                            mt-8
                                            overflow-hidden
                                            border-t
                                            border-gray-200
                                            pt-7
                                        "
                                    >
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                                                Booking
                                                Availability
                                            </h3>

                                            <Button
                                                type="button"
                                                size="sm"
                                                leftIcon={
                                                    <CalendarClock
                                                        size={
                                                            15
                                                        }
                                                    />
                                                }
                                                onClick={() =>
                                                    setRequestDialogOpen(
                                                        true
                                                    )
                                                }
                                            >
                                                Request
                                                Unavailable
                                                Dates
                                            </Button>
                                        </div>

                                        <AvailabilityCalendar
                                            vehicleId={
                                                item.id
                                            }
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </motion.article>
        </AnimatePresence>

        {allowAvailabilityRequests && (
            <RequestUnavailabilityDialog
                open={requestDialogOpen}
                vehicle={vehicle}
                onClose={() =>
                    setRequestDialogOpen(false)
                }
                onSuccess={() =>
                    setRequestDialogOpen(false)
                }
            />
        )}

        {!publicView && (
            <RenewRegistrationDialog
                open={renewDialogOpen}
                vehicle={vehicle}
                onClose={() =>
                    setRenewDialogOpen(false)
                }
                onSuccess={() =>
                    setRenewDialogOpen(false)
                }
            />
        )}

        {!publicView && (
            <VehicleDocumentsDialog
                open={documentsDialogOpen}
                vehicle={vehicle}
                onClose={() =>
                    setDocumentsDialogOpen(false)
                }
            />
        )}
        </>
    );
};

export default FeaturedVehicleCard;
