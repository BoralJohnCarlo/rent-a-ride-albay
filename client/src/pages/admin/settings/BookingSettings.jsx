import { useEffect, useState } from "react";

import {
    CalendarClock,
    Clock,
    MoonStar,
    Timer,
    TrafficCone,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

import {
    DEFAULT_TURNAROUND_BUFFER_MINUTES,
    EARLY_PICKUP_MAX_HOURS,
    MAX_TURNAROUND_BUFFER_MINUTES,
    MIN_TURNAROUND_BUFFER_MINUTES,
    TURNAROUND_BUFFER_STEP_MINUTES,
} from "../../../constants/bookingStatus";
import {
    DEFAULT_BOOKING_HOURS,
    DEFAULT_PICKUP_HOURS,
    MIN_BOOKING_LEAD_HOURS,
    getEarliestPickupMs,
} from "../../../utils/pickupTime";

/* 150 → "2 hours 30 minutes". */
const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return [
        hours > 0 && `${hours} hour${hours === 1 ? "" : "s"}`,
        rest > 0 && `${rest} minutes`,
    ]
        .filter(Boolean)
        .join(" ");
};

/* 2h, 2h 30m, 3h … 24h: the only values the server accepts. */
const BUFFER_OPTIONS = (() => {
    const options = [];

    for (
        let minutes = MIN_TURNAROUND_BUFFER_MINUTES;
        minutes <= MAX_TURNAROUND_BUFFER_MINUTES;
        minutes += TURNAROUND_BUFFER_STEP_MINUTES
    ) {
        options.push({
            value: minutes,
            label: `${formatDuration(minutes)}${
                minutes === DEFAULT_TURNAROUND_BUFFER_MINUTES
                    ? " (default)"
                    : ""
            }`,
        });
    }

    return options;
})();

const BookingSettings = () => {
    const toast = useToast();

    const {
        settings,
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [bufferMinutes, setBufferMinutes] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void getSettings();
    }, [getSettings]);

    useEffect(() => {
        const stored =
            settings?.bookingSettings?.turnaroundBufferMinutes;

        if (Number.isFinite(stored)) {
            setBufferMinutes(stored);
        }
    }, [settings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const currentBuffer =
        bufferMinutes ?? DEFAULT_TURNAROUND_BUFFER_MINUTES;

    const handleSave = async () => {
        setSaving(true);

        try {
            // Only this section: the other settings pages own theirs.
            await updateSettings({
                bookingSettings: {
                    turnaroundBufferMinutes: currentBuffer,
                },
            }).unwrap();
            toast.success("Booking settings saved successfully.");
        } catch {
            // The store keeps the server's message (e.g. an out-of-range
            // buffer) and the error effect above shows it.
        } finally {
            setSaving(false);
        }
    };

    if (settingsLoading && bufferMinutes === null) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                        <Timer size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Turnaround Buffer
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            The minimum time between one rental&apos;s
                            due-back time and the next pickup of the same
                            vehicle or driver, for cleaning and inspection.
                        </p>
                    </div>
                </div>

                <div className="max-w-xs">
                    <Select
                        name="turnaroundBufferMinutes"
                        label="Time between rentals"
                        value={currentBuffer}
                        options={BUFFER_OPTIONS}
                        onChange={(event) =>
                            setBufferMinutes(Number(event.target.value))
                        }
                        disabled={saving}
                        helperText={`At least ${formatDuration(
                            MIN_TURNAROUND_BUFFER_MINUTES
                        )}.`}
                    />
                </div>

                <div className="mt-5 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                    <p>
                        With {formatDuration(currentBuffer)}, a rental due
                        back at 2:00 PM keeps the vehicle unavailable for
                        other pickups until{" "}
                        {formatClock(14 * 60 + currentBuffer)}, and a
                        booking can&apos;t start less than{" "}
                        {formatDuration(currentBuffer)} after another one
                        ends (or end less than that before one starts).
                    </p>
                    <p>
                        Applies to new bookings, approvals, reschedules,
                        extensions, the vehicle calendar, and how far a
                        late pickup can run before the next booking.
                        Existing bookings aren&apos;t changed, but an
                        approval or change that doesn&apos;t leave enough
                        time is refused.
                    </p>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            <PickupHoursCard
                stored={settings?.bookingSettings?.pickupHours}
                updateSettings={updateSettings}
            />

            <BookingHoursCard
                stored={settings?.bookingSettings?.bookingHours}
                updateSettings={updateSettings}
            />

            <OffRoadVehiclesCard
                stored={settings?.bookingSettings?.offRoadVehicles}
                updateSettings={updateSettings}
            />

            <EarlyPickupCard
                stored={settings?.bookingSettings?.earlyPickup}
                updateSettings={updateSettings}
            />
        </div>
    );
};

