import Button from "../common/Button";
import EmptyState from "../common/EmptyState";

import TransactionTable from "../tables/TransactionTable";

const RecentPayments = ({
    transactions = [],
    loading = false,
    limit = 5,
    onViewAll,
}) => {
    const recentTransactions =
        transactions.slice(0, limit);

    return (
        <section
            className="
                rounded-xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-sm
            "
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Recent Payments
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Latest payment transactions.
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onViewAll}
                >
                    View All
                </Button>
            </div>

            {recentTransactions.length === 0 &&
            !loading ? (
                <EmptyState
                    title="No recent payments"
                    description="Payment transactions will appear here."
                />
            ) : (
                <TransactionTable
                    transactions={recentTransactions}
                    loading={loading}
                    compact
                    showBooking={false}
                    showMethod={false}
                    showType={false}
                    showActions={false}
                />
            )}
        </section>
    );
};

export default RecentPayments;