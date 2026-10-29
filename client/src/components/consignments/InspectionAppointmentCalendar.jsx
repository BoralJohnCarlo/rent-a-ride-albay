import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import Alert from "../common/Alert";

import { getInspectionAvailability } from "../../api/inspectionSettingApi";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Local calendar date as YYYY-MM-DD — `toISOString()` shifts the date under
// UTC+ timezones (e.g. PH).
const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const parseValue = (value) => {
    if (!value) {
        return { date: "", time: "" };
    }

    const [date, timePart] = String(value).split("T");
    const time = timePart ? timePart.slice(0, 5) : "";

    return { date: date || "", time };
};

/*
 * Lets a new operator pick their vehicle inspection appointment from the
 * same admin-configured, capacity-checked slots used everywhere else in the
 * app (see InspectionCalendarPanel/BookInspectionDialog) instead of typing
 * in any arbitrary date/time. Reports the chosen slot back as a single
 * "YYYY-MM-DDTHH:mm:00" string via `onChange`, matching what the plain
 * datetime input used to produce.
 */
const InspectionAppointmentCalendar = ({
    value,
    onChange,
    disabled = false,
    error = "",
}) => {
    const initial = parseValue(value);

    const [slots, setSlots] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(initial.date || null);
    const [selectedTime, setSelectedTime] = useState(initial.time || null);

    useEffect(() => {
        let cancelled = false;
        setFetching(true);
        setLoadError("");

        getInspectionAvailability()
            .then(({ data }) => {
                if (cancelled) return;
                setSlots(data?.data?.slots ?? []);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(
                    err?.response?.data?.message ||
                        "Unable to load inspection availability."
                );
            })
            .finally(() => {
                if (!cancelled) setFetching(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const slotsByDate = useMemo(() => {
        const map = new Map();

        slots.forEach((day) => {
            const timeSlots = (day.timeSlots ?? []).filter(
                (ts) => ts.remaining > 0
            );

            if (timeSlots.length > 0) {
                map.set(day.date, timeSlots);
            }
        });

        return map;
    }, [slots]);

    const getDaysInMonth = (date) =>
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    const getStartDay = (date) =>
        new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(calendarViewDate);
        const startDay = getStartDay(calendarViewDate);
        const days = [];

        for (let i = 0; i < startDay; i += 1) {
            days.push({ currentMonth: false, dateString: "", day: "" });
        }

        for (let i = 1; i <= daysInMonth; i += 1) {
            const date = new Date(
                calendarViewDate.getFullYear(),
                calendarViewDate.getMonth(),
                i
            );
            days.push({
                currentMonth: true,
                dateString: toDateString(date),
                day: i,
                date,
            });
        }

        return days;
    }, [calendarViewDate]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const handleSelectDate = (dateString) => {
        if (disabled || !slotsByDate.has(dateString)) {
            return;
        }

        setSelectedDate(dateString);
        setSelectedTime(null);
    };

    const handleSelectTime = (time) => {
        if (disabled || !selectedDate) {
            return;
        }

        setSelectedTime(time);
        onChange?.(`${selectedDate}T${time}:00`);
    };

    const timeSlotsForSelectedDate = selectedDate
        ? slotsByDate.get(selectedDate) ?? []
        : [];

    return (
        <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Inspection Appointment
                <span className="ml-1 text-red-500">*</span>
            </label>

            <p className="text-xs text-gray-500 dark:text-gray-400">
                This appointment is for discussing partnership terms and
                commission rates, and for inspecting and setting up your
                vehicle — not just a vehicle drop-off.
            </p>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                {loadError && (
                    <div className="mb-4">
                        <Alert variant="error" message={loadError} />
                    </div>
                )}

                {fetching ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 size={16} className="animate-spin" />
                        Loading available appointment slots…
                    </div>
                ) : !loadError && slotsByDate.size === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        No inspection slots are currently open. Please check
                        back later or contact the administrator.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                        <div>
                            <div className="mb-3 flex items-center justify-between">
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() =>
                                        setCalendarViewDate((prev) => {
                                            const next = new Date(prev);
                                            next.setMonth(next.getMonth() - 1);
                                            return next;
                                        })
                                    }
                                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {MONTHS[calendarViewDate.getMonth()]}{" "}
                                    {calendarViewDate.getFullYear()}
                                </p>

                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() =>
                                        setCalendarViewDate((prev) => {
                                            const next = new Date(prev);
                                            next.setMonth(next.getMonth() + 1);
                                            return next;
                                        })
                                    }
                                    className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {DAYS.map((day) => (
                                    <div key={day} className="py-1">
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-1 grid grid-cols-7 gap-1">
                                {calendarDays.map((day, index) => {
                                    if (!day.currentMonth) {
                                        return (
                                            <div
                                                key={index}
                                                className="aspect-square"
                                            />
                                        );
                                    }

                                    const isAvailable = slotsByDate.has(
                                        day.dateString
                                    );
                                    const isSelected =
                                        selectedDate === day.dateString;
                                    const isPast = day.date < today;

                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            disabled={
                                                disabled ||
                                                !isAvailable ||
                                                isPast
                                            }
                                            onClick={() =>
                                                handleSelectDate(
                                                    day.dateString
                                                )
                                            }
                                            className={`relative aspect-square rounded-lg border text-xs transition disabled:cursor-not-allowed ${
                                                isSelected
                                                    ? "border-yellow-500 bg-yellow-400 font-bold text-gray-950"
                                                    : isAvailable && !isPast
                                                      ? "border-green-200 bg-green-50 text-green-700 hover:border-green-400 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300"
                                                      : "border-gray-100 bg-gray-50 text-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600"
                                            }`}
                                        >
                                            {day.day}
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                                <span className="h-2 w-2 rounded-full bg-green-400" />
                                Dates with open slots
                            </p>
                        </div>

                        <div className="border-t border-gray-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 dark:border-gray-800">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {selectedDate
                                    ? "Available Times"
                                    : "Select a date"}
                            </p>

                            {!selectedDate ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    Pick a highlighted date to see its open
                                    appointment times.
                                </p>
                            ) : timeSlotsForSelectedDate.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    No open times left for this date.
                                </p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {timeSlotsForSelectedDate.map((ts) => {
                                        const isSelected =
                                            selectedTime === ts.time;

                                        return (
                                            <button
                                                key={ts.time}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() =>
                                                    handleSelectTime(ts.time)
                                                }
                                                className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                                    isSelected
                                                        ? "border-yellow-500 bg-yellow-400 text-gray-950"
                                                        : "border-gray-300 bg-white text-gray-700 hover:border-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                                }`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <CalendarCheck size={12} />
                                                    {ts.time}
                                                    {ts.endTime
                                                        ? ` – ${ts.endTime}`
                                                        : ""}
                                                </span>
                                                <span
                                                    className={`mt-0.5 block text-[10px] ${
                                                        isSelected
                                                            ? "text-gray-800"
                                                            : "text-gray-400"
                                                    }`}
                                                >
                                                    {ts.remaining} left
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
};

export default InspectionAppointmentCalendar;
