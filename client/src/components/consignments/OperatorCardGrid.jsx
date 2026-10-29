import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";

import OperatorCard from "./OperatorCard";

const OperatorCardGrid = ({
    operators = [],
    className = "",
}) => {
    const [expandedId, setExpandedId] =
        useState(null);

    const expandedOperator = useMemo(
        () =>
            operators.find(
                (operator) =>
                    operator._id === expandedId
            ),
        [operators, expandedId]
    );

    const remainingOperators = useMemo(
        () =>
            operators.filter(
                (operator) =>
                    operator._id !== expandedId
            ),
        [operators, expandedId]
    );

    const handleToggle = (operatorId) => {
        setExpandedId((current) =>
            current === operatorId
                ? null
                : operatorId
        );
    };

    return (
        <LayoutGroup>
            <div
                className={[
                    "space-y-6",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <AnimatePresence mode="popLayout">
                    {expandedOperator && (
                        <OperatorCard
                            key={expandedOperator._id}
                            operator={expandedOperator}
                            expanded
                            onToggle={() =>
                                handleToggle(
                                    expandedOperator._id
                                )
                            }
                        />
                    )}
                </AnimatePresence>

                <div
                    className="
                        grid
                        grid-cols-1
                        gap-6
                        sm:grid-cols-2
                        xl:grid-cols-3
                        2xl:grid-cols-4
                    "
                >
                    {remainingOperators.map(
                        (operator) => (
                            <OperatorCard
                                key={operator._id}
                                operator={operator}
                                expanded={false}
                                onToggle={() =>
                                    handleToggle(
                                        operator._id
                                    )
                                }
                            />
                        )
                    )}
                </div>
            </div>
        </LayoutGroup>
    );
};

export default OperatorCardGrid;