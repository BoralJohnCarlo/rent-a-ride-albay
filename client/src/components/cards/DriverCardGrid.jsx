import { motion } from "framer-motion";
import { UserRound } from "lucide-react";

import DriverCard from "./DriverCard";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const GRID_CLASS =
    "mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3";

const DriverCardGrid = ({
    drivers = [],
    loading = false,
    isArchivedView = false,
    onView,
    onEdit,
    onStatusChange,
    onArchive,
    onRestore,
}) => {
    if (loading && !drivers.length) {
        return (
            <div className={GRID_CLASS} aria-busy="true">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-52 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                    />
                ))}
            </div>
        );
    }

    if (!drivers.length) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                    <UserRound size={26} />
                </div>
                <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                    No drivers found
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Try adjusting your search or filters.
                </p>
            </div>
        );
    }

    return (
        <motion.div
            layout
            transition={{ layout: CARD_LAYOUT_TRANSITION }}
            className={GRID_CLASS}
        >
            {drivers.map((driver) => (
                <DriverCard
                    key={driver._id}
                    driver={driver}
                    isArchivedView={isArchivedView}
                    onView={onView}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    onArchive={onArchive}
                    onRestore={onRestore}
                />
            ))}
        </motion.div>
    );
};

export default DriverCardGrid;
