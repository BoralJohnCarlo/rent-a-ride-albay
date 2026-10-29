import { DISCOUNT_METHOD } from "../constants/discountConstants";

/*
 * A vehicle's running discount arrives from the server as
 * `vehicle.activeDiscount` (null when none): the server picks the best one
 * and applies the same rate when the booking is priced, so these helpers
 * only read it - never work a discount out on their own.
 */
export const getActiveDiscount = (vehicle) =>
    vehicle?.activeDiscount ?? vehicle?.raw?.activeDiscount ?? null;

/* The daily rate the customer pays today (after any discount). */
export const getEffectiveDailyRate = (vehicle) => {
    const discount = getActiveDiscount(vehicle);

    return Number(
        discount
            ? discount.discountedDailyRate
            : vehicle?.pricing?.dailyRate ?? 0
    );
};

/* "20% OFF" / "₱300 OFF" */
export const formatDiscountAmount = (discount) => {
    if (!discount) {
        return "";
    }

    if (discount.discountMethod === DISCOUNT_METHOD.PERCENTAGE) {
        return `${Number(discount.discountValue)}% OFF`;
    }

    return `₱${Number(discount.amountOff ?? discount.discountValue).toLocaleString(
        "en-PH",
        { maximumFractionDigits: 2 }
    )} OFF`;
};

/* Badge text: the admin's label, else the amount off. */
export const getDiscountBadgeText = (discount) =>
    discount?.label?.trim() || formatDiscountAmount(discount);
