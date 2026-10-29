import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Textarea from "../common/Textarea";
import LoadingSpinner from "../common/LoadingSpinner";
import PageHeader from "../common/PageHeader";

import useVehicleAvailabilityRequests from "../../hooks/vehicleAvailabilityRequests/useVehicleAvailabilityRequests";
import useToast from "../../hooks/toast/useToast";

const formatRange = (range) => {
    const start = new Date(range.startDate);

    // The stored end date is exclusive (the day after the last blocked
    // day) — shift back one day so the display shows the actual last day
    // requested instead of the day after it.
    const end = new Date(range.endDate);
    end.setDate(end.getDate() - 1);

    const options = {
        month: "short",
        day: "numeric",
        year: "numeric",
    };

    const startLabel = start.toLocaleDateString(
        "en-PH",
        options
    );

    const endLabel = end.toLocaleDateString(
        "en-PH",
        options
    );

    return startLabel === endLabel
        ? startLabel
        : `${startLabel} – ${endLabel}`;
};

const formatReason = (request) => {
    if (request.reason === "Others") {
        return request.reasonDetails || "Others";
    }

    return request.reasonDetails
        ? `${request.reason} — ${request.reasonDetails}`
        : request.reason;
};

/*
 * Partners requesting to withdraw one of their vehicles from booking on
 * specific dates — a request only, nothing is blocked until an admin
 * approves it here. Mirrors PendingVehiclesPanel.jsx's structure for the
 * sibling PendingVehicle workflow.
 */
const VehicleAvailabilityRequestsPanel = () => {
    const toast = useToast();

    const {
        requests,
        loading,
        loadAllRequests,
        approveRequest,
        rejectRequest,
    } = useVehicleAvailabilityRequests();

    const [actionTarget, setActionTarget] =
        useState(null);

    const [rejectReason, setRejectReason] =
        useState("");

    const [actionLoading, setActionLoading] =
        useState(false);

    const reload = () => {
        loadAllRequests({ status: "Pending" }).catch(
            () => {}
        );
    };

    useEffect(() => {
        reload();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pendingRequests = requests.filter(
        (request) => request.status === "Pending"
    );

    const openApprove = (request) =>
        setActionTarget({ request, mode: "approve" });

    const openReject = (request) => {
        setActionTarget({ request, mode: "reject" });
        setRejectReason("");
    };

    const close = () => {
        setActionTarget(null);
        setRejectReason("");
    };

    const confirmApprove = async () => {
        setActionLoading(true);

        try {
            await approveRequest(
                actionTarget.request._id
            );

            toast.success(
                "Request approved. The vehicle is now blocked for those dates."
            );

            close();
            reload();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to approve the request."
            );
        } finally {
            setActionLoading(false);
        }
    };

    const confirmReject = async () => {
        if (!rejectReason.trim()) {
            return;
        }

        setActionLoading(true);

        try {
            await rejectRequest(
                actionTarget.request._id,
                rejectReason.trim()
            );

            toast.success("Request rejected.");

            close();
            reload();
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to reject the request."
            );
        } finally {
            setActionLoading(false);
        }
    };

    if (!loading && pendingRequests.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <PageHeader
                title="Unavailability Requests"
                subtitle="Partners requesting to withdraw a vehicle from booking on specific dates."
            />

            {loading && pendingRequests.length === 0 ? (
                <LoadingSpinner fullScreen={false} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {pendingRequests.map((request) => (
                        <div
                            key={request._id}
                            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                        {
                                            request.vehicle
                                                ?.brand
                                        }{" "}
                                        {
                                            request.vehicle
                                                ?.model
                                        }
                                    </p>

                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {
                                            request.vehicle
                                                ?.plateNumber
                                        }
                                    </p>
                                </div>

                                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                    Pending
                                </span>
                            </div>

                            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Requested By
                            </p>

                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                {[
                                    request.operator
                                        ?.firstName,
                                    request.operator
                                        ?.lastName,
                                ]
                                    .filter(Boolean)
                                    .join(" ") ||
                                    "Unknown"}
                            </p>

                            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Dates
                            </p>

                            <div className="flex flex-wrap gap-1.5">
                                {request.dateRanges?.map(
                                    (range, index) => (
                                        <span
                                            key={index}
                                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                        >
                                            {formatRange(
                                                range
                                            )}
                                        </span>
                                    )
                                )}
                            </div>

                            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Reason
                            </p>

                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                {formatReason(request)}
                            </p>

                            <div className="mt-4 flex gap-2">
                                <Button
                                    size="sm"
                                    variant="success"
                                    leftIcon={
                                        <Check
                                            size={14}
                                        />
                                    }
                                    onClick={() =>
                                        openApprove(
                                            request
                                        )
                                    }
                                >
                                    Approve
                                </Button>

                                <Button
                                    size="sm"
                                    variant="danger"
                                    leftIcon={
                                        <X size={14} />
                                    }
                                    onClick={() =>
                                        openReject(
                                            request
                                        )
                                    }
                                >
                                    Reject
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={
                    actionTarget?.mode === "approve"
                }
                onClose={close}
                title="Approve Unavailability Request"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={close}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="success"
                            loading={actionLoading}
                            onClick={confirmApprove}
                        >
                            Approve
                        </Button>
                    </>
                }
            >
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    This vehicle will become unbookable
                    for the requested dates immediately.
                </p>
            </Modal>

            <Modal
                isOpen={actionTarget?.mode === "reject"}
                onClose={close}
                title="Reject Unavailability Request"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={close}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>

                        <Button
                            variant="danger"
                            loading={actionLoading}
                            disabled={
                                !rejectReason.trim()
                            }
                            onClick={confirmReject}
                        >
                            Reject
                        </Button>
                    </>
                }
            >
                <Textarea
                    label="Reason for rejection"
                    required
                    rows={4}
                    value={rejectReason}
                    onChange={(event) =>
                        setRejectReason(
                            event.target.value
                        )
                    }
                    placeholder="Explain why this request is being rejected. The partner will see this."
                />
            </Modal>
        </div>
    );
};

export default VehicleAvailabilityRequestsPanel;
