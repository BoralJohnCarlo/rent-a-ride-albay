const sum = (refunds) => refunds.reduce(
    (total, refund) => total + Number(refund.amount || 0), 0
);
const idOf = (value) => String(value?._id || value || "");
const inProgress = (status) =>
    ["pending", "processing", "requires_manual_action"].includes(status);

export const getRefundTotals = (booking = {}, rental = booking?.rental) => {
    const rentals = Array.isArray(rental?.refunds) ? rental.refunds : [];
    const approved = rentals.filter((refund) => (refund.status || "Approved") === "Approved");
    const trackedPayments = new Set(rentals.map((refund) => idOf(refund.gatewayPayment)).filter(Boolean));
    const trackedRefunds = new Set(rentals.map((refund) => refund.gatewayRefundId).filter(Boolean));
    const payments = [
        booking?.paymentRefund && { ...booking.paymentRefund, paymentId: booking.paymentId },
        ...(Array.isArray(booking?.extensionRefunds) ? booking.extensionRefunds : []),
    ].filter(Boolean);
    const untracked = payments.filter((refund) =>
        !trackedPayments.has(idOf(refund.paymentId)) &&
        !(refund.refundId && trackedRefunds.has(refund.refundId))
    );
    const owed = Array.isArray(booking?.owedRefunds) ? booking.owedRefunds : [];
    // Old admin-recorded refunds have no gateway outcome. Keep those visible
    // while requiring an explicit success for refunds tracked by a payment.
    const sentRental = (refund) => refund.gatewayStatus === "succeeded" ||
        (!refund.gatewayPayment && !refund.gatewayRefundId &&
            (!refund.gatewayStatus || refund.gatewayStatus === "not_applicable"));
    const hasDetails = rentals.length + payments.length + owed.length > 0;
    return {
        refunded: hasDetails
            ? sum(approved.filter(sentRental)) +
                sum(untracked.filter((refund) => refund.status === "succeeded")) +
                sum(owed.filter((refund) => refund.status === "Paid"))
            : Number(booking?.refundAmount || 0),
        pending: sum(rentals.filter((refund) => refund.status === "Pending")),
        processing: sum(approved.filter((refund) => !sentRental(refund) && refund.gatewayStatus !== "failed")) +
            sum(untracked.filter((refund) => inProgress(refund.status))) +
            sum(owed.filter((refund) => refund.status === "Owed")),
        failed: sum(approved.filter((refund) => refund.gatewayStatus === "failed")) +
            sum(untracked.filter((refund) => refund.status === "failed")) +
            sum(owed.filter((refund) => refund.status === "Not Paid")),
    };
};
