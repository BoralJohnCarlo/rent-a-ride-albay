import { motion } from "framer-motion";
import {
    Eye,
    ImageOff,
    Pencil,
    RotateCcw,
    Trash2,
} from "lucide-react";

import getVehicleCardData from "../../utils/getVehicleCardData";

import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";
import CardActionMenu from "../cards/CardActionMenu";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const VehicleCard = ({
    vehicle,
    onSelect,
    onView,
    onEdit,
    onArchive,
    onRestore,
    isArchivedView = false,
    className = "",
}) => {
    const item =
        getVehicleCardData(vehicle);

        const cardActions = [
    {
        label: "View",
        icon: Eye,
        onClick: () => onView?.(vehicle),
    },

    !isArchivedView && {
        label: "Edit",
        icon: Pencil,
        onClick: () => onEdit?.(vehicle),
    },

    !isArchivedView
        ? {
              label: "Archive",
              icon: Trash2,
              variant: "danger",
              onClick: () => onArchive?.(vehicle),
          }
        : {
              label: "Restore",
              icon: RotateCcw,
              variant: "success",
              onClick: () => onRestore?.(vehicle),
          },
].filter(Boolean);

    return (
        <motion.article
            layout
            layoutId={`vehicle-${item.id}`}
            onClick={() =>
                onSelect?.(vehicle)
            }
            transition={{
             layout: CARD_LAYOUT_TRANSITION,
        }}
            className={[
                "group",
                "h-[500x]",
                "cursor-pointer",
                "overflow-visible",
                "rounded-3xl",
                "border",
                "border-gray-200",
                "bg-white",
                "shadow-md",
                "transition-all",
                "duration-300",
                "hover:-translate-y-1",
                "hover:border-gray-300",
                "hover:shadow-2xl",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <motion.div
                layoutId={`vehicle-image-${item.id}`}
                className="relative h-48 overflow-hidden bg-gray-100"
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
                            gap-1
                            bg-gray-50
                            text-gray-400
                        "
                    >
                        <ImageOff
                            size={30}
                            strokeWidth={1.5}
                        />

                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500">
                                No Image
                            </p>

                            <p className="text-xs text-gray-400">
                                Upload later
                            </p>
                        </div>
                    </div>
                )}

            <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
                    {item.featured && (
                <Badge variant="warning">
                    Featured
                </Badge>
            )}

    <div
        className="
            rounded-full
          bg-white/90
            backdrop-blur-sm
            shadow-md
            transition
          hover:bg-white
        "

        onClick={(event) => event.stopPropagation()}
    >
        <CardActionMenu
            actions={cardActions}
        />
    </div>
</div>
            </motion.div>

            <div className="flex-1 flex-col px-6 py-5">

                <div>
    <div className="min-w-0 flex-1">
        <motion.h3
            layoutId={`vehicle-title-${item.id}`}
            className="
                truncate
                text-lg
                font-bold
                tracking-tight
                text-gray-900
            "
        >
            {item.name}
        </motion.h3>

        <p
            className="
                mt-1.5
                text-sm
                font-medium
                tracking-wide
                text-gray-500
            "
        >
            {item.vehicleCode}
        </p>
    </div>

</div>

                <div className="mt-5 flex items-center justify-between gap-3">
         <StatusChip
             status={item.status}
         />

         <Badge
         className="shrink-0"
                variant={
                   vehicle.ownership ===
                       "Company"
                     ? "info"
                     : "warning"
             }
         >
        {vehicle.ownership ??
            "Company"}
    </Badge>
                </div> 

                <div
                    className="
                        mt-5
                        flex
                        flex-wrap
                        gap-x-4
                        gap-y-1
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
                </div>

                <motion.div
                    layoutId={`vehicle-price-${item.id}`}
                    className="mt-auto flex items-end justify-between pt-5"
                >
                    <div
    className="
        inline-flex
        items-end
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
    <Price
        value={item.dailyRate}
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

                    <div
                        className="
                            text-right
                            text-xs
                            leading-5
                            text-gray-400
                        "
                    >
                        <p>
                            {item.seats} Seats
                        </p>

                        <p>
                            {item.fuelType}
                        </p>
                    </div>
                </motion.div>

            </div>
        </motion.article>
    );
};

export default VehicleCard;