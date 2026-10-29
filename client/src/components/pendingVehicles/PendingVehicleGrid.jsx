import { AnimatePresence, motion } from "framer-motion";
import PendingVehicleCard from "./PendingVehicleCard";

const STEP_VARIANTS = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
};

const STEP_TRANSITION = { duration: 0.2, ease: "easeOut" };

const PendingVehicleGrid = ({
    pendingVehicles,
    loading,
    onSelect,
    onView,
    onApprove,
    onReject,
    selectedId
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            </div>
        );
    }

    if (!pendingVehicles || pendingVehicles.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No pending vehicles found</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                {pendingVehicles.map((pendingVehicle) => (
                    <motion.div
                        key={pendingVehicle._id}
                        initial={STEP_VARIANTS.initial}
                        animate={STEP_VARIANTS.animate}
                        exit={STEP_VARIANTS.exit}
                        transition={STEP_TRANSITION}
                        layout
                    >
                        <PendingVehicleCard
                            pendingVehicle={pendingVehicle}
                            onSelect={onSelect}
                            onView={onView}
                            onApprove={onApprove}
                            onReject={onReject}
                            isSelected={selectedId === pendingVehicle._id}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};

export default PendingVehicleGrid;