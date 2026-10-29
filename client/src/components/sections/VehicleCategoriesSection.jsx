import { useEffect } from "react";
import { motion } from "framer-motion";
import {
    ArrowRight,
    CarFront,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getVehicleCategories,
} from "../../store/categories/vehicleCategorySlice";

import {
    getVehicles,
} from "../../store/vehicles/vehicleSlice";

import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import PageContainer from "./PageContainer";
import Section from "./Section";
import SectionHeader from "./SectionHeader";

import PublicVehicleCard from "../cards/PublicVehicleCard";
import {
    BOOKABLE_VEHICLE_STATUS_FILTER,
    isVehicleBookable,
} from "../../constants/vehicleConstants";

const VehicleCategoriesSection = () => {
    const dispatch = useDispatch();

    const {
        vehicleCategories = [],
        loading: categoriesLoading = false,
        error: categoriesError = null,
    } = useSelector(
        (state) => state.categories ?? {}
    );

    const {
        vehicles = [],
        loading: vehiclesLoading = false,
        error: vehiclesError = null,
    } = useSelector(
        (state) => state.vehicles ?? {}
    );

    useEffect(() => {
        if (vehicleCategories.length === 0) {
            dispatch(
                getVehicleCategories({
                    status: "Active",
                })
            );
        }
    }, [
        dispatch,
        vehicleCategories.length,
    ]);

    useEffect(() => {
        if (vehicles.length === 0) {
            dispatch(
                getVehicles({
                    publicListing: true,
                    status: BOOKABLE_VEHICLE_STATUS_FILTER,
                })
            );
        }
    }, [
        dispatch,
        vehicles.length,
    ]);

    const activeCategories =
        vehicleCategories.filter(
            (category) =>
                category?.status === "Active"
        );

    const availableVehicles =
        vehicles.filter(
            (vehicle) => isVehicleBookable(vehicle)
        );

    const getCategoryId = (category) =>
        category?._id ??
        category?.id;

    const getVehicleCategoryId = (
        vehicle
    ) => {
        if (
            typeof vehicle?.category ===
            "string"
        ) {
            return vehicle.category;
        }

        return (
            vehicle?.category?._id ??
            vehicle?.category?.id ??
            vehicle?.categoryId ??
            null
        );
    };

    const categoriesWithVehicles =
        activeCategories
            .map((category) => {
                const categoryId =
                    getCategoryId(category);

                const categoryVehicles =
                    availableVehicles.filter(
                        (vehicle) =>
                            String(
                                getVehicleCategoryId(
                                    vehicle
                                )
                            ) ===
                            String(categoryId)
                    );

                return {
                    category,
                    vehicles: categoryVehicles,
                };
            })
            .filter(
                ({ vehicles }) =>
                    vehicles.length > 0
            )
            .slice(0, 8);

    const loading =
        categoriesLoading ||
        vehiclesLoading;

    const error =
        categoriesError ||
        vehiclesError;

    const hasCategories =
        activeCategories.length > 0;

    const hasVehicles =
        categoriesWithVehicles.length > 0;

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
                    eyebrow="Find Your Ride"
                    title="Browse by Vehicle Category"
                    subtitle="Choose the type of vehicle that best fits your trip, whether you need something practical, comfortable, or ready for your next adventure."
                />

                {loading && !hasCategories ? (
                    <div
                        className="
                            flex
                            min-h-[320px]
                            flex-col
                            items-center
                            justify-center
                            rounded-[2rem]
                            border
                            border-gray-200
                            bg-gray-50
                            dark:border-gray-700
                            dark:bg-gray-900
                        "
                    >
                        <LoadingSpinner />

                        <p
                            className="
                                mt-4
                                text-sm
                                font-medium
                                text-gray-500
                                dark:text-gray-400
                            "
                        >
                            Loading vehicle
                            categories...
                        </p>
                    </div>
                ) : error && !hasCategories ? (
                    <div
                        className="
                            flex
                            min-h-[300px]
                            items-center
                            justify-center
                            rounded-[2rem]
                            border
                            border-red-100
                            bg-red-50
                            px-6
                            text-center
                            dark:border-red-900/50
                            dark:bg-red-950/30
                        "
                    >
                        <div className="max-w-md">
                            <div
                                className="
                                    mx-auto
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-white
                                    text-red-500
                                    shadow-sm
                                    dark:bg-gray-900
                                    dark:text-red-400
                                "
                            >
                                <CarFront size={24} />
                            </div>

                            <h3
                                className="
                                    mt-5
                                    text-lg
                                    font-bold
                                    text-gray-900
                                    dark:text-white
                                "
                            >
                                Unable to load
                                vehicle categories
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
                                We couldn't load
                                the available
                                vehicles right
                                now. Please try
                                again later.
                            </p>
                        </div>
                    </div>
                ) : !hasCategories ? (
                    <div
                        className="
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-gray-200
                            bg-gray-50
                            dark:border-gray-700
                            dark:bg-gray-900
                        "
                    >
                        <EmptyState
                            icon={CarFront}
                            title="No vehicle categories available"
                            description="Vehicle categories will appear here once they are available."
                        />
                    </div>
                ) : !hasVehicles ? (
                    <div
                        className="
                            overflow-hidden
                            rounded-[2rem]
                            border
                            border-gray-200
                            bg-gray-50
                            dark:border-gray-700
                            dark:bg-gray-900
                        "
                    >
                        <EmptyState
                            icon={CarFront}
                            title="No vehicles available"
                            description="Vehicles will appear here once they are available for rental."
                        />
                    </div>
                ) : (
                    <>
                        <div className="space-y-14">
                            {categoriesWithVehicles.map(
                                ({
                                    category,
                                    vehicles:
                                        categoryVehicles,
                                }) => (
                                    /* A div, not a <section>: site-texture paints the innermost
                                        page <section>, which must stay the whole Categories section
                                        (a per-category section got its own dotted, glowing panel). */
                                    <motion.div
                                        key={
                                            category._id ??
                                            category.id
                                        }
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
                                            amount: 0.08,
                                        }}
                                        transition={{
                                            duration: 0.45,
                                            ease: "easeOut",
                                        }}
                                    >
                                        <div
                                            className="
                                                mb-6
                                                flex
                                                items-end
                                                justify-between
                                                gap-4
                                            "
                                        >
                                            <div>
                                                <p
                                                    className="
                                                        text-xs
                                                        font-semibold
                                                        uppercase
                                                        tracking-[0.18em]
                                                        text-yellow-600
                                                        dark:text-yellow-400
                                                    "
                                                >
                                                    {
                                                        category.vehicleType
                                                    }
                                                </p>

                                                <h3
                                                    className="
                                                        mt-1
                                                        text-2xl
                                                        font-bold
                                                        tracking-tight
                                                        text-gray-900
                                                        dark:text-white
                                                    "
                                                >
                                                    {
                                                        category.name
                                                    }
                                                </h3>
                                            </div>

                                            <Link
                                                to={`/vehicles?category=${category._id}`}
                                                className="
                                                    hidden
                                                    shrink-0
                                                    items-center
                                                    gap-1.5
                                                    text-sm
                                                    font-semibold
                                                    text-gray-500
                                                    transition-colors
                                                    hover:text-gray-900
                                                    sm:flex
                                                    dark:text-gray-400
                                                    dark:hover:text-white
                                                "
                                            >
                                                View Category

                                                <ArrowRight
                                                    size={16}
                                                />
                                            </Link>
                                        </div>

                                        <motion.div
                                            initial="hidden"
                                            whileInView="visible"
                                            viewport={{
                                                once: true,
                                                amount: 0.08,
                                            }}
                                            variants={{
                                                hidden: {},
                                                visible: {
                                                    transition: {
                                                        staggerChildren:
                                                            0.08,
                                                    },
                                                },
                                            }}
                                            className="
                                                grid
                                                grid-cols-1
                                                gap-6
                                                md:grid-cols-3
                                            "
                                        >
                                            {categoryVehicles
                                                .slice(0, 3)
                                                .map(
                                                    (
                                                        vehicle
                                                    ) => (
                                                        <motion.div
                                                            key={
                                                                vehicle._id ??
                                                                vehicle.id
                                                            }
                                                            variants={{
                                                                hidden: {
                                                                    opacity: 0,
                                                                    y: 28,
                                                                },
                                                                visible: {
                                                                    opacity: 1,
                                                                    y: 0,
                                                                    transition: {
                                                                        duration: 0.5,
                                                                        ease: "easeOut",
                                                                    },
                                                                },
                                                            }}
                                                        >
                                                            <PublicVehicleCard
                                                                vehicle={
                                                                    vehicle
                                                                }
                                                            />
                                                        </motion.div>
                                                    )
                                                )}
                                        </motion.div>
                                    </motion.div>
                                )
                            )}
                        </div>

                        <motion.div
                            initial={{
                                opacity: 0,
                                y: 12,
                            }}
                            whileInView={{
                                opacity: 1,
                                y: 0,
                            }}
                            viewport={{
                                once: true,
                            }}
                            transition={{
                                duration: 0.45,
                                delay: 0.15,
                            }}
                            className="
                                mt-12
                                flex
                                justify-center
                            "
                        >
                            <Link
                                to="/vehicles"
                                className="w-full sm:w-auto"
                            >
                                <Button
                                    variant="outline"
                                    size="lg"
                                    rightIcon={
                                        <ArrowRight
                                            size={18}
                                        />
                                    }
                                    className="
                                        w-full
                                        rounded-full
                                        px-7
                                        sm:w-auto
                                    "
                                >
                                    Browse All Vehicles
                                </Button>
                            </Link>
                        </motion.div>
                    </>
                )}
            </PageContainer>
        </Section>
    );
};

export default VehicleCategoriesSection;