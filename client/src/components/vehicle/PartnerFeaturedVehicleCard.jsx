import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    CalendarClock,
    ChevronDown,
    ChevronUp,
    ImageOff,
} from "lucide-react";

import {
    CARD_FADE_UP,
    CARD_LAYOUT_TRANSITION,
    COLLAPSE_TRANSITION,
} from "../../constants/motionConstants";

import getVehicleCardData from "../../utils/getVehicleCardData";
import formatCommission from "../../utils/formatCommission";

import Badge from "../common/Badge";
import Button from "../common/Button";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import AvailabilityCalendar from "./AvailabilityCalendar";
import RequestUnavailabilityDialog from "./RequestUnavailabilityDialog";

/*
 * The expanded card on a partner's My Vehicles page. A trimmed sibling of
 * FeaturedVehicleCard (which admin's Fleet page keeps using): no action
 * menu - just the Availability calendar, from which a partner can request
 * unavailable dates. Opens with the calendar already showing when reached
 * through the grid card's "Availability" menu item.
 */
const PartnerFeaturedVehicleCard = ({
    vehicle,
    platformCommissionRate = null,
    initialCalendarOpen = false,
    onCollapse,
}) => {
    const [calendarOpen, setCalendarOpen] = useState(initialCalendarOpen);
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);

    if (!vehicle) {
        return null;
    }

    const item = getVehicleCardData(vehicle);

    const commissionInfo = formatCommission(
        item.commission,
        platformCommissionRate
    );

    const ownership = vehicle.ownership ?? "Company";

    return (
        <>
            <motion.article
                layout
                layoutId={`vehicle-${item.id}`}
                initial={CARD_FADE_UP.initial}
                animate={CARD_FADE_UP.animate}
                exit={CARD_FADE_UP.exit}
                transition={{
                    ...CARD_FADE_UP.transition,
                    layout: CARD_LAYOUT_TRANSITION,
                }}
                onClick={onCollapse}
                className="mb-8 overflow-hidden rounded-3xl border-2 border-blue-500 bg-white shadow-2xl dark:bg-gray-900"
            >
                <div className="flex flex-col lg:flex-row">
                    <motion.div
                        layoutId={`vehicle-image-${item.id}`}
                        className="relative h-72 overflow-hidden bg-gray-100 dark:bg-gray-800 lg:w-96"
                    >
                        {item.image ? (
                            <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                                <ImageOff size={42} strokeWidth={1.5} />
                                <p className="font-medium">No Vehicle Image</p>
                            </div>
                        )}
                    </motion.div>

                    <div className="flex flex-1 flex-col px-6 py-7 sm:px-10 sm:py-9">
                        <motion.div
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.04,
                            }}
                            className="flex flex-wrap items-center justify-between gap-3"
                        >
                            <div className="min-w-0 flex-1">
                                <motion.h2
                                    layoutId={`vehicle-title-${item.id}`}
                                    className="truncate text-3xl font-bold tracking-tight text-gray-900 dark:text-white"
                                >
                                    {item.name}
                                </motion.h2>

                                <p className="mt-1 text-sm font-medium tracking-wide text-gray-500 dark:text-gray-400">
                                    {item.vehicleCode}
                                </p>
                            </div>

                            <div
                                className="flex items-center gap-2"
                                onClick={(event) => event.stopPropagation()}
                            >
                                {item.featured && (
                                    <Badge variant="warning">Featured</Badge>
                                )}

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setCalendarOpen(
                                            (previous) => !previous
                                        )
                                    }
                                    leftIcon={<CalendarClock size={15} />}
                                    rightIcon={
                                        calendarOpen ? (
                                            <ChevronUp size={14} />
                                        ) : (
                                            <ChevronDown size={14} />
                                        )
                                    }
                                >
                                    Availability
                                </Button>
                            </div>
                        </motion.div>

                        <motion.div
                            {...CARD_FADE_UP}
                            transition={{
                                ...CARD_FADE_UP.transition,
                                delay: 0.08,
                            }}
                            className="mt-7 flex flex-wrap items-center gap-3"
                        >
                            <StatusChip status={item.status} />

                            <Badge
                                variant={
                                    ownership === "Company"
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
                            className="mt-7 flex flex-wrap gap-x-8 gap-y-2 text-sm text-gray-600 dark:text-gray-300"
                        >
                            <span>{item.vehicleType}</span>
                            <span>{item.transmission}</span>
                            <span>{item.fuelType}</span>
                            <span>{item.seats} Seats</span>
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
                            <div className="inline-flex items-end gap-1 rounded-full border border-green-200 bg-green-100/70 px-5 py-2 shadow-sm dark:border-green-900/50 dark:bg-green-900/20">
                                <Price
                                    value={Number(item.dailyRate) + Number(item.reservationFee || 0)}
                                    className="text-3xl font-black tracking-tight text-green-800 dark:text-green-400"
                                />
                                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-500">
                                    /day
                                </span>
                            </div>

                            {ownership !== "Company" && (
                                <div className="mt-3">
                                    <Badge
                                        variant={
                                            commissionInfo.isIndividual
                                                ? "info"
                                                : "secondary"
                                        }
                                        size="sm"
                                    >
                                        Commission: {commissionInfo.label}
                                    </Badge>
                                </div>
                            )}
                        </motion.div>

                        <AnimatePresence initial={false}>
                            {calendarOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={COLLAPSE_TRANSITION}
                                    onClick={(event) =>
                                        event.stopPropagation()
                                    }
                                    className="mt-8 overflow-hidden border-t border-gray-200 pt-7 dark:border-gray-800"
                                >
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                            Booking Availability
                                        </h3>

                                        <Button
                                            size="sm"
                                            leftIcon={
                                                <CalendarClock size={15} />
                                            }
                                            onClick={() =>
                                                setRequestDialogOpen(true)
                                            }
                                        >
                                            Request Unavailable Dates
                                        </Button>
                                    </div>

                                    <AvailabilityCalendar
                                        vehicleId={item.id}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.article>

            <RequestUnavailabilityDialog
                open={requestDialogOpen}
                vehicle={vehicle}
                onClose={() => setRequestDialogOpen(false)}
                onSuccess={() => setRequestDialogOpen(false)}
            />
        </>
    );
};

export default PartnerFeaturedVehicleCard;
