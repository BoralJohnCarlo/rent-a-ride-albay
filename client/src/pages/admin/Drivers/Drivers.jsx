import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import {
    Archive,
    Plus,
    Search,
    X,
} from "lucide-react";

import { ACTIVE_PILL_SPRING } from "../../../constants/animations";

import DriverCardGrid from "../../../components/cards/DriverCardGrid";
import DriverQuickDetails from "../../../components/driver/DriverQuickDetails";
import Modal from "../../../components/common/Modal";
import DriverDialogs from "../../../components/modals/DriverDialogs";

import useDriver from "../../../hooks/drivers/useDriver";
import useToast from "../../../hooks/toast/useToast";

/*
 * One filter row: "All" / "Active" / "Suspended" filter the drivers still in
 * service by status; "Archived" switches to archived drivers. (Previously an
 * Active/Archived tab row plus a second status row — two "Active" buttons
 * meaning different things.)
 */
const DRIVER_FILTERS = [
    { label: "All", value: "all" },
    { label: "Active", value: "Active" },
    { label: "Suspended", value: "Suspended" },
    { label: "Archived", value: "archived", icon: Archive },
];

// Driver schedules are a recurring weekly pattern (schedule.workingDays),
// not date-specific bookings - so the calendar is a Mon-Sun week grid, not
// a month-of-dates grid. Showing literal calendar dates here would imply a
// precision the data doesn't have.
const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const getTodayName = () =>
    new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        timeZone: "Asia/Manila",
    }).format(new Date());

const getDriverFullName = (driver) =>
    [
        driver.firstName,
        driver.lastName,
    ]
        .filter(Boolean)
        .join(" ") || "Unnamed Driver";

const isDriverScheduledForDay = (
    driver,
    day
) =>
    driver.schedule?.workingDays?.includes(
        day
    );

const formatScheduleTime = (driver) => {
    const start =
        driver.schedule?.startTime;

    const end =
        driver.schedule?.endTime;

    if (!start && !end) {
        return "Schedule not set";
    }

    if (start && end) {
        return `${start} – ${end}`;
    }

    return start || end;
};

