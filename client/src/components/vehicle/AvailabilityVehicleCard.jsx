import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    Cog,
    Fuel,
    ImageOff,
    Star,
    Users,
} from "lucide-react";

import getVehicleCardData from "../../utils/getVehicleCardData";
import Price from "../common/Price";
import VehicleRating from "./VehicleRating";
import DiscountBadge from "./DiscountBadge";
import OriginalPrice from "./OriginalPrice";

/*
 * Card used on the public availability page. Unlike the generic
 * FeaturedVehicleCard it leans into the "booked for a date range" context:
 * it surfaces an availability pill and the trip total for the selected dates.
 */
const AvailabilityVehicleCard = ({ vehicle, rentalDays = 0 }) => {
    const item = getVehicleCardData(vehicle);

    // After any running discount - what the booking will be priced at.
    const dailyRate =
        (Number(item.effectiveDailyRate) || 0) +
        (Number(item.reservationFee) || 0);
    const tripTotal =
        (Number(item.effectiveDailyRate) || 0) * rentalDays +
        (Number(item.reservationFee) || 0);

    const subtitle = [item.year, item.vehicleType, item.category]
        .filter((part) => part && part !== "Uncategorized")
        .join(" · ");

    return (
        <Link
            to={`/vehicles/${item.id}`}
            className="group block h-full focus:outline-none"
        >
            <motion.article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-transparent transition-[box-shadow,border-color] duration-300 hover:border-gray-300 hover:shadow-xl group-focus-visible:ring-yellow-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
                <div className="relative aspect-[16/10] overflow-hidden bg-gray-50 dark:bg-gray-800">
                    {item.image ? (
                        <img
                            src={item.image}
                            alt={item.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                        />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-600">
                            <ImageOff size={30} strokeWidth={1.5} />
                            <span className="text-xs font-medium">
                                No image
                            </span>
                        </div>
                    )}

                    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-950/90 dark:text-green-400 dark:ring-white/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Available
                        </span>

                        {item.featured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-950 shadow-sm">
                                <Star size={11} fill="currentColor" />
                                Featured
                            </span>
                        )}
                    </div>

                    {item.activeDiscount && (
                        <div className="absolute inset-x-0 bottom-0 p-3">
                            <DiscountBadge discount={item.activeDiscount} />
                        </div>
                    )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                    <h3 className="truncate text-[15px] font-bold text-gray-900 dark:text-white">
                        {item.name || "Vehicle"}
                    </h3>
                    {subtitle && (
                        <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                            {subtitle}
                        </p>
                    )}

                    <VehicleRating
                        rating={vehicle?.rating}
                        size="md"
                        className="mt-1.5"
                    />


                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1.5">
                            <Cog
                                size={14}
                                className="text-gray-400 dark:text-gray-500"
                            />
                            {item.transmission}
                        </span>
                        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
                        <span className="inline-flex items-center gap-1.5">
                            <Fuel
                                size={14}
                                className="text-gray-400 dark:text-gray-500"
                            />
                            {item.fuelType}
                        </span>
                        <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" />
                        <span className="inline-flex items-center gap-1.5">
                            <Users
                                size={14}
                                className="text-gray-400 dark:text-gray-500"
                            />
                            {item.seats}
                        </span>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 border-t border-gray-100 pt-3.5 dark:border-gray-800">
                        <div className="min-w-0">
                            <OriginalPrice
                                discount={item.activeDiscount}
                                reservationFee={item.reservationFee}
                                minimumFractionDigits={0}
                                maximumFractionDigits={0}
                                className="text-xs"
                            />
                            <div className="flex items-baseline gap-1">
                                <Price
                                    value={dailyRate}
                                    minimumFractionDigits={0}
                                    maximumFractionDigits={0}
                                    className="text-xl font-black tracking-tight text-gray-900 dark:text-white"
                                />
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                                    /day
                                </span>
                            </div>
                            {rentalDays > 0 && (
                                <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                    <Price
                                        value={tripTotal}
                                        minimumFractionDigits={0}
                                        maximumFractionDigits={0}
                                        className="font-bold text-gray-700 dark:text-gray-200"
                                    />{" "}
                                    total · {rentalDays}{" "}
                                    {rentalDays === 1 ? "day" : "days"}
                                </p>
                            )}
                        </div>

                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-colors duration-200 group-hover:bg-yellow-500 group-hover:text-gray-950 dark:bg-white dark:text-gray-900 dark:group-hover:bg-yellow-400">
                            <ArrowRight
                                size={16}
                                className="transition-transform duration-200 group-hover:translate-x-0.5"
                            />
                        </span>
                    </div>
                </div>
            </motion.article>
        </Link>
    );
};

export default AvailabilityVehicleCard;
