import { motion } from "framer-motion";
import {
    ArrowRight,
    CarFront,
    CheckCircle2,
    Handshake,
    LayoutDashboard,
    MapPin,
    ShieldCheck,
    UserRound,
    Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../components/common/Button";
import LightTexture from "../../components/sections/LightTexture";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

const heroFacts = [
    { icon: CarFront, label: "Cars & motorcycles" },
    { icon: UserRound, label: "With or without a driver" },
    { icon: MapPin, label: "Based in Albay" },
];

const audiences = [
    {
        icon: Users,
        title: "Customers",
        description: "Browse, book and track rentals online.",
    },
    {
        icon: LayoutDashboard,
        title: "Administrators",
        description: "Manage vehicles, bookings and records.",
    },
    {
        icon: Handshake,
        title: "Vehicle owners",
        description: "List consigned vehicles with the business.",
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

const REVEAL = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

/* Small uppercase label above a heading, same as the Explore page. */
const Eyebrow = ({ children }) => (
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-600 dark:text-yellow-400">
        {children}
    </p>
);

const About = () => {
    return (
        <div className="relative isolate bg-gray-50 dark:bg-gray-950">
            <LightTexture
                accent="yellow"
                decorOnly
                className="inset-x-0 top-0 -z-10 h-[44rem]"
            />

            {/* Hero — top padding clears the fixed 72px navbar */}
            <Section spacing="NONE" className="pb-14 pt-28 sm:pb-16 sm:pt-32">
                <PageContainer>
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="mx-auto max-w-3xl text-center"
                    >
                        <Eyebrow>About Rent-A-Ride Albay</Eyebrow>

                        <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
                            Making Vehicle Rental{" "}
                            <span className="text-yellow-500">Simpler</span>
                        </h1>

                        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300 sm:text-lg">
                            Rent-A-Ride Albay is a web-based vehicle rental
                            platform designed to make vehicle rental
                            operations more organized, convenient, and
                            reliable for customers and the business.
                        </p>

                        <ul className="mt-8 flex flex-wrap justify-center gap-2">
                            {heroFacts.map(({ icon: Icon, label }) => (
                                <li
                                    key={label}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-800"
                                >
                                    <Icon
                                        size={16}
                                        className="text-yellow-600 dark:text-yellow-400"
                                        aria-hidden="true"
                                    />
                                    {label}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </PageContainer>
            </Section>

            {/* Who we are + what the platform provides */}
            <Section
                spacing="NONE"
                className="border-y border-gray-200/70 bg-white py-16 dark:border-gray-800 dark:bg-gray-900 sm:py-20"
            >
                <PageContainer>
                    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
                        <motion.div
                            {...REVEAL}
                            className="flex flex-col lg:col-span-7"
                        >
                            <Eyebrow>Who We Are</Eyebrow>

                            <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                                A More Organized Way to Rent
                            </h2>

                            <p className="mt-5 text-lg font-medium leading-8 text-gray-800 dark:text-gray-100">
                                Rent-A-Ride Albay brings the whole vehicle
                                rental process into one centralized
                                platform.
                            </p>

                            <div className="mt-4 space-y-4 text-base leading-7 text-gray-600 dark:text-gray-300">
                                <p>
                                    The system was developed to improve the
                                    way Rent-A-Ride Albay manages vehicle
                                    rentals, reservations, availability, and
                                    rental records.
                                </p>

                                <p>
                                    Instead of relying mainly on manual
                                    communication and separate records,
                                    customers can browse vehicles and submit
                                    booking requests in one place, while the
                                    business manages its rental operations
                                    more efficiently.
                                </p>
                            </div>

                            {/* Who it's for — anchors the column's bottom */}
                            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:mt-auto lg:pt-8">
                                {audiences.map(
                                    ({ icon: Icon, title, description }) => (
                                        <div
                                            key={title}
                                            className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60"
                                        >
                                            <Icon
                                                size={20}
                                                className="text-yellow-600 dark:text-yellow-400"
                                                aria-hidden="true"
                                            />
                                            <p className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
                                                {title}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                                {description}
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        </motion.div>

                        <motion.div
                            {...REVEAL}
                            transition={{ ...REVEAL.transition, delay: 0.1 }}
                            className="lg:col-span-5"
                        >
                            <div className="h-full rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950 sm:p-8">
                                <div className="flex items-center gap-4">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-gray-950">
                                        <CarFront
                                            size={24}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                        />
                                    </span>

                                    <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                                        What the Platform Provides
                                    </h2>
                                </div>

                                <ul className="mt-6 divide-y divide-gray-200 dark:divide-gray-800">
                                    {systemHighlights.map((highlight) => (
                                        <li
                                            key={highlight}
                                            className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"
                                        >
                                            <CheckCircle2
                                                size={20}
                                                className="mt-0.5 shrink-0 text-yellow-500"
                                                aria-hidden="true"
                                            />
                                            <span className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                                                {highlight}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>

            {/* Why Rent-A-Ride Albay */}
            <Section spacing="NONE" className="py-16 sm:py-20">
                <PageContainer>
                    <motion.div
                        {...REVEAL}
                        className="mx-auto max-w-2xl text-center"
                    >
                        <Eyebrow>Why Rent-A-Ride Albay</Eyebrow>

                        <h2 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                            Designed Around the Rental Experience
                        </h2>

                        <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
                            Making vehicle rental more convenient for
                            customers while helping the business manage its
                            operations more effectively.
                        </p>
                    </motion.div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.15 }}
                        variants={{
                            hidden: {},
                            visible: {
                                transition: { staggerChildren: 0.1 },
                            },
                        }}
                        className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
                    >
                        {features.map(
                            ({ icon: Icon, title, description }) => (
                                <motion.article
                                    key={title}
                                    variants={{
                                        hidden: { opacity: 0, y: 24 },
                                        visible: {
                                            opacity: 1,
                                            y: 0,
                                            transition: { duration: 0.45 },
                                        },
                                    }}
                                    className="flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400">
                                        <Icon
                                            size={24}
                                            strokeWidth={1.8}
                                            aria-hidden="true"
                                        />
                                    </span>

                                    <h3 className="mt-5 text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                                        {title}
                                    </h3>

                                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                                        {description}
                                    </p>
                                </motion.article>
                            )
                        )}
                    </motion.div>
                </PageContainer>
            </Section>

            {/* Call to action */}
            <Section spacing="NONE" className="pb-20">
                <PageContainer>
                    <motion.div
                        {...REVEAL}
                        className="relative overflow-hidden rounded-3xl bg-gray-950 px-6 py-12 dark:bg-black sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-14"
                    >
                        <div className="text-center lg:text-left">
                            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                                Ready to Find Your Next Ride?
                            </h2>

                            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400 sm:text-base lg:max-w-lg">
                                Explore the available vehicles and find a
                                ride that fits your next trip around Albay.
                            </p>
                        </div>

                        <div className="mt-8 flex shrink-0 flex-col justify-center gap-3 sm:flex-row lg:mt-0">
                            <Link to="/vehicles">
                                <Button
                                    variant="brand"
                                    size="lg"
                                    rightIcon={<ArrowRight size={18} />}
                                    className="w-full sm:w-auto"
                                >
                                    Browse Vehicles
                                </Button>
                            </Link>

                            {/* `!`: the outline variant's white background
                                would otherwise win over these. */}
                            <Link to="/contact">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="w-full border-gray-700! bg-transparent! text-white! hover:bg-gray-800! sm:w-auto"
                                >
                                    Contact Us
                                </Button>
                            </Link>
                        </div>
                    </motion.div>
                </PageContainer>
            </Section>
        </div>
    );
};

export default About;
