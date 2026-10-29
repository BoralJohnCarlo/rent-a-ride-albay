import { motion } from "framer-motion";
import {
    Search,
    CarFront,
    CalendarCheck,
    MapPinned,
} from "lucide-react";

import PageContainer from "./PageContainer";
import Section from "./Section";
import SectionHeader from "./SectionHeader";

const steps = [
    {
        number: "01",
        icon: Search,
        title: "Browse Vehicles",
        description:
            "Explore available cars and motorcycles and find options that match your travel needs.",
    },
    {
        number: "02",
        icon: CarFront,
        title: "Choose Your Ride",
        description:
            "Compare vehicle details, pricing, specifications, and availability before making your choice.",
    },
    {
        number: "03",
        icon: CalendarCheck,
        title: "Make a Reservation",
        description:
            "Select your rental dates, review the reservation details, and submit your booking request.",
    },
    {
        number: "04",
        icon: MapPinned,
        title: "Enjoy Your Trip",
        description:
            "Pick up your approved rental and enjoy a convenient ride for your trip around Albay.",
    },
];

const RentalProcessSection = () => {
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
                    eyebrow="How It Works"
                    title="Rent a Vehicle in Four Simple Steps"
                    subtitle="Finding and reserving a vehicle with Rent-A-Ride Albay is designed to be simple, clear, and convenient."
                />

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
                                staggerChildren: 0.1,
                            },
                        },
                    }}
                    className="
                        grid
                        grid-cols-1
                        gap-6
                        md:grid-cols-2
                        lg:grid-cols-4
                    "
                >
                    {steps.map(
                        ({
                            number,
                            icon: Icon,
                            title,
                            description,
                        }) => (
                            <motion.article
                                key={number}
                                variants={{
                                    hidden: {
                                        opacity: 0,
                                        y: 24,
                                    },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: {
                                            duration: 0.45,
                                        },
                                    },
                                }}
                                className="
                                    relative
                                    rounded-3xl
                                    border
                                    border-gray-200
                                    bg-gray-50
                                    p-6
                                    shadow-sm
                                    transition-all
                                    duration-300
                                    hover:-translate-y-1
                                    hover:border-gray-300
                                    hover:bg-white
                                    hover:shadow-lg

                                    dark:border-gray-800
                                    dark:bg-gray-900
                                    dark:hover:border-gray-700
                                    dark:hover:bg-gray-800
                                "
                            >
                                <div className="flex items-center justify-between">
                                    <div
                                        className="
                                            flex
                                            h-12
                                            w-12
                                            items-center
                                            justify-center
                                            rounded-2xl
                                            bg-yellow-100
                                            text-yellow-600

                                            dark:bg-yellow-500/15
                                            dark:text-yellow-400
                                        "
                                    >
                                        <Icon
                                            size={24}
                                            strokeWidth={1.8}
                                        />
                                    </div>

                                    <span
                                        className="
                                            text-4xl
                                            font-black
                                            tracking-tight
                                            text-gray-200

                                            dark:text-gray-700
                                        "
                                    >
                                        {number}
                                    </span>
                                </div>

                                <h3
                                    className="
                                        mt-6
                                        text-lg
                                        font-bold
                                        tracking-tight
                                        text-gray-900

                                        dark:text-white
                                    "
                                >
                                    {title}
                                </h3>

                                <p
                                    className="
                                        mt-2
                                        text-sm
                                        leading-6
                                        text-gray-500

                                        dark:text-gray-400
                                    "
                                >
                                    {description}
                                </p>
                            </motion.article>
                        )
                    )}
                </motion.div>
            </PageContainer>
        </Section>
    );
};

export default RentalProcessSection;