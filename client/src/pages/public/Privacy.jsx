import { motion } from "framer-motion";
import {
    Eye,
    FileText,
    LockKeyhole,
    ShieldCheck,
    UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const privacySections = [
    {
        icon: UserRound,
        title: "Information You Provide",
        description:
            "When you create an account or use rental-related features, the platform may collect information that you provide, such as your name, contact details, account credentials, and other information required by the system.",
    },
    {
        icon: Eye,
        title: "How Information Is Used",
        description:
            "Information collected through the platform is used to support account management, vehicle rental services, rental-related transactions, communication, and other functions necessary for operating Rent-A-Ride Albay.",
    },
    {
        icon: LockKeyhole,
        title: "Account Security",
        description:
            "Users are expected to keep their account credentials confidential and should avoid sharing their passwords or other authentication information with others.",
    },
    {
        icon: ShieldCheck,
        title: "Vehicle and Rental Information",
        description:
            "Information related to vehicles, availability, rental activity, and participating vehicle owners or operators may be processed as necessary to support the platform's vehicle rental and management functions.",
    },
    {
        icon: FileText,
        title: "Information Accuracy",
        description:
            "Users should provide accurate and up-to-date information when using the platform. If account or submitted information changes, users should update it when the system provides the appropriate option.",
    },
];

const Privacy = () => {
    return (
        <>
            <Section
                spacing="XL"
                className="bg-gray-50 dark:bg-gray-950"
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
                        <span
                            className="
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
                                dark:border-yellow-900/60
                                dark:bg-yellow-950/40
                                dark:text-yellow-400
                            "
                        >
                            <ShieldCheck size={16} />
                            Privacy
                        </span>

                        <h1
                            className="
                                mt-6
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                dark:text-white
                                sm:text-5xl
                            "
                        >
                            Your Privacy Matters
                        </h1>

                        <p
                            className="
                                mx-auto
                                mt-5
                                max-w-2xl
                                text-base
                                leading-7
                                text-gray-600
                                dark:text-gray-300
                                sm:text-lg
                            "
                        >
                            Learn how information may be
                            handled when using the
                            Rent-A-Ride Albay platform and
                            its rental-related features.
                        </p>
                    </motion.div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="bg-white dark:bg-gray-900"
            >
                <PageContainer>
                    <div className="mx-auto max-w-4xl">
                        <div
                            className="
                                rounded-3xl
                                border
                                border-gray-200
                                bg-white
                                p-6
                                shadow-sm
                                dark:border-gray-800
                                dark:bg-gray-900
                                sm:p-8
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
                                        rounded-xl
                                        bg-yellow-100
                                        text-yellow-600
                                        dark:bg-yellow-950/50
                                        dark:text-yellow-400
                                    "
                                >
                                    <LockKeyhole
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
                                            text-gray-900
                                            dark:text-white
                                        "
                                    >
                                        Privacy and responsible
                                        information handling
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-7
                                            text-gray-600
                                            dark:text-gray-300
                                        "
                                    >
                                        Rent-A-Ride Albay is
                                        designed to use
                                        information as needed
                                        to provide account,
                                        vehicle rental, and
                                        platform-management
                                        functionality.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-5">
                            {privacySections.map(
                                (
                                    {
                                        icon: Icon,
                                        title,
                                        description,
                                    },
                                    index
                                ) => (
                                    <motion.article
                                        key={title}
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
                                            delay:
                                                index * 0.04,
                                        }}
                                        className="
                                            rounded-3xl
                                            border
                                            border-gray-200
                                            bg-white
                                            p-6
                                            shadow-sm
                                            transition-all
                                            duration-300
                                            hover:-translate-y-0.5
                                            hover:shadow-md
                                            dark:border-gray-800
                                            dark:bg-gray-900
                                            dark:hover:border-gray-700
                                            sm:p-7
                                        "
                                    >
                                        <div className="flex items-start gap-5">
                                            <div
                                                className="
                                                    flex
                                                    h-11
                                                    w-11
                                                    shrink-0
                                                    items-center
                                                    justify-center
                                                    rounded-xl
                                                    bg-gray-950
                                                    text-yellow-500
                                                    dark:bg-white
                                                    dark:text-yellow-600
                                                "
                                            >
                                                <Icon
                                                    size={21}
                                                    strokeWidth={1.8}
                                                />
                                            </div>

                                            <div>
                                                <h2
                                                    className="
                                                        text-lg
                                                        font-bold
                                                        tracking-tight
                                                        text-gray-900
                                                        dark:text-white
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
                                                        dark:text-gray-300
                                                    "
                                                >
                                                    {
                                                        description
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </motion.article>
                                )
                            )}
                        </div>

                        <div
                            className="
                                mt-8
                                rounded-3xl
                                bg-gray-950
                                p-7
                                dark:bg-gray-800
                                sm:p-9
                            "
                        >
                            <div className="flex items-start gap-4">
                                <ShieldCheck
                                    size={23}
                                    className="
                                        mt-0.5
                                        shrink-0
                                        text-yellow-500
                                    "
                                />

                                <div>
                                    <h2
                                        className="
                                            text-xl
                                            font-black
                                            text-white
                                        "
                                    >
                                        Questions about privacy?
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            leading-6
                                            text-gray-400
                                        "
                                    >
                                        If you have questions
                                        or concerns regarding
                                        information used by
                                        the platform, visit
                                        our Contact page for
                                        assistance.
                                    </p>

                                    <Link
                                        to="/contact"
                                        className="
                                            mt-5
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
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </PageContainer>
            </Section>
        </>
    );
};

export default Privacy;