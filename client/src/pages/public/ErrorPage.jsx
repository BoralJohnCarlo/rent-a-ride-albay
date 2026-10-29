import { motion } from "framer-motion";
import {
    AlertTriangle,
    ArrowLeft,
    Home,
} from "lucide-react";
import {
    Link,
    useNavigate,
} from "react-router-dom";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const ErrorPage = ({
    title = "Something Went Wrong",
    message = "We were unable to complete your request. Please try again or return to the homepage.",
}) => {
    const navigate = useNavigate();

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <Section
                spacing="XL"
                className="
                    flex
                    min-h-screen
                    items-center
                "
            >
                <PageContainer>
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 24,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.55,
                        }}
                        className="
                            mx-auto
                            max-w-2xl
                            text-center
                        "
                    >
                        <motion.div
                            initial={{
                                scale: 0.85,
                                opacity: 0,
                            }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                            }}
                            transition={{
                                duration: 0.45,
                                delay: 0.1,
                            }}
                            className="
                                mx-auto
                                flex
                                h-20
                                w-20
                                items-center
                                justify-center
                                rounded-3xl
                                bg-yellow-100
                                text-yellow-600
                                shadow-sm
                                dark:bg-yellow-500/10
                                dark:text-yellow-400
                            "
                        >
                            <AlertTriangle
                                size={40}
                                strokeWidth={1.7}
                            />
                        </motion.div>

                        <p
                            className="
                                mt-7
                                text-sm
                                font-bold
                                uppercase
                                tracking-[0.2em]
                                text-yellow-600
                                dark:text-yellow-400
                            "
                        >
                            Unexpected Error
                        </p>

                        <h1
                            className="
                                mt-3
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                dark:text-white
                                sm:text-5xl
                            "
                        >
                            {title}
                        </h1>

                        <p
                            className="
                                mx-auto
                                mt-5
                                max-w-xl
                                text-base
                                leading-7
                                text-gray-600
                                dark:text-gray-300
                            "
                        >
                            {message}
                        </p>

                        <div
                            className="
                                mt-8
                                flex
                                flex-col
                                items-center
                                justify-center
                                gap-3
                                sm:flex-row
                            "
                        >
                            <Link
                                to="/"
                                className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    gap-2
                                    rounded-xl
                                    border
                                    border-gray-300
                                    bg-white
                                    px-6
                                    py-3
                                    text-sm
                                    font-bold
                                    text-gray-700
                                    transition-all
                                    duration-200
                                    hover:border-gray-400
                                    hover:bg-gray-100
                                    hover:text-gray-900
                                    focus:outline-none
                                    focus:ring-2
                                    focus:ring-yellow-500
                                    focus:ring-offset-2
                                    focus:ring-offset-gray-50
                                    dark:border-gray-700
                                    dark:bg-gray-900
                                    dark:text-gray-200
                                    dark:hover:border-gray-600
                                    dark:hover:bg-gray-800
                                    dark:hover:text-white
                                    dark:focus:ring-offset-gray-950
                                "
                            >
                                <Home size={17} />

                                Go Home
                            </Link>

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(-1)
                                }
                                className="
                                    inline-flex
                                    items-center
                                    justify-center
                                    gap-2
                                    rounded-xl
                                    px-5
                                    py-3
                                    text-sm
                                    font-semibold
                                    text-gray-500
                                    transition-colors
                                    duration-200
                                    hover:text-gray-900
                                    focus:outline-none
                                    focus:ring-2
                                    focus:ring-yellow-500
                                    dark:text-gray-400
                                    dark:hover:text-white
                                "
                            >
                                <ArrowLeft
                                    size={17}
                                />

                                Go Back
                            </button>
                        </div>
                    </motion.div>
                </PageContainer>
            </Section>
        </main>
    );
};

export default ErrorPage;