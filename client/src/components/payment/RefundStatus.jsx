import { getRefundTotals } from "../../utils/refundStatus";
import { AlertTriangle, Ban, CircleDollarSign, Clock } from "lucide-react";

/*
 * A booking's refund can live in several places: `rental.refunds[]`
 * (post-pickup refund requests, approved/rejected by an admin), the
 * refund on the reservation-fee or an extension-fee Payment (an automatic
 * PayMongo/manual refund triggered by a pre-pickup cancellation), or a
 * refund our team owes by hand (`booking.owedRefunds`). Payment and owed
 * refunds only reach `booking.refundAmount` once they've actually gone
 * through, so the ones still pending, needing manual action, or failed are
 * totalled here separately.
 */
const RefundStatus = ({ booking, rental }) => {
    const {
        refunded: approvedRefund,
        pending: pendingTotal,
        processing: paymentRefundAmount,
        failed: failedRefundAmount,
    } = getRefundTotals(booking, rental);
    const hasApprovedRefund = approvedRefund > 0;
    const hasPendingRefund = pendingTotal > 0;
    const isPaymentRefundInProgress = paymentRefundAmount > 0;
    const isPaymentRefundFailed = failedRefundAmount > 0;
    /*
     * Cancelled + paid + no refund of any kind ever recorded means the
     * reservation fee was kept in full per the cancellation policy — a
     * silent outcome in the data (no refund object is created at all when
     * nothing is owed back), so it needs its own explicit indicator.
     */
    const isNoShow = booking?.status === "No Show";

    const feeKeptInFull =
        (booking?.status === "Cancelled" || isNoShow) &&
        booking?.paymentStatus === "VERIFIED" &&
        !hasApprovedRefund &&
        !hasPendingRefund &&
        !isPaymentRefundInProgress &&
        !isPaymentRefundFailed;

    if (
        !hasApprovedRefund &&
        !hasPendingRefund &&
        !isPaymentRefundInProgress &&
        !isPaymentRefundFailed &&
        !feeKeptInFull
    ) {
        return null;
    }

    return (
        <div className="flex min-w-0 max-w-full flex-col items-end gap-1 [&>span]:max-w-full [&>span]:whitespace-normal [&>span]:break-words [&_svg]:shrink-0">
            {hasApprovedRefund && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CircleDollarSign size={14} aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {`Refunded: ₱${approvedRefund.toLocaleString()}`}
                    </span>
                </span>
            )}

            {hasPendingRefund && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Clock size={14} aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {`Refund Pending: ₱${pendingTotal.toLocaleString()}`}
                    </span>
                </span>
            )}

            {isPaymentRefundInProgress && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Clock size={14} aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {`Refund Processing: ₱${paymentRefundAmount.toLocaleString()}`}
                    </span>
                </span>
            )}

            {isPaymentRefundFailed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <AlertTriangle size={14} aria-hidden="true" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                        {`Refund Failed: ₱${failedRefundAmount.toLocaleString()}`}
                    </span>
                </span>
            )}

            {feeKeptInFull && (
                <span
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                    title={
                        isNoShow
                            ? "The vehicle wasn't picked up, so the reservation fee was kept per the cancellation policy."
                            : "The reservation fee is non-refundable per the cancellation policy."
                    }
                >
                    <Ban size={14} aria-hidden="true" />
                    Fee Non-Refundable
                </span>
            )}
        </div>
    );
};

export default RefundStatus;
