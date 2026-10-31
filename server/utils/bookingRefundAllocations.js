import { BOOKING_RESCHEDULE_STATUS, BOOKING_RESCHEDULE_SETTLEMENT } from "../constants/bookingConstants.js";
import { MANUAL_REFUND_STATUS, PAYMENT_REFUND_STATUS, PAYMENT_TYPE } from "../constants/paymentConstants.js";
import Payment from "../models/Payment.js";
import ManualRefund from "../models/ManualRefund.js";

// Older price changes refunded the reservation payment only. New records
// identify each payment so top-up refunds don't reduce that payment twice.
export const getAllocatedPriceChangeRefund = (booking, paymentId = null, includeLegacy = true) => {
    const changes = [
        ...(booking?.reschedules || []).filter((r) => r.status === BOOKING_RESCHEDULE_STATUS.APPROVED),
        ...(booking?.vehicleChanges || []),
    ];
    return changes.reduce((sum, change) => {
        const settlement = change.settlement;
        if (settlement?.kind !== BOOKING_RESCHEDULE_SETTLEMENT.REFUND) return sum;
        if (!paymentId) return sum + Number(settlement.amount || 0);
        if (settlement.allocations?.length) {
            return sum + settlement.allocations.reduce((total, allocation) =>
                total + (String(allocation.payment) === String(paymentId) ? Number(allocation.amount || 0) : 0), 0);
        }
        return sum + (includeLegacy ? Number(settlement.amount || 0) : 0);
    }, 0);
};

// Settlement history is an audit trail, not proof that money was returned.
// Remove failed shares once per payment, while retaining successful/owed ones.
export const getActiveAllocatedPriceChangeRefund = async (booking, paymentId = null, includeLegacy = true) => {
    const total = getAllocatedPriceChangeRefund(booking, paymentId, includeLegacy);
    if (!total || !booking?._id) return total;
    const [payments, manualRefunds] = await Promise.all([
        Payment.find({ booking: booking._id, ...(paymentId ? { _id: paymentId } : {}),
            "refund.status": PAYMENT_REFUND_STATUS.FAILED }).select("paymentType refund").lean(),
        ManualRefund.find({ booking: booking._id, status: MANUAL_REFUND_STATUS.NOT_PAID,
            payment: paymentId || { $ne: null },
            // Cancellation refunds are separate from price-change allocations.
            reason: /^Refund of the price difference after / }).select("payment amount").lean(),
    ]);
    const failed = new Map();
    for (const payment of payments) {
        failed.set(String(payment._id), { amount: Number(payment.refund?.amount || 0),
            legacy: payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE });
    }
    for (const refund of manualRefunds) {
        const key = String(refund.payment);
        const value = failed.get(key) || { amount: 0, legacy: false };
        value.amount += Number(refund.amount || 0);
        failed.set(key, value);
    }
    let excluded = 0;
    for (const [id, value] of failed) {
        excluded += Math.min(value.amount, getAllocatedPriceChangeRefund(booking, id,
            paymentId ? includeLegacy : value.legacy));
    }
    return Math.max(0, total - excluded);
};
