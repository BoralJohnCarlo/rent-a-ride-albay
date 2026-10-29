import { useMemo, useState } from "react";
import {
    ArrowDownAZ,
    Check,
    Route,
    Search,
    Star,
    UserRound,
    UserRoundSearch,
    Wallet,
} from "lucide-react";

import Avatar from "../common/Avatar";
import Button from "../common/Button";
import Modal from "../common/Modal";
import SearchBar from "../common/SearchBar";
import DriverProfileModal from "../driver/DriverProfileModal";

/*
 * The booking form's driver choice: a summary of the selected driver (or a
 * prompt to choose one) shown under the Self Drive / With Driver cards, and
 * a pop-up to search and sort the available drivers. Drivers come from
 * GET /drivers/available, which includes each one's `rating` and
 * `completedTrips`.
 */

const getDriverId = (driver) => driver._id ?? driver.id;

const getDriverName = (driver) =>
    [driver.firstName, driver.lastName]
        .filter(Boolean)
        .join(" ") ||
    driver.driverCode ||
    "Driver";

const getRating = (driver) => driver.rating?.averageRating ?? 0;
const getReviewCount = (driver) => driver.rating?.reviewCount ?? 0;
const getTrips = (driver) => driver.completedTrips ?? 0;

const byName = (a, b) => getDriverName(a).localeCompare(getDriverName(b));

const SORTS = {
    rating: {
        label: "Top rated",
        icon: Star,
        // Unreviewed drivers last; ties go to the more-reviewed driver.
        compare: (a, b) =>
            getRating(b) - getRating(a) ||
            getReviewCount(b) - getReviewCount(a) ||
            getTrips(b) - getTrips(a) ||
            byName(a, b),
    },
    trips: {
        label: "Most booked",
        icon: Route,
        compare: (a, b) =>
            getTrips(b) - getTrips(a) ||
            getRating(b) - getRating(a) ||
            byName(a, b),
    },
    rate: {
        label: "Lowest rate",
        icon: Wallet,
        // Set per render: only offered when drivers have their own rates.
        compare: null,
    },
    name: {
        label: "Name A–Z",
        icon: ArrowDownAZ,
        compare: byName,
    },
};

const DriverStats = ({ driver, rateText }) => {
    const reviewCount = getReviewCount(driver);
    const trips = getTrips(driver);

    return (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {reviewCount > 0 ? (
                <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-200">
                    <Star
                        size={12}
                        className="fill-yellow-400 text-yellow-400"
                    />
                    {getRating(driver).toFixed(1)}
                    <span className="font-normal text-gray-400 dark:text-gray-500">
                        ({reviewCount})
                    </span>
                </span>
            ) : (
                <span className="text-gray-400 dark:text-gray-500">
                    No reviews yet
                </span>
            )}

            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Route size={12} />
                {trips} {trips === 1 ? "trip" : "trips"}
            </span>

            {rateText && (
                <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {rateText}
                </span>
            )}
        </div>
    );
};

const NO_IDS = new Set();

