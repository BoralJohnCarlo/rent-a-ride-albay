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
import VehiclePinButton from "./VehiclePinButton";

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
    menuActions,
    // Admin fleet: pin toggle in the photo's top-left corner.
    pinned = false,
    onTogglePin,
    className = "",
}) => {
    const item =
        getVehicleCardData(vehicle);

        // `menuActions` replaces the default admin menu outright (a
        // partner's card only gets View + Availability).
        const cardActions = menuActions ?? [
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
                "flex",
                "flex-col",
                "cursor-pointer",
                "rounded-3xl",
                "border",
                "border-gray-200",
                "bg-white",
                "dark:border-gray-800",
                "dark:bg-gray-900",
                "shadow-md",
                "transition-all",
                "duration-300",
                "hover:-translate-y-1",
                "hover:border-gray-300",
                "dark:hover:border-gray-600",
                "hover:shadow-2xl",
                pinned &&
                    "ring-2 ring-amber-300/70 dark:ring-amber-500/40",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <motion.div
                layoutId={`vehicle-image-${item.id}`}
                className="relative h-40 overflow-hidden rounded-t-3xl bg-gray-50 dark:bg-gray-800/60"
            >
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="
                            h-full
                            w-full
                            object-contain
                            p-3
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
                            dark:bg-gray-800/50
                            dark:text-gray-500
                        "
                    >
                        <ImageOff
                            size={30}
                            strokeWidth={1.5}
                        />

                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                No Image
                            </p>

                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                Upload later
                            </p>
                        </div>
                    </div>
                )}

            {onTogglePin && (
                <VehiclePinButton
                    variant="card"
                    pinned={pinned}
                    onToggle={() => onTogglePin(vehicle)}
                    className="absolute left-3 top-3 z-50"
                />
            )}

            <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
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
            dark:bg-gray-800/90
            dark:hover:bg-gray-800
        "

        onClick={(event) => event.stopPropagation()}
    >
        <CardActionMenu
            actions={cardActions}
        />
    </div>
</div>
            </motion.div>

            <div className="flex flex-1 flex-col px-4 py-4">

                <div>
    <div className="min-w-0 flex-1">
        <motion.h3
            layoutId={`vehicle-title-${item.id}`}
            className="
                truncate
                text-base
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
                mt-0.5
                text-xs
                font-medium
                tracking-wide
                text-gray-500
                dark:text-gray-400
            "
        >
            {item.vehicleCode}
        </p>
    </div>

</div>

                <div className="mt-3 flex items-center justify-between gap-3">
         <StatusChip
             status={item.status}
             size="sm"
         />

         <Badge
         size="sm"
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
                        mt-3
                        flex
                        flex-wrap
                        gap-x-4
                        gap-y-1
                        text-xs
                        text-gray-600
                        dark:text-gray-300
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
                    className="mt-auto flex items-end justify-between pt-3"
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
        px-3
        py-1
        shadow-sm
        dark:border-green-900/50
        dark:bg-green-900/30
    "
>
    <Price
        value={Number(item.dailyRate) + Number(item.reservationFee || 0)}
        className="
            text-lg
            font-black
            tracking-tight
            text-green-800
            dark:text-green-300
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
            dark:text-green-400
        "
    >
        /day
    </span>
</div>

                    <div
                        className="
                            text-right
                            text-[11px]
                            leading-4
                            text-gray-400
                            dark:text-gray-500
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
