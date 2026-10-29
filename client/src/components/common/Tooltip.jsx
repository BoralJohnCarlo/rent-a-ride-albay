import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    TOOLTIP_ANIMATION,
    TOOLTIP_TRANSITION,
} from "../../constants/animations";

const Tooltip = ({
    content,
    children,
    side = "right",
    disabled = false,
    delay = 180,
}) => {
    const [show, setShow] =
        useState(false);

    const timeoutRef =
        useRef(null);

    const positions = {
        right:
            "left-full top-1/2 ml-3 -translate-y-1/2",

        left:
            "right-full top-1/2 mr-3 -translate-y-1/2",

        top:
            "bottom-full left-1/2 mb-3 -translate-x-1/2",

        bottom:
            "top-full left-1/2 mt-3 -translate-x-1/2",
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(
                    timeoutRef.current
                );
            }
        };
    }, []);

    const handleMouseEnter = () => {
        if (disabled) {
            return;
        }

        timeoutRef.current =
            setTimeout(() => {
                setShow(true);
            }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(
                timeoutRef.current
            );
        }

        setShow(false);
    };

    return (
        <div
            className="relative flex"
            onMouseEnter={
                handleMouseEnter
            }
            onMouseLeave={
                handleMouseLeave
            }
        >
            {children}

            <AnimatePresence>
                {show && (
                    <motion.div
                        initial={TOOLTIP_ANIMATION.initial(
                            side
                        )}
                        animate={
                            TOOLTIP_ANIMATION.animate
                        }
                        exit={TOOLTIP_ANIMATION.exit(
                            side
                        )}
                        transition={
                            TOOLTIP_TRANSITION
                        }
                        className={`
                            pointer-events-none
                            absolute
                            z-50
                            whitespace-nowrap
                            rounded-lg
                            border
                            border-gray-700
                            bg-gray-900
                            px-3
                            py-2
                            text-sm
                            font-medium
                            text-white
                            shadow-xl
                            dark:border-gray-700
                            dark:bg-gray-800
                            dark:text-gray-100
                            ${positions[side]}
                        `}
                    >
                        {content}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip;