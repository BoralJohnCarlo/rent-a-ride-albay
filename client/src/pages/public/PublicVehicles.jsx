import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ChevronRight,
    ImageOff,
    LayoutGrid,
    List,
    Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import {
    getVehicles,
} from "../../store/vehicles/vehicleSlice";

import Button from "../../components/common/Button";
import PillSearch from "../../components/common/PillSearch";
import Select from "../../components/common/Select";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import LightTexture from "../../components/sections/LightTexture";
import PageContainer from "../../components/sections/PageContainer";
import Section from "../../components/sections/Section";
import ViewSwitcher from "../../components/common/ViewSwitcher";
import FeaturedVehicleCard from "../../components/vehicle/FeaturedVehicleCard";
import VehicleRating from "../../components/vehicle/VehicleRating";
import Badge from "../../components/common/Badge";
import Price from "../../components/common/Price";
import PriceRangeSlider from "../../components/search/PriceRangeSlider";
import useVehicleCategory from "../../hooks/categories";

import getVehicleCardData from "../../utils/getVehicleCardData";
import { getEffectiveDailyRate } from "../../utils/vehicleDiscount";
import { trackCardSpotlight } from "../../utils/spotlightHover";
import DiscountBadge from "../../components/vehicle/DiscountBadge";
import OriginalPrice from "../../components/vehicle/OriginalPrice";
import {
    BOOKABLE_VEHICLE_STATUS_FILTER,
    isVehicleBookable,
} from "../../constants/vehicleConstants";

const VEHICLE_TYPE_OPTIONS = [
    { value: "", label: "All vehicle types" },
    { value: "Car", label: "Cars" },
    { value: "Motorcycle", label: "Motorcycles" },
];

const VEHICLE_SORT_OPTIONS = [
    { value: "default", label: "Recommended" },
    { value: "rating-desc", label: "Most rated" },
    { value: "bookings-desc", label: "Most bookings" },
];

