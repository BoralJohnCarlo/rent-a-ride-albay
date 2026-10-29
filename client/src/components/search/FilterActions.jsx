import Button from "../common/Button";

const FilterActions = ({
    onApply,
    onReset,
    applyLabel = "Apply Filters",
    resetLabel = "Reset",
    loading = false,
    className = "",
}) => {
    return (
        <div
            className={[
                "flex gap-3 border-t border-gray-200 pt-5 dark:border-gray-800",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Button
                variant="outline"
                className="flex-1"
                onClick={onReset}
            >
                {resetLabel}
            </Button>

            <Button
                className="flex-1"
                loading={loading}
                onClick={onApply}
            >
                {applyLabel}
            </Button>
        </div>
    );
};

export default FilterActions;