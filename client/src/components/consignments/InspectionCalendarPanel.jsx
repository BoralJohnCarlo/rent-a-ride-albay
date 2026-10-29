import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Plus,
    Save,
} from "lucide-react";

import Button from "../common/Button";
import Modal from "../common/Modal";
import Select from "../common/Select";
import Switch from "../common/Switch";

import useToast from "../../hooks/toast/useToast";
import {
    fetchInspectionSetting,
    updateInspectionSetting,
    getInspectionAvailability,
} from "../../api/inspectionSettingApi";

const SLOT_PERIOD_OPTIONS = [
    { value: "AM", label: "AM" },
    { value: "PM", label: "PM" },
    { value: "Custom", label: "Custom" },
];

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

// Local calendar date as YYYY-MM-DD — `toISOString()` shifts the date under
// UTC+ timezones (e.g. PH).
const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const InspectionCalendarPanel = () => {
    const toast = useToast();

    const [inspectionSetting, setInspectionSetting] = useState({
        inspectionSlots: [],
        disabledDates: [],
    });
    const [savingInspectionSetting, setSavingInspectionSetting] = useState(false);
    // { "YYYY-MM-DD|HH:mm": { booked, remaining } }
    const [slotBookings, setSlotBookings] = useState({});

    const [availableDates, setAvailableDates] = useState([]);
    const [calendarViewDate, setCalendarViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showAddSlotModal, setShowAddSlotModal] = useState(false);
    const [newSlotTime, setNewSlotTime] = useState("09:00");
    const [newSlotEndTime, setNewSlotEndTime] = useState("10:00");
    const [newSlotPeriod, setNewSlotPeriod] = useState("AM");
    const [selectedWeekdays, setSelectedWeekdays] = useState([
        1, 2, 3, 4, 5, 6, 0,
    ]);
    const [togglingDate, setTogglingDate] = useState(null);

    useEffect(() => {
        const loadInspectionSetting = async () => {
            try {
                const { data } = await fetchInspectionSetting();
                if (data?.data) {
                    setInspectionSetting({
                        inspectionSlots: data.data.inspectionSlots || [],
                        disabledDates: data.data.disabledDates || [],
                    });
                    setAvailableDates(
                        (data.data.inspectionSlots || []).map((slot) => ({
                            date: slot.date,
                            slots: slot.timeSlots || [],
                            weekdays: slot.weekdays || [],
                            enabled: slot.enabled !== false,
                        }))
                    );
                }
            } catch (error) {
                console.error("Failed to load inspection setting:", error);
            }
        };

        const loadSlotBookings = async () => {
            try {
                const { data } = await getInspectionAvailability();
                const map = {};
                (data?.data?.slots || []).forEach((day) => {
                    (day.timeSlots || []).forEach((ts) => {
                        map[`${day.date}|${ts.time}`] = {
                            booked: ts.booked,
                            remaining: ts.remaining,
                        };
                    });
                });
                setSlotBookings(map);
            } catch (error) {
                console.error("Failed to load slot bookings:", error);
            }
        };

        loadInspectionSetting();
        loadSlotBookings();
    }, []);

    const getDaysInMonth = (date) =>
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    const getStartDay = (date) =>
        new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const handlePrevMonth = () => {
        setCalendarViewDate((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setCalendarViewDate((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + 1);
            return newDate;
        });
    };

    const handleAddTimeSlot = () => {
        const selectedDateString = selectedDate?.date;
        if (!selectedDateString) {
            toast.warning("Please select a date first.");
            return;
        }

        if (!newSlotEndTime) {
            toast.warning("Please set an end time.");
            return;
        }

        if (newSlotEndTime <= newSlotTime) {
            toast.warning("End time must be after the start time.");
            return;
        }

        const timeSlot = {
            time: newSlotTime,
            endTime: newSlotEndTime,
            period: newSlotPeriod,
            maxAppointments: 1,
        };

        setAvailableDates((prev) => {
            const existingIndex = prev.findIndex(
                (d) => d.date === selectedDateString
            );

            if (existingIndex >= 0) {
                const newDates = [...prev];
                const existingSlots = newDates[existingIndex].slots || [];
                newDates[existingIndex] = {
                    ...newDates[existingIndex],
                    slots: [...existingSlots, timeSlot],
                };
                return newDates;
            }

            return [
                ...prev,
                {
                    date: selectedDateString,
                    slots: [timeSlot],
                    weekdays: selectedWeekdays,
                    enabled: true,
                },
            ];
        });

        setShowAddSlotModal(false);
        setNewSlotTime("09:00");
        setNewSlotEndTime("10:00");
        setNewSlotPeriod("AM");
    };

    const handleDeleteTimeSlot = (dateString, time) => {
        setAvailableDates((prev) => {
            const dateIndex = prev.findIndex((d) => d.date === dateString);
            if (dateIndex < 0) return prev;

            const slots = prev[dateIndex].slots || [];
            const filteredSlots = slots.filter((slot) => slot.time !== time);

            if (filteredSlots.length === 0) {
                return prev.filter((d) => d.date !== dateString);
            }

            return [
                ...prev.slice(0, dateIndex),
                { ...prev[dateIndex], slots: filteredSlots },
                ...prev.slice(dateIndex + 1),
            ];
        });
    };

    const handleToggleWeekday = (day) => {
        setSelectedWeekdays((prev) =>
            prev.includes(day)
                ? prev.filter((d) => d !== day)
                : [...prev, day]
        );
    };

    const buildInspectionSlotsPayload = () =>
        availableDates.map((d) => ({
            date: d.date,
            timeSlots: d.slots || [],
            enabled: d.enabled !== false,
            weekdays: d.weekdays || [],
        }));

    /*
     * Toggles a single, individual date between available/disabled — never
     * touches any other date. A switch reads as a live control, not a
     * staged form field, so it saves immediately instead of waiting for
     * the separate "Save Inspection Setting" click below (which only
     * covers slot/weekday edits) — otherwise flipping it silently reverts
     * on refresh with no feedback that it never actually persisted.
     */
    const handleToggleDateDisable = async (dateString) => {
        const wasDisabled =
            inspectionSetting.disabledDates.includes(dateString);
        const nextDisabledDates = wasDisabled
            ? inspectionSetting.disabledDates.filter((d) => d !== dateString)
            : [...inspectionSetting.disabledDates, dateString];

        setInspectionSetting((prev) => ({
            ...prev,
            disabledDates: nextDisabledDates,
        }));
        setTogglingDate(dateString);

        try {
            await updateInspectionSetting({
                inspectionSlots: buildInspectionSlotsPayload(),
                disabledDates: nextDisabledDates,
            });
            toast.success(
                wasDisabled
                    ? "Date marked available."
                    : "Date marked disabled."
            );
        } catch (error) {
            setInspectionSetting((prev) => ({
                ...prev,
                disabledDates: wasDisabled
                    ? [...prev.disabledDates, dateString]
                    : prev.disabledDates.filter((d) => d !== dateString),
            }));
            toast.error(
                error?.message || "Failed to update date availability."
            );
        } finally {
            setTogglingDate(null);
        }
    };

    const handleSaveInspectionSetting = async () => {
        setSavingInspectionSetting(true);
        try {
            await updateInspectionSetting({
                inspectionSlots: buildInspectionSlotsPayload(),
                disabledDates: inspectionSetting.disabledDates,
            });
            toast.success("Inspection setting saved.");
        } catch (error) {
            toast.error(error?.message || "Failed to save inspection setting.");
        } finally {
            setSavingInspectionSetting(false);
        }
    };

    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(calendarViewDate);
        const startDay = getStartDay(calendarViewDate);
        const days = [];

        for (let i = 0; i < startDay; i += 1) {
            days.push({
                currentMonth: false,
                dateString: "",
                day: "",
                date: new Date(),
            });
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

        const remainingCells = 42 - days.length;
        for (let i = 0; i < remainingCells; i += 1) {
            const date = new Date(
                calendarViewDate.getFullYear(),
                calendarViewDate.getMonth() + 1,
                i + 1
            );
            days.push({
                currentMonth: false,
                dateString: toDateString(date),
                day: i + 1,
                date,
            });
        }

        return days;
    }, [calendarViewDate]);

    const daySlots =
        (selectedDate &&
            availableDates.find((d) => d.date === selectedDate.date)?.slots) ||
        [];

    const isSelectedDateDisabled = Boolean(
        selectedDate &&
            inspectionSetting.disabledDates.includes(selectedDate.date)
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
            {/* Calendar — compact fixed-height day cells (square cells grew
                huge in the wide column) */}
            <div className="self-start rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <h3 className="min-w-[8rem] text-center text-sm font-bold text-gray-900 dark:text-gray-100">
                            {MONTHS[calendarViewDate.getMonth()]}{" "}
                            {calendarViewDate.getFullYear()}
                        </h3>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Slots
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Disabled
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {DAYS.map((day) => (
                        <div key={day} className="py-1">
                            {day.slice(0, 3)}
                        </div>
                    ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                    {calendarDays.map((day, index) => {
                        const isAvailable = availableDates.some(
                            (d) =>
                                d.date === day.dateString &&
                                Array.isArray(d.slots) &&
                                d.slots.length > 0
                        );
                        const isSelected =
                            selectedDate?.date === day.dateString;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const isPast = day.date < today;
                        const isDisabledDate =
                            inspectionSetting.disabledDates.includes(
                                day.dateString
                            );

                        return (
                            <button
                                key={index}
                                type="button"
                                disabled={
                                    !day.currentMonth || isPast
                                }
                                onClick={() =>
                                    setSelectedDate({
                                        date: day.dateString,
                                        display: day.day,
                                    })
                                }
                                className={`relative flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition sm:h-10 sm:text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                                    !day.currentMonth
                                        ? "border-transparent bg-transparent"
                                        : isSelected
                                          ? "border-blue-500 bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                          : isDisabledDate
                                            ? "border-red-100 bg-red-50/60 text-red-400 line-through dark:border-red-900/40 dark:bg-red-950/20"
                                            : isAvailable
                                              ? "border-green-200 bg-green-50 text-green-700 hover:border-green-300 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300"
                                              : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                                }`}
                            >
                                {day.day}
                                {isAvailable && !isDisabledDate && (
                                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                                )}
                                {isDisabledDate && (
                                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <p className="mt-2.5 text-xs text-gray-400 dark:text-gray-500">
                    Click a date to manage its inspection time slots.
                </p>
            </div>

            {/* Side panel */}
            <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                            <Clock size={16} className="text-blue-500" />
                            {selectedDate
                                ? `${MONTHS[calendarViewDate.getMonth()].slice(0, 3)} ${selectedDate.display}`
                                : "Time Slots"}
                        </h4>
                        {selectedDate && !isSelectedDateDisabled && (
                            <Button
                                size="sm"
                                variant="secondary"
                                leftIcon={<Plus size={14} />}
                                onClick={() => setShowAddSlotModal(true)}
                            >
                                Add
                            </Button>
                        )}
                    </div>

                    {!selectedDate ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Select a date on the calendar to manage its
                            availability and inspection slots.
                        </p>
                    ) : (
                        <>
                            <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {isSelectedDateDisabled
                                            ? "Disabled"
                                            : "Available"}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {isSelectedDateDisabled
                                            ? "No appointments can be booked on this date."
                                            : "Operators can book this date's time slots."}
                                    </p>
                                </div>
                                <Switch
                                    checked={!isSelectedDateDisabled}
                                    disabled={
                                        togglingDate === selectedDate.date
                                    }
                                    onChange={() =>
                                        handleToggleDateDisable(
                                            selectedDate.date
                                        )
                                    }
                                />
                            </div>

                            {isSelectedDateDisabled ? null : daySlots.length ===
                              0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    No time slots for this date yet.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {daySlots.map((slot, idx) => {
                                        const booking =
                                            slotBookings[
                                                `${selectedDate.date}|${slot.time}`
                                            ];
                                        const bookedCount =
                                            booking?.booked ?? 0;
                                        const full =
                                            bookedCount >=
                                            slot.maxAppointments;
                                        return (
                                            <li
                                                key={idx}
                                                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-800/50"
                                            >
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {slot.time}
                                                    {slot.endTime
                                                        ? ` – ${slot.endTime}`
                                                        : ""}
                                                </span>
                                                <span className="flex items-center gap-3">
                                                    <span
                                                        className={`text-xs font-semibold ${
                                                            full
                                                                ? "text-red-600 dark:text-red-400"
                                                                : "text-gray-500 dark:text-gray-400"
                                                        }`}
                                                    >
                                                        {full
                                                            ? "Booked"
                                                            : "Open"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDeleteTimeSlot(
                                                                selectedDate.date,
                                                                slot.time
                                                            )
                                                        }
                                                        className="text-xs font-medium text-red-500 hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </>
                    )}
                </div>

                <Button
                    className="w-full"
                    leftIcon={<Save size={16} />}
                    onClick={handleSaveInspectionSetting}
                    disabled={savingInspectionSetting}
                >
                    {savingInspectionSetting
                        ? "Saving…"
                        : "Save Inspection Setting"}
                </Button>
            </div>

            <Modal
                isOpen={showAddSlotModal && Boolean(selectedDate)}
                onClose={() => setShowAddSlotModal(false)}
                title={`Add Time Slot — ${selectedDate?.display ?? ""}`}
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setShowAddSlotModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddTimeSlot}>Add Slot</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Start Time
                            </label>
                            <input
                                type="time"
                                value={newSlotTime}
                                onChange={(e) => setNewSlotTime(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                End Time
                            </label>
                            <input
                                type="time"
                                value={newSlotEndTime}
                                onChange={(e) => setNewSlotEndTime(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            />
                        </div>
                    </div>
                    <div>
                        <Select
                            label="Period"
                            value={newSlotPeriod}
                            onChange={(e) =>
                                setNewSlotPeriod(e.target.value)
                            }
                            options={SLOT_PERIOD_OPTIONS}
                            className="py-2.5"
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Repeat Weekdays
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {DAYS.map((day, dayIndex) => (
                                <label
                                    key={day}
                                    className="flex cursor-pointer items-center gap-1.5 text-xs"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedWeekdays.includes(
                                            dayIndex
                                        )}
                                        onChange={() =>
                                            handleToggleWeekday(dayIndex)
                                        }
                                        className="h-3.5 w-3.5 rounded border-gray-400"
                                    />
                                    <span>{day.slice(0, 3)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </motion.div>
    );
};

export default InspectionCalendarPanel;
