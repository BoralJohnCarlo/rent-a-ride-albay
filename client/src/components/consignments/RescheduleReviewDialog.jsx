import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Textarea from "../common/Textarea";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";

import formatDate from "../../utils/formatDate";

const RescheduleReviewDialog = ({
    open,
    consignment,
    loading = false,
    onClose,
    onApprove,
    onReject,
}) => {
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (!open) {
            setRemarks("");
        }
    }, [open]);

    const reschedule = consignment?.reschedule ?? {};
    const trimmedRemarks = remarks.trim();

    const handleApprove = async () => {
        if (loading) return;
        await onApprove?.(trimmedRemarks);
    };

    const handleReject = async () => {
        if (loading || !trimmedRemarks) return;
        await onReject?.(trimmedRemarks);
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Review Reschedule Request"
            size="lg"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        variant="danger"
                        loading={loading}
                        disabled={!trimmedRemarks}
                        onClick={handleReject}
                    >
                        Reject
                    </Button>

                    <Button
                        variant="success"
                        loading={loading}
                        onClick={handleApprove}
                    >
                        Approve
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <ConsignmentSummaryCard
                    consignment={consignment}
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                            <CalendarClock size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                                Operator requested a new inspection schedule
                            </h3>

                            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                        Proposed Date
                                    </dt>
                                    <dd className="mt-0.5 text-sm font-medium text-amber-900 dark:text-amber-100">
                                        {formatDate(
                                            reschedule.proposedDate
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                        Proposed Time
                                    </dt>
                                    <dd className="mt-0.5 text-sm font-medium text-amber-900 dark:text-amber-100">
                                        {reschedule.proposedTime ||
                                            "—"}
                                    </dd>
                                </div>

                                <div className="sm:col-span-2">
                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                        Requested
                                    </dt>
                                    <dd className="mt-0.5 text-sm font-medium text-amber-900 dark:text-amber-100">
                                        {formatDate(
                                            reschedule.requestedAt,
                                            {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            }
                                        )}
                                    </dd>
                                </div>

                                <div className="sm:col-span-2">
                                    <dt className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                        Reason
                                    </dt>
                                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-100">
                                        {reschedule.reason ||
                                            "No reason provided."}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>

                <Textarea
                    label="Admin remarks"
                    value={remarks}
                    onChange={(event) =>
                        setRemarks(event.target.value)
                    }
                    rows={3}
                    maxLength={500}
                    disabled={loading}
                    placeholder="Optional when approving. Required when rejecting — explain why the request is declined."
                />
            </div>
        </Modal>
    );
};

export default RescheduleReviewDialog;
