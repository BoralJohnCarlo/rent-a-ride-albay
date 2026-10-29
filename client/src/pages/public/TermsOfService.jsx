import { motion } from "framer-motion";
import {
    CheckCircle2,
    FileText,
    ShieldCheck,
} from "lucide-react";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const sections = [
    {
        number: "01",
        title: "Using the Platform",
        content:
            "Rent-A-Ride Albay provides an online platform for browsing and managing vehicle rental services. Users are expected to provide accurate information and use the platform only for legitimate rental-related purposes.",
    },
    {
        number: "02",
        title: "Customer Accounts",
        content:
            "Customers are responsible for the information submitted during registration and for keeping their account credentials secure. Account information should remain accurate and up to date.",
    },
    {
        number: "03",
        title: "Vehicle Information",
        content:
            "Vehicle information displayed on the platform may include pricing, specifications, images, availability, and other relevant details. Availability may change depending on the current status of a vehicle.",
    },
    {
        number: "04",
        title: "Rental Transactions",
        content:
            "Customers should review the available vehicle information and rental details before proceeding with a transaction. Rental-related actions are subject to the information and conditions presented by the platform.",
    },
    {
        number: "05",
        title: "Vehicle Owners and Operators",
        content:
            "Vehicle owners and operators who participate in the platform are expected to provide accurate vehicle information and comply with the platform's approval and management procedures.",
    },
    {
        number: "06",
        title: "Acceptable Use",
        content:
            "Users should not misuse the platform, provide intentionally misleading information, interfere with system operation, or use the service for unlawful purposes.",
    },
    {
        number: "07",
        title: "Platform Availability",
        content:
            "The platform may occasionally be unavailable because of maintenance, technical issues, updates, or circumstances outside the platform's control.",
    },
    {
        number: "08",
        title: "Changes to These Terms",
        content:
            "The terms and information presented on this page may be updated as the Rent-A-Ride Albay system and its services develop. Users should review this page when necessary.",
    },
];

const TermsOfService = () => {
    return (
        <>
            <Section
                spacing="XL"
                className="bg-gray-50"
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
                            duration: 0.6,
                        }}
                        className="
                            mx-auto
                            max-w-3xl
                            text-center
                        "
                    >
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0.95,
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                            }}
                            transition={{
                                duration: 0.45,
                                delay: 0.1,
                            }}
                            className="
                                mx-auto
                                inline-flex
                                items-center
                                gap-2
                                rounded-full
                                border
                                border-yellow-200
                                bg-yellow-50
                                px-4
                                py-2
                                text-sm
                                font-semibold
                                text-yellow-700
                            "
                        >
                            <FileText size={16} />
                            Terms of Service
                        </motion.div>

                        <h1
                            className="
                                mt-6
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                sm:text-5xl
                            "
                        >
                            Terms for Using
                            <span className="text-yellow-500">
                                {" "}
                                Rent-A-Ride Albay
                            </span>
                        </h1>

                        <p
                            className="
                                mx-auto
                                mt-5
                                max-w-2xl
                                text-base
                                leading-7
                                text-gray-600
                                sm:text-lg
                            "
                        >
                            Please review these general terms
                            before using the Rent-A-Ride Albay
                            platform and its rental-related
                            services.
                        </p>
                    </motion.div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="bg-white"
            >
                <PageContainer>
                    <div className="mx-auto max-w-4xl">
                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 20,
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                            className="
                                mb-8
                                overflow-hidden
                                rounded-3xl
                                border
                                border-yellow-200
                                bg-yellow-50
                                p-6
                                shadow-sm
                                sm:p-7
                            "
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-2xl
                                        bg-yellow-500
                                        text-gray-950
                                        shadow-sm
                                    "
                                >
                                    <ShieldCheck
                                        size={23}
                                        strokeWidth={1.8}
                                    />
                                </div>

                                <div>
                                    <h2
                                        className="
                                            text-base
                                            font-bold
                                            tracking-tight
                                            text-gray-900
                                            sm:text-lg
                                        "
                                    >
                                        Please use the platform
                                        responsibly
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-7
                                            text-gray-600
                                        "
                                    >
                                        By using Rent-A-Ride Albay,
                                        users are expected to provide
                                        truthful information and use
                                        the system responsibly.
                                    </p>
                                </div>
                            </div>
                        </motion.div>

                        <div className="space-y-5">
                            {sections.map(
                                ({
                                    number,
                                    title,
                                    content,
                                }) => (
                                    <motion.article
                                        key={number}
                                        initial={{
                                            opacity: 0,
                                            y: 20,
                                        }}
                                        whileInView={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        viewport={{
                                            once: true,
                                            amount: 0.15,
                                        }}
                                        transition={{
                                            duration: 0.45,
                                        }}
                                        className="
                                            group
                                            rounded-3xl
                                            border
                                            border-gray-200
                                            bg-white
                                            p-6
                                            shadow-sm
                                            transition-all
                                            duration-300
                                            hover:-translate-y-1
                                            hover:border-gray-300
                                            hover:shadow-lg
                                            sm:p-7
                                        "
                                    >
                                        <div className="flex items-start gap-5">
                                            <span
                                                className="
                                                    flex
                                                    h-11
                                                    w-11
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    rounded-2xl
                                                    bg-gray-950
                                                    text-xs
                                                    font-bold
                                                    text-yellow-500
                                                    shadow-sm
                                                    transition-colors
                                                    duration-300
                                                    group-hover:bg-yellow-500
                                                    group-hover:text-gray-950
                                                "
                                            >
                                                {number}
                                            </span>

                                            <div className="min-w-0">
                                                <h2
                                                    className="
                                                        text-lg
                                                        font-bold
                                                        tracking-tight
                                                        text-gray-900
                                                        sm:text-xl
                                                    "
                                                >
                                                    {title}
                                                </h2>

                                                <p
                                                    className="
                                                        mt-3
                                                        text-sm
                                                        leading-7
                                                        text-gray-600
                                                    "
                                                >
                                                    {content}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.article>
                                )
                            )}
                        </div>

                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 20,
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.15,
                            }}
                            transition={{
                                duration: 0.45,
                            }}
                            className="
                                mt-8
                                overflow-hidden
                                rounded-3xl
                                bg-gray-950
                                p-7
                                shadow-xl
                                sm:p-9
                            "
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-11
                                        w-11
                                        shrink-0
                                        items-center
                                        justify-center
                                        rounded-2xl
                                        bg-yellow-500
                                        text-gray-950
                                    "
                                >
                                    <CheckCircle2
                                        size={22}
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
                                        Questions about these
                                        terms?
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            max-w-2xl
                                            text-sm
                                            leading-7
                                            text-gray-400
                                        "
                                    >
                                        If you need clarification
                                        regarding the platform or
                                        rental process, visit the
                                        Contact page for
                                        assistance.
                                    </p>

                                    <a
                                        href="/contact"
                                        className="
                                            mt-6
                                            inline-flex
                                            items-center
                                            justify-center
                                            rounded-xl
                                            bg-yellow-500
                                            px-5
                                            py-3
                                            text-sm
                                            font-bold
                                            text-gray-950
                                            transition-all
                                            duration-200
                                            hover:bg-yellow-400
                                            hover:shadow-lg
                                            focus:outline-none
                                            focus:ring-2
                                            focus:ring-yellow-500
                                            focus:ring-offset-2
                                            focus:ring-offset-gray-950
                                        "
                                    >
                                        Contact Us
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>
        </>
    );
};

export default TermsOfService;