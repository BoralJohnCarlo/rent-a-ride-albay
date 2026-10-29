import { motion } from "framer-motion";
import {
    CarFront,
    Clock3,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
} from "lucide-react";

import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";
import SectionHeader from "../../components/sections/SectionHeader";

const contactItems = [
    {
        icon: MapPin,
        title: "Location",
        value: "Albay, Philippines",
        description:
            "Serving customers looking for convenient vehicle rentals around Albay.",
    },
    {
        icon: MessageCircle,
        title: "Rental Inquiries",
        value: "Vehicle Rental Support",
        description:
            "Contact the Rent-A-Ride Albay team regarding vehicle availability and rental concerns.",
    },
    {
        icon: Mail,
        title: "Customer Support",
        value: "Support & Assistance",
        description:
            "Get assistance with questions regarding the rental process and your transactions.",
    },
    {
        icon: Clock3,
        title: "Availability",
        value: "Online Platform",
        description:
            "The system is designed to be accessible through internet-enabled devices.",
    },
];

const Contact = () => {
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
                        className="mx-auto max-w-3xl text-center"
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
                            Get in Touch
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
                            Contact Rent-A-Ride
                            <span className="text-yellow-500">
                                {" "}
                                Albay
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
                                dark:text-gray-300
                                sm:text-lg
                            "
                        >
                            Have questions about vehicle rentals,
                            availability, or the rental process?
                            Learn how Rent-A-Ride Albay can assist
                            you with your next trip.
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
                        {contactItems.map(
                            ({
                                icon: Icon,
                                title,
                                value,
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

                                    <h2
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
                                    </h2>

                                    <p
                                        className="
                                            mt-2
                                            text-sm
                                            font-semibold
                                            text-gray-700
                                            dark:text-gray-200
                                        "
                                    >
                                        {value}
                                    </p>

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
                    bg-gray-50
                    dark:bg-gray-950
                "
            >
                <PageContainer>
                    <div
                        className="
                            grid
                            grid-cols-1
                            gap-10
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
                                eyebrow="Rental Assistance"
                                title="We're Here to Help"
                                subtitle="Rent-A-Ride Albay is designed to make vehicle rental more organized and convenient for customers."
                                align="CENTER"
                            />

                            <div className="mt-7 space-y-4">
                                <div
                                    className="
                                        flex
                                        items-start
                                        gap-4
                                        rounded-2xl
                                        border
                                        border-gray-200
                                        bg-white
                                        p-5
                                        dark:border-gray-800
                                        dark:bg-gray-900
                                    "
                                >
                                    <div
                                        className="
                                            flex
                                            h-10
                                            w-10
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
                                        <CarFront
                                            size={20}
                                            strokeWidth={1.8}
                                        />
                                    </div>

                                    <div>
                                        <h3
                                            className="
                                                font-bold
                                                text-gray-900
                                                dark:text-white
                                            "
                                        >
                                            Looking for a vehicle?
                                        </h3>

                                        <p
                                            className="
                                                mt-1
                                                text-sm
                                                leading-6
                                                text-gray-500
                                                dark:text-gray-400
                                            "
                                        >
                                            Browse the available
                                            vehicles and explore
                                            your rental options.
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className="
                                        flex
                                        items-start
                                        gap-4
                                        rounded-2xl
                                        border
                                        border-gray-200
                                        bg-white
                                        p-5
                                        dark:border-gray-800
                                        dark:bg-gray-900
                                    "
                                >
                                    <div
                                        className="
                                            flex
                                            h-10
                                            w-10
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
                                        <Phone
                                            size={20}
                                            strokeWidth={1.8}
                                        />
                                    </div>

                                    <div>
                                        <h3
                                            className="
                                                font-bold
                                                text-gray-900
                                                dark:text-white
                                            "
                                        >
                                            Need assistance?
                                        </h3>

                                        <p
                                            className="
                                                mt-1
                                                text-sm
                                                leading-6
                                                text-gray-500
                                                dark:text-gray-400
                                            "
                                        >
                                            Reach out regarding
                                            questions about the
                                            rental process,
                                            availability, or
                                            other concerns.
                                        </p>
                                    </div>
                                </div>
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
                                bg-gray-950
                                p-7
                                shadow-xl
                                dark:bg-black
                                sm:p-9
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
                                    bg-yellow-500
                                    text-gray-950
                                "
                            >
                                <MapPin
                                    size={28}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <h2
                                className="
                                    mt-6
                                    text-2xl
                                    font-black
                                    tracking-tight
                                    text-white
                                "
                            >
                                Rent-A-Ride Albay
                            </h2>

                            <p
                                className="
                                    mt-3
                                    text-sm
                                    leading-6
                                    text-gray-400
                                "
                            >
                                A local vehicle rental platform
                                designed around the needs of
                                customers traveling around Albay.
                            </p>

                            <div
                                className="
                                    mt-7
                                    border-t
                                    border-gray-800
                                    pt-6
                                "
                            >
                                <div className="flex items-start gap-3">
                                    <MapPin
                                        size={19}
                                        className="
                                            mt-0.5
                                            shrink-0
                                            text-yellow-500
                                        "
                                    />

                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            Location
                                        </p>

                                        <p className="mt-1 text-sm text-gray-400">
                                            Albay, Philippines
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-5 flex items-start gap-3">
                                    <MessageCircle
                                        size={19}
                                        className="
                                            mt-0.5
                                            shrink-0
                                            text-yellow-500
                                        "
                                    />

                                    <div>
                                        <p className="text-sm font-semibold text-white">
                                            Rental Inquiries
                                        </p>

                                        <p className="mt-1 text-sm text-gray-400">
                                            Contact the team for
                                            rental assistance.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </PageContainer>
            </Section>
        </>
    );
};

export default Contact;