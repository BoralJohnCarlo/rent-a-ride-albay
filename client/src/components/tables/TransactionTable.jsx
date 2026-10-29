import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import DataTable from "./DataTable";
import TableActions from "./TableActions";

const TransactionTable = ({
    transactions = [],
    loading = false,

    compact = false,

    showBooking = true,
    showCustomer = true,
    showOperator = false,
    showMethod = true,
    showType = true,
    showActions = true,

    onView,
    onRefund,
    onRelease,
}) => {
    const columns = [];

    if (!compact) {
        columns.push({
            key: "reference",
            header: "Reference",
            render: (transaction) =>
                transaction.reference ||
                transaction.transactionId ||
                "—",
        });
    }

    if (showBooking && !compact) {
        columns.push({
            key: "booking",
            header: "Booking",
            render: (transaction) =>
                transaction.booking?.bookingNumber ||
                "—",
        });
    }

    if (showCustomer) {
        columns.push({
            key: "customer",
            header: "Customer",
            render: (transaction) => {
                const customer = transaction.customer;

                if (!customer) {
                    return "—";
                }

                return (
                    customer.fullName ||
                    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()
                );
            },
        });
    }

    if (showOperator && !compact) {
        columns.push({
            key: "operator",
            header: "Partner",
            render: (transaction) => {
                const operator = transaction.operator;

                if (!operator) {
                    return "—";
                }

                return (
                    operator.businessName ||
                    operator.name ||
                    "—"
                );
            },
        });
    }

    if (showType && !compact) {
        columns.push({
            key: "type",
            header: "Type",
            align: "center",
            render: (transaction) => (
                <Badge
                    variant="secondary"
                    size="sm"
                >
                    {transaction.type || "N/A"}
                </Badge>
            ),
        });
    }

    if (showMethod && !compact) {
        columns.push({
            key: "method",
            header: "Method",
            align: "center",
            render: (transaction) => (
                <Badge
                    variant="info"
                    size="sm"
                >
                    {transaction.paymentMethod ||
                        "N/A"}
                </Badge>
            ),
        });
    }

    columns.push(
        {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (transaction) => (
                <Price
                    value={transaction.amount}
                    className="font-medium"
                />
            ),
        },

        {
            key: "status",
            header: "Status",
            align: "center",
            render: (transaction) => (
                <StatusChip
                    status={transaction.status}
                />
            ),
        },

        {
            key: "date",
            header: "Date",
            render: (transaction) =>
                transaction.createdAt
                    ? new Date(
                          transaction.createdAt
                      ).toLocaleDateString()
                    : "—",
        }
    );

    if (showActions) {
        columns.push({
            key: "actions",
            header: "Actions",
            align: "right",
            cellClassName: "min-w-[220px]",
            render: (transaction) => {
                const actions = [
                    {
                        label: "View",
                        variant: "outline",
                        onClick: () =>
                            onView?.(transaction),
                    },
                ];

                if (onRefund) {
                    actions.push({
                        label: "Refund",
                        variant: "warning",
                        disabled:
                            transaction.status?.toLowerCase() !==
                            "paid",
                        onClick: () =>
                            onRefund(transaction),
                    });
                }

                if (onRelease) {
                    actions.push({
                        label: "Release",
                        variant: "success",
                        disabled:
                            transaction.status?.toLowerCase() !==
                            "held",
                        onClick: () =>
                            onRelease(transaction),
                    });
                }

                return (
                    <TableActions
                        actions={actions}
                    />
                );
            },
        });
    }

    return (
        <DataTable
            columns={columns}
            data={transactions}
            loading={loading}
            compact={compact}
            caption="Transaction management table"
            emptyMessage="No transactions found."
        />
    );
};

export default TransactionTable;