const PublicVehicles = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const {
        vehicles = [],
        loading = false,
        error = null,
    } = useSelector(
        (state) =>
            state.vehicles ??
            state.vehicle ??
            {}
    );

    const [search, setSearch] =
        useState("");

    const [vehicleType, setVehicleType] =
        useState("");

    const [category, setCategory] = useState("");

    const [seatRange, setSeatRange] = useState([2, 2]);
    const [seatRangeTouched, setSeatRangeTouched] = useState(false);

    const [priceRange, setPriceRange] = useState([0, 5000]);

    const [priceTouched, setPriceTouched] = useState(false);

    const [sortBy, setSortBy] = useState("default");

    const [viewMode, setViewMode] =
        useState("cards");

    const { vehicleCategories = [], getVehicleCategories } =
        useVehicleCategory();

    useEffect(() => {
        getVehicleCategories();
        dispatch(
            getVehicles({
                publicListing: true,
                // Reserved or out on a rental can still take other dates.
                status: BOOKABLE_VEHICLE_STATUS_FILTER,
                includeRatings: true,
                includeBookingCounts: true,
            })
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const activeCategories = useMemo(
        () =>
            vehicleCategories
                .filter((item) => item.status === "Active")
                .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
        [vehicleCategories]
    );

    const priceCeiling = useMemo(() => {
        const maxPrice = vehicles.reduce(
            (max, vehicle) =>
                Math.max(
                    max,
                    getEffectiveDailyRate(vehicle) +
                        (Number(vehicle?.pricing?.reservationFee) || 0)
                ),
            0
        );
        return maxPrice ? Math.ceil(maxPrice / 500) * 500 : 5000;
    }, [vehicles]);

    useEffect(() => {
        if (!priceTouched) setPriceRange([0, priceCeiling]);
    }, [priceCeiling, priceTouched]);

    const maxSeats = useMemo(
        () =>
            Math.max(
                2,
                ...vehicles
                    .map((vehicle) => Number(vehicle?.specifications?.seatingCapacity))
                    .filter((seats) => Number.isFinite(seats))
            ),
        [vehicles]
    );

    useEffect(() => {
        if (!seatRangeTouched) setSeatRange([2, maxSeats]);
    }, [maxSeats, seatRangeTouched]);

    const filteredVehicles = useMemo(() => {
        const normalizedSearch =
            search.trim().toLowerCase();

        const filtered = vehicles.filter((vehicle) => {
            if (!isVehicleBookable(vehicle)) {
                return false;
            }

            if (
                vehicleType &&
                vehicle?.vehicleType !==
                    vehicleType
            ) {
                return false;
            }

            if (
                category &&
                (vehicle?.category?._id ?? vehicle?.category) !== category
            ) {
                return false;
            }

            const seats = Number(vehicle?.specifications?.seatingCapacity);
            if (
                !Number.isFinite(seats) ||
                seats < seatRange[0] ||
                seats > seatRange[1]
            ) {
                return false;
            }

            // The price the customer sees (after any running discount).
            const totalDailyPrice =
                getEffectiveDailyRate(vehicle) +
                (Number(vehicle?.pricing?.reservationFee) || 0);
            if (
                totalDailyPrice < priceRange[0] ||
                totalDailyPrice > priceRange[1]
            ) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const searchableText = [
                vehicle?.brand,
                vehicle?.model,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(
                normalizedSearch
            );
        });

        if (sortBy === "rating-desc") {
            return [...filtered].sort((a, b) => {
                const reviewDifference =
                    (Number(b?.rating?.reviewCount) || 0) -
                    (Number(a?.rating?.reviewCount) || 0);
                if (reviewDifference !== 0) return reviewDifference;
                return (
                    (Number(b?.rating?.averageRating) || 0) -
                    (Number(a?.rating?.averageRating) || 0)
                );
            });
        }

        if (sortBy === "bookings-desc") {
            return [...filtered].sort((a, b) => {
                const bookingDifference =
                    (Number(b?.bookingCount) || 0) -
                    (Number(a?.bookingCount) || 0);
                if (bookingDifference !== 0) return bookingDifference;
                return (
                    (Number(b?.rating?.averageRating) || 0) -
                    (Number(a?.rating?.averageRating) || 0)
                );
            });
        }

        return filtered;
    }, [
        vehicles,
        search,
        vehicleType,
        category,
        seatRange,
        priceRange,
        sortBy,
    ]);

    const clearFilters = () => {
        setSearch("");
        setVehicleType("");
        setCategory("");
        setSeatRange([2, maxSeats]);
        setSeatRangeTouched(false);
        setSortBy("default");
        setPriceRange([0, priceCeiling]);
        setPriceTouched(false);
    };

    const hasActiveFilters = Boolean(
        search.trim() ||
            category ||
            vehicleType ||
            seatRangeTouched ||
            priceTouched ||
            sortBy !== "default"
    );

    return (
        <main className="relative isolate bg-gray-50 dark:bg-gray-950">
            <LightTexture
                accent="yellow"
                decorOnly
                className="inset-x-0 top-0 -z-10 h-[48rem]"
            />

            <Section
                spacing="XL"
                className="pt-24 sm:pt-28"
            >
                <PageContainer>
                    <div className="text-center">
                        <p
                            className="
                                text-sm
                                font-semibold
                                uppercase
                                tracking-[0.2em]
                                text-yellow-600
                                dark:text-yellow-400
                            "
                        >
                            Our Fleet
                        </p>

                        <h1
                            className="
                                mt-3
                                text-4xl
                                font-black
                                tracking-tight
                                text-gray-900
                                dark:text-white
                                sm:text-5xl
                            "
                        >
                            Find Your Perfect Ride
                        </h1>
                    </div>

                    {/* Brand/model search; compact filters sit below it. */}
                    <div className="mt-8 flex justify-center">
                        <PillSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search by brand or model..."
                            label="Search vehicles"
                        />
                    </div>

                    <div className="mx-auto mt-2 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
                        <CompactSelect
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            options={[
                                { value: "", label: "All categories" },
                                ...activeCategories.map((item) => ({
                                    value: item._id,
                                    label: item.name,
                                })),
                            ]}
                        />
                        <CompactSelect
                            label="Vehicle type"
                            value={vehicleType}
                            onChange={setVehicleType}
                            options={VEHICLE_TYPE_OPTIONS}
                        />
                        <details className="group relative">
                            <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                Seats
                                {seatRangeTouched && (
                                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                                        {seatRange[0]}–{seatRange[1]}
                                    </span>
                                )}
                            </summary>
                            <div className="absolute left-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-xl sm:left-1/2 sm:-translate-x-1/2 dark:border-gray-700 dark:bg-gray-900">
                                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                                    <span>Number of seats</span>
                                    {seatRangeTouched && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSeatRange([2, maxSeats]);
                                                setSeatRangeTouched(false);
                                            }}
                                            className="text-yellow-700 hover:text-yellow-900 dark:text-yellow-400"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <PriceRangeSlider
                                    min={2}
                                    max={maxSeats}
                                    step={1}
                                    value={seatRange}
                                    formatValue={(seats) => `${seats} seats`}
                                    rangeLabel="seats"
                                    showMaxPlus={false}
                                    onChange={(next) => {
                                        setSeatRange(next);
                                        setSeatRangeTouched(true);
                                    }}
                                />
                            </div>
                        </details>
                        <CompactSelect
                            label="Sort vehicles"
                            value={sortBy}
                            onChange={setSortBy}
                            options={VEHICLE_SORT_OPTIONS}
                        />
                        <details className="group relative">
                            <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                Price / day
                                {priceTouched && (
                                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                                        ₱{priceRange[0].toLocaleString()}–₱{priceRange[1].toLocaleString()}
                                    </span>
                                )}
                            </summary>
                            <div className="absolute right-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 dark:border-gray-700 dark:bg-gray-900">
                                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                                    <span>Daily price range</span>
                                    {priceTouched && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPriceRange([0, priceCeiling]);
                                                setPriceTouched(false);
                                            }}
                                            className="text-yellow-700 hover:text-yellow-900 dark:text-yellow-400"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <PriceRangeSlider
                                    min={0}
                                    max={priceCeiling}
                                    step={100}
                                    value={priceRange}
                                    rangeLabel="daily rate"
                                    onChange={(next) => {
                                        setPriceRange(next);
                                        setPriceTouched(true);
                                    }}
                                />
                            </div>
                        </details>
                    </div>

                    <div
                        className="
                            mt-10
                            flex
                            items-center
                            justify-between
                        "
                    >
                        <div>
                            <h2
                                className="
                                    text-2xl
                                    font-bold
                                    tracking-tight
                                    text-gray-900
                                    dark:text-white
                                "
                            >
                                Available Vehicles
                            </h2>

                            {!loading && (
                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                >
                                    {
                                        filteredVehicles.length
                                    }{" "}
                                    {filteredVehicles.length ===
                                    1
                                        ? "vehicle"
                                        : "vehicles"}{" "}
                                    available
                                </p>
                            )}
                        </div>

                        <ViewSwitcher
                            value={viewMode}
                            onChange={
                                setViewMode
                            }
                            options={[
                                {
                                    value: "cards",
                                    label: "Cards",
                                    icon: LayoutGrid,
                                },
                                {
                                    value: "list",
                                    label: "List",
                                    icon: List,
                                },
                            ]}
                        />
                    </div>

                    {loading ? (
                        <div
                            className="
                                flex
                                min-h-[360px]
                                items-center
                                justify-center
                            "
                        >
                            <LoadingSpinner />
                        </div>
                    ) : error ? (
                        <div
                            className="
                                mt-8
                                flex
                                min-h-[280px]
                                items-center
                                justify-center
                                rounded-3xl
                                border
                                border-red-100
                                bg-white
                                px-6
                                text-center
                                shadow-sm
                                dark:border-red-900/50
                                dark:bg-gray-900
                            "
                        >
                            <div>
                                <h3
                                    className="
                                        text-lg
                                        font-semibold
                                        text-gray-900
                                        dark:text-white
                                    "
                                >
                                    Unable to load vehicles
                                </h3>

                                <p
                                    className="
                                        mt-2
                                        text-sm
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                >
                                    {error}
                                </p>
                            </div>
                        </div>
                    ) : filteredVehicles.length ===
                      0 ? (
                        <div
                            className="
                                mt-8
                                rounded-3xl
                                border
                                border-gray-200
                                bg-white
                                shadow-sm
                                dark:border-gray-800
                                dark:bg-gray-900
                            "
                        >
                            <EmptyState
                                icon={Search}
                                title="No vehicles found"
                                description={
                                    hasActiveFilters
                                        ? "Try adjusting your search or filters to find available vehicles."
                                        : "There are currently no available vehicles."
                                }
                            />

                            {hasActiveFilters && (
                                <div className="flex justify-center pb-8">
                                    <Button
                                        variant="outline"
                                        onClick={
                                            clearFilters
                                        }
                                    >
                                        Clear Filters
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        viewMode === "cards" ? (
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: {},
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.08,
                                        },
                                    },
                                }}
                                className="
                                    mt-8
                                    grid
                                    grid-cols-1
                                    gap-4
                                    md:grid-cols-3
                                "
                            >
                                {filteredVehicles.map(
                                    (vehicle) => (
                                        <motion.div
                                            key={
                                                vehicle._id ??
                                                vehicle.id
                                            }
                                            variants={{
                                                hidden: {
                                                    opacity: 0,
                                                    y: 20,
                                                },
                                                visible: {
                                                    opacity: 1,
                                                    y: 0,
                                                    transition: {
                                                        duration: 0.4,
                                                    },
                                                },
                                            }}
                                        >
                                            <FeaturedVehicleCard
                                                vehicle={
                                                    vehicle
                                                }
                                                publicView={
                                                    true
                                                }
                                                compact={
                                                    true
                                                }
                                            />
                                        </motion.div>
                                    )
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: {},
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.06,
                                        },
                                    },
                                }}
                                className="
                                    mt-8
                                    space-y-3
                                "
                            >
                                {filteredVehicles.map(
                                    (vehicle) => {
                                        const item =
                                            getVehicleCardData(
                                                vehicle
                                            );

                                        return (
                                            <motion.div
                                                key={
                                                    vehicle._id ??
                                                    vehicle.id
                                                }
                                                onClick={() =>
                                                    navigate(
                                                        `/vehicles/${item.id}`
                                                    )
                                                }
                                                variants={{
                                                    hidden: {
                                                        opacity: 0,
                                                        y: 12,
                                                    },
                                                    visible: {
                                                        opacity: 1,
                                                        y: 0,
                                                        transition: {
                                                            duration: 0.3,
                                                        },
                                                    },
                                                }}
                                                onMouseMove={trackCardSpotlight}
                                                // vehicle-hover-fx: dark-mode hover effect, mode/colour set by
                                                // the admin (styles/vehicle-hover.css)
                                                className="
                                                    vehicle-hover-fx
                                                    group
                                                    flex
                                                    cursor-pointer
                                                    flex-col
                                                    gap-3
                                                    rounded-2xl
                                                    border
                                                    border-gray-200
                                                    bg-white
                                                    p-3
                                                    shadow-sm
                                                    transition-all
                                                    duration-200
                                                    hover:border-blue-300
                                                    hover:shadow-md
                                                    sm:flex-row
                                                    sm:items-center
                                                    sm:gap-4
                                                    dark:border-gray-800
                                                    dark:bg-gray-900
                                                "
                                            >
                                                <div className="flex items-center gap-4">
                                                <div className="
                                                    h-20
                                                    w-28
                                                    shrink-0
                                                    overflow-hidden
                                                    rounded-xl
                                                    bg-gray-100
                                                    dark:bg-gray-800
                                                ">
                                                    {item.image ? (
                                                        <img
                                                            src={item.image}
                                                            alt={item.name}
                                                            className="
                                                                h-full
                                                                w-full
                                                                object-cover
                                                            "
                                                        />
                                                    ) : (
                                                        <div className="
                                                            flex
                                                            h-full
                                                            items-center
                                                            justify-center
                                                            text-gray-400
                                                        ">
                                                            <ImageOff
                                                                size={24}
                                                                strokeWidth={1.5}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="
                                                    min-w-0
                                                    flex-1
                                                ">
                                                    <div className="
                                                        flex
                                                        items-center
                                                        gap-2
                                                    ">
                                                        <h3 className="
                                                            truncate
                                                            text-sm
                                                            font-semibold
                                                            text-gray-900
                                                            dark:text-white
                                                        ">
                                                            {item.name}
                                                        </h3>

                                                        {item.featured && (
                                                            <Badge
                                                                variant="warning"
                                                                size="sm"
                                                            >
                                                                Featured
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="
                                                        mt-1
                                                        text-xs
                                                        text-gray-500
                                                        dark:text-gray-400
                                                    ">
                                                        {item.vehicleType} • {item.year} • {item.category}
                                                    </p>

                                                    <div className="
                                                        mt-2
                                                        flex
                                                        items-center
                                                        gap-3
                                                        text-xs
                                                        text-gray-600
                                                        dark:text-gray-300
                                                    ">
                                                        <span>
                                                            {item.transmission}
                                                        </span>
                                                        <span>
                                                            {item.fuelType}
                                                        </span>
                                                        <span>
                                                            {item.seats} Seats
                                                        </span>

                                                        <VehicleRating
                                                            rating={vehicle.rating}
                                                            size="md"
                                                        />
                                                    </div>
                                                </div>
                                                </div>

                                                <div className="
                                                    shrink-0
                                                    text-right
                                                ">
                                                    {item.activeDiscount && (
                                                        <div className="mb-1 flex items-center justify-end gap-2">
                                                            <DiscountBadge discount={item.activeDiscount} />
                                                            <OriginalPrice
                                                                discount={item.activeDiscount}
                                                                className="text-xs"
                                                            />
                                                        </div>
                                                    )}

                                                    <div
                                                        className="
                                                            inline-flex
                                                            items-center
                                                            gap-2
                                                        "
                                                    >
                                                        <div
                                                            className="
                                                                inline-flex
                                                                items-end
                                                                gap-1
                                                                rounded-full
                                                                border
                                                                border-green-200
                                                                bg-green-100/70
                                                                px-3
                                                                py-1.5
                                                                transition-colors
                                                                duration-300
                                                                dark:border-green-900/50
                                                                dark:bg-green-900/20
                                                                dark:group-hover:border-yellow-400/40
                                                                dark:group-hover:bg-yellow-400/10
                                                            "
                                                        >
                                                            <Price
                                                                value={item.effectiveDailyRate}
                                                                className="
                                                                    text-base
                                                                    font-black
                                                                    tracking-tight
                                                                    text-green-800
                                                                    transition-colors
                                                                    duration-300
                                                                    dark:text-green-400
                                                                    dark:group-hover:text-yellow-300
                                                                "
                                                            />

                                                            <span
                                                                className="
                                                                    mb-0.5
                                                                    text-[10px]
                                                                    font-semibold
                                                                    uppercase
                                                                    tracking-wide
                                                                    text-green-700
                                                                    transition-colors
                                                                    duration-300
                                                                    dark:text-green-500
                                                                    dark:group-hover:text-yellow-400
                                                                "
                                                            >
                                                                /day
                                                            </span>
                                                        </div>

                                                        <ChevronRight
                                                            size={16}
                                                            className="
                                                                shrink-0
                                                                text-gray-400
                                                                transition-colors
                                                                duration-200
                                                                group-hover:text-blue-600
                                                                dark:text-gray-500
                                                                dark:group-hover:translate-x-0.5
                                                                dark:group-hover:text-yellow-400
                                                            "
                                                        />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    }
                                )}
                            </motion.div>
                        )
                    )}
                </PageContainer>
            </Section>
        </main>
    );
};

const CompactSelect = ({ label, value, onChange, options }) => (
    <Select
        bare
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        options={options}
        className="h-9 max-w-[10rem] rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 focus-visible:border-yellow-500 focus-visible:ring-2 focus-visible:ring-yellow-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    />
);

export default PublicVehicles;
