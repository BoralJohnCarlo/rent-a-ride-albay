import { useEffect, useState } from "react";

import { fetchBookingCancellationPreview } from "../../services/bookingService";
import PolicySourceNote from "../legal/PolicySourceNote";

const formatCurrency = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/*
 * Cutoffs are anchored to the booked pickup time in Philippine time, so show
 * them there whatever the viewer's device says.
 */
const formatCutoff = (value) =>
    new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
    }).format(new Date(value));

const NOTICE_BASE =
    "space-y-1 rounded-lg px-3 py-2 text-xs font-medium";

const NOTICE_NEUTRAL = `${NOTICE_BASE} bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300`;
const NOTICE_FULL = `${NOTICE_BASE} bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`;
const NOTICE_PARTIAL = `${NOTICE_BASE} bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300`;

const getReason = (preview) => {
    if (preview.rule === "before_approval") {
        return "Your booking hasn't been approved yet.";
    }

    if (preview.rule === "approval_grace") {
        return "You're still within the cooling-off period after approval.";
    }

    if (preview.rule === "tier" && preview.tierHoursBefore) {
        return `You're cancelling at least ${preview.tierHoursBefore} hour${
            preview.tierHoursBefore === 1 ? "" : "s"
        } before pickup.`;
    }

    if (preview.rule === "none") {
        return "Under our cancellation policy the reservation fee isn't refundable at this point.";
    }

    return "";
};

/*
 * Tells the customer, before they confirm a cancellation, exactly what they
 * will get back right now and when that next drops. The figures come from
 * the server (the same calculation cancelBooking uses), so the dialog can
 * never promise something the cancellation won't deliver.
 */
const CancellationRefundNotice = ({ bookingId }) => {
    const [state, setState] = useState({
        status: "loading",
        preview: null,
    });

    useEffect(() => {
        let active = true;

        fetchBookingCancellationPreview(bookingId)
            .then((response) => {
                if (active) {
                    setState({
                        status: "ready",
                        preview: response?.data ?? null,
                    });
                }
            })
            .catch(() => {
                if (active) {
                    setState({
                        status: "error",
                        preview: null,
                    });
                }
            });

        return () => {
            active = false;
        };
    }, [bookingId]);

    if (state.status === "loading") {
        return (
            <p className={NOTICE_NEUTRAL} aria-live="polite">
                Checking your refund…
            </p>
        );
    }

    const preview = state.preview;

    if (state.status === "error" || !preview) {
        return (
            <p className={NOTICE_NEUTRAL}>
                We couldn&apos;t work out your refund right now. It follows our
                cancellation policy, and the exact amount is confirmed when you
                cancel.
            </p>
        );
    }

    // Nothing paid yet, so nothing can be kept or refunded.
    if (!preview.hasPayment) {
        return null;
    }

    const refundAll = preview.keptAmount <= 0;
    const reason = getReason(preview);
    const next = preview.next;

    return (
        <div
            className={refundAll ? NOTICE_FULL : NOTICE_PARTIAL}
            aria-live="polite"
        >
            <p>
                {refundAll
                    ? `Cancelling now refunds everything you paid (${formatCurrency(preview.totalPaid)}).`
                    : preview.refundAmount > 0
                      ? `Cancelling now refunds ${formatCurrency(preview.refundAmount)} of the ${formatCurrency(preview.totalPaid)} you paid. ${formatCurrency(preview.keptAmount)} is kept under our cancellation policy.`
                      : `Cancelling now does not refund your ${formatCurrency(preview.keptAmount)} reservation fee.`}
            </p>

            {reason && <p className="font-normal">{reason}</p>}

            {next && (
                <p className="font-normal">
                    {next.refundAmount > 0
                        ? `After ${formatCutoff(next.after)} (Philippine time) the refund drops to ${formatCurrency(next.refundAmount)}.`
                        : `After ${formatCutoff(next.after)} (Philippine time) nothing would be refunded.`}
                </p>
            )}

            <PolicySourceNote
                source={preview.policySource}
                version={preview.termsVersion}
                inheritColor
            />
        </div>
    );
};

export default CancellationRefundNotice;
