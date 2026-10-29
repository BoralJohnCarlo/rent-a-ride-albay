import { TrendingUp } from "lucide-react";

import Price from "../common/Price";

const RevenueWidget = ({
    revenue = 0,
    growth = 0,
    period = "This Month",
    loading = false,
    className = "",
}) => {
    if (loading) {
        return (
            <div
                className={`
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-5
                    shadow-sm
                    ${className}
                `}
            >
                <div className="h-6 w-40 rounded bg-gray-200" />

                <div className="mt-2 h-4 w-56 rounded bg-gray-100" />

                <div className="mt-8 h-12 w-48 rounded bg-gray-300" />

                <div className="mt-6 h-52 rounded bg-gray-100" />
            </div>
        );
    }

    return (
        <section
            className={`
                rounded-xl
                border
                border-gray-200
                bg-white
                p-6
                shadow-sm
                ${className}
            `}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Revenue
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Revenue summary for {period.toLowerCase()}.
                    </p>
                </div>

                <div
                    className={`
                        flex
                        items-center
                        gap-2
                        rounded-full
                        px-3
                        py-1
                        text-sm
                        font-medium
                        ${
                            growth >= 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                        }
                    `}
                >
                    <TrendingUp size={16} />

                    <span>
                        {growth >= 0 ? "+" : ""}
                        {growth}%
                    </span>
                </div>
            </div>

            <div className="mt-6">
                <Price
                    amount={revenue}
                    className="text-4xl font-bold text-gray-900"
                />

                <p className="mt-2 text-sm text-gray-500">
                    Total revenue generated for {period.toLowerCase()}.
                </p>
            </div>

            <div
                className="
                    mt-8
                    flex
                    h-64
                    items-center
                    justify-center
                    rounded-xl
                    border-2
                    border-dashed
                    border-gray-200
                    bg-gray-50
                "
            >
                <p className="text-sm text-gray-400">
                    Revenue chart will appear here.
                </p>
            </div>
        </section>
    );
};

export default RevenueWidget;