const WeekCalendar = ({ drivers, todayName }) => {
    const activeDrivers = useMemo(
        () =>
            drivers.filter(
                (driver) =>
                    driver.archive?.isArchived !== true &&
                    driver.status === "Active"
            ),
        [drivers]
    );

    return (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Weekly Schedule
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Who's working which day, based on each driver's recurring
                    schedule.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
                {WEEKDAYS.map((day) => {
                    const scheduledDrivers = activeDrivers.filter(
                        (driver) =>
                            isDriverScheduledForDay(driver, day)
                    );

                    const isToday = day === todayName;

                    return (
                        <div
                            key={day}
                            className={`rounded-lg border p-3 ${
                                isToday
                                    ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800"
                                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                            }`}
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                                    {day}
                                </p>

                                {isToday && (
                                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-gray-900">
                                        Today
                                    </span>
                                )}
                            </div>

                            {scheduledDrivers.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    No drivers scheduled
                                </p>
                            ) : (
                                <div className="space-y-1.5">
                                    {scheduledDrivers.map((driver) => (
                                        <div
                                            key={driver._id}
                                            className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800"
                                        >
                                            <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                                                {getDriverFullName(driver)}
                                            </p>

                                            <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                {formatScheduleTime(driver)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

const Drivers = ({
    users = [],
}) => {
    const toast = useToast();

    const {
        drivers,
        loading,
        error,
        getDrivers,
        createDriver,
        updateDriver,
        updateDriverStatus,
        archiveDriver,
        restoreDriver,
        clearDriverError,
    } = useDriver();

    const [
        driverView,
        setDriverView,
    ] = useState("active");

    const [
        activeFilter,
        setActiveFilter,
    ] = useState("all");

    const [
        searchTerm,
        setSearchTerm,
    ] = useState("");

    // Driver whose full details are open (clicking a card).
    const [
        detailDriver,
        setDetailDriver,
    ] = useState(null);

    const [
        dialog,
        setDialog,
    ] = useState({
        type: null,
        driver: null,
    });

    useEffect(() => {
        getDrivers({
            includeArchived: true,
        });
    }, [getDrivers]);

    const visibleDrivers = useMemo(() => {
        if (driverView === "archived") {
            return drivers.filter(
                (driver) =>
                    driver.archive?.isArchived ===
                    true
            );
        }

        return drivers.filter(
            (driver) =>
                driver.archive?.isArchived !==
                true
        );
    }, [drivers, driverView]);

    const filteredDrivers = useMemo(() => {
        const normalizedSearch =
            searchTerm
                .trim()
                .toLowerCase();

        return visibleDrivers.filter(
            (driver) => {
                if (
                    driverView === "active"
                ) {
                    const matchesStatus =
                        activeFilter ===
                            "all" ||
                        driver.status ===
                            activeFilter;

                    if (!matchesStatus) {
                        return false;
                    }
                }

                if (!normalizedSearch) {
                    return true;
                }

                const fullName =
                    getDriverFullName(
                        driver
                    );

                return [
                    fullName,
                    driver.driverCode,
                    driver.email,
                    driver.phoneNumber,
                    driver.license
                        ?.licenseNumber,
                ]
                    .filter(Boolean)
                    .some((value) =>
                        String(value)
                            .toLowerCase()
                            .includes(
                                normalizedSearch
                            )
                    );
            }
        );
    }, [
        visibleDrivers,
        driverView,
        activeFilter,
        searchTerm,
    ]);

    const todayName = getTodayName();

    const filterCounts = useMemo(() => {
        const inService = drivers.filter(
            (driver) => driver.archive?.isArchived !== true
        );

        return {
            all: inService.length,
            Active: inService.filter((d) => d.status === "Active").length,
            Suspended: inService.filter((d) => d.status === "Suspended").length,
            archived: drivers.length - inService.length,
        };
    }, [drivers]);

    const selectedFilter =
        driverView === "archived" ? "archived" : activeFilter;

    const closeDialog = () => {
        if (loading) {
            return;
        }

        setDialog({
            type: null,
            driver: null,
        });
    };

    const handleFilterChange = (value) => {
        if (loading) {
            return;
        }

        const nextView =
            value === "archived" ? "archived" : "active";

        setDriverView(nextView);
        setActiveFilter(value === "archived" ? "all" : value);
    };

    const handleEdit = (driver) => {
        setDialog({
            type: "edit",
            driver,
        });
    };

    const handleStatusChange = (
        driver,
        status
    ) => {
        setDialog({
            type:
                status === "Suspended"
                    ? "suspend"
                    : "activate",
            driver,
        });
    };

    const handleArchive = (driver) => {
        setDialog({
            type: "archive",
            driver,
        });
    };

    const handleRestore = (driver) => {
        setDialog({
            type: "restore",
            driver,
        });
    };

    const handleConfirmStatusChange =
        async (driver) => {
            if (!driver) {
                return;
            }

            const status =
                dialog.type === "suspend"
                    ? "Suspended"
                    : "Active";

            const result =
                await updateDriverStatus(
                    driver._id,
                    status
                );

            if (
                result?.meta
                    ?.requestStatus ===
                "fulfilled"
            ) {
                toast.success(
                    dialog.type === "suspend"
                        ? "Driver suspended successfully."
                        : "Driver activated successfully.",
                    dialog.type === "suspend"
                        ? "Driver Suspended"
                        : "Driver Activated"
                );

                closeDialog();

                await getDrivers({
                    includeArchived: true,
                });
            }
        };

    const handleConfirmArchive =
        async ({ driver, reason }) => {
            if (!driver) {
                return;
            }

            const result =
                await archiveDriver(
                    driver._id,
                    reason
                );

            if (
                result?.meta
                    ?.requestStatus ===
                "fulfilled"
            ) {
                toast.success(
                    "Driver archived successfully.",
                    "Driver Archived"
                );

                closeDialog();

                await getDrivers({
                    includeArchived: true,
                });
            }
        };

    const handleConfirmRestore =
        async (driver) => {
            if (!driver) {
                return;
            }

            const result =
                await restoreDriver(
                    driver._id
                );

            if (
                result?.meta
                    ?.requestStatus ===
                "fulfilled"
            ) {
                toast.success(
                    "Driver restored successfully.",
                    "Driver Restored"
                );

                closeDialog();

                await getDrivers({
                    includeArchived: true,
                });
            }
        };

    const handleFormSubmit = async (
        payload
    ) => {
        let result;

        if (dialog.type === "edit") {
            if (!dialog.driver) {
                return;
            }

            result = await updateDriver(
                dialog.driver._id,
                payload
            );
        } else {
            result =
                await createDriver(payload);
        }

        if (
            result?.meta
                ?.requestStatus ===
            "fulfilled"
        ) {
            toast.success(
                dialog.type === "edit"
                    ? "Driver updated successfully."
                    : "Driver created successfully.",
                dialog.type === "edit"
                    ? "Driver Updated"
                    : "Driver Created"
            );

            closeDialog();

            await getDrivers({
                includeArchived: true,
            });
        }
    };

    const handleDialogSubmit = async (
        value
    ) => {
        if (
            dialog.type === "create" ||
            dialog.type === "edit"
        ) {
            await handleFormSubmit(
                value
            );

            return;
        }

        if (
            dialog.type === "suspend" ||
            dialog.type === "activate"
        ) {
            await handleConfirmStatusChange(
                value
            );

            return;
        }

        if (dialog.type === "archive") {
            await handleConfirmArchive(
                value
            );

            return;
        }

        if (dialog.type === "restore") {
            await handleConfirmRestore(
                value
            );
        }
    };

    return (
        <div className="space-y-6">
            {/* Search — the widest pill, on top */}
            <div className="relative mx-auto w-full max-w-3xl">
                <Search
                    size={18}
                    className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) =>
                        setSearchTerm(event.target.value)
                    }
                    placeholder={
                        driverView === "archived"
                            ? "Search archived drivers by name, code, email, phone or license..."
                            : "Search drivers by name, code, email, phone or license..."
                    }
                    aria-label="Search drivers"
                    className="h-12 w-full rounded-full border border-gray-200/80 bg-white/80 pl-12 pr-11 text-sm text-gray-900 shadow-sm outline-none backdrop-blur-xl transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-600 dark:focus:ring-blue-600/20"
                />

                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* Filters + Add Driver — one pill under the search */}
            <div className="flex justify-center">
                <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-xl [scrollbar-width:none] dark:border-gray-800 dark:bg-gray-900/80 [&::-webkit-scrollbar]:hidden">
                    <div
                        role="tablist"
                        aria-label="Driver filters"
                        className="flex items-center gap-1"
                    >
                        {DRIVER_FILTERS.map((filter) => {
                            const isActive = selectedFilter === filter.value;
                            const Icon = filter.icon;

                            return (
                                <button
                                    key={filter.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() =>
                                        handleFilterChange(filter.value)
                                    }
                                    className={`relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                                        isActive
                                            ? "text-white"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                                    }`}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="driver-filter-pill"
                                            className="absolute inset-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20"
                                            transition={ACTIVE_PILL_SPRING}
                                        />
                                    )}

                                    {Icon && (
                                        <Icon size={14} className="relative" />
                                    )}

                                    <span className="relative">
                                        {filter.label}
                                    </span>

                                    <span
                                        className={`relative rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                            isActive
                                                ? "bg-white/25 text-white"
                                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                        }`}
                                    >
                                        {filterCounts[filter.value] ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <span
                        aria-hidden="true"
                        className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700"
                    />

                    <button
                        type="button"
                        onClick={() =>
                            setDialog({
                                type: "create",
                                driver: null,
                            })
                        }
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        <Plus size={16} />
                        Add Driver
                    </button>
                </div>
            </div>

            {/* Weekly schedule (today highlighted) — in-service drivers only */}
            {driverView === "active" && (
                <WeekCalendar
                    drivers={drivers}
                    todayName={todayName}
                />
            )}

            {error && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    <span>
                        {typeof error ===
                        "string"
                            ? error
                            : "Unable to load drivers."}
                    </span>

                    <button
                        type="button"
                        onClick={
                            clearDriverError
                        }
                        className="font-medium hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <DriverCardGrid
                drivers={filteredDrivers}
                loading={loading}
                isArchivedView={
                    driverView ===
                    "archived"
                }
                onView={setDetailDriver}
                onEdit={
                    driverView ===
                    "archived"
                        ? undefined
                        : handleEdit
                }
                onStatusChange={
                    driverView ===
                    "archived"
                        ? undefined
                        : handleStatusChange
                }
                onArchive={
                    driverView ===
                    "archived"
                        ? undefined
                        : handleArchive
                }
                onRestore={
                    driverView ===
                    "archived"
                        ? handleRestore
                        : undefined
                }
            />

            <Modal
                isOpen={Boolean(detailDriver)}
                onClose={() => setDetailDriver(null)}
                title={
                    detailDriver
                        ? getDriverFullName(detailDriver)
                        : "Driver details"
                }
                size="lg"
            >
                {detailDriver && (
                    <DriverQuickDetails driver={detailDriver} />
                )}
            </Modal>

            <DriverDialogs
                mode={dialog.type}
                driver={dialog.driver}
                users={users}
                isOpen={Boolean(
                    dialog.type
                )}
                loading={loading}
                onClose={closeDialog}
                onSubmit={
                    handleDialogSubmit
                }
            />
        </div>
    );
};

export default Drivers;