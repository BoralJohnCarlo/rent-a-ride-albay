import { useEffect, useState } from "react";
import { BadgeDollarSign, Loader2 } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Textarea from "../common/Textarea";

import PayoutRequestCard from "../payouts/PayoutRequestCard";

import { usePayouts } from "../../hooks/payouts/usePayouts";
import useToast from "../../hooks/toast/useToast";

/*
 * Read-mostly payout history for one partner, embedded in their expanded
 * OperatorCard. Almost every payout now arrives auto-SCHEDULED/PAID (see
 * `scheduleOperatorPayout`/`releaseScheduledPayouts`), so approve/reject/
 * mark-paid rarely apply — they're kept here as the manual fallback for the
 * rare case an automatic step fails and admin needs to step in directly.
 */
const OperatorPayoutRecords = ({ operatorId }) => {
    const {
        payoutRequests,
        loading,
        loadPayoutRequests,
        approvePayout,
        rejectPayout,
        markPayoutAsPaid,
        cancelPayout,
    } = usePayouts();

    const toast = useToast();

    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancelReason, setCancelReason] = useState("");
    const [actionLoading, setActionLoading] = useState({});

    useEffect(() => {
        if (!operatorId) {
            return;
        }

        loadPayoutRequests({ operatorId }).catch((error) => {
            toast.error(
                error?.message ||
                    "Unable to load payout records."
            );
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [operatorId]);

    const setLoading = (id, value) =>
        setActionLoading((prev) => ({
            ...prev,
            [id]: value,
        }));

    const refresh = () => {
        loadPayoutRequests({ operatorId }).catch(() => {});
    };

    const handleApprove = async (payout) => {
        setLoading(payout._id, true);

        try {
            await approvePayout(payout._id);
            refresh();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to approve payout."
            );
        } finally {
            setLoading(payout._id, false);
        }
    };

    const handleMarkPaid = async (payout) => {
        setLoading(payout._id, true);

        try {
            await markPayoutAsPaid({ id: payout._id });
            refresh();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to credit wallet."
            );
        } finally {
            setLoading(payout._id, false);
        }
    };

    const openReject = (payout) => {
        setRejectTarget(payout);
        setRejectReason("");
    };

    const openCancel = (payout) => {
        setCancelTarget(payout);
        setCancelReason("");
    };

    const confirmCancel = async () => {
        if (!cancelReason.trim() || !cancelTarget) {
            return;
        }

        setLoading(cancelTarget._id, true);

        try {
            await cancelPayout(
                cancelTarget._id,
                cancelReason.trim()
            );
            refresh();
            setCancelTarget(null);
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to cancel payout."
            );
        } finally {
            setLoading(cancelTarget._id, false);
        }
    };

    const confirmReject = async () => {
        if (!rejectReason.trim() || !rejectTarget) {
            return;
        }

        setLoading(rejectTarget._id, true);

        try {
            await rejectPayout({
                id: rejectTarget._id,
                reason: rejectReason.trim(),
            });
            refresh();
            setRejectTarget(null);
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to reject payout."
            );
        } finally {
            setLoading(rejectTarget._id, false);
        }
    };

    return (
        <section
            className="
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-sm
                p-6
                dark:border-gray-800
                dark:bg-gray-900
            "
        >
            <div className="flex items-center gap-2 border-b border-gray-100 pb-4 dark:border-gray-800">
                <BadgeDollarSign
                    size={16}
                    className="text-emerald-500"
                />

                <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">
                    Payout Records
                </h4>
            </div>

            <div className="mt-4 space-y-3">
                {loading && payoutRequests.length === 0 ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                ) : payoutRequests.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No payout records yet for this partner.
                    </p>
                ) : (
                    payoutRequests.map((payout) => (
                        <PayoutRequestCard
                            key={payout._id}
                            payout={payout}
                            isAdmin
                            onApprove={handleApprove}
                            onReject={openReject}
                            onMarkPaid={handleMarkPaid}
                            onCancel={openCancel}
                        />
                    ))
                )}
            </div>

            <Modal
                isOpen={Boolean(rejectTarget)}
                onClose={() => setRejectTarget(null)}
                title="Reject Payout Request"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setRejectTarget(null)
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="danger"
                            onClick={confirmReject}
                            loading={
                                actionLoading[
                                    rejectTarget?._id
                                ]
                            }
                            disabled={!rejectReason.trim()}
                        >
                            Reject Payout
                        </Button>
                    </>
                }
            >
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    Please provide a reason for rejecting
                    this payout request. This will be shown
                    to the partner.
                </p>

                <Textarea
                    label="Reason"
                    required
                    rows={4}
                    value={rejectReason}
                    onChange={(event) =>
                        setRejectReason(event.target.value)
                    }
                    placeholder="Enter rejection reason..."
                />
            </Modal>

            <Modal
                isOpen={Boolean(cancelTarget)}
                onClose={() => setCancelTarget(null)}
                title="Cancel Scheduled Payout"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() =>
                                setCancelTarget(null)
                            }
                        >
                            Back
                        </Button>

                        <Button
                            variant="danger"
                            onClick={confirmCancel}
                            loading={
                                actionLoading[
                                    cancelTarget?._id
                                ]
                            }
                            disabled={!cancelReason.trim()}
                        >
                            Cancel Payout
                        </Button>
                    </>
                }
            >
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    This payout hasn't reached the
                    partner's wallet yet, so cancelling it
                    is safe — nothing needs to be reversed.
                    Explain why (e.g. a refund or dispute on
                    the booking) — this will be shown to the
                    partner.
                </p>

                <Textarea
                    label="Reason"
                    required
                    rows={4}
                    value={cancelReason}
                    onChange={(event) =>
                        setCancelReason(event.target.value)
                    }
                    placeholder="Enter cancellation reason..."
                />
            </Modal>
        </section>
    );
};

export default OperatorPayoutRecords;
