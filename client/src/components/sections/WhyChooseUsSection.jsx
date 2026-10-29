import { motion } from "framer-motion";

import {
    CarFront,
    MapPin,
    ShieldCheck,
    WalletCards,
} from "lucide-react";

import PageContainer from "./PageContainer";
import Section from "./Section";
import SectionHeader from "./SectionHeader";

const benefits = [
    {
        icon: ShieldCheck,
        title: "Trusted & Verified",
        description:
            "We prioritize verified vehicle owners and quality vehicles for a safer rental experience.",
    },
    {
        icon: CarFront,
        title: "Quality Vehicles",
        description:
            "Choose from properly managed vehicles suited for different travel needs and occasions.",
    },
    {
        icon: MapPin,
        title: "Based in Albay",
        description:
            "A local vehicle rental platform designed around the needs of customers traveling around Albay.",
    },
    {
        icon: WalletCards,
        title: "Simple Rental Experience",
        description:
            "Browse available vehicles, compare your options, and choose the ride that fits your trip.",
    },
];

const WhyChooseUsSection = () => {
    return (
        <Section>
            <PageContainer>
                <SectionHeader>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
                        Why Choose Us?
                    </h2>

                    <p className="max-w-3xl text-base leading-relaxed text-gray-600 dark:text-gray-300 md:text-lg">
                        We make renting a vehicle simple,
                        convenient, and reliable for your
                        trips around Albay.
                    </p>
                </SectionHeader>

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
                        sm:grid-cols-2
                        lg:grid-cols-4
                    "
                >
                    {benefits.map(
                        ({
                            icon: Icon,
                            title,
                            description,
                        }) => (
                            <motion.article
                                key={title}
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
                                    dark:border-gray-700
                                    dark:bg-gray-800
                                    dark:hover:border-gray-600
                                "
                            >
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

                                <h3
                                    className="
                                        mt-5
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
                                        dark:text-gray-300
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

export default WhyChooseUsSection;