import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import Collapse from "../common/Collapse";
import {
    jellyCardVariants,
    jellyChevronTransition,
} from "../common/jellyMotion";
import PageContainer from "./PageContainer";
import Section from "./Section";
import SectionHeader from "./SectionHeader";

const faqs = [
    {
        question: "What types of vehicles can I rent?",
        answer:
            "Rent-A-Ride Albay offers cars and motorcycles from available vehicle owners and the company fleet. Available vehicles depend on the current fleet and their rental status.",
    },
    {
        question: "How do I reserve a vehicle?",
        answer:
            "Browse the available vehicles, choose the vehicle that fits your needs, select your preferred rental dates, and follow the reservation process to submit your booking.",
    },
    {
        question:
            "Can I see the vehicle details before reserving?",
        answer:
            "Yes. Vehicle information such as the vehicle type, specifications, seating capacity, transmission, fuel type, pricing, and availability can be reviewed before making a reservation.",
    },
    {
        question:
            "Where is Rent-A-Ride Albay located?",
        answer:
            "Rent-A-Ride Albay is a local vehicle rental platform serving customers traveling around Albay, Philippines.",
    },
    {
        question:
            "Can vehicle owners provide vehicles for rental?",
        answer:
            "Yes. Vehicle owners can submit their vehicles for consideration through the appropriate owner or partner process. Vehicles must go through the required approval process before becoming available for rental.",
    },
    {
        question:
            "What happens after I submit a reservation?",
        answer:
            "Your reservation will go through the required booking process. You can review the reservation status and related information through your account.",
    },
];

const FAQSection = () => {
    const [openIndex, setOpenIndex] =
        useState(null);
    const reduceMotion = useReducedMotion();

    const handleToggle = (index) => {
        setOpenIndex((currentIndex) =>
            currentIndex === index ? null : index
        );
    };

    return (
        <Section
            spacing="XL"
            className="
                bg-white
                dark:bg-gray-950
            "
        >
            <PageContainer>
                <SectionHeader
                    eyebrow="FAQ"
                    title="Frequently Asked Questions"
                    subtitle="Find answers to some of the common questions about renting and providing vehicles through Rent-A-Ride Albay."
                />

                <div className="mx-auto w-full max-w-4xl">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{
                            once: true,
                            amount: 0.15,
                        }}
                        variants={{
                            hidden: {},
                            visible: {
                                transition: {
                                    staggerChildren: 0.07,
                                },
                            },
                        }}
                        className="space-y-4"
                    >
                        {faqs.map(
                            (
                                {
                                    question,
                                    answer,
                                },
                                index
                            ) => {
                                const isOpen =
                                    openIndex === index;

                                return (
                                    <motion.div
                                        key={question}
                                        variants={{
                                            hidden: {
                                                opacity: 0,
                                                y: 18,
                                            },
                                            visible: {
                                                opacity: 1,
                                                y: 0,
                                                transition: {
                                                    duration: 0.5,
                                                    ease: [0.22, 1, 0.36, 1],
                                                },
                                            },
                                        }}
                                    >
                                        <motion.div
                                            initial={false}
                                            animate={
                                                isOpen
                                                    ? "open"
                                                    : "closed"
                                            }
                                            variants={
                                                reduceMotion
                                                    ? undefined
                                                    : jellyCardVariants
                                            }
                                            className={`
                                                overflow-hidden
                                                rounded-2xl
                                                border
                                                transition-[border-color,background-color,box-shadow]
                                                duration-300
                                                ${
                                                    isOpen
                                                        ? "border-yellow-300 bg-white shadow-md dark:border-yellow-500/40 dark:bg-gray-900"
                                                        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                                                }
                                            `}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleToggle(
                                                        index
                                                    )
                                                }
                                                aria-expanded={
                                                    isOpen
                                                }
                                                className="
                                                    flex
                                                    w-full
                                                    items-center
                                                    justify-between
                                                    gap-6
                                                    px-6
                                                    py-5
                                                    text-left
                                                    outline-none
                                                    focus-visible:ring-2
                                                    focus-visible:ring-inset
                                                    focus-visible:ring-yellow-500
                                                    [-webkit-tap-highlight-color:transparent]
                                                "
                                            >
                                                <span
                                                    className="
                                                        text-base
                                                        font-semibold
                                                        text-gray-900
                                                        dark:text-white
                                                    "
                                                >
                                                    {question}
                                                </span>
    
                                                <motion.span
                                                    animate={{
                                                        rotate: isOpen
                                                            ? 180
                                                            : 0,
                                                    }}
                                                    transition={
                                                        jellyChevronTransition
                                                    }
                                                    className={`
                                                        flex
                                                        shrink-0
                                                        transition-colors
                                                        duration-300
                                                        ${
                                                            isOpen
                                                                ? "text-yellow-500"
                                                                : "text-gray-500 dark:text-gray-400"
                                                        }
                                                    `}
                                                >
                                                    <ChevronDown
                                                        size={20}
                                                    />
                                                </motion.span>
                                            </button>
    
                                            <Collapse open={isOpen}>
                                                <div
                                                    className="
                                                        border-t
                                                        border-gray-200
                                                        px-6
                                                        pb-5
                                                        pt-4
                                                        dark:border-gray-700
                                                    "
                                                >
                                                    <p
                                                        className="
                                                            text-sm
                                                            leading-7
                                                            text-gray-500
                                                            dark:text-gray-300
                                                        "
                                                    >
                                                        {answer}
                                                    </p>
                                                </div>
                                            </Collapse>
                                        </motion.div>
                                    </motion.div>
                                );
                            }
                        )}
                    </motion.div>
                </div>
            </PageContainer>
        </Section>
    );
};

export default FAQSection;