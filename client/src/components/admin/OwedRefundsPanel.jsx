import { useState } from "react";

import Button from "../common/Button";
import Modal from "../common/Modal";
import StatusChip from "../common/StatusChip";
import Textarea from "../common/Textarea";

import useToast from "../../hooks/toast/useToast";

import { settleOwedRefund } from "../../api/refundApi";
import StackedTable from "../tables/StackedTable";

const peso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "—";

const fullName = (person) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
    person?.email ||
    "—";

const cardClass =
    "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const thClass =
    "px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const tdClass =
    "px-5 py-4 text-sm text-gray-700 dark:text-gray-200";

/*
 * Refunds owed by hand: money a customer is owed that no payment could carry
 * (a payment holds one refund, and it was already used — typically by a
 * reschedule to fewer days before the booking was cancelled). Each stays
 * here as "Owed" until an admin pays it outside the app and records it.
 */
const OwedRefundsPanel = ({
    refunds = [],
    loading = false,
    error = "",
    onSettled,
}) => {
    const toast = useToast();

    const [settling, setSettling] = useState(null);

    const close = () => {
        if (!settling?.submitting) {
            setSettling(null);
        }
    };

    const submit = async (succeeded) => {
        setSettling((current) => ({ ...current, submitting: true }));

        try {
            await settleOwedRefund(settling.refund._id, {
                succeeded,
                notes: settling.notes?.trim() || "",
            });

            toast.success(
                succeeded
                    ? "Refund marked as paid. The customer was notified."
                    : "Refund marked as not paid. The customer was notified."
            );

            setSettling(null);
            onSettled?.();
        } catch (settleError) {
            toast.error(
                settleError?.response?.data?.message ||
                    settleError?.message ||
                    "Couldn't record the refund."
            );

            setSettling((current) =>
                current ? { ...current, submitting: false } : current
            );
        }
    };

    return (
        <>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                Refunds that couldn't go back through the customer's
                payment. Pay each one outside the app (for example GCash
                or bank transfer), then record it here — the customer is
                notified either way.
            </p>

            {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    {error}
                </div>
            )}

            <div className={cardClass}>
                <div className="overflow-x-auto">
                    <StackedTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                        <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                                <th className={thClass}>Booking</th>
                                <th className={thClass}>Customer</th>
                                <th className={`${thClass} text-right`}>
                                    Amount
                                </th>
                                <th className={thClass}>Why</th>
                                <th className={`${thClass} text-center`}>
                                    Status
                                </th>
                                <th className={thClass}>Raised</th>
                                <th className={`${thClass} text-right`}>
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                            {loading && refunds.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        Loading owed refunds…
                                    </td>
                                </tr>
                            )}

                            {!loading && refunds.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"
                                    >
                                        No owed refunds found.
                                    </td>
                                </tr>
                            )}

                            {refunds.map((refund) => {
                                const vehicle = refund.booking?.vehicle;

                                return (
                                    <tr
                                        key={refund._id}
                                        className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td
                                            className={`${tdClass} whitespace-nowrap`}
                                        >
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {refund.booking
                                                    ?.bookingCode || "—"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {[
                                                    vehicle?.brand,
                                                    vehicle?.model,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ") || "—"}
                                                {refund.booking?.startDate
                                                    ? ` · ${formatDate(
                                                          refund.booking
                                                              .startDate
                                                      )}`
                                                    : ""}
                                            </p>
                                        </td>
                                        <td
                                            className={`${tdClass} whitespace-nowrap`}
                                        >
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {fullName(refund.customer)}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {refund.customer
                                                    ?.phoneNumber ||
                                                    refund.customer?.email ||
                                                    ""}
                                            </p>
                                        </td>
                                        <td
                                            className={`${tdClass} whitespace-nowrap text-right font-bold text-gray-900 dark:text-white`}
                                        >
                                            {peso(refund.amount)}
                                        </td>
                                        <td
                                            className={`${tdClass} min-w-64 max-w-md text-xs text-gray-600 dark:text-gray-300`}
                                        >
                                            {refund.reason}
                                            {refund.settlementNote && (
                                                <p className="mt-1 text-gray-500 dark:text-gray-400">
                                                    Note:{" "}
                                                    {refund.settlementNote}
                                                </p>
                                            )}
                                        </td>
                                        <td
                                            className={`${tdClass} whitespace-nowrap text-center`}
                                        >
                                            <StatusChip
                                                status={refund.status}
                                                size="sm"
                                            />
                                        </td>
                                        <td
                                            className={`${tdClass} whitespace-nowrap`}
                                        >
                                            {formatDate(refund.createdAt)}
                                            {refund.settledAt && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Settled{" "}
                                                    {formatDate(
                                                        refund.settledAt
                                                    )}
                                                </p>
                                            )}
                                        </td>
                                        <td
                                            className={`${tdClass} whitespace-nowrap text-right`}
                                        >
                                            {refund.status === "Owed" ? (
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        setSettling({
                                                            refund,
                                                            notes: "",
                                                        })
                                                    }
                                                >
                                                    Record outcome
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {refund.settledBy
                                                        ? `by ${fullName(
                                                              refund.settledBy
                                                          )}`
                                                        : "—"}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </StackedTable>
                </div>
            </div>

            <Modal
                isOpen={Boolean(settling)}
                onClose={close}
                title="Record owed refund"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={close}
                            disabled={settling?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={settling?.submitting}
                            onClick={() => submit(false)}
                        >
                            Not paid
                        </Button>
                        <Button
                            variant="success"
                            loading={settling?.submitting}
                            onClick={() => submit(true)}
                        >
                            Mark as paid
                        </Button>
                    </>
                }
            >
                {settling && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Pay{" "}
                            <strong>{fullName(settling.refund.customer)}</strong>{" "}
                            {peso(settling.refund.amount)} outside the app
                            first, then mark it as paid. Choose "Not paid"
                            only if it can't be done — the customer is
                            asked to contact support.
                        </p>
                        <Textarea
                            label="Notes"
                            rows={3}
                            value={settling.notes ?? ""}
                            onChange={(event) =>
                                setSettling((current) =>
                                    current
                                        ? {
                                              ...current,
                                              notes: event.target.value,
                                          }
                                        : current
                                )
                            }
                            placeholder="Optional — e.g. GCash reference number..."
                        />
                    </div>
                )}
            </Modal>
        </>
    );
};

export default OwedRefundsPanel;
