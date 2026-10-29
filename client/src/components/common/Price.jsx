const Price = ({
    value = 0,
    currency = "PHP",
    locale = "en-PH",
    prefix = "",
    suffix = "",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    className = "",
}) => {
    const amount = Number(value);

    const formattedPrice = new Intl.NumberFormat(
        locale,
        {
            style: "currency",
            currency,
            minimumFractionDigits,
            maximumFractionDigits,
        }
    ).format(
        Number.isFinite(amount) ? amount : 0
    );

    return (
        <span
            className={[
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {prefix}
            {formattedPrice}
            {suffix}
        </span>
    );
};

export default Price;