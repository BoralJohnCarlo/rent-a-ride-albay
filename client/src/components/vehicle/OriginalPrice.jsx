import Price from "../common/Price";

/*
 * The struck-through "was" price beside a discounted one. Renders nothing
 * without a running discount, so cards can always include it.
 */
const OriginalPrice = ({
    discount,
    reservationFee = 0,
    className = "",
    ...priceProps
}) => {
    if (!discount) {
        return null;
    }

    return (
        <Price
            value={
                Number(discount.originalDailyRate || 0) +
                Number(reservationFee || 0)
            }
            className={[
                "font-semibold text-gray-400 line-through decoration-rose-500/70 dark:text-gray-500",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            {...priceProps}
        />
    );
};

export default OriginalPrice;
