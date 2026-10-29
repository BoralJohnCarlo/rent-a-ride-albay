import {
    useEffect,
    useMemo,
    useState,
} from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Select from "../common/Select";
import Input from "../common/Input";

import { getVehicleAvailabilityCalendar } from "../../api/vehicleApi";
import { toISODate, buildMonthWeeks } from "../../utils/calendarGrid";

import {
    AVAILABILITY_REQUEST_REASON,
    AVAILABILITY_REQUEST_REASON_OPTIONS,
} from "../../constants/vehicleAvailabilityRequestConstants";

import useVehicleAvailabilityRequests from "../../hooks/vehicleAvailabilityRequests/useVehicleAvailabilityRequests";
import useToast from "../../hooks/toast/useToast";

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
 * Collapses a set of individually-selected ISO dates into consecutive
 * {startDate, endDate} ranges (exclusive end — the day after the last
 * selected day in a run), matching the exclusive-end convention the server
 * uses for blocked date ranges.
 */
const buildDateRangesFromSelection = (
    selectedDates
) => {
    const sorted = Array.from(selectedDates).sort();
    const ranges = [];

    let rangeStart = null;
    let previous = null;

    const pushRange = () => {
        const end = new Date(previous);
        end.setDate(end.getDate() + 1);

        ranges.push({
            startDate: rangeStart.toISOString(),
            endDate: end.toISOString(),
        });
    };

    for (const iso of sorted) {
        const date = new Date(`${iso}T00:00:00`);

        if (rangeStart && previous) {
            const expectedNext = new Date(previous);
            expectedNext.setDate(
                expectedNext.getDate() + 1
            );

            if (
                date.getTime() ===
                expectedNext.getTime()
            ) {
                previous = date;
                continue;
            }

            pushRange();
        }

        rangeStart = date;
        previous = date;
    }

    if (rangeStart) {
        pushRange();
    }

    return ranges;
};

const formatDisplayDate = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(
        "en-PH",
        {
            month: "short",
            day: "numeric",
        }
    );

