import { motion } from "framer-motion";

import VehicleCard from "./VehicleCard";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const VehicleCardGrid = ({
    vehicles = [],
    onSelect,
    getMenuActions,
    pinnedIds,
    onTogglePin,
    className = "",
}) => {
    return (
        <motion.div
            layout
            transition={{
            layout: CARD_LAYOUT_TRANSITION,
}}
            className={[
                "mx-auto",
                "grid",
                "w-full",
                "max-w-[1600px]",
                "grid-cols-1",
                "gap-6",
                "md:grid-cols-2",
                "lg:gap-7",
                "xl:grid-cols-3",
                "2xl:gap-8",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {vehicles.map((vehicle) => (
                <VehicleCard
                    key={vehicle._id}
                    vehicle={vehicle}
                    onSelect={onSelect}
                    menuActions={getMenuActions?.(vehicle)}
                    pinned={pinnedIds?.includes(vehicle._id) ?? false}
                    onTogglePin={onTogglePin}
                />
            ))}
        </motion.div>
    );
};

export default VehicleCardGrid;