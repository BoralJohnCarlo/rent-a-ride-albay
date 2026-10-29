import {
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
} from "lucide-react";

const Pagination = ({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    siblingCount = 1,
    className = "",
}) => {
    if (totalPages <= 1) {
        return null;
    }

    const createPages = () => {
        const pages = [];

        const totalNumbers =
            siblingCount * 2 + 5;

        if (totalPages <= totalNumbers) {
            for (
                let i = 1;
                i <= totalPages;
                i++
            ) {
                pages.push(i);
            }

            return pages;
        }

        const leftSibling = Math.max(
            currentPage - siblingCount,
            1
        );

        const rightSibling = Math.min(
            currentPage + siblingCount,
            totalPages
        );

        const showLeftDots =
            leftSibling > 2;

        const showRightDots =
            rightSibling <
            totalPages - 1;

        pages.push(1);

        if (showLeftDots) {
            pages.push("left-dots");
        }

        for (
            let i = leftSibling;
            i <= rightSibling;
            i++
        ) {
            if (
                i !== 1 &&
                i !== totalPages
            ) {
                pages.push(i);
            }
        }

        if (showRightDots) {
            pages.push("right-dots");
        }

        if (totalPages > 1) {
            pages.push(totalPages);
        }

        return [...new Set(pages)];
    };

    return (
        <nav
            className={`flex items-center justify-center gap-2 ${className}`}
            aria-label="Pagination"
        >
            <button
                type="button"
                onClick={() =>
                    onPageChange(
                        currentPage - 1
                    )
                }
                disabled={currentPage === 1}
                className="
                    rounded-lg
                    border
                    border-gray-300
                    p-2
                    text-gray-700
                    transition
                    hover:bg-gray-100
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    dark:border-gray-700
                    dark:text-gray-300
                    dark:hover:bg-gray-800
                "
            >
                <ChevronLeft size={18} />
            </button>

            {createPages().map((page) =>
                typeof page === "number" ? (
                    <button
                        key={page}
                        type="button"
                        onClick={() =>
                            onPageChange(page)
                        }
                        className={`
                            h-10
                            w-10
                            rounded-lg
                            border
                            text-sm
                            font-medium
                            transition
                            ${
                                currentPage ===
                                page
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            }
                        `}
                    >
                        {page}
                    </button>
                ) : (
                    <span
                        key={page}
                        className="
                            px-2
                            text-gray-500
                            dark:text-gray-400
                        "
                    >
                        <MoreHorizontal
                            size={18}
                        />
                    </span>
                )
            )}

            <button
                type="button"
                onClick={() =>
                    onPageChange(
                        currentPage + 1
                    )
                }
                disabled={
                    currentPage === totalPages
                }
                className="
                    rounded-lg
                    border
                    border-gray-300
                    p-2
                    text-gray-700
                    transition
                    hover:bg-gray-100
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    dark:border-gray-700
                    dark:text-gray-300
                    dark:hover:bg-gray-800
                "
            >
                <ChevronRight size={18} />
            </button>
        </nav>
    );
};

export default Pagination;