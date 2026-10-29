import { Filter } from "lucide-react";

import Button from "../common/Button";
import SearchBar from "../common/SearchBar";

const TableToolbar = ({
    search = "",
    onSearch,
    searchPlaceholder = "Search...",

    filters = null,
    view = null,

    secondaryActions = null,
    actions = null,

    addLabel,
    onAdd,

    showFilter = false,
    onFilter,
    filterLabel = "Filters",

    className = "",
}) => {
    const filterContent =
        filters ??
        (showFilter && (
            <Button
                variant="outline"
                onClick={onFilter}
            >
                <span className="flex items-center gap-2">
                    <Filter size={18} />
                    {filterLabel}
                </span>
            </Button>
        ));

    const actionContent =
        actions ??
        (addLabel && (
            <Button onClick={onAdd}>
                {addLabel}
            </Button>
        ));

    return (
        <div
            className={[
                "mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="min-w-0 flex-1 lg:max-w-xl">
                <SearchBar
                    value={search}
                    onChange={(event) =>
                        onSearch?.(
                            event.target.value
                        )
                    }
                    placeholder={
                        searchPlaceholder
                    }
                />
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                {filterContent}

                {view}

                {secondaryActions}

                {actionContent}
            </div>
        </div>
    );
};

export default TableToolbar;