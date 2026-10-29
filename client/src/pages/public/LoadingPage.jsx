import { motion } from "framer-motion";
import { CarFront } from "lucide-react";

const LoadingPage = ({
    message = "Loading Rent-A-Ride Albay...",
}) => {
    return (
        <main
            className="
                flex
                min-h-screen
                items-center
                justify-center
                bg-gray-50
                px-6
                transition-colors
                duration-300
                dark:bg-gray-950
            "
        >
            <div
                className="
                    flex
                    flex-col
                    items-center
                    text-center
                "
            >
                <motion.div
                    animate={{
                        scale: [1, 1.08, 1],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="
                        flex
                        h-16
                        w-16
                        items-center
                        justify-center
                        rounded-2xl
                        bg-gray-950
                        text-yellow-500
                        shadow-lg
                        dark:bg-white
                        dark:text-yellow-500
                    "
                >
                    <CarFront
                        size={30}
                        strokeWidth={1.8}
                    />
                </motion.div>

                <motion.div
                    animate={{
                        opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="
                        mt-6
                        h-1.5
                        w-16
                        overflow-hidden
                        rounded-full
                        bg-yellow-500
                    "
                />

                <h1
                    className="
                        mt-6
                        text-xl
                        font-black
                        tracking-tight
                        text-gray-900
                        dark:text-white
                    "
                >
                    Rent-A-Ride Albay
                </h1>

                <p
                    className="
                        mt-2
                        text-sm
                        text-gray-500
                        dark:text-gray-400
                    "
                >
                    {message}
                </p>
            </div>
        </main>
    );
};

export default LoadingPage;