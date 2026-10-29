import { motion } from "framer-motion";
import {
    ArrowRight,
    ImageOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import getVehicleCardData from "../../utils/getVehicleCardData";

import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";
import DiscountBadge from "../vehicle/DiscountBadge";
import OriginalPrice from "../vehicle/OriginalPrice";
import useAuth from "../../hooks/auth/useAuth";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";
import { isVehicleBookable } from "../../constants/vehicleConstants";


const PublicVehicleCard = ({
    vehicle,
    onSelect,
    className = "",
}) => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    const item =
        getVehicleCardData(vehicle);

    const handleReserveClick = (event) => {
        event.stopPropagation();

        if (isAuthenticated && user?.role === "customer") {
            navigate(`/vehicles/${item.id}`);
        } else {
            navigate(`/login?redirect=/vehicles/${item.id}`);
        }
    };

    return (
        <motion.article
            layout
            layoutId={`public-vehicle-${item.id}`}
            onClick={() =>
                onSelect?.(vehicle)
            }
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
            }}
            className={[
                "group",
                "flex",
                "h-full",
                "cursor-pointer",
                "flex-col",
                "overflow-hidden",
                "rounded-3xl",
                "border",
                "border-gray-200",
                "bg-white",
                "shadow-sm",
                "transition-all",
                "duration-300",
                "hover:-translate-y-1",
                "hover:border-gray-300",
                "hover:shadow-xl",
                "dark:border-gray-700",
                "dark:bg-gray-800",
                "dark:hover:border-gray-600",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <motion.div
                layoutId={`public-vehicle-image-${item.id}`}
                className="
                    relative
                    h-36
                    shrink-0
                    overflow-hidden
                    bg-gray-100
                    dark:bg-gray-900
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
                            dark:bg-gray-900
                            dark:text-gray-500
                        "
                    >
                        <ImageOff
                            size={32}
                            strokeWidth={1.5}
                        />

                        <span
                            className="
                                text-sm
                                font-medium
                            "
                        >
                            No Image
                        </span>
                    </div>
                )}

                {item.activeDiscount && (
                    <div className="absolute left-3 top-3 max-w-[60%]">
                        <DiscountBadge discount={item.activeDiscount} />
                    </div>
                )}

                <div
                    className="
                        absolute
                        right-4
                        top-4
                    "
                >
                    {item.featured && (
                        <Badge variant="warning">
                            Featured
                        </Badge>
                    )}
                </div>
            </motion.div>

            <div
                className="
                    flex
                    flex-1
                    flex-col
                    px-3
                    py-3
                "
            >
                <div>
                    <motion.h3
                        layoutId={`public-vehicle-title-${item.id}`}
                        className="
                            truncate
                            text-sm
                            font-bold
                            tracking-tight
                            text-gray-900
                            dark:text-white
                        "
                    >
                        {item.name}
                    </motion.h3>

                    <p
                        className="
                            mt-1
                            text-xs
                            text-gray-500
                            dark:text-gray-400
                        "
                    >
                        {item.category}
                    </p>
                </div>

                <div
                    className="
                        mt-3
                        flex
                        items-center
                        justify-between
                        gap-3
                    "
                >
                    {/* Rented/Reserved still take other dates. */}
                    <StatusChip
                        status={
                            isVehicleBookable(vehicle)
                                ? "Available"
                                : item.status
                        }
                    />

                    <span
                        className="
                            text-sm
                            font-medium
                            text-gray-500
                            dark:text-gray-400
                        "
                    >
                        {item.vehicleType}
                    </span>
                </div>

                <div
                    className="
                        mt-3
                        flex
                        flex-wrap
                        gap-x-3
                        gap-y-1
                        text-xs
                        text-gray-600
                        dark:text-gray-300
                    "
                >
                    <span>
                        {item.seats} Seats
                    </span>

                    <span>
                        {item.transmission}
                    </span>

                    <span>
                        {item.fuelType}
                    </span>
                </div>

                <motion.div
                    layoutId={`public-vehicle-price-${item.id}`}
                    className="
                        mt-auto
                        flex
                        items-end
                        justify-between
                        gap-4
                        pt-3
                    "
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
                            px-4
                            py-2
                            dark:border-green-900/50
                            dark:bg-green-900/20
                        "
                    >
                        <OriginalPrice
                            discount={item.activeDiscount}
                            reservationFee={item.reservationFee}
                            className="text-[11px] leading-none"
                        />

                        <Price
                            value={Number(item.effectiveDailyRate) + Number(item.reservationFee || 0)}
                            className="
                                text-base
                                font-black
                                tracking-tight
                                text-green-800
                                dark:text-green-400
                            "
                        />

                        <span
                            className="
                                mb-0.5
                                text-[10px]
                                font-semibold
                                uppercase
                                tracking-wide
                                text-green-700
                                dark:text-green-500
                            "
                        >
                            /day
                        </span>
                    </div>

                    <ArrowRight
                        size={20}
                        className="
                            shrink-0
                            text-gray-400
                            transition-all
                            duration-200
                            group-hover:translate-x-1
                            group-hover:text-gray-700
                            dark:text-gray-500
                            dark:group-hover:text-gray-200
                        "
                    />
                </motion.div>

                <button
                    type="button"
                    onClick={handleReserveClick}
                    className="
                        mt-3
                        w-full
                        cursor-pointer
                        rounded-full
                        border
                        border-gray-200
                        bg-gray-100
                        px-4
                        py-1.5
                        text-xs
                        font-semibold
                        text-gray-500
                        transition-colors
                        duration-200
                        hover:border-blue-300
                        hover:bg-blue-50
                        hover:text-blue-700
                        dark:border-gray-700
                        dark:bg-gray-700
                        dark:text-gray-400
                        dark:hover:border-blue-700
                        dark:hover:bg-blue-900/20
                        dark:hover:text-blue-300
                    "
                >
                    Reserve Vehicle
                </button>
            </div>
        </motion.article>
    );
};


export default PublicVehicleCard;
