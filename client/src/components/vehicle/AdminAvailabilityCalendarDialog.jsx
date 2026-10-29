import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ChevronLeft,
    ChevronRight,
    Trash2,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Textarea from "../common/Textarea";

import { getVehicleAvailabilityCalendar } from "../../api/vehicleApi";
import {
    toISODate,
    buildMonthWeeks,
    buildDateRangesFromSelection,
} from "../../utils/calendarGrid";

import useVehicle from "../../hooks/vehicles/useVehicle";
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

const formatDisplayDate = (value) =>
    new Date(value).toLocaleDateString(
        "en-PH",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
        }
    );

/*
 * Admin-only counterpart to the operator's RequestUnavailabilityDialog —
 * same calendar, but an admin's block takes effect immediately (no approval
 * step) and always carries a reason. The reason is admin-facing only: the
 * public/customer calendar (AvailabilityCalendar.jsx) never shows why a day
 * is unavailable, only whether it is.
 */
const AdminAvailabilityCalendarDialog = ({
    open,
    vehicle,
    onClose,
}) => {
    const vehicleId = vehicle?._id;

    const toast = useToast();

    const {
        addVehicleBlockedDate,
        removeVehicleBlockedDate,
    } = useVehicle();

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
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [removingId, setRemovingId] = useState(null);
    const [confirmRemoveId, setConfirmRemoveId] =
        useState(null);

    useEffect(() => {
        if (open) {
            return;
        }

        setSelectedDates(new Set());
        setReason("");
        setFormError("");
        setConfirmRemoveId(null);
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
        /*
         * Also reload whenever the vehicle's blocked dates change (after an
         * add/remove) so a just-removed day immediately turns green again,
         * and a just-added one immediately turns amber.
         */
    }, [
        open,
        vehicleId,
        visibleMonth,
        vehicle?.availability?.blockedDates,
    ]);

    const blockedDates = useMemo(
        () =>
            Array.isArray(
                vehicle?.availability?.blockedDates
            )
                ? vehicle.availability.blockedDates
                : [],
        [vehicle]
    );

    /*
     * Ranges are stored exclusive-end ([start, end)) — see
     * buildDateRangesFromSelection.
     */
    const findBlockedEntry = (date) =>
        blockedDates.find((entry) => {
            const start = new Date(entry.startDate);
            const end = new Date(entry.endDate);

            return date >= start && date < end;
        });

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

    const toggleDate = (date, isBlocked, isUnavailable) => {
        if (date < today || isBlocked || isUnavailable) {
            return;
        }

        const iso = toISODate(date);

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

        if (!reason.trim()) {
            setFormError(
                "A reason is required when blocking dates."
            );
            return;
        }

        const dateRanges =
            buildDateRangesFromSelection(selectedDates);

        setSubmitting(true);

        try {
            for (const range of dateRanges) {
                const result =
                    await addVehicleBlockedDate(
                        vehicleId,
                        {
                            startDate: range.startDate,
                            endDate: range.endDate,
                            reason: reason.trim(),
                        }
                    );

                if (
                    result?.meta?.requestStatus ===
                    "rejected"
                ) {
                    throw new Error(
                        typeof result.payload ===
                            "string"
                            ? result.payload
                            : "Unable to block those dates."
                    );
                }
            }

            toast.success(
                "Vehicle blocked for the selected dates.",
                "Dates Blocked"
            );

            setSelectedDates(new Set());
            setReason("");
        } catch (error) {
            setFormError(
                error?.message ||
                    "Unable to block those dates."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (blockedDateId) => {
        setRemovingId(blockedDateId);

        try {
            const result =
                await removeVehicleBlockedDate(
                    vehicleId,
                    blockedDateId
                );

            if (
                result?.meta?.requestStatus ===
                "rejected"
            ) {
                throw new Error(
                    typeof result.payload === "string"
                        ? result.payload
                        : "Unable to remove that block."
                );
            }

            toast.success(
                "Block removed.",
                "Done"
            );

            setConfirmRemoveId(null);
        } catch (error) {
            toast.error(
                error?.message ||
                    "Unable to remove that block."
            );
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Manage Availability${
                vehicle?.vehicleCode
                    ? ` — ${vehicle.vehicleCode}`
                    : ""
            }`}
            size="lg"
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Close
                    </Button>

                    <Button
                        loading={submitting}
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        Block Selected Dates
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select date(s) to withdraw this
                    vehicle from booking. Blocks apply
                    immediately — no approval needed.
                    The reason you give is only ever
                    shown here to staff; customers just
                    see the date marked unavailable.
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

                                        const blockedEntry =
                                            findBlockedEntry(
                                                date
                                            );

                                        const isBlocked =
                                            Boolean(
                                                blockedEntry
                                            );

                                        const isUnavailable =
                                            !isBlocked &&
                                            unavailableDates.has(
                                                iso
                                            );

                                        const isSelected =
                                            selectedDates.has(
                                                iso
                                            );

                                        const isDisabled =
                                            isPast ||
                                            isBlocked ||
                                            isUnavailable ||
                                            calendarLoading;

                                        return (
                                            <button
                                                key={iso}
                                                type="button"
                                                disabled={
                                                    isDisabled
                                                }
                                                title={
                                                    blockedEntry?.reason ||
                                                    undefined
                                                }
                                                onClick={() =>
                                                    toggleDate(
                                                        date,
                                                        isBlocked,
                                                        isUnavailable
                                                    )
                                                }
                                                className={[
                                                    "flex h-9 items-center justify-center rounded-lg text-xs font-semibold transition",
                                                    calendarLoading
                                                        ? "animate-pulse bg-gray-100 text-transparent dark:bg-gray-800"
                                                        : isSelected
                                                          ? "bg-blue-600 text-white shadow-sm"
                                                          : isBlocked
                                                            ? "cursor-not-allowed bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
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
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                            Blocked (hover for reason)
                        </span>

                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-200" />
                            Booked
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
                                            `${iso}T00:00:00`
                                        )}
                                    </span>
                                )
                            )}
                        </div>
                    </div>
                )}

                <Textarea
                    label="Reason"
                    required
                    rows={2}
                    value={reason}
                    onChange={(event) =>
                        setReason(event.target.value)
                    }
                    placeholder="e.g. Scheduled maintenance, relocating the vehicle"
                    disabled={submitting}
                    helperText="Visible to admins and operators only — never shown to customers."
                />

                {formError && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {formError}
                    </p>
                )}

                {blockedDates.length > 0 && (
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Current Blocks (
                            {blockedDates.length})
                        </p>

                        <div className="space-y-2">
                            {blockedDates.map((entry) => (
                                <div
                                    key={entry._id}
                                    className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatDisplayDate(
                                                    entry.startDate
                                                )}{" "}
                                                –{" "}
                                                {formatDisplayDate(
                                                    entry.endDate
                                                )}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {entry.reason ||
                                                    "No reason given."}
                                            </p>
                                        </div>

                                        {confirmRemoveId ===
                                        entry._id ? (
                                            <div className="flex shrink-0 items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="danger"
                                                    loading={
                                                        removingId ===
                                                        entry._id
                                                    }
                                                    onClick={() =>
                                                        handleRemove(
                                                            entry._id
                                                        )
                                                    }
                                                >
                                                    Confirm
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        removingId ===
                                                        entry._id
                                                    }
                                                    onClick={() =>
                                                        setConfirmRemoveId(
                                                            null
                                                        )
                                                    }
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setConfirmRemoveId(
                                                        entry._id
                                                    )
                                                }
                                            >
                                                <Trash2
                                                    size={
                                                        14
                                                    }
                                                />
                                                <span className="ml-1">
                                                    Remove
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default AdminAvailabilityCalendarDialog;
