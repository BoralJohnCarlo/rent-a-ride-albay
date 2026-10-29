import { motion } from "framer-motion";

import {
    PAGE_TRANSITION,
    PAGE_VARIANTS,
} from "../../constants/animations";

const PageTransition = ({
    children,
    className = "",
}) => {
    return (
        <motion.div
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            transition={PAGE_TRANSITION}
            className={[
                "h-full",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;