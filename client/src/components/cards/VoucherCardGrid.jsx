import { motion } from "framer-motion";

import VoucherCard from "./VoucherCard";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const VoucherCardGrid = ({
    vouchers = [],
    onView,
    onEdit,
    onDelete,
    onCopyCode,
    className = "",
}) => {
    if (!vouchers.length) {
        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                    No vouchers found
                </p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                    Create a voucher to get started.
                </p>
            </div>
        );
    }

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
                "gap-5",
                "md:grid-cols-2",
                "xl:grid-cols-3",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {vouchers.map((voucher) => (
                <VoucherCard
                    key={voucher._id ?? voucher.id}
                    voucher={voucher}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onCopyCode={onCopyCode}
                />
            ))}
        </motion.div>
    );
};

export default VoucherCardGrid;