const RequestUnavailabilityDialog = ({
    open,
    vehicle,
    onClose,
    onSuccess,
}) => {
    const vehicleId = vehicle?._id;

    const toast = useToast();

    const { submitRequest } =
        useVehicleAvailabilityRequests();

    const today = useMemo(() => {
        const now = new Date();

        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
    }, []);

    const [visibleMonth, setVisibleMonth] = useState(
        () =>
            new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            )
    );

    const [unavailableDates, setUnavailableDates] =
        useState(new Set());

    const [calendarLoading, setCalendarLoading] =
        useState(false);

    const [selectedDates, setSelectedDates] = useState(
        new Set()
    );

    const [reason, setReason] = useState("");
    const [reasonDetails, setReasonDetails] =
        useState("");

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        if (open) {
            return;
        }

        setSelectedDates(new Set());
        setReason("");
        setReasonDetails("");
        setFormError("");
        setVisibleMonth(
            new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            )
        );
    }, [open, today]);

    useEffect(() => {
        if (!open || !vehicleId) {
            return undefined;
        }

        let cancelled = false;

        const monthStart = visibleMonth;

        const monthEnd = new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth() + 1,
            1
        );

        const load = async () => {
            setCalendarLoading(true);

            try {
                const { data } =
                    await getVehicleAvailabilityCalendar(
                        vehicleId,
                        toISODate(monthStart),
                        toISODate(monthEnd)
                    );

                if (!cancelled) {
                    setUnavailableDates(
                        new Set(
                            data?.unavailableDates || []
                        )
                    );
                }
            } catch {
                if (!cancelled) {
                    setUnavailableDates(new Set());
                }
            } finally {
                if (!cancelled) {
                    setCalendarLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [open, vehicleId, visibleMonth]);

    const weeks = useMemo(
        () =>
            buildMonthWeeks(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth()
            ),
        [visibleMonth]
    );

    const monthLabel = visibleMonth.toLocaleDateString(
        "en-PH",
        {
            month: "long",
            year: "numeric",
        }
    );

    const isCurrentMonth =
        visibleMonth.getFullYear() ===
            today.getFullYear() &&
        visibleMonth.getMonth() === today.getMonth();

    const toggleDate = (date) => {
        if (date < today) {
            return;
        }

        const iso = toISODate(date);

        if (unavailableDates.has(iso)) {
            return;
        }

        setSelectedDates((previous) => {
            const next = new Set(previous);

            if (next.has(iso)) {
                next.delete(iso);
            } else {
                next.add(iso);
            }

            return next;
        });
    };

    const sortedSelectedDates = useMemo(
        () => Array.from(selectedDates).sort(),
        [selectedDates]
    );

    const handleSubmit = async () => {
        setFormError("");

        if (selectedDates.size === 0) {
            setFormError(
                "Select at least one date to block."
            );
            return;
        }

        if (!reason) {
            setFormError("Please select a reason.");
            return;
        }

        if (
            reason === AVAILABILITY_REQUEST_REASON.OTHERS &&
            !reasonDetails.trim()
        ) {
            setFormError("Please describe the reason.");
            return;
        }

        const dateRanges =
            buildDateRangesFromSelection(selectedDates);

        setSubmitting(true);

        try {
            await submitRequest({
                vehicleId,
                dateRanges,
                reason,
                reasonDetails: reasonDetails.trim(),
            });

            toast.success(
                "Unavailability request submitted. Awaiting admin approval.",
                "Request Submitted"
            );

            onSuccess?.();
        } catch (error) {
            const message =
                error?.message ||
                (typeof error === "string"
                    ? error
                    : "Unable to submit the request.");

            setFormError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Request Unavailable Dates"
            size="lg"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>

                    <Button
                        loading={submitting}
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        Submit Request
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select the date(s) this vehicle
                    should be withdrawn from booking.
                    Dates that are already booked or
                    blocked can't be selected. An admin
                    must approve this request before the
                    vehicle actually becomes unavailable.
                </p>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() =>
                                !isCurrentMonth &&
                                setVisibleMonth(
                                    (current) =>
                                        new Date(
                                            current.getFullYear(),
                                            current.getMonth() -
                                                1,
                                            1
                                        )
                                )
                            }
                            disabled={isCurrentMonth}
                            aria-label="Previous month"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {monthLabel}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setVisibleMonth(
                                    (current) =>
                                        new Date(
                                            current.getFullYear(),
                                            current.getMonth() +
                                                1,
                                            1
                                        )
                                )
                            }
                            aria-label="Next month"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
                        {WEEKDAY_LABELS.map(
                            (label, index) => (
                                <div
                                    key={`${label}-${index}`}
                                    className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                                >
                                    {label}
                                </div>
                            )
                        )}

                        {weeks.flatMap(
                            (week, weekIndex) =>
                                week.map(
                                    (date, dayIndex) => {
                                        if (!date) {
                                            return (
                                                <div
                                                    key={`empty-${weekIndex}-${dayIndex}`}
                                                />
                                            );
                                        }

                                        const iso =
                                            toISODate(date);

                                        const isPast =
                                            date < today;

                                        const isUnavailable =
                                            unavailableDates.has(
                                                iso
                                            );

                                        const isSelected =
                                            selectedDates.has(
                                                iso
                                            );

                                        const isDisabled =
                                            isPast ||
                                            isUnavailable ||
                                            calendarLoading;

                                        return (
                                            <button
                                                key={iso}
                                                type="button"
                                                disabled={
                                                    isDisabled
                                                }
                                                onClick={() =>
                                                    toggleDate(
                                                        date
                                                    )
                                                }
                                                className={[
                                                    "flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                                                    calendarLoading
                                                        ? "animate-pulse bg-gray-100 text-transparent dark:bg-gray-800"
                                                        : isSelected
                                                          ? "bg-blue-600 text-white shadow-sm"
                                                          : isDisabled
                                                            ? "cursor-not-allowed bg-red-50 text-red-300 dark:bg-red-500/10 dark:text-red-500/40"
                                                            : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25",
                                                ].join(
                                                    " "
                                                )}
                                            >
                                                {date.getDate()}
                                            </button>
                                        );
                                    }
                                )
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                            Selectable
                        </span>

                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                            Selected
                        </span>

                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-200" />
                            Unavailable
                        </span>
                    </div>
                </div>

                {sortedSelectedDates.length > 0 && (
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Selected Dates (
                            {sortedSelectedDates.length})
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                            {sortedSelectedDates.map(
                                (iso) => (
                                    <span
                                        key={iso}
                                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                    >
                                        {formatDisplayDate(
                                            iso
                                        )}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                )}

                <Select
                    label="Reason"
                    required
                    value={reason}
                    onChange={(event) =>
                        setReason(event.target.value)
                    }
                    options={
                        AVAILABILITY_REQUEST_REASON_OPTIONS
                    }
                    disabled={submitting}
                />

                {reason ===
                    AVAILABILITY_REQUEST_REASON.OTHERS && (
                    <Input
                        label="Describe the reason"
                        required
                        value={reasonDetails}
                        onChange={(event) =>
                            setReasonDetails(
                                event.target.value
                            )
                        }
                        placeholder="e.g. Family emergency, relocating the vehicle"
                        disabled={submitting}
                    />
                )}

                {formError && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {formError}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default RequestUnavailabilityDialog;
