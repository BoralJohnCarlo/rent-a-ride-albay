import { motion } from "framer-motion";
import {
    CarFront,
    CheckCircle2,
    MapPin,
    ShieldCheck,
    Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../components/common/Button";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";
import SectionHeader from "../../components/sections/SectionHeader";

const features = [
    {
        icon: CarFront,
        title: "Cars & Motorcycles",
        description:
            "Browse rental vehicles that fit different travel needs, from cars for longer trips to motorcycles for everyday transportation.",
    },
    {
        icon: ShieldCheck,
        title: "Organized & Reliable",
        description:
            "Vehicle availability and rental information are managed through a centralized platform for a more organized rental experience.",
    },
    {
        icon: Users,
        title: "Built for Everyone",
        description:
            "The platform supports customers, administrators, and consigned vehicle owners through dedicated system features.",
    },
    {
        icon: MapPin,
        title: "Serving Albay",
        description:
            "Rent-A-Ride Albay is designed around the needs of people looking for convenient vehicle rental services within Albay.",
    },
];

const systemHighlights = [
    "Browse available cars and motorcycles",
    "Submit rental and booking requests online",
    "Choose rental options with or without a driver",
    "Monitor booking and rental status",
    "Support vehicle availability management",
    "Provide a more organized rental experience",
];

const About = () => {
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
                            max-w-4xl
                            text-center
                        "
                    >
                        <span
                            className="
                                inline-flex
                                items-center
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
                            About Rent-A-Ride Albay
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
                                lg:text-6xl
                            "
                        >
                            Making Vehicle Rental
                            <span className="text-yellow-500">
                                {" "}
                                Simpler
                            </span>
                        </h1>

                        <p
                            className="
                                mx-auto
                                mt-6
                                max-w-3xl
                                text-base
                                leading-7
                                text-gray-600
                                dark:text-gray-300
                                sm:text-lg
                            "
                        >
                            Rent-A-Ride Albay is a web-based vehicle
                            rental platform designed to make vehicle
                            rental operations more organized,
                            convenient, and reliable for customers
                            and the business.
                        </p>
                    </motion.div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="
                    bg-white
                    dark:bg-gray-900
                "
            >
                <PageContainer>
                    <div
                        className="
                            grid
                            grid-cols-1
                            gap-12
                            lg:grid-cols-2
                            lg:items-center
                        "
                    >
                        <motion.div
                            initial={{
                                opacity: 0,
                                x: -30,
                            }}
                            whileInView={{
                                opacity: 1,
                                x: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.2,
                            }}
                            transition={{
                                duration: 0.6,
                            }}
                        >
                            <SectionHeader
                                eyebrow="Who We Are"
                                title="A More Organized Way to Rent"
                                subtitle="Rent-A-Ride Albay is built to bring the vehicle rental process into one centralized platform."
                                align="left"
                            />

                            <div
                                className="
                                    mt-6
                                    space-y-4
                                    text-sm
                                    leading-7
                                    text-gray-600
                                    dark:text-gray-300
                                    sm:text-base
                                "
                            >
                                <p>
                                    The system was developed to
                                    improve the way Rent-A-Ride
                                    Albay manages vehicle rentals,
                                    reservations, availability,
                                    and rental records.
                                </p>

                                <p>
                                    Instead of relying mainly on
                                    manual communication and
                                    separate records, the platform
                                    provides a centralized space
                                    where customers can browse
                                    vehicles and submit booking
                                    requests while the business can
                                    manage its rental operations
                                    more efficiently.
                                </p>

                                <p>
                                    The platform supports both
                                    cars and motorcycles and is
                                    designed to serve the needs of
                                    customers, administrators, and
                                    consigned vehicle owners.
                                </p>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{
                                opacity: 0,
                                x: 30,
                            }}
                            whileInView={{
                                opacity: 1,
                                x: 0,
                            }}
                            viewport={{
                                once: true,
                                amount: 0.2,
                            }}
                            transition={{
                                duration: 0.6,
                            }}
                            className="
                                rounded-3xl
                                border
                                border-gray-200
                                bg-gray-50
                                p-6
                                shadow-sm
                                dark:border-gray-800
                                dark:bg-gray-950
                                sm:p-8
                            "
                        >
                            <div
                                className="
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-yellow-100
                                    text-yellow-600
                                    dark:bg-yellow-950/50
                                    dark:text-yellow-400
                                "
                            >
                                <CarFront
                                    size={28}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <h2
                                className="
                                    mt-6
                                    text-2xl
                                    font-bold
                                    tracking-tight
                                    text-gray-900
                                    dark:text-white
                                "
                            >
                                What the Platform Provides
                            </h2>

                            <div className="mt-6 space-y-4">
                                {systemHighlights.map(
                                    (highlight) => (
                                        <div
                                            key={highlight}
                                            className="
                                                flex
                                                items-start
                                                gap-3
                                            "
                                        >
                                            <CheckCircle2
                                                size={20}
                                                className="
                                                    mt-0.5
                                                    shrink-0
                                                    text-yellow-500
                                                "
                                            />

                                            <span
                                                className="
                                                    text-sm
                                                    leading-6
                                                    text-gray-600
                                                    dark:text-gray-300
                                                "
                                            >
                                                {highlight}
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>

            <Section
                spacing="XL"
                className="
                    bg-gray-50
                    dark:bg-gray-950
                "
            >
                <PageContainer>
                    <SectionHeader
                        eyebrow="Why Rent-A-Ride Albay"
                        title="Designed Around the Rental Experience"
                        subtitle="The platform focuses on making vehicle rental more convenient for customers while helping the business manage its operations more effectively."
                        align="CENTER"
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
                            mt-10
                            grid
                            grid-cols-1
                            gap-6
                            sm:grid-cols-2
                            lg:grid-cols-4
                        "
                    >
                        {features.map(
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
                                        dark:border-gray-800
                                        dark:bg-gray-900
                                        dark:hover:border-gray-700
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
                                            dark:bg-yellow-950/50
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

            <Section
                spacing="XL"
                className="
                    bg-white
                    dark:bg-gray-900
                "
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
                            duration: 0.6,
                        }}
                        className="
                            overflow-hidden
                            rounded-3xl
                            bg-gray-950
                            px-6
                            py-12
                            text-center
                            dark:bg-black
                            sm:px-10
                            lg:px-16
                        "
                    >
                        <MapPin
                            size={32}
                            className="
                                mx-auto
                                text-yellow-500
                            "
                        />

                        <h2
                            className="
                                mt-5
                                text-3xl
                                font-black
                                tracking-tight
                                text-white
                                sm:text-4xl
                            "
                        >
                            Ready to Find Your Next Ride?
                        </h2>

                        <p
                            className="
                                mx-auto
                                mt-4
                                max-w-2xl
                                text-sm
                                leading-6
                                text-gray-400
                                sm:text-base
                            "
                        >
                            Explore the available vehicles and
                            find a ride that fits your next trip
                            around Albay.
                        </p>

                        <div
                            className="
                                mt-8
                                flex
                                flex-col
                                justify-center
                                gap-3
                                sm:flex-row
                            "
                        >
                            <Link to="/vehicles">
                                <Button
                                    size="lg"
                                    className="
                                        w-full
                                        bg-yellow-500
                                        text-gray-950
                                        hover:bg-yellow-400
                                        sm:w-auto
                                    "
                                >
                                    Browse Vehicles
                                </Button>
                            </Link>

                            <Link to="/contact">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="
                                        w-full
                                        border-gray-700
                                        bg-transparent
                                        text-white
                                        hover:bg-gray-800
                                        hover:text-white
                                        sm:w-auto
                                    "
                                >
                                    Contact Us
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </PageContainer>
            </Section>
        </>
    );
};

export default About;