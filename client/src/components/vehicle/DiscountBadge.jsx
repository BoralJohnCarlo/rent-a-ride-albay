import { Tag } from "lucide-react";

import {
    formatDiscountAmount,
} from "../../utils/vehicleDiscount";

/*
 * The "on sale" pill for vehicle cards and the details page. Shows the
 * admin's label (e.g. "Holiday Sale") with the amount off beside it, or
 * just the amount when there's no label.
 */
const SIZES = {
    sm: "gap-1 px-2 py-0.5 text-[10px]",
    md: "gap-1.5 px-2.5 py-1 text-xs",
};

const DiscountBadge = ({
    discount,
    size = "sm",
    className = "",
}) => {
    if (!discount) {
        return null;
    }

    const label = discount.label?.trim();
    const amount = formatDiscountAmount(discount);

    return (
        <span
            className={[
                "inline-flex max-w-full items-center rounded-full bg-rose-600 font-bold uppercase tracking-wide text-white shadow-md shadow-rose-600/30 dark:bg-rose-500",
                SIZES[size] ?? SIZES.sm,
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            title={discount.name}
        >
            <Tag
                size={size === "md" ? 13 : 11}
                className="shrink-0"
                aria-hidden="true"
            />

            {label && (
                <span className="truncate">
                    {label}
                </span>
            )}

            {label && (
                <span
                    className="opacity-70"
                    aria-hidden="true"
                >
                    ·
                </span>
            )}

            <span className="shrink-0">
                {amount}
            </span>
        </span>
    );
};

export default DiscountBadge;
