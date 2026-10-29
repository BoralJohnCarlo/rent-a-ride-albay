import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getBookingStatement } from "../../api/receiptApi";
import ErrorState from "../../components/common/ErrorState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import DocumentShell, {
    DetailList,
    DocumentSection,
} from "../../components/documents/DocumentShell";
import { formatDocDate, formatPeso } from "../../utils/documentFormat";

/*
 * Everything money-related on one booking: charges, every payment and refund
 * (each linking to its receipt), refunds still on their way, and the balance.
 * Printable. Admins and the booking's own customer only (checked by the
 * server). No booking code — customers know trips by vehicle and dates.
 */

const cellClass = "px-4 py-2.5";

const MoneyTable = ({ rows, emptyText, showReceipt = false }) => {
    if (!rows.length) {
        return <p className="text-sm text-[#14161B]/55">{emptyText}</p>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-[#14161B]/10">
            <table className="w-full min-w-md text-sm">
                <tbody>
                    {rows.map((row, index) => (
                        <tr
                            key={row.id || `${row.label}-${index}`}
                            className={index ? "border-t border-[#14161B]/10" : ""}
                        >
                            {showReceipt && (
                                <td className={`${cellClass} whitespace-nowrap text-[#14161B]/55`}>
                                    {formatDocDate(row.date, { withTime: false })}
                                </td>
                            )}
                            <td className={cellClass}>
                                <span className="font-medium">
                                    {row.label || row.description}
                                </span>
                                {(row.note || row.method) && (
                                    <span className="block text-xs text-[#14161B]/55">
                                        {row.note || row.method}
                                    </span>
                                )}
                                {showReceipt && (
                                    <span className="block text-xs wrap-anywhere text-[#14161B]/55">
                                        Transaction ID:{" "}
                                        <span
                                            className={
                                                row.transactionId
                                                    ? "font-mono text-[#14161B]/80"
                                                    : ""
                                            }
                                        >
                                            {row.transactionIdText}
                                        </span>
                                        {row.providerReference && (
                                            <>
                                                {" · "}
                                                {row.providerReferenceLabel}{" "}
                                                <span className="font-mono text-[#14161B]/80">
                                                    {row.providerReference}
                                                </span>
                                            </>
                                        )}
                                    </span>
                                )}
                            </td>
                            {showReceipt && (
                                <td className={`${cellClass} whitespace-nowrap font-mono text-xs`}>
                                    {row.id ? (
                                        <Link
                                            to={`/documents/receipts/${row.id}`}
                                            className="text-[#2F6F68] underline underline-offset-2 print:text-[#14161B] print:no-underline"
                                        >
                                            {row.receiptNumber}
                                        </Link>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                            )}
                            <td className={`${cellClass} text-right font-medium whitespace-nowrap tabular-nums`}>
                                {formatPeso(row.amount)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const SummaryRow = ({ label, value, strong = false }) => (
    <div
        className={`flex items-baseline justify-between gap-4 py-1.5 ${
            strong
                ? "mt-1 border-t border-[#14161B]/15 pt-3 text-base font-bold"
                : "text-sm"
        }`}
    >
        <span className={strong ? "" : "text-[#14161B]/65"}>{label}</span>
        <span className="tabular-nums">{value}</span>
    </div>
);

const BookingStatementPage = () => {
    const { bookingId } = useParams();

    const [statement, setStatement] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        getBookingStatement(bookingId)
            .then((response) => {
                if (!cancelled) {
                    setStatement(response.data);
                }
            })
            .catch((requestError) => {
                if (!cancelled) {
                    setError(
                        requestError.response?.data?.message ||
                            "We couldn't load this statement."
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [bookingId]);

    if (error) {
        return (
            <div className="min-h-screen bg-[#F7F5F1] dark:bg-gray-950">
                <ErrorState title="Statement unavailable" message={error} />
            </div>
        );
    }

    if (!statement) {
        return <LoadingSpinner message="Loading statement..." />;
    }

    const { booking, customer, vehicle, totals } = statement;

    return (
        <DocumentShell
            title={`Statement — ${vehicle.name}`}
            documentLabel="Booking statement"
            meta={`As of ${formatDocDate(statement.generatedAt)}`}
        >
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <DocumentSection title="Customer">
                    <DetailList
                        rows={[
                            ["Name", customer.name],
                            ["Email", customer.email],
                            ["Phone", customer.phone],
                        ]}
                    />
                </DocumentSection>

                <DocumentSection title="Booking">
                    <DetailList
                        rows={[
                            [
                                "Vehicle",
                                vehicle.plateNumber
                                    ? `${vehicle.name} (${vehicle.plateNumber})`
                                    : vehicle.name,
                            ],
                            ["Status", booking.status],
                            ["Pickup", formatDocDate(booking.startDate)],
                            [
                                booking.returnedAt ? "Returned" : "Return",
                                formatDocDate(booking.returnedAt || booking.endDate),
                            ],
                            ["Pickup location", booking.pickupLocation],
                            ["Driver", booking.driverOption],
                        ]}
                    />
                </DocumentSection>
            </div>

            <DocumentSection title="Charges">
                {statement.endedWithoutTrip ? (
                    <p className="rounded-xl bg-[#F7F5F1] px-4 py-3 text-sm text-[#14161B]/75 print:border print:border-[#14161B]/15 print:bg-transparent">
                        This booking ended before pickup ({booking.status.toLowerCase()}),
                        so no rental charges apply. Any fee kept under the
                        cancellation policy is shown in the summary below.
                    </p>
                ) : (
                    <MoneyTable
                        rows={statement.charges}
                        emptyText="No charges."
                    />
                )}
            </DocumentSection>

            <DocumentSection title="Payments received">
                <MoneyTable
                    rows={statement.payments}
                    emptyText="No payments received yet."
                    showReceipt
                />
            </DocumentSection>

            {(statement.refunds.length > 0 ||
                statement.pendingRefunds.length > 0) && (
                <DocumentSection title="Refunds">
                    <MoneyTable
                        rows={statement.refunds}
                        emptyText="No refunds sent yet."
                        showReceipt
                    />

                    {statement.pendingRefunds.length > 0 && (
                        <p className="mt-3 text-sm text-[#14161B]/65">
                            {formatPeso(totals.pendingRefunds)} more is being
                            refunded and will get its own acknowledgement once
                            it's sent.
                        </p>
                    )}
                </DocumentSection>
            )}

            <section className="mt-8 ml-auto max-w-sm break-inside-avoid">
                {!statement.endedWithoutTrip && (
                    <SummaryRow
                        label="Total charges"
                        value={formatPeso(totals.charges)}
                    />
                )}
                <SummaryRow
                    label="Payments received"
                    value={formatPeso(totals.paid)}
                />
                {totals.refunded > 0 && (
                    <SummaryRow
                        label="Refunded"
                        value={formatPeso(-totals.refunded)}
                    />
                )}
                {totals.pendingRefunds > 0 && (
                    <SummaryRow
                        label="Refund on its way"
                        value={formatPeso(-totals.pendingRefunds)}
                    />
                )}
                {statement.endedWithoutTrip ? (
                    <SummaryRow
                        label="Kept under the cancellation policy"
                        value={formatPeso(totals.retained)}
                        strong
                    />
                ) : (
                    <SummaryRow
                        label="Balance due"
                        value={formatPeso(totals.balanceDue)}
                        strong
                    />
                )}
            </section>
        </DocumentShell>
    );
};

export default BookingStatementPage;
