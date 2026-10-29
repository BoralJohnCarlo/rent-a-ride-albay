import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
    buildMonthWeeks,
    toISODate,
} from "../../utils/calendarGrid";

const WEEKDAY_LABELS = [
    "S",
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
];

/*
 * A plain single-click, single-date month grid — used to pick when a
 * renewed vehicle becomes bookable again. Unlike RequestUnavailabilityDialog
 * (multi-date Set selection, date-range building, disabling already-booked
 * dates), there's nothing to disable here since the vehicle isn't bookable
 * at all yet, and only one date is ever picked.
 */
const SingleDatePicker = ({
    value,
    onChange,
    minDate,
    disabled = false,
}) => {
    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const earliestSelectable =
        minDate ?? today;

    const [viewDate, setViewDate] = useState(() => {
        const base = value
            ? new Date(value)
            : earliestSelectable;
        return new Date(
            base.getFullYear(),
            base.getMonth(),
            1
        );
    });

    const weeks = useMemo(
        () =>
            buildMonthWeeks(
                viewDate.getFullYear(),
                viewDate.getMonth()
            ),
        [viewDate]
    );

    const goToPreviousMonth = () => {
        setViewDate(
            (previous) =>
                new Date(
                    previous.getFullYear(),
                    previous.getMonth() - 1,
                    1
                )
        );
    };

    const goToNextMonth = () => {
        setViewDate(
            (previous) =>
                new Date(
                    previous.getFullYear(),
                    previous.getMonth() + 1,
                    1
                )
        );
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
                <button
                    type="button"
                    onClick={goToPreviousMonth}
                    disabled={disabled}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Previous month"
                >
                    <ChevronLeft size={16} />
                </button>

                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {viewDate.toLocaleDateString(
                        "en-US",
                        {
                            month: "long",
                            year: "numeric",
                        }
                    )}
                </p>

                <button
                    type="button"
                    onClick={goToNextMonth}
                    disabled={disabled}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label="Next month"
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map(
                    (label, index) => (
                        <div
                            key={`${label}-${index}`}
                            className="py-1 text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500"
                        >
                            {label}
                        </div>
                    )
                )}

                {weeks.flat().map((date, index) => {
                    if (!date) {
                        return (
                            <div
                                key={`empty-${index}`}
                            />
                        );
                    }

                    const iso = toISODate(date);
                    const isPast =
                        date < earliestSelectable;
                    const isSelected =
                        value &&
                        toISODate(new Date(value)) ===
                            iso;

                    return (
                        <button
                            key={iso}
                            type="button"
                            disabled={
                                disabled || isPast
                            }
                            onClick={() =>
                                onChange?.(iso)
                            }
                            className={[
                                "aspect-square rounded-lg text-sm transition-colors",
                                isSelected
                                    ? "bg-blue-600 font-semibold text-white"
                                    : isPast
                                      ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
                                      : "text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-950/40",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SingleDatePicker;
