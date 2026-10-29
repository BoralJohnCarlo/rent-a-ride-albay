import { useEffect, useMemo, useState } from "react";

import {
    BellRing,
    CheckCircle2,
    Clock3,
    MinusCircle,
    RotateCcw,
    TrafficCone,
    Wrench,
    XCircle,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";

import {
    refundMaintenanceConflict,
    sendMaintenanceConflictOptions,
} from "../../api/bookingApi";
import {
    MAINTENANCE_CONFLICT_STATUS,
    formatConflictDateTime,
} from "../../constants/maintenanceConflict";
import { VEHICLE_MAINTENANCE_MODE } from "../../constants/vehicleConstants";

const ACTION = {
    NOTIFY: "notify",
    REFUND: "refund",
    LATER: "later",
};

const ACTION_OPTIONS = [
    {
        value: ACTION.NOTIFY,
        label: "Notify",
        icon: BellRing,
        active: "bg-amber-400 text-gray-900 shadow-sm",
        explain:
            "The customer is told now and picks another vehicle for the same dates or a full refund.",
    },
    {
        value: ACTION.REFUND,
        label: "Refund",
        icon: RotateCcw,
        active: "bg-rose-600 text-white shadow-sm",
        explain:
            "Cancelled right away with a full refund — no fees — and the customer is told why.",
    },
    {
        value: ACTION.LATER,
        label: "Later",
        icon: Clock3,
        active: "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900",
        explain:
            "Only flagged. Handle it from Bookings → Maintenance conflicts.",
    },
];

const ALREADY_NOTIFIED_EXPLAIN =
    "Already asked to choose for this vehicle — their deadline still applies.";

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

const isAlreadyNotified = (booking) =>
    booking?.conflictStatus ===
    MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER;

const defaultAction = (booking) =>
    isAlreadyNotified(booking) ? ACTION.LATER : ACTION.NOTIFY;

const dayParts = (value) => {
    const date = new Date(value);

    return {
        month: date.toLocaleString("en-PH", { month: "short" }),
        day: date.toLocaleString("en-PH", { day: "numeric" }),
        weekday: date.toLocaleString("en-PH", { weekday: "short" }),
    };
};

const shortDate = (value) =>
    new Date(value).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

const ActionSwitch = ({ value, onChange, disabled, allowNotify = true }) => (
    <div
        role="radiogroup"
        className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
    >
        {ACTION_OPTIONS.map(({ value: option, label, icon: Icon, active }) => {
            const selected = value === option;
            const unavailable = option === ACTION.NOTIFY && !allowNotify;

            return (
                <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled || unavailable}
                    onClick={() => onChange(option)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        selected
                            ? active
                            : "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                    <Icon size={13} />
                    {label}
                </button>
            );
        })}
    </div>
);

const RESULT_STYLES = {
    done: {
        icon: CheckCircle2,
        className: "text-emerald-600 dark:text-emerald-400",
    },
    failed: {
        icon: XCircle,
        className: "text-rose-600 dark:text-rose-400",
    },
    skipped: {
        icon: MinusCircle,
        className: "text-gray-400 dark:text-gray-500",
    },
};

/*
 * Admin: the bookings a new maintenance window runs into, shown before it's
 * applied, with what to do for each — notify the customer with their
 * options (another vehicle or a full refund), refund now, or decide later.
 * Confirming applies the maintenance (`applyMaintenance`, which returns the
 * bookings actually flagged), then each choice, and shows how each went.
 */
const MaintenanceConflictConfirmDialog = ({
    isOpen,
    onBack,
    onFinished,
    vehicle,
    mode,
    preview,
    applyMaintenance,
}) => {
    const conflicts = useMemo(() => preview?.conflicts ?? [], [preview]);

    const [choices, setChoices] = useState({});
    const [phase, setPhase] = useState("review");
    const [results, setResults] = useState({});
    const [error, setError] = useState("");

    useEffect(() => {
        if (isOpen) {
            setChoices(
                Object.fromEntries(
                    conflicts.map((booking) => [
                        booking._id,
                        defaultAction(booking),
                    ])
                )
            );
            setPhase("review");
            setResults({});
            setError("");
        }
    }, [isOpen, conflicts]);

    const offRoad = mode === VEHICLE_MAINTENANCE_MODE.OFF_ROAD;
    const HeroIcon = offRoad ? TrafficCone : Wrench;
    const working = phase === "working";
    const finished = phase === "done";

    const choiceFor = (booking) => choices[booking._id] ?? defaultAction(booking);

    const setAll = (action) =>
        setChoices(
            Object.fromEntries(
                conflicts.map((booking) => [
                    booking._id,
                    action === ACTION.NOTIFY && isAlreadyNotified(booking)
                        ? ACTION.LATER
                        : action,
                ])
            )
        );

    const counts = conflicts.reduce(
        (total, booking) => {
            total[choiceFor(booking)] += 1;
            return total;
        },
        { [ACTION.NOTIFY]: 0, [ACTION.REFUND]: 0, [ACTION.LATER]: 0 }
    );

    const uniformAction = [ACTION.NOTIFY, ACTION.REFUND, ACTION.LATER].find(
        (action) => counts[action] === conflicts.length
    );

    const confirm = async () => {
        setPhase("working");
        setError("");

        let flagged;

        try {
            flagged = await applyMaintenance();
        } catch (applyError) {
            setPhase("review");
            setError(
                applyError?.response?.data?.message ||
                    "Couldn't set maintenance."
            );
            return;
        }

        const flaggedIds = new Set(
            (flagged ?? []).map((booking) => String(booking._id))
        );
        const next = {};

        // One at a time: each call settles money and notifies a customer.
        for (const booking of conflicts) {
            const action = choiceFor(booking);

            if (!flaggedIds.has(String(booking._id))) {
                next[booking._id] = {
                    state: "skipped",
                    message:
                        "No longer inside this maintenance — nothing to do.",
                };
            } else if (action === ACTION.LATER) {
                next[booking._id] = {
                    state: "skipped",
                    message: isAlreadyNotified(booking)
                        ? "Still waiting for the customer to choose."
                        : "Flagged — handle it from Bookings.",
                };
            } else {
                try {
                    if (action === ACTION.NOTIFY) {
                        await sendMaintenanceConflictOptions(booking._id);
                    } else {
                        await refundMaintenanceConflict(booking._id);
                    }

                    next[booking._id] = {
                        state: "done",
                        message:
                            action === ACTION.NOTIFY
                                ? "Customer notified with their options."
                                : "Cancelled with a full refund.",
                    };
                } catch (actionError) {
                    next[booking._id] = {
                        state: "failed",
                        message: `${
                            actionError?.response?.data?.message ||
                            "Request failed."
                        } It stays flagged in Bookings.`,
                    };
                }
            }

            setResults({ ...next });
        }

        // Bookings flagged that weren't in the preview (booked meanwhile).
        const extra = (flagged ?? []).filter(
            (booking) =>
                !conflicts.some(
                    (listed) => String(listed._id) === String(booking._id)
                )
        ).length;

        if (extra > 0) {
            setError(
                `${extra} more booking${
                    extra === 1 ? " was" : "s were"
                } made in the meantime and ${
                    extra === 1 ? "is" : "are"
                } flagged too — handle ${
                    extra === 1 ? "it" : "them"
                } from Bookings → Maintenance conflicts.`
            );
        }

        setPhase("done");
    };

    const resultList = Object.values(results);
    const failedCount = resultList.filter(
        (result) => result.state === "failed"
    ).length;

    return (
        <Modal
            isOpen={isOpen}
            onClose={working ? undefined : finished ? onFinished : onBack}
            closeOnOverlayClick={!working}
            closeOnEscape={!working}
            title={finished ? "Maintenance applied" : "Bookings in the way"}
            description={
                finished
                    ? failedCount
                        ? `${failedCount} action${
                              failedCount === 1 ? "" : "s"
                          } didn't go through — those bookings stay flagged.`
                        : "Here's what happened to each booking."
                    : "Decide what each customer hears before you confirm."
            }
            size="lg"
            footer={
                finished ? (
                    <Button onClick={onFinished}>Done</Button>
                ) : (
                    <>
                        <Button
                            variant="secondary"
                            onClick={onBack}
                            disabled={working}
                        >
                            Back
                        </Button>
                        <Button
                            variant={offRoad ? "danger" : "primary"}
                            onClick={confirm}
                            loading={working}
                        >
                            {offRoad
                                ? "Take off road & apply"
                                : "Start maintenance & apply"}
                        </Button>
                    </>
                )
            }
        >
            <div className="space-y-4">
                {/* Work-zone banner */}
                <div className="overflow-hidden rounded-2xl border border-gray-900/10 bg-gray-950 text-white dark:border-white/10">
                    <div
                        aria-hidden="true"
                        className="h-2.5"
                        style={{
                            backgroundImage:
                                "repeating-linear-gradient(-45deg, #facc15 0 12px, #111827 12px 24px)",
                        }}
                    />
                    <div className="flex items-center gap-4 p-4">
                        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-gray-950 shadow-[0_0_0_4px_rgba(250,204,21,0.18)]">
                            <HeroIcon size={26} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
                                {offRoad ? "Taking off road" : "Maintenance"} ·{" "}
                                {vehicleName(vehicle)}
                                {vehicle?.plateNumber
                                    ? ` · ${vehicle.plateNumber}`
                                    : ""}
                            </p>
                            <p className="mt-1 text-lg font-black leading-tight">
                                {conflicts.length} booking
                                {conflicts.length === 1 ? "" : "s"} fall
                                {conflicts.length === 1 ? "s" : ""} inside it
                            </p>
                            <p className="mt-0.5 text-xs text-gray-300">
                                {preview?.until
                                    ? `Unbookable until ${formatConflictDateTime(
                                          preview.until
                                      )}`
                                    : "No end date — unbookable until you put it back in service"}
                            </p>
                        </div>
                        <span className="hidden text-5xl font-black leading-none text-white/10 sm:block">
                            {String(conflicts.length).padStart(2, "0")}
                        </span>
                    </div>
                </div>

                {!finished && (
                    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
                        <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Apply to all
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Or choose per booking below.
                            </p>
                        </div>
                        <div className="sm:w-72">
                            <ActionSwitch
                                value={uniformAction}
                                onChange={setAll}
                                disabled={working}
                            />
                        </div>
                    </div>
                )}

                <ul className="space-y-2.5">
                    {conflicts.map((booking) => {
                        const action = choiceFor(booking);
                        const notified = isAlreadyNotified(booking);
                        const pickup = dayParts(booking.startDate);
                        const result = results[booking._id];
                        const ResultIcon = result
                            ? RESULT_STYLES[result.state].icon
                            : null;
                        const explain =
                            notified && action === ACTION.LATER
                                ? ALREADY_NOTIFIED_EXPLAIN
                                : ACTION_OPTIONS.find(
                                      (option) => option.value === action
                                  )?.explain;

                        return (
                            <li
                                key={booking._id}
                                className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                            >
                                {/* Pickup day, tear-off calendar style */}
                                <div className="flex w-14 shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200 text-center dark:border-gray-700">
                                    <span className="bg-rose-600 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                        {pickup.month}
                                    </span>
                                    <span className="flex-1 pt-1 text-xl font-black leading-none text-gray-900 dark:text-white">
                                        {pickup.day}
                                    </span>
                                    <span className="pb-1 text-[10px] font-medium text-gray-400">
                                        {pickup.weekday}
                                    </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                            {booking.customerName}
                                        </p>
                                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                            {booking.bookingCode}
                                        </span>
                                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                            {booking.status}
                                        </span>
                                        {notified && (
                                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                                Already notified
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                        {shortDate(booking.startDate)} →{" "}
                                        {shortDate(booking.endDate)}
                                    </p>

                                    {result ? (
                                        <p
                                            className={`mt-2 flex items-start gap-1.5 text-xs font-medium ${
                                                RESULT_STYLES[result.state]
                                                    .className
                                            }`}
                                        >
                                            <ResultIcon
                                                size={14}
                                                className="mt-px shrink-0"
                                            />
                                            {result.message}
                                        </p>
                                    ) : (
                                        <div className="mt-2.5 space-y-1.5">
                                            <ActionSwitch
                                                value={action}
                                                allowNotify={!notified}
                                                disabled={working}
                                                onChange={(next) =>
                                                    setChoices((current) => ({
                                                        ...current,
                                                        [booking._id]: next,
                                                    }))
                                                }
                                            />
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                {explain}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {!finished && (
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            {counts[ACTION.NOTIFY]} to notify
                        </span>
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                            {counts[ACTION.REFUND]} to refund
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {counts[ACTION.LATER]} for later
                        </span>
                    </div>
                )}

                {!finished && counts[ACTION.NOTIFY] > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Notified customers get 48 hours to choose (no later
                        than 24 hours before pickup). No reply by then means
                        an automatic full refund.
                    </p>
                )}

                {error && (
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default MaintenanceConflictConfirmDialog;
