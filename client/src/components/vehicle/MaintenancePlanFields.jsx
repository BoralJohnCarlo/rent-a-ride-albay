import { useEffect, useState } from "react";

import { CalendarClock, Clock, Wrench } from "lucide-react";

import Input from "../common/Input";
import Textarea from "../common/Textarea";

import { previewVehicleMaintenance } from "../../api/vehicleApi";
import {
    VEHICLE_MAINTENANCE_MODE,
    MAX_VEHICLE_MAINTENANCE_DAYS,
} from "../../constants/vehicleConstants";
import {
    EMPTY_MAINTENANCE_PLAN,
    toMaintenancePayload,
    validateMaintenancePlan,
} from "../../utils/maintenancePlan";

const formatDateTime = (value) =>
    new Date(value).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

const MODE_OPTIONS = [
    {
        mode: VEHICLE_MAINTENANCE_MODE.TURNAROUND,
        icon: Clock,
        title: "Standard turnaround",
        description:
            "Cleaning and inspection only — the usual buffer between rentals. Bookable again right after.",
    },
    {
        mode: VEHICLE_MAINTENANCE_MODE.EXTENDED,
        icon: CalendarClock,
        title: "Set number of days",
        description:
            "Repairs or servicing. Those days are disabled on the booking calendar; later dates stay bookable.",
    },
    {
        mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
        icon: Wrench,
        title: "Off road",
        description:
            "No end date. No dates can be booked until you put it back in service. Settings → Bookings decides whether customers still see it listed.",
    },
];

/*
 * What happens to a vehicle under maintenance: turnaround, a number of days,
 * or off road. Previews the window and lists the bookings it would run
 * into, so the admin knows which customers will need another vehicle or a
 * refund before confirming. `from` is when it starts (the return time, for
 * a return outcome; now otherwise). `conflictFollowUp` replaces the note on
 * what happens to those bookings.
 */
const MaintenancePlanFields = ({
    vehicleId,
    value,
    onChange,
    from = null,
    conflictFollowUp = null,
}) => {
    const plan = value ?? EMPTY_MAINTENANCE_PLAN;
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState("");

    const planError = validateMaintenancePlan(plan);

    useEffect(() => {
        if (!vehicleId || planError) {
            setPreview(null);
            setPreviewError("");
            return undefined;
        }

        let active = true;

        // Typing a day count shouldn't fire a request per keystroke.
        const timer = setTimeout(() => {
            previewVehicleMaintenance(vehicleId, {
                ...toMaintenancePayload(plan),
                from,
            })
                .then((response) => {
                    if (active) {
                        setPreview(response?.data ?? null);
                        setPreviewError("");
                    }
                })
                .catch((error) => {
                    if (active) {
                        setPreview(null);
                        setPreviewError(
                            error?.response?.data?.message ||
                                "Couldn't check upcoming bookings."
                        );
                    }
                });
        }, 300);

        return () => {
            active = false;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleId, plan.mode, plan.days, from, planError]);

    const update = (changes) => onChange({ ...plan, ...changes });

    const conflicts = preview?.conflicts ?? [];

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                {MODE_OPTIONS.map(
                    ({ mode, icon: Icon, title, description }) => {
                        const selected = plan.mode === mode;

                        return (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => update({ mode })}
                                aria-pressed={selected}
                                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                                    selected
                                        ? mode ===
                                          VEHICLE_MAINTENANCE_MODE.OFF_ROAD
                                            ? "border-red-400 bg-red-50 ring-1 ring-red-400 dark:border-red-500/60 dark:bg-red-500/10"
                                            : "border-yellow-400 bg-yellow-50 ring-1 ring-yellow-400 dark:border-yellow-500/60 dark:bg-yellow-500/10"
                                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                                }`}
                            >
                                <Icon
                                    size={18}
                                    className={`mt-0.5 shrink-0 ${
                                        selected
                                            ? "text-gray-900 dark:text-white"
                                            : "text-gray-400 dark:text-gray-500"
                                    }`}
                                />
                                <span>
                                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                                        {title}
                                    </span>
                                    <span className="block text-xs text-gray-600 dark:text-gray-400">
                                        {description}
                                    </span>
                                </span>
                            </button>
                        );
                    }
                )}
            </div>

            {plan.mode === VEHICLE_MAINTENANCE_MODE.EXTENDED && (
                <Input
                    type="number"
                    label="Days of maintenance"
                    required
                    min={1}
                    max={MAX_VEHICLE_MAINTENANCE_DAYS}
                    step="1"
                    value={plan.days}
                    onChange={(event) =>
                        update({ days: event.target.value })
                    }
                    placeholder="e.g. 3"
                    helperText={`Counted from ${
                        from ? "the return" : "now"
                    }, up to ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`}
                />
            )}

            <Textarea
                label="Internal note (optional)"
                rows={2}
                value={plan.reason}
                onChange={(event) =>
                    update({ reason: event.target.value })
                }
                placeholder="e.g. Brake pads replacement — admins only, never shown to customers"
            />

            {preview && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                    {preview.until ? (
                        <>
                            Customers can't book it until{" "}
                            <strong>{formatDateTime(preview.until)}</strong>.
                            It stays listed, and later dates remain
                            bookable.
                        </>
                    ) : (
                        <>
                            It stays listed, but{" "}
                            <strong>no dates can be booked</strong> until
                            you put it back in service.
                        </>
                    )}
                </div>
            )}

            {previewError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {previewError}
                </p>
            )}

            {conflicts.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <p className="font-semibold">
                        {conflicts.length} upcoming booking
                        {conflicts.length === 1 ? "" : "s"} fall
                        {conflicts.length === 1 ? "s" : ""} inside this
                        maintenance:
                    </p>
                    <ul className="mt-2 space-y-1">
                        {conflicts.map((booking) => (
                            <li key={booking._id}>
                                <strong>{booking.bookingCode}</strong> —{" "}
                                {booking.customerName},{" "}
                                {formatDateTime(booking.startDate)} (
                                {booking.status})
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2">
                        {conflictFollowUp ??
                            "They'll be flagged as maintenance conflicts. From each booking you can send the customer their options: another vehicle for the same dates, or a full refund. If they don't choose in time, they're refunded in full automatically."}
                    </p>
                </div>
            )}
        </div>
    );
};

export default MaintenancePlanFields;
