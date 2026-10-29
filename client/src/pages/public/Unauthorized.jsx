import { motion } from "framer-motion";
import {
    ArrowLeft,
    Home,
    ShieldAlert,
} from "lucide-react";
import {
    Link,
    useNavigate,
} from "react-router-dom";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <main className="min-h-screen bg-gray-50">
            <Section
                spacing="XL"
                className="flex min-h-screen items-center"
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
                            w-full
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
                            "
                        >
                            <ShieldAlert
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
                            "
                        >
                            Error 403
                        </p>

                        <h1
                            className="
                                mt-3
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                sm:text-5xl
                            "
                        >
                            Unauthorized Access
                        </h1>

                        <p
                            className="
                                mx-auto
                                mt-5
                                max-w-xl
                                text-base
                                leading-7
                                text-gray-600
                                sm:text-lg
                            "
                        >
                            You do not have permission to
                            access this page. Please return
                            to an authorized area of
                            Rent-A-Ride Albay.
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
                                    w-full
                                    items-center
                                    justify-center
                                    gap-2
                                    rounded-xl
                                    bg-yellow-500
                                    px-6
                                    py-3
                                    text-sm
                                    font-bold
                                    text-gray-950
                                    shadow-sm
                                    transition-all
                                    duration-200
                                    hover:bg-yellow-400
                                    hover:shadow-lg
                                    focus:outline-none
                                    focus:ring-2
                                    focus:ring-yellow-500
                                    focus:ring-offset-2
                                "
                            >
                                <Home size={17} />
                                Back to Home
                            </Link>

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(-1)
                                }
                                className="
                                    inline-flex
                                    w-full
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
                                    shadow-sm
                                    transition-all
                                    duration-200
                                    hover:border-gray-400
                                    hover:bg-gray-100
                                    hover:text-gray-900
                                    focus:outline-none
                                    focus:ring-2
                                    focus:ring-yellow-500
                                    focus:ring-offset-2
                                "
                            >
                                <ArrowLeft size={17} />
                                Go Back
                            </button>
                        </div>

                        <div
                            className="
                                mx-auto
                                mt-10
                                max-w-md
                                rounded-2xl
                                border
                                border-gray-200
                                bg-white
                                px-5
                                py-4
                                text-left
                                shadow-sm
                            "
                        >
                            <p
                                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-wider
                                    text-gray-400
                                "
                            >
                                Access Restricted
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    leading-6
                                    text-gray-500
                                "
                            >
                                Your account may not have
                                the required role or
                                permissions to view this
                                resource.
                            </p>
                        </div>
                    </motion.div>
                </PageContainer>
            </Section>
        </main>
    );
};

export default Unauthorized;