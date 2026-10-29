import { VOUCHER_TYPE } from "../constants/voucherConstants.js";

const toAmount = (value) => Math.max(0, Number(value) || 0);

const round2 = (value) => Math.round(value * 100) / 100;

/*
 * What a booking charges up front — its reservation fee and pickup distance
 * fee — after the booking's voucher. `pricing.reservationFee` and
 * `pricing.pickupDistanceFee` stay the gross figures (rentals, payouts and
 * receipts read them that way); a reservation-fee or pickup-fee voucher's
 * discount is only kept as `voucher.discountAmount`, so it's applied here.
 * Other voucher types discount the rental itself, not what's paid up front.
 *
 * Everything sized or judged by the upfront payment reads this: the
 * reservation payment, its validation and deadline, and the share of a
 * payment the cancellation policy may keep.
 */
export const getUpfrontFees = (booking) => {
    let reservationFee = toAmount(booking?.pricing?.reservationFee);
    let pickupDistanceFee = toAmount(booking?.pricing?.pickupDistanceFee);

    const discount = toAmount(booking?.voucher?.discountAmount);

    if (booking?.voucher?.type === VOUCHER_TYPE.RESERVATION_FEE) {
        reservationFee = round2(Math.max(0, reservationFee - discount));
    } else if (booking?.voucher?.type === VOUCHER_TYPE.PICKUP_FEE) {
        pickupDistanceFee = round2(
            Math.max(0, pickupDistanceFee - discount)
        );
    }

    return {
        reservationFee,
        pickupDistanceFee,
        total: round2(reservationFee + pickupDistanceFee),
    };
};

/*
 * The upfront amount before any voucher. Reservation payments created before
 * vouchers were applied up front were sized from this, so validation still
 * accepts it for those bookings.
 */
export const getGrossUpfrontAmount = (booking) =>
    round2(
        toAmount(booking?.pricing?.reservationFee) +
            toAmount(booking?.pricing?.pickupDistanceFee)
    );
