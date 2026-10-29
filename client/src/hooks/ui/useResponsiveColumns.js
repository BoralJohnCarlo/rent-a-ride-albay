import { useEffect, useState } from "react";

const DEFAULT_BREAKPOINTS = {
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
};

const getColumnCount = (
    breakpoints
) => {
    if (typeof window === "undefined") {
        return breakpoints.lg;
    }

    const width = window.innerWidth;

    if (width >= 1280) {
        return breakpoints.xl;
    }

    if (width >= 1024) {
        return breakpoints.lg;
    }

    if (width >= 768) {
        return breakpoints.md;
    }

    return breakpoints.sm;
};

const useResponsiveColumns = (
    customBreakpoints = {}
) => {
    const breakpoints = {
        ...DEFAULT_BREAKPOINTS,
        ...customBreakpoints,
    };

    const [columns, setColumns] =
        useState(() =>
            getColumnCount(
                breakpoints
            )
        );

    useEffect(() => {
        const handleResize = () => {
            setColumns(
                getColumnCount(
                    breakpoints
                )
            );
        };

        window.addEventListener(
            "resize",
            handleResize
        );

        return () => {
            window.removeEventListener(
                "resize",
                handleResize
            );
        };
    }, [breakpoints]);

    return columns;
};

export default useResponsiveColumns;