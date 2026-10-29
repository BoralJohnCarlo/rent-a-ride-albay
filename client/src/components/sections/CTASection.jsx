import { motion } from "framer-motion";
import { ArrowRight, CarFront } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../common/Button";
import PageContainer from "./PageContainer";
import Section from "./Section";

import useAuth from "../../hooks/auth/useAuth";

const CTASection = () => {
    const { isAuthenticated } = useAuth();

    return (
        <Section
            spacing="LG"
            className="bg-white dark:bg-gray-950"
        >
            <PageContainer>
                <motion.div
                    initial={{
                        opacity: 0,
                        y: 24,
                    }}
                    whileInView={{
                        opacity: 1,
                        y: 0,
                    }}
                    viewport={{
                        once: true,
                        amount: 0.2,
                    }}
                    transition={{
                        duration: 0.5,
                    }}
                    className="
                        relative
                        isolate
                        overflow-hidden
                        rounded-3xl
                        border
                        border-gray-900
                        bg-gray-950
                        px-6
                        py-6
                        shadow-xl
                        ring-1
                        ring-white/10
                        sm:px-10
                        lg:px-14
                        lg:py-7
                        dark:border-gray-800
                    "
                >
                    {/* Atmosphere — same language as Featured / Testimonials */}
                    <div className="pointer-events-none absolute -right-28 -top-28 -z-10 h-[24rem] w-[24rem] rounded-full bg-yellow-500/15 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-32 -left-16 -z-10 h-[22rem] w-[22rem] rounded-full bg-blue-500/10 blur-3xl" />
                    <div
                        className="
                            pointer-events-none
                            absolute
                            inset-0
                            -z-10
                            bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]
                            [background-size:22px_22px]
                            [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]
                        "
                    />

                    <div
                        className="
                            flex
                            flex-col
                            gap-5
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                        "
                    >
                        <div className="flex max-w-2xl items-center gap-4">
                            <div
                                className="
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-yellow-500/15
                                    text-yellow-400
                                    ring-1
                                    ring-yellow-400/20
                                "
                            >
                                <CarFront
                                    size={20}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div>
                                <h2
                                    className="
                                        text-xl
                                        font-black
                                        tracking-tight
                                        text-white
                                        sm:text-2xl
                                    "
                                >
                                    Ready to Find Your Ride?
                                </h2>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        leading-6
                                        text-gray-400
                                    "
                                >
                                    Browse available vehicles and
                                    find a dependable ride for your
                                    next trip around Albay.
                                </p>
                            </div>
                        </div>

                        <div
                            className="
                                flex
                                w-full
                                flex-col
                                gap-3
                                sm:w-auto
                                sm:flex-row
                            "
                        >
                            <Link
                                to="/vehicles"
                                className="w-full sm:w-auto"
                            >
                                <Button
                                    size="lg"
                                    fullWidth
                                    rightIcon={
                                        <ArrowRight
                                            size={18}
                                        />
                                    }
                                    className="
                                        bg-yellow-500
                                        text-gray-950
                                        shadow-lg
                                        shadow-yellow-500/20
                                        hover:bg-yellow-400
                                        focus:ring-yellow-500
                                    "
                                >
                                    Browse Vehicles
                                </Button>
                            </Link>

                            {/* Already has an account once signed in. */}
                            {!isAuthenticated && (
                                <Link
                                    to="/register"
                                    className="w-full sm:w-auto"
                                >
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        fullWidth
                                        className="
                                            border-gray-700
                                            bg-transparent
                                            text-white
                                            hover:border-gray-600
                                            hover:bg-gray-900
                                            hover:text-white
                                            focus:ring-gray-500
                                        "
                                    >
                                        Create an Account
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </motion.div>
            </PageContainer>
        </Section>
    );
};

export default CTASection;
