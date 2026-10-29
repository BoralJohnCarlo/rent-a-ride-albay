import { useEffect, useMemo, useState } from "react";

import { motion, useReducedMotion } from "framer-motion";
import { Quote, Star } from "lucide-react";

import Avatar from "../common/Avatar";
import LightTexture from "./LightTexture";
import PageContainer from "./PageContainer";
import Section from "./Section";

import { getPublicTestimonials } from "../../api/testimonialApi";

// Masonry columns for the cards under the spotlight — fewer columns when
// there are only one or two so they don't sit in a mostly-empty row.
const COLUMN_CLASSES = {
    1: "mx-auto max-w-xl columns-1",
    2: "mx-auto max-w-4xl columns-1 md:columns-2",
};

const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" },
    },
};

const Stars = ({ rating = 5, size = 15 }) => (
    <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`${rating} out of 5 stars`}
    >
        {Array.from({ length: 5 }, (_, index) => (
            <Star
                key={index}
                size={size}
                fill={index < rating ? "currentColor" : "none"}
                strokeWidth={1.5}
                className={
                    index < rating
                        ? "text-yellow-500 dark:text-yellow-400"
                        : "text-gray-300 dark:text-gray-600"
                }
            />
        ))}
    </div>
);

const Person = ({ name, role, avatar, size = "sm" }) => (
    <div className="flex min-w-0 items-center gap-3">
        <Avatar
            src={avatar || undefined}
            name={name}
            size={size}
            className="ring-2 ring-yellow-400/40 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
        />

        <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {name}
            </p>

            {role && (
                <p className="mt-0.5 truncate text-xs font-medium text-gray-500 dark:text-gray-400">
                    {role}
                </p>
            )}
        </div>
    </div>
);

/* -------------------------------------------------------------------------- */

