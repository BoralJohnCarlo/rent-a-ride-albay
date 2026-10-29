import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import LogoImage from "../../assets/logos/Logo.png";

const VARIANTS = Object.freeze({
    LIGHT: {
        title: "text-gray-900",
        subtitle: "text-gray-600",
    },

    DARK: {
        title: "text-white",
        subtitle: "text-gray-300",
    },
});

const PublicLogo = ({
    to = "/",
    title = "Rent-A-Ride Albay",
    subtitle = "Your Trusted Vehicle Rental in Albay",
    showTitle = true,
    showSubtitle = true,
    iconSize = 56,
    orientation = "horizontal",
    variant = "LIGHT",
}) => {
    const colors =
        VARIANTS[variant] ?? VARIANTS.LIGHT;

    return (
        <Link
            to={to}
            className="inline-flex"
            aria-label="Rent-A-Ride Albay"
        >
            <motion.div
                whileHover={{
                    scale: 1.03,
                }}
                whileTap={{
                    scale: 0.98,
                }}
                transition={{
                    duration: 0.2,
                }}
                className={`
                    flex
                    ${
                        orientation === "vertical"
                            ? "flex-col items-center text-center"
                            : "items-center"
                    }
                `}
            >
<img
    src={LogoImage}
    alt="Rent-A-Ride Albay"
    width={iconSize}
    height={iconSize}
    className="
        select-none
        rounded-lg
        bg-white
        dark:bg-white
        object-contain
    "
    draggable={false}
/>

                {showTitle && (
    <div
        className={
            orientation === "vertical"
                ? "mt-4"
                : "ml-4"
        }
    >
        <h1
            className={`
                text-xl
                font-bold
                tracking-tight
                ${colors.title}
            `}
        >
            {title}
        </h1>

        {showSubtitle && (
            <p
                className={`
                    mt-1
                    text-sm
                    ${colors.subtitle}
                `}
            >
                {subtitle}
            </p>
        )}
    </div>
)}
            </motion.div>
        </Link>
    );
};

export default PublicLogo;