const DriverPicker = ({
    drivers = [],
    // Driver ids that can't take the chosen dates (booked, or license).
    unavailableIds = NO_IDS,
    value,
    onChange,
    disabled = false,
    error,
    // Controlled so the form can open it when "With Driver" is picked.
    pickerOpen = false,
    onPickerOpenChange,
    // driver -> "₱1,500.00/day" when drivers have their own rates, else null.
    getRateText,
    // driver -> numeric daily rate, for the "Lowest rate" sort.
    getRate,
}) => {
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("rating");

    // Driver whose profile is previewed in place (see DriverProfileModal).
    const [profileDriverId, setProfileDriverId] = useState(null);

    const selectedDriver = useMemo(
        () =>
            drivers.find((driver) => getDriverId(driver) === value) ?? null,
        [drivers, value]
    );

    // "Lowest rate" only means something when the rates differ.
    const ratesDiffer = useMemo(
        () =>
            Boolean(getRate) &&
            new Set(drivers.map((driver) => getRate(driver))).size > 1,
        [drivers, getRate]
    );

    const sortOptions = Object.entries(SORTS).filter(
        ([key]) => key !== "rate" || ratesDiffer
    );

    const activeSort = sort === "rate" && !ratesDiffer ? "rating" : sort;

    const visibleDrivers = useMemo(() => {
        const query = search.trim().toLowerCase();

        const compare =
            activeSort === "rate"
                ? (a, b) =>
                      getRate(a) - getRate(b) ||
                      SORTS.rating.compare(a, b)
                : SORTS[activeSort].compare;

        // Drivers who can't take these dates go last.
        const unavailableLast = (a, b) =>
            Number(unavailableIds.has(getDriverId(a))) -
            Number(unavailableIds.has(getDriverId(b)));

        return drivers
            .filter(
                (driver) =>
                    !query ||
                    getDriverName(driver)
                        .toLowerCase()
                        .includes(query) ||
                    driver.driverCode?.toLowerCase().includes(query)
            )
            .sort((a, b) => unavailableLast(a, b) || compare(a, b));
    }, [drivers, search, activeSort, getRate, unavailableIds]);

    const closePicker = () => onPickerOpenChange?.(false);

    const selectDriver = (driverId) => {
        onChange?.(driverId);
        closePicker();
    };

    if (!drivers.length) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400">
                No drivers are available right now.
            </p>
        );
    }

    return (
        <div>
            {selectedDriver ? (
                <div className="relative rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-50 via-white to-white p-4 ring-4 ring-amber-500/15 dark:border-amber-400 dark:from-amber-500/15 dark:via-gray-900 dark:to-gray-900">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                        <Check size={11} strokeWidth={3} />
                        Selected driver
                    </span>

                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Avatar
                                src={selectedDriver.profileImage}
                                name={getDriverName(selectedDriver)}
                                size="md"
                            />

                            <div className="min-w-0">
                                <p className="truncate text-base font-bold text-gray-900 dark:text-white">
                                    {getDriverName(selectedDriver)}
                                </p>

                                <DriverStats
                                    driver={selectedDriver}
                                    rateText={getRateText?.(selectedDriver)}
                                />

                                {unavailableIds.has(
                                    getDriverId(selectedDriver)
                                ) && (
                                    <p className="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                                        Not available for your dates — please
                                        choose another driver.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                leftIcon={<UserRound size={14} />}
                                onClick={() =>
                                    setProfileDriverId(
                                        getDriverId(selectedDriver)
                                    )
                                }
                            >
                                View profile
                            </Button>

                            <Button
                                type="button"
                                variant="brand"
                                size="sm"
                                leftIcon={<UserRoundSearch size={14} />}
                                disabled={disabled}
                                onClick={() => onPickerOpenChange?.(true)}
                            >
                                Change
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onPickerOpenChange?.(true)}
                    className={`group flex w-full items-center gap-4 rounded-2xl border-2 border-dashed p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                        error
                            ? "border-red-300 bg-red-50/50 dark:border-red-500/40 dark:bg-red-500/5"
                            : "border-gray-300 bg-white hover:border-amber-400 hover:bg-amber-50/50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-amber-500 dark:hover:bg-amber-500/5"
                    }`}
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-500/15 dark:text-amber-300">
                        <UserRoundSearch size={20} />
                    </span>

                    <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900 dark:text-white">
                            Choose a driver
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                            Search {drivers.length} available{" "}
                            {drivers.length === 1 ? "driver" : "drivers"} by
                            name, rating, or bookings.
                        </span>
                    </span>

                    <Search
                        size={18}
                        className="shrink-0 text-gray-400 transition-colors group-hover:text-amber-500"
                    />
                </button>
            )}

            {error && (
                <p
                    role="alert"
                    className="mt-2 text-sm text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            )}

            <Modal
                isOpen={pickerOpen}
                onClose={closePicker}
                // Escape belongs to the profile preview while it's open.
                closeOnEscape={!profileDriverId}
                title="Choose a Driver"
                description="Search and compare drivers, then pick who will drive you."
                size="lg"
            >
                <div className="space-y-4">
                    <SearchBar
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search drivers by name"
                    />

                    <div
                        role="radiogroup"
                        aria-label="Sort drivers"
                        className="flex flex-wrap gap-2"
                    >
                        {sortOptions.map(([key, option]) => {
                            const Icon = option.icon;
                            const isActive = activeSort === key;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    role="radio"
                                    aria-checked={isActive}
                                    onClick={() => setSort(key)}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        isActive
                                            ? "border-amber-500 bg-amber-500 text-white"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-amber-600 dark:hover:text-amber-300"
                                    }`}
                                >
                                    <Icon size={13} />
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {visibleDrivers.length} of {drivers.length}{" "}
                        {drivers.length === 1 ? "driver" : "drivers"}
                    </p>

                    {visibleDrivers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                No drivers match "{search.trim()}"
                            </p>
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="mt-2 text-xs font-medium text-amber-700 underline underline-offset-2 dark:text-amber-300"
                            >
                                Clear search
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {visibleDrivers.map((driver) => {
                                const driverId = getDriverId(driver);
                                const name = getDriverName(driver);
                                const isSelected = value === driverId;
                                const isUnavailable =
                                    unavailableIds.has(driverId);

                                return (
                                    <li
                                        key={driverId}
                                        className={`flex flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center ${
                                            isUnavailable && !isSelected
                                                ? "border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-900/60"
                                                : isSelected
                                                ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-500/10"
                                                : "border-gray-200 bg-white hover:border-amber-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-amber-600"
                                        }`}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <Avatar
                                                src={driver.profileImage}
                                                name={name}
                                                size="sm"
                                            />

                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-gray-900 dark:text-white">
                                                    {name}
                                                </p>

                                                <DriverStats
                                                    driver={driver}
                                                    rateText={getRateText?.(
                                                        driver
                                                    )}
                                                />

                                                {isUnavailable && (
                                                    <span className="mt-1 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                                        Not available for your
                                                        dates
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setProfileDriverId(
                                                        driverId
                                                    )
                                                }
                                            >
                                                View profile
                                            </Button>

                                            <Button
                                                type="button"
                                                variant={
                                                    isSelected
                                                        ? "outline"
                                                        : "brand"
                                                }
                                                size="sm"
                                                leftIcon={
                                                    isSelected ? (
                                                        <Check size={14} />
                                                    ) : undefined
                                                }
                                                disabled={
                                                    disabled ||
                                                    (isUnavailable &&
                                                        !isSelected)
                                                }
                                                onClick={() =>
                                                    selectDriver(driverId)
                                                }
                                            >
                                                {isSelected
                                                    ? "Selected"
                                                    : "Select"}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </Modal>

            {/* Rendered after the picker so its portal stacks on top. */}
            <DriverProfileModal
                driverId={profileDriverId}
                onClose={() => setProfileDriverId(null)}
                onSelect={
                    disabled || unavailableIds.has(profileDriverId)
                        ? undefined
                        : selectDriver
                }
                isSelected={value === profileDriverId}
            />
        </div>
    );
};

export default DriverPicker;
