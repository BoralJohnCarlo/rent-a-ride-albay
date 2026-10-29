import LoadingSpinner from "../common/LoadingSpinner";
import ListEmptyState from "./ListEmptyState";

const DataList = ({
    data = [],
    loading = false,
    emptyTitle = "No data found.",
    emptyDescription = "",
    renderItem,
    className = "",
}) => {
    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <LoadingSpinner />
            </div>
        );
    }

    if (!data.length) {
        return (
            <ListEmptyState
                title={emptyTitle}
                description={emptyDescription}
            />
        );
    }

    return (
        <div
            className={[
                "space-y-4",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {data.map((item, index) => (
                <div
                    key={item._id ?? index}
                >
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
    );
};

export default DataList;