/*
 * Early pickup: lets admins release a vehicle before the usual window (for
 * testing, or a genuine early hand-over). Each early release is still ticked
 * in the pickup dialog and checked by the server. Saved on its own; the
 * server merges it with the rest of Settings → Bookings.
 */
const EarlyPickupCard = ({ stored, updateSettings }) => {
    const toast = useToast();

    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const allowAnytime = draft ?? stored?.allowAnytime === true;

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings({
                bookingSettings: {
                    earlyPickup: { allowAnytime },
                },
            }).unwrap();
            setDraft(null);
            toast.success("Early pickup setting saved successfully.");
        } catch {
            // The page's error effect shows the server's message.
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                    <CalendarClock size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Early Pickup
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Normally a vehicle can be released at most{" "}
                        {EARLY_PICKUP_MAX_HOURS} hours before the booked
                        pickup time.
                    </p>
                </div>
            </div>

            <Switch
                name="earlyPickupAllowAnytime"
                label="Let admins release vehicles before that"
                helperText={
                    allowAnytime
                        ? "On: the pickup dialog offers an early release for an approved booking, any time before its pickup."
                        : `Off: pickup is refused until ${EARLY_PICKUP_MAX_HOURS} hours before the booked time.`
                }
                checked={allowAnytime}
                onChange={(event) => setDraft(event.target.checked)}
                disabled={saving}
            />

            <div className="mt-5 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                <p>
                    For testing, or a customer who genuinely needs the
                    vehicle sooner. The rental starts when it&apos;s
                    released and keeps its full booked duration, so it
                    comes back earlier too. Each early release has to be
                    ticked in the pickup dialog and is noted in the
                    booking&apos;s history.
                </p>
                <p>
                    It&apos;s refused if the earlier rental (plus the
                    turnaround buffer) would overlap another booking of the
                    vehicle or its driver, or blocked dates. Payment,
                    approval and maintenance checks still apply.
                </p>
            </div>

            <div className="mt-6 flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                >
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

const DEFAULT_OFF_ROAD_VEHICLES = {
    showInListings: true,
    showNotice: true,
};

/*
 * Off-road vehicles (maintenance with no end date): whether customers still
 * see them in the vehicle listings, and whether they're told the vehicle is
 * off the road or only that its dates are blocked. Saved on its own; the
 * server merges it with the rest of Settings → Bookings.
 */
const OffRoadVehiclesCard = ({ stored, updateSettings }) => {
    const toast = useToast();

    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const values = draft ?? {
        ...DEFAULT_OFF_ROAD_VEHICLES,
        ...(stored ?? {}),
    };

    const update = (changes) =>
        setDraft((previous) => ({
            ...(previous ?? values),
            ...changes,
        }));

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings({
                bookingSettings: {
                    offRoadVehicles: {
                        showInListings: values.showInListings,
                        showNotice: values.showNotice,
                    },
                },
            }).unwrap();
            setDraft(null);
            toast.success("Off-road vehicle settings saved successfully.");
        } catch {
            // The page's error effect shows the server's message.
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <TrafficCone size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Off-Road Vehicles
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        What customers see when a vehicle is off road
                        (maintenance with no end date). It can&apos;t be
                        booked either way.
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                <Switch
                    name="offRoadShowInListings"
                    label="Show off-road vehicles in the listings"
                    helperText={
                        values.showInListings
                            ? "On: off-road vehicles still appear in the vehicle listings, unbookable."
                            : "Off: off-road vehicles are removed from the vehicle listings until they're back in service."
                    }
                    checked={values.showInListings}
                    onChange={(event) =>
                        update({ showInListings: event.target.checked })
                    }
                    disabled={saving}
                />

                <Switch
                    name="offRoadShowNotice"
                    label="Say the vehicle is temporarily off the road"
                    helperText={
                        values.showNotice
                            ? "On: customers see that it's temporarily unavailable, with the off-road description."
                            : "Off: customers only see that they can't book it because its dates are blocked."
                    }
                    checked={values.showNotice}
                    onChange={(event) =>
                        update({ showNotice: event.target.checked })
                    }
                    disabled={saving}
                />
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                Take a vehicle off road (or put it back in service) from
                Vehicles, with the off-road button in the table or the
                card&apos;s menu. A direct link to a hidden vehicle still
                opens its page.
            </div>

            <div className="mt-6 flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                >
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

/*
 * Pickup hours: the first and last pickup time customers can choose (the
 * return is at the same time). Saved on its own; the server merges it with
 * the rest of Settings → Bookings.
 */
const PickupHoursCard = ({ stored, updateSettings }) => {
    const toast = useToast();

    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const hours = draft ?? {
        ...DEFAULT_PICKUP_HOURS,
        ...(stored ?? {}),
    };

    const first = timeToMinute(hours.earliestTime);
    const last = timeToMinute(hours.latestTime);
    const invalid = first > last;

    const update = (changes) =>
        setDraft((previous) => ({
            ...(previous ?? hours),
            ...changes,
        }));

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings({
                bookingSettings: {
                    pickupHours: {
                        earliestTime: hours.earliestTime,
                        latestTime: hours.latestTime,
                    },
                },
            }).unwrap();
            setDraft(null);
            toast.success("Pickup hours saved successfully.");
        } catch {
            // The page's error effect shows the server's message.
        } finally {
            setSaving(false);
        }
    };

    const sameDayCutoff = last - MIN_BOOKING_LEAD_HOURS * 60;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <Clock size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Pickup Hours
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        The pickup times customers can choose, every 30
                        minutes. The return is at the same time on the
                        return date.
                    </p>
                </div>
            </div>

            <div className="grid max-w-md gap-4 sm:grid-cols-2">
                <Select
                    name="pickupHoursEarliest"
                    label="First pickup"
                    value={hours.earliestTime}
                    options={BOOKING_HOURS_TIME_OPTIONS}
                    onChange={(event) =>
                        update({ earliestTime: event.target.value })
                    }
                    disabled={saving}
                />

                <Select
                    name="pickupHoursLatest"
                    label="Last pickup"
                    value={hours.latestTime}
                    options={BOOKING_HOURS_TIME_OPTIONS}
                    onChange={(event) =>
                        update({ latestTime: event.target.value })
                    }
                    disabled={saving}
                />
            </div>

            {invalid && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    The last pickup can&apos;t be earlier than the first.
                </p>
            )}

            {!invalid && (
                <div className="mt-5 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                    <p>
                        Customers can choose {formatClock(first)} –{" "}
                        {formatClock(last)} ({(last - first) / 30 + 1}{" "}
                        time{last === first ? "" : "s"} a day).
                        {sameDayCutoff >= 0 &&
                            ` Same-day pickups close at ${formatClock(
                                sameDayCutoff
                            )}, ${MIN_BOOKING_LEAD_HOURS} hours before the last pickup.`}
                    </p>
                    <p>
                        Applies to new bookings and reschedules (and to
                        admin date changes). Existing bookings keep their
                        times, even outside the new hours.
                    </p>
                </div>
            )}

            <div className="mt-6 flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                    disabled={invalid}
                >
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