const TestimonialsSection = () => {
    // Managed in Admin → Settings → Testimonials.
    const [testimonials, setTestimonials] = useState([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getPublicTestimonials()
            .then((response) => {
                if (!cancelled) setTestimonials(response?.data ?? []);
            })
            .catch(() => {
                if (!cancelled) setTestimonials([]);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const averageRating = useMemo(() => {
        if (!testimonials.length) return 0;

        const total = testimonials.reduce(
            (sum, item) => sum + (Number(item.rating) || 5),
            0
        );

        return Math.round((total / testimonials.length) * 10) / 10;
    }, [testimonials]);

    // Nothing to show → hide the whole section rather than an empty block.
    if (!loaded || testimonials.length === 0) {
        return null;
    }

    const [spotlight, ...rest] = testimonials;

    const columnClasses =
        COLUMN_CLASSES[rest.length] ??
        "columns-1 md:columns-2 lg:columns-3";

    return (
        <Section
            spacing="XL"
            className="
                relative
                isolate
                overflow-hidden
                bg-gradient-to-b
                from-white
                via-yellow-50/30
                to-white
                dark:bg-none
                dark:bg-gray-950
            "
        >
            {/* ------------------------- background ------------------------- */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10"
            >
                <LightTexture accent="yellow" />

                {/* Dark atmosphere — same language as the Featured section */}
                <div className="absolute -right-40 -top-40 hidden h-[28rem] w-[28rem] rounded-full bg-yellow-500/15 blur-3xl dark:block" />
                <div className="absolute -bottom-48 -left-20 hidden h-[26rem] w-[26rem] rounded-full bg-blue-500/10 blur-3xl dark:block" />
                <div className="absolute inset-0 hidden bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)] dark:block" />

                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-300/60 to-transparent dark:via-white/10" />
            </div>

            <PageContainer>
                {/* --------------------------- header --------------------------- */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-12 flex flex-col items-center text-center"
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-800 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-300">
                        <Quote size={12} />
                        Customer Experiences
                    </span>

                    <h2 className="mt-5 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                        What our{" "}
                        <span className="text-yellow-500 dark:text-yellow-400">
                            customers
                        </span>{" "}
                        say
                    </h2>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300 sm:text-base">
                        Real stories from people who rented with
                        Rent-A-Ride Albay for trips, errands, and
                        everything in between.
                    </p>

                    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">
                            {averageRating.toFixed(1)}
                        </span>

                        <div className="text-left">
                            <Stars
                                rating={Math.round(averageRating)}
                                size={14}
                            />
                            <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                from {testimonials.length}{" "}
                                {testimonials.length === 1
                                    ? "testimonial"
                                    : "testimonials"}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* -------------------------- spotlight ------------------------- */}
                <SpotlightCard testimonial={spotlight} />

                {/* ---------------------------- the rest ------------------------ */}
                {rest.length > 0 && (
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.1 }}
                        variants={{
                            hidden: {},
                            visible: {
                                transition: { staggerChildren: 0.08 },
                            },
                        }}
                        className={`mt-6 gap-6 ${columnClasses}`}
                    >
                        {rest.map((testimonial) => (
                            <TestimonialCard
                                key={testimonial._id}
                                testimonial={testimonial}
                            />
                        ))}
                    </motion.div>
                )}
            </PageContainer>
        </Section>
    );
};

/* -------------------------------------------------------------------------- */

const SpotlightCard = ({
    testimonial: { name, role, rating = 5, message, avatar, photo },
}) => (
    <motion.article
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={cardVariants}
        className={`
            relative
            mx-auto
            grid
            max-w-5xl
            overflow-hidden
            rounded-[2rem]
            border
            border-gray-200
            bg-white
            shadow-[0_24px_70px_-35px_rgba(15,23,42,0.3)]
            dark:border-gray-800
            dark:bg-gray-900
            dark:shadow-black/40
            ${photo ? "md:grid-cols-[2fr_3fr]" : ""}
        `}
    >
        {photo && (
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800 md:aspect-auto">
                <img
                    src={photo}
                    alt={`Photo shared by ${name}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent md:bg-gradient-to-r md:from-transparent md:to-black/10" />
            </div>
        )}

        <div className="relative flex flex-col justify-between p-7 sm:p-10">
            {/* Oversized decorative quote mark */}
            <Quote
                aria-hidden="true"
                size={120}
                strokeWidth={1}
                className="pointer-events-none absolute -right-2 -top-4 text-yellow-400/15 dark:text-yellow-400/10"
            />

            <div className="relative">
                <Stars rating={rating} size={18} />

                <blockquote className="mt-5 whitespace-pre-line text-lg font-medium leading-8 text-gray-800 dark:text-gray-100 sm:text-xl sm:leading-9">
                    “{message}”
                </blockquote>
            </div>

            <div className="relative mt-8 flex items-center justify-between gap-4 border-t border-gray-100 pt-6 dark:border-gray-800">
                <Person
                    name={name}
                    role={role}
                    avatar={avatar}
                    size="md"
                />

                <span className="hidden shrink-0 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300 sm:inline-flex">
                    Featured story
                </span>
            </div>
        </div>
    </motion.article>
);

const TestimonialCard = ({
    testimonial: { name, role, rating = 5, message, avatar, photo },
}) => {
    const reduceMotion = useReducedMotion();

    return (
        <motion.article
            variants={cardVariants}
            whileHover={reduceMotion ? undefined : { y: -4 }}
            className="
                group
                relative
                mb-6
                break-inside-avoid
                overflow-hidden
                rounded-3xl
                border
                border-gray-200
                bg-white/90
                shadow-sm
                backdrop-blur-sm
                transition-[border-color,box-shadow]
                duration-300
                hover:border-yellow-300
                hover:shadow-lg
                hover:shadow-yellow-500/10
                dark:border-gray-800
                dark:bg-gray-900/90
                dark:hover:border-yellow-400/30
            "
        >
            {/* Accent bar that grows in on hover */}
            <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 z-10 h-1 origin-left scale-x-0 bg-gradient-to-r from-yellow-400 to-yellow-500 transition-transform duration-300 group-hover:scale-x-100"
            />

            {photo && (
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                        src={photo}
                        alt={`Photo shared by ${name}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                </div>
            )}

            <div className="relative p-6">
                <Quote
                    aria-hidden="true"
                    size={56}
                    strokeWidth={1}
                    className="pointer-events-none absolute right-4 top-3 text-yellow-400/20 dark:text-yellow-400/10"
                />

                <Stars rating={rating} />

                <p className="relative mt-4 whitespace-pre-line text-sm leading-7 text-gray-600 dark:text-gray-300">
                    “{message}”
                </p>

                <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
                    <Person name={name} role={role} avatar={avatar} />
                </div>
            </div>
        </motion.article>
    );
};

export default TestimonialsSection;
