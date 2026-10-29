import { useState } from "react";
import {
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

const getDriverFullName = (driver) =>
    [
        driver.firstName,
        driver.lastName,
    ]
        .filter(Boolean)
        .join(" ") || "Unnamed Driver";

const formatTime = (time) => {
    if (!time) {
        return "Not set";
    }

    const [hours, minutes] =
        time.split(":");

    const date = new Date();

    date.setHours(
        Number(hours),
        Number(minutes),
        0,
        0
    );

    return new Intl.DateTimeFormat(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
        }
    ).format(date);
};

const DriverScheduleCalendar = ({
    drivers = [],
}) => {
    const [
        currentDate,
        setCurrentDate,
    ] = useState(new Date());

    const year =
        currentDate.getFullYear();

    const month =
        currentDate.getMonth();

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();

    const calendarDays = [];

for (
    let index = 0;
    index < firstDay;
    index += 1
) {
    calendarDays.push(null);
}

for (
    let day = 1;
    day <= daysInMonth;
    day += 1
) {
    calendarDays.push(day);
}

    const getDriversForDay = (
        day
    ) => {
        if (!day) {
            return [];
        }

        const date = new Date(
            year,
            month,
            day
        );

        const dayName =
            DAYS[date.getDay()];

        return drivers.filter(
            (driver) =>
                driver.schedule?.workingDays?.includes(
                    dayName
                )
        );
    };

    const goToPreviousMonth =
        () => {
            setCurrentDate(
                new Date(
                    year,
                    month - 1,
                    1
                )
            );
        };

    const goToNextMonth = () => {
        setCurrentDate(
            new Date(
                year,
                month + 1,
                1
            )
        );
    };

    const goToToday = () => {
        setCurrentDate(
            new Date()
        );
    };

    const isToday = (day) => {
        if (!day) {
            return false;
        }

        const today =
            new Date();

        return (
            today.getFullYear() ===
                year &&
            today.getMonth() ===
                month &&
            today.getDate() ===
                day
        );
    };

    return (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {/* Calendar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Driver Schedule
                    </h2>

                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        View driver schedules by date.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={
                            goToToday
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                        Today
                    </button>

                    <button
                        type="button"
                        onClick={
                            goToPreviousMonth
                        }
                        className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        aria-label="Previous month"
                    >
                        <ChevronLeft
                            size={17}
                        />
                    </button>

                    <div className="min-w-[130px] text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {
                            MONTHS[
                                month
                            ]
                        }{" "}
                        {year}
                    </div>

                    <button
                        type="button"
                        onClick={
                            goToNextMonth
                        }
                        className="rounded-lg border border-gray-300 p-2 text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        aria-label="Next month"
                    >
                        <ChevronRight
                            size={17}
                        />
                    </button>
                </div>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                {DAYS.map(
                    (day) => (
                        <div
                            key={day}
                            className="border-r border-gray-200 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 last:border-r-0 dark:border-gray-700 dark:text-gray-400"
                        >
                            {day.slice(
                                0,
                                3
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
                {calendarDays.map(
                    (day, index) => {
                        const dayDrivers =
                            getDriversForDay(
                                day
                            );

                        return (
                            <div
                                key={
                                    day
                                        ? `${year}-${month}-${day}`
                                        : `empty-${index}`
                                }
                                className="min-h-[145px] border-b border-r border-gray-200 p-2 last:border-r-0 dark:border-gray-700"
                            >
                                {!day ? (
                                    <div />
                                ) : (
                                    <>
                                        <div className="mb-2 flex justify-end">
                                            <span
                                                className={[
                                                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                                                    isToday(
                                                        day
                                                    )
                                                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                                                        : "text-gray-600 dark:text-gray-400",
                                                ].join(
                                                    " "
                                                )}
                                            >
                                                {
                                                    day
                                                }
                                            </span>
                                        </div>

                                        <div className="space-y-1.5">
                                            {dayDrivers.map(
                                                (
                                                    driver
                                                ) => (
                                                    <div
                                                        key={
                                                            driver._id
                                                        }
                                                        className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800"
                                                    >
                                                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                                                            {getDriverFullName(
                                                                driver
                                                            )}
                                                        </p>

                                                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                            {formatTime(
                                                                driver
                                                                    .schedule
                                                                    ?.startTime
                                                            )}{" "}
                                                            –{" "}
                                                            {formatTime(
                                                                driver
                                                                    .schedule
                                                                    ?.endTime
                                                            )}
                                                        </p>
                                                    </div>
                                                )
                                            )}

                                            {!dayDrivers.length && (
                                                <p className="px-1 pt-1 text-[11px] text-gray-400 dark:text-gray-600">
                                                    No drivers
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    }
                )}
            </div>
        </section>
    );
};

export default DriverScheduleCalendar;