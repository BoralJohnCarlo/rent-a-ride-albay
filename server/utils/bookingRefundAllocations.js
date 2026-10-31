import { BOOKING_RESCHEDULE_STATUS, BOOKING_RESCHEDULE_SETTLEMENT } from "../constants/bookingConstants.js";

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
