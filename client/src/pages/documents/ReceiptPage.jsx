import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getReceipt } from "../../api/receiptApi";
import ErrorState from "../../components/common/ErrorState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import DocumentShell, {
    DetailList,
    DocumentSection,
} from "../../components/documents/DocumentShell";
import { formatDocDate, formatPeso } from "../../utils/documentFormat";

/*
 * A printable acknowledgement receipt: payment received (AR-…) or refund
 * sent (RF-…). Admins and the paying customer only (checked by the server).
 */
const ReceiptPage = () => {
    const { receiptId } = useParams();

    const [receipt, setReceipt] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        getReceipt(receiptId)
            .then((response) => {
                if (!cancelled) {
                    setReceipt(response.data);
                }
            })
            .catch((requestError) => {
                if (!cancelled) {
                    setError(
                        requestError.response?.data?.message ||
                            "We couldn't load this receipt."
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [receiptId]);

    if (error) {
        return (
            <div className="min-h-screen bg-[#F7F5F1] dark:bg-gray-950">
                <ErrorState title="Receipt unavailable" message={error} />
            </div>
        );
    }

    if (!receipt) {
        return <LoadingSpinner message="Loading receipt..." />;
    }

    const isRefund = receipt.kind === "refund";
    const snapshot = receipt.snapshot || {};

    return (
        <DocumentShell
            title={`${isRefund ? "Refund" : "Receipt"} ${receipt.receiptNumber}`}
            documentLabel={
                isRefund ? "Refund acknowledgement" : "Acknowledgement receipt"
            }
            number={receipt.receiptNumber}
            meta={`Issued ${formatDocDate(receipt.createdAt)}`}
        >
            <DocumentSection title={isRefund ? "Refunded to" : "Received from"}>
                <DetailList
                    rows={[
                        ["Name", snapshot.customerName],
                        ["Email", snapshot.customerEmail],
                        ["Phone", snapshot.customerPhone],
                    ]}
                />
            </DocumentSection>

            <DocumentSection title="Rental">
                <DetailList
                    rows={[
                        [
                            "Vehicle",
                            snapshot.plateNumber
                                ? `${snapshot.vehicleName} (${snapshot.plateNumber})`
                                : snapshot.vehicleName,
                        ],
                        [
                            "Rental period",
                            snapshot.startDate
                                ? `${formatDocDate(snapshot.startDate)} – ${formatDocDate(snapshot.endDate)}`
                                : null,
                        ],
                    ]}
                />
            </DocumentSection>

            <DocumentSection title="Transaction">
                <div className="overflow-hidden rounded-xl border border-[#14161B]/10">
                    <table className="w-full text-sm">
                        <thead className="bg-[#F7F5F1] text-left text-xs text-[#14161B]/55 uppercase print:bg-transparent">
                            <tr>
                                <th className="px-4 py-2 font-semibold">Description</th>
                                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-[#14161B]/10">
                                <td className="px-4 py-3">{receipt.description}</td>
                                <td className="px-4 py-3 text-right font-medium tabular-nums">
                                    {formatPeso(receipt.amount)}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-[#14161B]/20">
                                <td className="px-4 py-3 font-semibold">
                                    {isRefund ? "Total refunded" : "Total received"}
                                </td>
                                <td className="px-4 py-3 text-right text-lg font-bold tabular-nums">
                                    {formatPeso(receipt.amount)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-4">
                    <DetailList
                        rows={[
                            [isRefund ? "Refunded on" : "Paid on", formatDocDate(receipt.transactionDate)],
                            ["Method", receipt.method],
                            [
                                "Transaction ID",
                                receipt.reference ? (
                                    <span className="font-mono">
                                        {receipt.reference}
                                    </span>
                                ) : (
                                    <span className="font-normal text-[#14161B]/60">
                                        {receipt.transactionIdText || "Not recorded"}
                                    </span>
                                ),
                            ],
                            [
                                receipt.providerReferenceLabel,
                                receipt.providerReference ? (
                                    <span className="font-mono">
                                        {receipt.providerReference}
                                    </span>
                                ) : null,
                            ],
                        ]}
                    />
                </div>
            </DocumentSection>

            <p className="mt-8 text-sm print:hidden">
                <Link
                    to={`/documents/statements/${receipt.booking}`}
                    className="font-semibold text-[#2F6F68] underline underline-offset-2"
                >
                    View the full booking statement
                </Link>
            </p>
        </DocumentShell>
    );
};

export default ReceiptPage;