/* "00:00" … "23:30": the only times the server accepts. */
const BOOKING_HOURS_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
    const minute = index * 30;
    const value = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
        minute % 60
    ).padStart(2, "0")}`;

    return { value, label: formatClock(minute) };
});

const timeToMinute = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);

    return hour * 60 + minute;
};

/*
 * Earliest pickup for a booking made at `bookedAt` ("HH:mm") on an example
 * day, with these hours: "10:00 AM the next day".
 */
const describeExampleEarliest = (bookedAt, hours) => {
    const day = "2026-01-05";
    const nowMs = Date.parse(`${day}T${bookedAt}:00+08:00`);
    const earliestMs = getEarliestPickupMs(nowMs, hours);

    const manilaMinutes = Math.round(
        (earliestMs - Date.parse(`${day}T00:00:00+08:00`)) / 60000
    );

    return formatClock(manilaMinutes);
};

/*
 * Booking hours: when staff approve bookings. The 2-hour notice for a new
 * booking only counts inside them, so overnight bookings can't take the
 * first slots of the morning. Saved on its own (the server merges it with the
 * rest of Settings → Bookings).
 */
const BookingHoursCard = ({ stored, updateSettings }) => {
    const toast = useToast();

    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);

    const hours = draft ?? {
        ...DEFAULT_BOOKING_HOURS,
        ...(stored ?? {}),
    };

    const invalid =
        timeToMinute(hours.closeTime) <= timeToMinute(hours.openTime);

    const update = (changes) =>
        setDraft((previous) => ({
            ...(previous ?? hours),
            ...changes,
        }));

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings({
                bookingSettings: {
                    bookingHours: {
                        enabled: hours.enabled,
                        openTime: hours.openTime,
                        closeTime: hours.closeTime,
                    },
                },
            }).unwrap();
            setDraft(null);
            toast.success("Booking hours saved successfully.");
        } catch {
            // The page's error effect shows the server's message.
        } finally {
            setSaving(false);
        }
    };

    const examples = [
        ["15:00", "3:00 PM"],
        [
            `${String(Math.floor((timeToMinute(hours.closeTime) - 30) / 60)).padStart(2, "0")}:${String(
                (timeToMinute(hours.closeTime) - 30) % 60
            ).padStart(2, "0")}`,
            formatClock(timeToMinute(hours.closeTime) - 30),
        ],
        ["23:00", "11:00 PM"],
        ["06:00", "6:00 AM"],
    ];

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <MoonStar size={19} />
                </div>

                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Booking Hours
                    </h2>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        When staff are available to approve new bookings.
                        Outside these hours, a new booking&apos;s{" "}
                        {MIN_BOOKING_LEAD_HOURS}-hour notice waits until
                        booking hours open, so nobody books an early-morning
                        pickup that can&apos;t be approved in time.
                    </p>
                </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    checked={hours.enabled}
                    onChange={(event) =>
                        update({ enabled: event.target.checked })
                    }
                    disabled={saving}
                />
                Close bookings outside booking hours
            </label>

            <div className="mt-4 grid max-w-md gap-4 sm:grid-cols-2">
                <Select
                    name="bookingHoursOpen"
                    label="Opens at"
                    value={hours.openTime}
                    options={BOOKING_HOURS_TIME_OPTIONS}
                    onChange={(event) =>
                        update({ openTime: event.target.value })
                    }
                    disabled={saving || !hours.enabled}
                />

                <Select
                    name="bookingHoursClose"
                    label="Closes at"
                    value={hours.closeTime}
                    options={BOOKING_HOURS_TIME_OPTIONS}
                    onChange={(event) =>
                        update({ closeTime: event.target.value })
                    }
                    disabled={saving || !hours.enabled}
                />
            </div>

            {invalid && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Closing time must be later than opening time, on the
                    same day.
                </p>
            )}

            <div className="mt-5 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300">
                {hours.enabled && !invalid ? (
                    <>
                        <p>Earliest pickup for a booking made at:</p>
                        <ul className="list-disc space-y-0.5 pl-5">
                            {examples.map(([time, label], index) => (
                                <li key={index}>
                                    {label} →{" "}
                                    <strong>
                                        {describeExampleEarliest(
                                            time,
                                            hours
                                        )}
                                    </strong>
                                </li>
                            ))}
                        </ul>
                        <p>
                            Applies to new bookings only. Reschedules
                            already need 24 hours&apos; notice, and admins
                            can still edit any booking.
                        </p>
                    </>
                ) : (
                    <p>
                        Off: a booking can be made at any hour for any pickup
                        at least {MIN_BOOKING_LEAD_HOURS} hours away, e.g.
                        at 11:00 PM for 8:00 AM the next morning.
                    </p>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                    disabled={invalid}
                >
                    Save Changes
                </Button>
            </div>
        </div>
    );
};

/* Minutes after midnight → "4:00 PM" (wraps past midnight, "+1 day"). */
function formatClock(totalMinutes) {
    const dayOffset = Math.floor(totalMinutes / (24 * 60));
    const minuteOfDay = totalMinutes % (24 * 60);
    const hour = Math.floor(minuteOfDay / 60);

    return `${hour % 12 || 12}:${String(minuteOfDay % 60).padStart(2, "0")} ${
        hour < 12 ? "AM" : "PM"
    }${dayOffset > 0 ? " the next day" : ""}`;
}

export default BookingSettings;
