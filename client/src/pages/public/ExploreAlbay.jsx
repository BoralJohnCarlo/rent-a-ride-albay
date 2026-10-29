import { useCallback, useEffect, useMemo, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowRight,
    Car,
    Clock,
    MapPin,
    Motorbike,
    RefreshCw,
    Route,
    Sun,
} from "lucide-react";
import { Link } from "react-router-dom";

import DestinationImage from "../../components/explore/DestinationImage";
import LightTexture from "../../components/sections/LightTexture";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";

import { DESTINATION_CATEGORIES } from "../../data/albayDestinations";
import { getPublicDestinations } from "../../api/destinationApi";

const RIDE_ICONS = {
    Car,
    Motorcycle: Motorbike,
};

const RIDE_LABELS = {
    Car: "car",
    Motorcycle: "motorcycle",
};

/* Small inline fact chip under the description. */
const FactChip = ({ icon: Icon, label, value }) =>
    value ? (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Icon
                size={12}
                className="shrink-0 text-yellow-600 dark:text-yellow-400"
                aria-hidden="true"
            />
            <span className="sr-only">{label}: </span>
            <span className="truncate">{value}</span>
        </span>
    ) : null;

/*
 * Compact destination card: the name, town and drive time sit on the photo
 * (so the body stays short), a two-line description, fact chips, and one
 * footer row pairing the ride suggestion with its "Find a …" link.
 */
const DestinationCard = ({ destination, index }) => {
    const RideIcon = RIDE_ICONS[destination.rideType] || Car;
    const rideLabel = RIDE_LABELS[destination.rideType] || "ride";
    const category = DESTINATION_CATEGORIES.find(
        (c) => c.key === destination.category
    );

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{
                duration: 0.35,
                delay: Math.min(index * 0.05, 0.3),
                ease: [0.22, 1, 0.36, 1],
            }}
            className="group flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900"
        >
            {/* Photo with the title overlaid */}
            <div className="relative overflow-hidden">
                <DestinationImage
                    destination={destination}
                    iconSize={34}
                    className="aspect-[16/10] transition-transform duration-500 group-hover:scale-105"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                <span className="absolute left-3 top-3 rounded-full bg-gray-950/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                    {category?.label}
                </span>

                {destination.driveTime && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-900 shadow-sm backdrop-blur-md">
                        <Clock size={12} aria-hidden="true" />
                        <span className="sr-only">Drive from Legazpi: </span>
                        {destination.driveTime}
                    </span>
                )}

                <div className="absolute inset-x-4 bottom-3">
                    <h2 className="text-lg font-extrabold leading-tight tracking-tight text-white drop-shadow">
                        {destination.name}
                    </h2>

                    {destination.town && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-white/85">
                            <MapPin size={12} aria-hidden="true" />
                            {destination.town}
                        </p>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col p-4">
                <p
                    className="line-clamp-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
                    title={destination.blurb}
                >
                    {destination.blurb}
                </p>

                {(destination.road || destination.bestTime) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <FactChip
                            icon={Route}
                            label="Road"
                            value={destination.road}
                        />
                        <FactChip
                            icon={Sun}
                            label="Best time"
                            value={destination.bestTime}
                        />
                    </div>
                )}

                {/* Ride suggestion + action, one row */}
                <div className="mt-auto flex items-center gap-3 border-t border-gray-100 pt-3.5 dark:border-gray-800">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-gray-950">
                        <RideIcon size={17} aria-hidden="true" />
                    </span>

                    <div
                        className="min-w-0 flex-1"
                        title={destination.rideNote || undefined}
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                            Best by {rideLabel}
                        </p>
                        {destination.rideNote && (
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {destination.rideNote}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </motion.article>
    );
};

const CardSkeleton = () => (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="aspect-[16/10] animate-pulse bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-3 p-4">
            <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800/70" />
            <div className="h-9 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/70" />
        </div>
    </div>
);

