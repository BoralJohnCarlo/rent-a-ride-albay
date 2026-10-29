import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CarFront, Sparkles } from "lucide-react";

import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import SwapLayer from "../common/SwapLayer";
import { SLIDE_LEFT_SWAP } from "../../constants/swapAnimations";
import LightTexture from "./LightTexture";
import PageContainer from "./PageContainer";
import Section from "./Section";
import SectionHeader from "./SectionHeader";

import FeaturedVehicleCarousel from "../vehicle/FeaturedVehicleCarousel";
import { getVehicles } from "../../api/vehicleApi";
import {
    BOOKABLE_VEHICLE_STATUS_FILTER,
    isVehicleBookable,
} from "../../constants/vehicleConstants";

/*
 * Loads its own featured list rather than reading the shared `vehicles`
 * store. That store is overwritten by other pages (admin fleet tabs, a
 * partner's own vehicles) and its loading/error flags are shared with
 * unrelated requests, so a failed vehicle-details load left this section
 * stuck on "Unable to load featured vehicles".
 */
const FeaturedVehiclesSection = () => {
    const [featuredVehicles, setFeaturedVehicles] =
        useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    /* The showcase plays its exit whenever it scrolls (mostly) out of view
       — above or below — and its entrance each time it comes back. The ref
       sits on an always-rendered wrapper so it's observed from the start,
       not only once the vehicles have loaded. */
    const showcaseRef = useRef(null);
    const showcaseInView = useInView(showcaseRef, { amount: 0.3 });
    const reduceMotion = useReducedMotion();
    const showcaseHidden = !reduceMotion && !showcaseInView;

    useEffect(() => {
        let cancelled = false;

        getVehicles({
            publicListing: true,
            isFeatured: true,
            status: BOOKABLE_VEHICLE_STATUS_FILTER,
        })
            .then((response) => {
                if (cancelled) {
                    return;
                }

                const vehicles = Array.isArray(response?.data)
                    ? response.data
                    : [];

                setFeaturedVehicles(
                    vehicles.filter(
                        (vehicle) =>
                            vehicle?.isFeatured === true &&
                            isVehicleBookable(vehicle)
                    )
                );
            })
            .catch((requestError) => {
                if (!cancelled) {
                    setError(
                        requestError?.response?.data?.message ||
                            "Unable to load featured vehicles."
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <Section
            spacing="XL"
            className="
                relative
                overflow-hidden
                bg-gradient-to-b
                from-slate-50
                via-white
                to-blue-50/40
                dark:bg-none
                dark:bg-gray-950
            "
        >
            {/* =========================================================
                BACKGROUND ATMOSPHERE
                Everything in this layer stays behind the content.
            ========================================================== */}
            <div
                aria-hidden="true"
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    z-0
                    overflow-hidden
                "
            >
                {/* Ambient glows (light) */}
                <div
                    className="
                        absolute
                        -left-40
                        top-20
                        h-96
                        w-96
                        rounded-full
                        bg-blue-400/10
                        blur-[100px]
                        dark:hidden
                    "
                />

                <div
                    className="
                        absolute
                        -right-40
                        top-1/3
                        h-[30rem]
                        w-[30rem]
                        rounded-full
                        bg-sky-300/10
                        blur-[110px]
                        dark:hidden
                    "
                />

                {/* Dark atmosphere — matches the /available hero:
                    yellow glow top-left, blue glow bottom-right,
                    masked dot grid. */}
                <div
                    className="
                        absolute
                        -left-40
                        -top-40
                        hidden
                        h-[28rem]
                        w-[28rem]
                        rounded-full
                        bg-yellow-500/20
                        blur-3xl
                        dark:block
                    "
                />

                <div
                    className="
                        absolute
                        -bottom-48
                        right-0
                        hidden
                        h-[26rem]
                        w-[26rem]
                        rounded-full
                        bg-blue-500/10
                        blur-3xl
                        dark:block
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        hidden
                        bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]
                        [background-size:22px_22px]
                        [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]
                        dark:block
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        hidden
                        bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_55%)]
                        dark:block
                    "
                />

                {/* Dot texture (light) */}
                <div
                    className="
                        absolute
                        inset-0
                        opacity-[0.48]
                        dark:hidden
                    "
                    style={{
                        backgroundImage: `
                            radial-gradient(
                                circle at 1px 1px,
                                rgba(30, 64, 175, 0.11) 1px,
                                transparent 0
                            )
                        `,
                        backgroundSize: "30px 30px",
                    }}
                />

                {/* Grid, grain, rings, striped corner (light) */}
                <LightTexture accent="blue" />

                {/* Top accent */}
                <div
                    className="
                        absolute
                        inset-x-0
                        top-0
                        h-px
                        bg-gradient-to-r
                        from-transparent
                        via-blue-300/70
                        to-transparent
                        dark:via-white/10
                    "
                />
            </div>

            {/* =========================================================
                CONTENT
            ========================================================== */}
            <PageContainer className="relative z-10 min-w-0">
                {/* Section header */}
                <div className="mb-10">
                    <SectionHeader
                        eyebrow="Our Fleet"
                        title="Featured Vehicles"
                        subtitle="Explore some of our featured vehicles, carefully selected to make your next trip around Albay comfortable and convenient."
                    />
                </div>

                <div ref={showcaseRef}>
                {/* =====================================================
                    LOADING
                ====================================================== */}
                {loading ? (
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 18,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        className="
                            relative
                            flex
                            min-h-[420px]
                            flex-col
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-slate-200/80
                            bg-white/80
                            shadow-[0_24px_70px_-35px_rgba(15,23,42,0.28)]
                            backdrop-blur-sm
                            dark:border-gray-800
                            dark:bg-gray-900/80
                        "
                    >
                        <div
                            aria-hidden="true"
                            className="
                                absolute
                                left-1/2
                                top-1/2
                                h-56
                                w-56
                                -translate-x-1/2
                                -translate-y-1/2
                                rounded-full
                                bg-blue-500/10
                                blur-3xl
                            "
                        />

                        <div
                            className="
                                relative
                                z-10
                                flex
                                flex-col
                                items-center
                            "
                        >
                            <div
                                className="
                                    flex
                                    h-16
                                    w-16
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    border
                                    border-blue-100
                                    bg-blue-50
                                    text-blue-600
                                    shadow-sm
                                    dark:border-blue-900/50
                                    dark:bg-blue-950/50
                                    dark:text-blue-400
                                "
                            >
                                <CarFront
                                    size={28}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <LoadingSpinner />

                            <p
                                className="
                                    mt-4
                                    text-sm
                                    font-semibold
                                    text-slate-600
                                    dark:text-gray-300
                                "
                            >
                                Loading featured vehicles...
                            </p>
                        </div>
                    </motion.div>
                ) : error ? (
                    /* =================================================
                       ERROR
                    ================================================== */
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 18,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        className="
                            relative
                            flex
                            min-h-[340px]
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-red-100
                            bg-white
                            px-6
                            text-center
                            shadow-[0_24px_70px_-40px_rgba(15,23,42,0.25)]
                            dark:border-red-900/40
                            dark:bg-gray-900
                        "
                    >
                        <div
                            aria-hidden="true"
                            className="
                                absolute
                                -right-24
                                -top-24
                                h-64
                                w-64
                                rounded-full
                                bg-red-100/60
                                blur-3xl
                                dark:bg-red-900/20
                            "
                        />

                        <div
                            className="
                                relative
                                z-10
                                max-w-md
                            "
                        >
                            <div
                                className="
                                    mx-auto
                                    flex
                                    h-16
                                    w-16
                                    items-center
                                    justify-center
                                    rounded-2xl
                                    bg-red-50
                                    text-red-500
                                    dark:bg-red-950/40
                                    dark:text-red-400
                                "
                            >
                                <CarFront
                                    size={28}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <p
                                className="
                                    mt-5
                                    text-lg
                                    font-bold
                                    text-gray-900
                                    dark:text-white
                                "
                            >
                                Unable to load featured vehicles
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
                                We couldn't load the featured vehicles
                                right now. Please try again later.
                            </p>
                        </div>
                    </motion.div>
                ) : featuredVehicles.length === 0 ? (
                    /* =================================================
                       EMPTY
                    ================================================== */
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 18,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        className="
                            relative
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-slate-200/80
                            bg-white/80
                            shadow-[0_24px_70px_-35px_rgba(15,23,42,0.25)]
                            backdrop-blur-sm
                            dark:border-gray-800
                            dark:bg-gray-900/80
                        "
                    >
                        <EmptyState
                            icon={CarFront}
                            title="No featured vehicles yet"
                            description="Our featured vehicles will appear here once they are available."
                        />
                    </motion.div>
                ) : (
                    /* =================================================
                       FEATURED VEHICLE SHOWCASE
                       
                       IMPORTANT:
                       There is intentionally NO fixed-height rectangle
                       around the carousel here.

                       FeaturedVehicleCarousel.jsx owns the image
                       rectangle.

                       No entrance on the wrapper: each piece enters and
                       exits on its own (showcaseHidden).
                    ================================================== */
                    <div
                        className="
                            relative
                            min-w-0
                            w-full
                        "
                    >
                        {/* Soft glow behind carousel */}
                        <div
                            aria-hidden="true"
                            className="
                                pointer-events-none
                                absolute
                                left-1/2
                                top-1/2
                                h-72
                                w-3/4
                                -translate-x-1/2
                                -translate-y-1/2
                                rounded-full
                                bg-blue-500/[0.07]
                                blur-[100px]
                                dark:bg-blue-500/[0.08]
                            "
                        />

                        {/* Small featured label — leaves with the left column */}
                        <SwapLayer
                            swap={SLIDE_LEFT_SWAP}
                            hidden={showcaseHidden}
                            className="
                                pointer-events-none
                                absolute
                                left-0
                                top-0
                                z-30
                                hidden
                                items-center
                                gap-2
                                rounded-full
                                border
                                border-white/90
                                bg-white/75
                                px-3
                                py-1.5
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-[0.16em]
                                text-slate-600
                                shadow-sm
                                backdrop-blur-md
                                sm:flex
                                dark:border-gray-700/80
                                dark:bg-gray-900/70
                                dark:text-gray-300
                            "
                        >
                            <Sparkles
                                size={11}
                                className="text-blue-500"
                            />

                            Featured Fleet
                        </SwapLayer>

                        {/* =================================================
                            CAROUSEL

                            No outer image rectangle here.
                            The image container is inside
                            FeaturedVehicleCarousel.jsx.
                        ================================================== */}
                        <div
                            className="
                                relative
                                z-10
                                min-w-0
                                w-full
                                px-0
                                pt-5
                                sm:pt-6
                            "
                        >
                            <FeaturedVehicleCarousel
                                vehicles={featuredVehicles.slice(
                                    0,
                                    6
                                )}
                                hidden={showcaseHidden}
                            />
                        </div>
                    </div>
                )}
                </div>
            </PageContainer>
        </Section>
    );
};

export default FeaturedVehiclesSection;