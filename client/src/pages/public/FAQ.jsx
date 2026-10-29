import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ChevronDown,
    HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const faqs = [
    {
        question:
            "What is Rent-A-Ride Albay?",
        answer:
            "Rent-A-Ride Albay is a local vehicle rental platform designed to help customers browse available vehicles and choose a suitable ride for their trip around Albay.",
    },
    {
        question:
            "What types of vehicles can I rent?",
        answer:
            "The platform supports cars and motorcycles. Available vehicles and their details depend on the current fleet listed on the system.",
    },
    {
        question:
            "How can I find an available vehicle?",
        answer:
            "You can browse the Vehicles page to view the vehicles currently listed on the platform. Vehicle availability and other relevant information are displayed with each vehicle.",
    },
    {
        question:
            "Can I view vehicle details before renting?",
        answer:
            "Yes. Customers can browse vehicle information before proceeding with a rental. Vehicle details may include the vehicle type, specifications, pricing, images, and availability.",
    },
    {
        question:
            "Do I need an account to use the platform?",
        answer:
            "You can browse public vehicle information without an account. An account is required for customer features that involve authenticated rental transactions.",
    },
    {
        question:
            "How do I register as a customer?",
        answer:
            "Select Register from the navigation menu and complete the required registration information. After registration, you can log in using your account credentials.",
    },
    {
        question:
            "Can vehicle owners provide vehicles for rental?",
        answer:
            "Yes. Rent-A-Ride Albay supports vehicle owners and operators who can provide vehicles for the rental fleet, subject to the platform's approval and management process.",
    },
    {
        question:
            "Are all vehicles immediately available for rent?",
        answer:
            "No. Vehicle availability depends on the vehicle's current status and rental conditions. A vehicle may be unavailable because it is reserved, rented, under maintenance, or otherwise unavailable.",
    },
    {
        question:
            "What should I do if I have a question about a rental?",
        answer:
            "You can use the Contact page to find information about getting assistance with rental inquiries, availability, and other concerns.",
    },
    {
        question:
            "Where does Rent-A-Ride Albay operate?",
        answer:
            "Rent-A-Ride Albay is designed as a local vehicle rental platform serving customers traveling around Albay, Philippines.",
    },
];

const FAQItem = ({
    question,
    answer,
    isOpen,
    onToggle,
}) => {
    return (
        <motion.div
            layout
            className="
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-sm
                transition-shadow
                duration-300
                hover:shadow-md
                dark:border-gray-800
                dark:bg-gray-900
                dark:hover:shadow-black/20
            "
        >
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className="
                    flex
                    w-full
                    items-center
                    justify-between
                    gap-5
                    px-5
                    py-5
                    text-left
                    transition-colors
                    hover:bg-gray-50
                    focus:outline-none
                    focus:ring-2
                    focus:ring-inset
                    focus:ring-yellow-500
                    sm:px-6
                    dark:hover:bg-gray-800/70
                "
            >
                <span
                    className="
                        text-base
                        font-bold
                        leading-6
                        text-gray-900
                        dark:text-white
                    "
                >
                    {question}
                </span>

                <span
                    className={`
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        transition-all
                        duration-300
                        ${
                            isOpen
                                ? "bg-yellow-500 text-gray-950"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }
                    `}
                >
                    <ChevronDown
                        size={18}
                        className={`
                            transition-transform
                            duration-300
                            ${
                                isOpen
                                    ? "rotate-180"
                                    : ""
                            }
                        `}
                    />
                </span>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{
                            height: 0,
                            opacity: 0,
                        }}
                        animate={{
                            height: "auto",
                            opacity: 1,
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                        }}
                        transition={{
                            duration: 0.25,
                        }}
                    >
                        <div
                            className="
                                border-t
                                border-gray-100
                                px-5
                                pb-5
                                pt-4
                                sm:px-6
                                dark:border-gray-800
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    leading-7
                                    text-gray-600
                                    dark:text-gray-300
                                "
                            >
                                {answer}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const FAQ = () => {
    const [openIndex, setOpenIndex] =
        useState(null);

    const handleToggle = (index) => {
        setOpenIndex((current) =>
            current === index
                ? null
                : index
        );
    };

    return (
        <>
            <Section
                spacing="XL"
                className="
                    bg-gray-50
                    dark:bg-gray-950
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
                            <HelpCircle
                                size={16}
                            />

                            Frequently Asked
                            Questions
                        </span>

                        <h1
                            className="
                                mt-6
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                sm:text-5xl
                                dark:text-white
                            "
                        >
                            Questions?
                            <span className="text-yellow-500">
                                {" "}
                                We Can Help.
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
                                dark:text-gray-300
                            "
                        >
                            Find answers to common
                            questions about Rent-A-Ride
                            Albay, vehicles, accounts,
                            and the rental experience.
                        </p>
                    </motion.div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="
                    bg-white
                    dark:bg-gray-950
                "
            >
                <PageContainer>
                    <div className="mx-auto max-w-4xl">
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{
                                once: true,
                                amount: 0.1,
                            }}
                            variants={{
                                hidden: {},
                                visible: {
                                    transition: {
                                        staggerChildren: 0.06,
                                    },
                                },
                            }}
                            className="space-y-4"
                        >
                            {faqs.map(
                                (
                                    faq,
                                    index
                                ) => (
                                    <motion.div
                                        key={
                                            faq.question
                                        }
                                        variants={{
                                            hidden: {
                                                opacity: 0,
                                                y: 18,
                                            },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    duration: 0.4,
                                                },
                                            },
                                        }}
                                    >
                                        <FAQItem
                                            question={
                                                faq.question
                                            }
                                            answer={
                                                faq.answer
                                            }
                                            isOpen={
                                                openIndex ===
                                                index
                                            }
                                            onToggle={() =>
                                                handleToggle(
                                                    index
                                                )
                                            }
                                        />
                                    </motion.div>
                                )
                            )}
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>

            <Section
                spacing="LG"
                className="
                    bg-gray-50
                    dark:bg-gray-950
                "
            >
                <PageContainer>
                    <div
                        className="
                            mx-auto
                            max-w-3xl
                            rounded-3xl
                            bg-gray-950
                            px-6
                            py-10
                            text-center
                            shadow-xl
                            sm:px-10
                            dark:bg-gray-900
                            dark:ring-1
                            dark:ring-gray-800
                        "
                    >
                        <h2
                            className="
                                text-2xl
                                font-black
                                tracking-tight
                                text-white
                                sm:text-3xl
                            "
                        >
                            Still have questions?
                        </h2>

                        <p
                            className="
                                mx-auto
                                mt-3
                                max-w-xl
                                text-sm
                                leading-6
                                text-gray-400
                            "
                        >
                            If you need additional
                            assistance, visit our Contact
                            page for information about
                            rental inquiries and support.
                        </p>

                        <Link
                            to="/contact"
                            className="
                                mt-6
                                inline-flex
                                items-center
                                justify-center
                                rounded-xl
                                bg-yellow-500
                                px-6
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
                </PageContainer>
            </Section>
        </>
    );
};

export default FAQ;