const ExploreAlbay = () => {
    const [activeCategory, setActiveCategory] = useState("all");
    const [allDestinations, setAllDestinations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);

        try {
            const response = await getPublicDestinations();
            setAllDestinations(response?.data?.destinations ?? []);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const destinations = useMemo(
        () =>
            activeCategory === "all"
                ? allDestinations
                : allDestinations.filter(
                      (d) => d.category === activeCategory
                  ),
        [activeCategory, allDestinations]
    );

    /* Only offer categories that have at least one destination. */
    const chips = [
        { key: "all", label: "All" },
        ...DESTINATION_CATEGORIES.filter((category) =>
            allDestinations.some((d) => d.category === category.key)
        ),
    ];

    return (
        <main className="relative isolate bg-gray-50 dark:bg-gray-950">
            <LightTexture
                accent="yellow"
                decorOnly
                className="inset-x-0 top-0 -z-10 h-[48rem]"
            />

            <Section spacing="XL" className="pt-24 sm:pt-28">
                <PageContainer>
                    <div className="text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-600 dark:text-yellow-400">
                            Explore Albay
                        </p>

                        <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl dark:text-white">
                            Stunning Views.{" "}
                            <span className="text-yellow-500">
                                Endless Adventures.
                            </span>
                        </h1>

                        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-500 sm:text-lg dark:text-gray-300">
                            Where to go around Albay — and the ride that
                            gets you there best.
                        </p>
                    </div>

                    {/* Category filter */}
                    <div
                        role="tablist"
                        aria-label="Destination categories"
                        className="mt-8 flex flex-wrap justify-center gap-2"
                    >
                        {chips.map((chip) => {
                            const active = activeCategory === chip.key;

                            return (
                                <button
                                    key={chip.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() =>
                                        setActiveCategory(chip.key)
                                    }
                                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                        active
                                            ? "text-gray-950"
                                            : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-gray-900 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800 dark:hover:text-white"
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="explore-chip"
                                            transition={{
                                                type: "spring",
                                                stiffness: 420,
                                                damping: 32,
                                            }}
                                            className="absolute inset-0 rounded-full bg-yellow-400"
                                        />
                                    )}
                                    <span className="relative">
                                        {chip.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Destinations */}
                    {loading ? (
                        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {[0, 1, 2].map((item) => (
                                <CardSkeleton key={item} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="mx-auto mt-8 flex max-w-md flex-col items-center rounded-3xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                                We couldn't load the destinations.
                            </p>
                            <button
                                type="button"
                                onClick={() => load()}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100 dark:bg-gray-900 dark:text-red-300 dark:ring-red-900"
                            >
                                <RefreshCw size={15} aria-hidden="true" />
                                Try again
                            </button>
                        </div>
                    ) : allDestinations.length === 0 ? (
                        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
                            <MapPin
                                size={28}
                                className="mx-auto text-gray-400"
                                aria-hidden="true"
                            />
                            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                                Destinations are coming soon
                            </p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                In the meantime, browse our vehicles for your
                                next trip.
                            </p>
                        </div>
                    ) : (
                        <motion.div
                            layout
                            className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
                        >
                            <AnimatePresence mode="popLayout">
                                {destinations.map((destination, index) => (
                                    <DestinationCard
                                        key={destination._id}
                                        destination={destination}
                                        index={index}
                                    />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
                        Drive times are approximate, from Legazpi City, and
                        vary with traffic and weather.
                    </p>

                    {/* Closing CTA */}
                    <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-gray-950 px-6 py-10 text-center shadow-xl sm:px-10 dark:bg-gray-900 dark:ring-1 dark:ring-gray-800">
                        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                            Ready to hit the road?
                        </h2>
                        <p className="max-w-lg text-sm leading-6 text-gray-400">
                            Pick your dates and see which cars and
                            motorcycles are free for your trip.
                        </p>
                        <Link
                            to="/available"
                            className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-yellow-400"
                        >
                            Check availability
                            <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </div>
                </PageContainer>
            </Section>
        </main>
    );
};

export default ExploreAlbay;
