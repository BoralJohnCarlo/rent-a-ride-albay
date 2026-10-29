import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import BookingTable from "../tables/BookingTable";

const RecentBookings = ({
    bookings = [],
    loading = false,
    limit = 5,
    onViewAll,
}) => {
    const recentBookings = bookings.slice(0, limit);

    return (
        <section
            className="
                rounded-xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-sm
                dark:border-gray-800
                dark:bg-gray-900
            "
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Recent Bookings
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Latest vehicle bookings in the system.
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

            {recentBookings.length === 0 && !loading ? (
                <EmptyState
                    title="No recent bookings"
                    description="New bookings will appear here."
                />
            ) : (
                <BookingTable
                    bookings={recentBookings}
                    loading={loading}
                />
            )}
        </section>
    );
};

export default RecentBookings;