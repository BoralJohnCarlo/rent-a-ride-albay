import { useEffect, useState } from "react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import Textarea from "../common/Textarea";

import {
    RENTAL_INSPECTION_CONDITION_VALUES,
    RENTAL_CHARGE_TYPE_VALUES,
    RENTAL_ADJUSTMENT_TYPE_VALUES,
    RENTAL_VEHICLE_OUTCOME_VALUES,
    RENTAL_SECURITY_DEPOSIT_STATUS,
    RENTAL_PAYMENT_METHOD_VALUES,
} from "../../constants/rentalConstants";
import {
    EARLY_PICKUP_MAX_HOURS,
    getEarliestPickupAt,
} from "../../constants/bookingStatus";
import MaintenancePlanFields from "../vehicle/MaintenancePlanFields";
import {
    EMPTY_MAINTENANCE_PLAN,
    validateMaintenancePlan,
    toMaintenancePayload,
} from "../../utils/maintenancePlan";

const toOptions = (values) =>
    values.map((value) => ({ value, label: value }));

const formatDateTime = (ms) =>
    new Date(ms).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/* Whether it's still before the usual early-pickup window right now. */
const isBeforePickupWindow = (booking, now = Date.now()) => {
    const earliestPickupAt = getEarliestPickupAt(booking);

    return Boolean(earliestPickupAt && now < earliestPickupAt.getTime());
};

/* 26.5h → "1 day 2 hours", for how much earlier an early release starts. */
const formatLead = (ms) => {
    const totalHours = Math.round(ms / (60 * 60 * 1000));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    return (
        [
            days > 0 && `${days} day${days === 1 ? "" : "s"}`,
            hours > 0 && `${hours} hour${hours === 1 ? "" : "s"}`,
        ]
            .filter(Boolean)
            .join(" ") || "less than an hour"
    );
};

/*
 * Pickup starts the rental clock: the server times the rental from the
 * moment it's confirmed, for the booked duration (see createRental), capping
 * the return at the next booking if needed. This previews that, ticking so
 * it stays right while the modal is open.
 *
 * Before the usual window, an early release is only possible while Settings
 * → Bookings → Early Pickup allows it, and must be ticked here first.
 */
const PickupPeriodNotice = ({
    booking,
    earlyPickupAllowed = false,
    releaseEarly = false,
    onReleaseEarlyChange,
}) => {
    const [now, setNow] = useState(0);

    useEffect(() => {
        const tick = () => setNow(Date.now());

        tick();

        const timer = setInterval(tick, 30 * 1000);

        return () => clearInterval(timer);
    }, []);

    const durationMs =
        new Date(booking.endDate).getTime() -
        new Date(booking.startDate).getTime();

    if (!now || !Number.isFinite(durationMs) || durationMs <= 0) {
        return null;
    }

    const earliestPickupAt = getEarliestPickupAt(booking);

    if (isBeforePickupWindow(booking, now) && earlyPickupAllowed) {
        const bookedPickupMs =
            earliestPickupAt.getTime() +
            EARLY_PICKUP_MAX_HOURS * 60 * 60 * 1000;

        return (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <p>
                    This is before the usual window (from{" "}
                    <strong>{formatDateTime(earliestPickupAt)}</strong>).
                    Early pickup is turned on in Settings → Bookings, so
                    you can release it now:{" "}
                    <strong>
                        {formatLead(bookedPickupMs - now)} earlier
                    </strong>{" "}
                    than booked, due back{" "}
                    <strong>{formatDateTime(now + durationMs)}</strong>{" "}
                    instead of {formatDateTime(booking.endDate)}.
                </p>
                <p className="text-xs">
                    The customer keeps the full booked duration. It&apos;s
                    refused if the earlier rental would overlap another
                    booking of this vehicle or driver, or blocked dates.
                </p>
                <label className="flex items-start gap-2 font-medium">
                    <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-amber-600 focus:ring-amber-500 dark:border-amber-500/50 dark:bg-gray-800"
                        checked={releaseEarly}
                        onChange={(event) =>
                            onReleaseEarlyChange?.(event.target.checked)
                        }
                    />
                    <span>Release early and start the rental now</span>
                </label>
            </div>
        );
    }

    if (isBeforePickupWindow(booking, now)) {
        return (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                Too early to release this vehicle. It can be released from{" "}
                <strong>{formatDateTime(earliestPickupAt)}</strong> (
                {EARLY_PICKUP_MAX_HOURS} hours before the booked pickup
                time). To start sooner, reschedule the booking.
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            The rental period starts when you confirm. Booked{" "}
            {formatDateTime(booking.startDate)} –{" "}
            {formatDateTime(booking.endDate)}; confirming now makes it
            due back{" "}
            <strong>{formatDateTime(now + durationMs)}</strong>. If the
            vehicle or driver is booked sooner than that, the return is
            moved up to the start of that booking.
        </div>
    );
};

const CONDITION_OPTIONS = toOptions(
    RENTAL_INSPECTION_CONDITION_VALUES
);
const CHARGE_TYPE_OPTIONS = toOptions(RENTAL_CHARGE_TYPE_VALUES);
const ADJUSTMENT_TYPE_OPTIONS = toOptions(
    RENTAL_ADJUSTMENT_TYPE_VALUES
);
const OUTCOME_LABELS = {
    Available: "Available — ready for the next rental",
    Maintenance:
        "Maintenance — turnaround, a number of days, or off road",
};

const OUTCOME_OPTIONS = RENTAL_VEHICLE_OUTCOME_VALUES.map((value) => ({
    value,
    label: OUTCOME_LABELS[value] ?? value,
}));
const PAYMENT_METHOD_OPTIONS = toOptions(
    RENTAL_PAYMENT_METHOD_VALUES
);
const DEPOSIT_ACTION_OPTIONS = [
    { value: "hold", label: "Hold deposit" },
    { value: "deduct", label: "Deduct from deposit" },
    { value: "release", label: "Release deposit" },
];

const DEPOSIT_ACTIONS_BY_STATUS = {
    [RENTAL_SECURITY_DEPOSIT_STATUS.PENDING]: ["hold"],
    [RENTAL_SECURITY_DEPOSIT_STATUS.HELD]: [
        "deduct",
        "release",
    ],
    [RENTAL_SECURITY_DEPOSIT_STATUS.PARTIALLY_DEDUCTED]: [
        "deduct",
        "release",
    ],
    [RENTAL_SECURITY_DEPOSIT_STATUS.FULLY_DEDUCTED]: [],
    [RENTAL_SECURITY_DEPOSIT_STATUS.RELEASED]: [],
    [RENTAL_SECURITY_DEPOSIT_STATUS.NOT_REQUIRED]: [],
};

const getAvailableDepositActions = (rental) => {
    const status = rental?.securityDeposit?.status;
    const allowed = DEPOSIT_ACTIONS_BY_STATUS[status];

    if (!allowed) {
        return DEPOSIT_ACTION_OPTIONS;
    }

    return DEPOSIT_ACTION_OPTIONS.filter((option) =>
        allowed.includes(option.value)
    );
};

const PICKUP_FIELDS = [
    {
        name: "fuelLevel",
        label: "Fuel level (%)",
        type: "number",
        required: true,
        min: 0,
        max: 100,
    },
];

/*
 * Return collects nothing of its own — the outstanding question at return
 * (what happens to the vehicle next) is handled by a separate, dedicated
 * "outcome" step chained in right after a return succeeds (see
 * Bookings.jsx's submitAction). All this step needs is a reminder of the
 * fuel level recorded at pickup, rendered below as plain text rather than a
 * field.
 */
const RETURN_FIELDS = [];

const MODE_CONFIG = {
    pickup: {
        title: "Process pickup",
        description:
            "Record the vehicle's fuel level at hand-over to the customer.",
        confirmLabel: "Confirm pickup",
        fields: PICKUP_FIELDS,
    },
    return: {
        title: "Process return",
        description:
            "Confirm the vehicle has been returned. Late fees are calculated automatically.",
        confirmLabel: "Confirm return",
        fields: RETURN_FIELDS,
    },
    charge: {
        title: "Add charge",
        description: "Add an extra charge to this rental.",
        confirmLabel: "Add charge",
        fields: [
            {
                name: "type",
                label: "Charge type",
                type: "select",
                options: CHARGE_TYPE_OPTIONS,
                required: true,
            },
            {
                name: "amount",
                label: "Amount (₱)",
                type: "number",
                required: true,
                min: 0.01,
                step: "0.01",
            },
            {
                name: "description",
                label: "Description",
                type: "textarea",
            },
        ],
    },
    adjustment: {
        title: "Add adjustment",
        description:
            "Apply a discount or a manual adjustment to this rental.",
        confirmLabel: "Apply adjustment",
        fields: [
            {
                name: "type",
                label: "Adjustment type",
                type: "select",
                options: ADJUSTMENT_TYPE_OPTIONS,
                required: true,
            },
            {
                name: "amount",
                label: "Amount (₱)",
                type: "number",
                required: true,
                min: 0.01,
                step: "0.01",
            },
            {
                name: "reason",
                label: "Reason",
                type: "textarea",
                required: true,
            },
        ],
    },
    payment: {
        title: "Record payment",
        description:
            "Confirm a payment received from the customer — for example, a late-return penalty or outstanding balance paid in cash at the counter. This immediately marks it as verified.",
        confirmLabel: "Confirm payment",
        fields: [
            {
                name: "amount",
                label: "Amount (₱)",
                type: "number",
                required: true,
                min: 0.01,
                step: "0.01",
                defaultValue: (rental) =>
                    Number(rental?.financial?.balance) > 0
                        ? Number(rental.financial.balance)
                        : "",
            },
            {
                name: "paymentMethod",
                label: "Payment method",
                type: "select",
                options: PAYMENT_METHOD_OPTIONS,
                required: true,
                defaultValue: () => "Cash",
            },
            {
                name: "reference",
                label: "Reference (optional)",
                type: "text",
            },
            {
                name: "notes",
                label: "Notes",
                type: "textarea",
            },
        ],
    },
    deposit: {
        title: "Security deposit",
        description:
            "Hold, deduct from, or release the security deposit.",
        confirmLabel: "Apply",
        fields: [
            {
                name: "action",
                label: "Action",
                type: "select",
                optionsFromProp: "depositActions",
                required: true,
            },
            {
                name: "amount",
                label: "Deduction amount (₱)",
                type: "number",
                required: true,
                min: 0.01,
                step: "0.01",
                dependsOn: (values) =>
                    values.action === "deduct",
            },
            {
                name: "reason",
                label: "Reason",
                type: "textarea",
                required: true,
                dependsOn: (values) =>
                    values.action === "deduct",
            },
        ],
    },
    reassign: {
        title: "Reassign driver",
        description:
            "Assign a different driver to this rental.",
        confirmLabel: "Reassign",
        fields: [
            {
                name: "newDriver",
                label: "New driver",
                type: "select",
                required: true,
                optionsFromProp: "drivers",
            },
            {
                name: "reason",
                label: "Reason",
                type: "textarea",
            },
        ],
    },
    complete: {
        title: "Complete rental",
        description:
            "Mark this rental as completed. Do this once the vehicle is returned and all charges are settled.",
        confirmLabel: "Complete rental",
        fields: [
            {
                name: "notes",
                label: "Completion notes",
                type: "textarea",
            },
            {
                name: "overrideOutstandingBalance",
                label: "Complete anyway (the outstanding balance will be recorded, not waived)",
                type: "checkbox",
                dependsOn: (values, rental) =>
                    Number(rental?.financial?.balance || 0) > 0,
            },
        ],
    },
    outcome: {
        title: "Vehicle outcome",
        description:
            "Set what happens to the vehicle after this rental. Either way it stays listed for customers — maintenance only blocks the dates it covers.",
        confirmLabel: "Save outcome",
        fields: [
            {
                name: "vehicleOutcome",
                label: "Outcome",
                type: "select",
                options: OUTCOME_OPTIONS,
                required: true,
            },
        ],
    },
    damage: {
        title: "Log damage issue",
        description:
            "Record damage found on the vehicle during this rental.",
        confirmLabel: "Log damage",
        fields: [
            {
                name: "description",
                label: "Description",
                type: "textarea",
                required: true,
            },
            {
                name: "condition",
                label: "Condition",
                type: "select",
                options: CONDITION_OPTIONS,
            },
            {
                name: "chargeAmount",
                label: "Charge amount (₱)",
                type: "number",
                min: 0,
                step: "0.01",
            },
        ],
    },
};

const RentalActionModal = ({
    isOpen,
    mode,
    rental,
    // Pickup only: the booking being released (no rental exists yet).
    booking = null,
    // Pickup only: Settings → Bookings → Early Pickup is on.
    earlyPickupAllowed = false,
    drivers = [],
    loading = false,
    onClose,
    onSubmit,
}) => {
    const config = MODE_CONFIG[mode];

    const [values, setValues] = useState({});
    const [error, setError] = useState("");
    // Outcome only: the maintenance plan when Maintenance is chosen.
    const [maintenancePlan, setMaintenancePlan] = useState(
        EMPTY_MAINTENANCE_PLAN
    );
    // Pickup only: the admin ticked "Release early".
    const [releaseEarly, setReleaseEarly] = useState(false);

    useEffect(() => {
        if (isOpen && config) {
            setReleaseEarly(false);
            const initial = {};
            config.fields.forEach((field) => {
                initial[field.name] =
                    typeof field.defaultValue ===
                    "function"
                        ? (field.defaultValue(rental) ??
                          "")
                        : "";
            });
            setValues(initial);
            setError("");
            setMaintenancePlan(EMPTY_MAINTENANCE_PLAN);
        }
    }, [isOpen, mode, config, rental]);

    const isMaintenanceOutcome =
        mode === "outcome" && values.vehicleOutcome === "Maintenance";

    if (!config) {
        return null;
    }

    const visibleFields = config.fields.filter(
        (field) =>
            !field.dependsOn ||
            field.dependsOn(values, rental)
    );

    const setField = (name, value) =>
        setValues((current) => ({
            ...current,
            [name]: value,
        }));

    const resolveOptions = (field) => {
        if (field.optionsFromProp === "drivers") {
            return drivers.map((driver) => ({
                value: driver._id ?? driver.id,
                label:
                    [driver.firstName, driver.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                    driver.name ||
                    driver.driverCode ||
                    "Driver",
            }));
        }

        if (field.optionsFromProp === "depositActions") {
            return getAvailableDepositActions(rental);
        }

        return field.options ?? [];
    };

    const depositActionsAvailable =
        mode !== "deposit" ||
        getAvailableDepositActions(rental).length > 0;

    // Populated on some screens, a bare id on others.
    const outcomeVehicleId =
        rental?.vehicle?._id ?? rental?.vehicle ?? null;

    const handleSubmit = async () => {
        const missing = visibleFields.find(
            (field) =>
                field.required &&
                (values[field.name] === "" ||
                    values[field.name] == null)
        );

        if (missing) {
            setError(`${missing.label} is required.`);
            return;
        }

        const badNumber = visibleFields.find(
            (field) =>
                field.type === "number" &&
                values[field.name] !== "" &&
                values[field.name] != null &&
                field.min != null &&
                Number(values[field.name]) < field.min
        );

        if (badNumber) {
            setError(
                `${badNumber.label} must be at least ${badNumber.min}.`
            );
            return;
        }

        if (isMaintenanceOutcome) {
            const planError = validateMaintenancePlan(maintenancePlan);

            if (planError) {
                setError(planError);
                return;
            }
        }

        // A pickup that hasn't started a rental yet, before the usual window.
        const earlyPickup =
            mode === "pickup" &&
            !rental?.pickup?.date &&
            !rental?._id &&
            booking?.startDate &&
            isBeforePickupWindow(booking);

        if (earlyPickup && earlyPickupAllowed && !releaseEarly) {
            setError(
                'Tick "Release early and start the rental now" to release it before the usual window.'
            );
            return;
        }

        setError("");

        const payload = {};
        visibleFields.forEach((field) => {
            const raw = values[field.name];
            payload[field.name] =
                field.type === "number" && raw !== ""
                    ? Number(raw)
                    : raw;
        });

        if (isMaintenanceOutcome) {
            payload.maintenancePlan = toMaintenancePayload(maintenancePlan);
        }

        if (earlyPickup && earlyPickupAllowed && releaseEarly) {
            payload.releaseEarly = true;
        }

        await onSubmit(payload);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            title={config.title}
            size={isMaintenanceOutcome ? "md" : "sm"}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        loading={loading}
                        disabled={
                            !depositActionsAvailable
                        }
                        onClick={handleSubmit}
                    >
                        {config.confirmLabel}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {rental?.rentalCode && (
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {rental.rentalCode}
                    </p>
                )}

                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {config.description}
                </p>

                {mode === "complete" &&
                    Number(rental?.financial?.balance || 0) >
                        0 && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            This rental has an outstanding
                            balance of{" "}
                            <strong>
                                ₱
                                {Number(
                                    rental.financial.balance
                                ).toLocaleString("en-PH", {
                                    minimumFractionDigits: 2,
                                })}
                            </strong>
                            . Check the box below to
                            complete it anyway.
                        </div>
                    )}

                {mode === "pickup" &&
                    !rental?.pickup?.date &&
                    booking?.startDate &&
                    booking?.endDate && (
                        <PickupPeriodNotice
                            booking={booking}
                            earlyPickupAllowed={earlyPickupAllowed}
                            releaseEarly={releaseEarly}
                            onReleaseEarlyChange={setReleaseEarly}
                        />
                    )}

                {mode === "return" && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                        Fuel level at pickup was{" "}
                        <strong>
                            {Number.isFinite(
                                rental?.pickup?.fuelLevel
                            )
                                ? `${rental.pickup.fuelLevel}%`
                                : "not recorded"}
                        </strong>
                        . Check the tank against this
                        before confirming the return.
                    </div>
                )}

                {mode === "deposit" &&
                    !depositActionsAvailable && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300">
                            This deposit has already
                            been resolved (status:{" "}
                            {rental?.securityDeposit
                                ?.status ??
                                "N/A"}
                            ). There is nothing left
                            to hold, deduct, or
                            release.
                        </div>
                    )}

                {depositActionsAvailable &&
                    visibleFields.map((field) => {
                    if (field.type === "select") {
                        return (
                            <div key={field.name}>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {field.label}
                                    {field.required && (
                                        <span className="ml-1 text-red-500">
                                            *
                                        </span>
                                    )}
                                </label>
                                <Select
                                    options={resolveOptions(
                                        field
                                    )}
                                    value={
                                        values[field.name] ??
                                        ""
                                    }
                                    placeholder={`Select ${field.label.toLowerCase()}`}
                                    onChange={(event) =>
                                        setField(
                                            field.name,
                                            event.target.value
                                        )
                                    }
                                />
                            </div>
                        );
                    }

                    if (field.type === "checkbox") {
                        return (
                            <label
                                key={field.name}
                                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                            >
                                <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 dark:border-gray-600 dark:bg-gray-800"
                                    checked={Boolean(
                                        values[field.name]
                                    )}
                                    onChange={(event) =>
                                        setField(
                                            field.name,
                                            event.target.checked
                                        )
                                    }
                                />
                                <span>{field.label}</span>
                            </label>
                        );
                    }

                    if (field.type === "textarea") {
                        return (
                            <Textarea
                                key={field.name}
                                label={field.label}
                                required={field.required}
                                rows={3}
                                value={
                                    values[field.name] ?? ""
                                }
                                onChange={(event) =>
                                    setField(
                                        field.name,
                                        event.target.value
                                    )
                                }
                            />
                        );
                    }

                    if (field.type === "text") {
                        return (
                            <Input
                                key={field.name}
                                type="text"
                                label={field.label}
                                required={field.required}
                                value={
                                    values[field.name] ?? ""
                                }
                                onChange={(event) =>
                                    setField(
                                        field.name,
                                        event.target.value
                                    )
                                }
                            />
                        );
                    }

                    return (
                        <Input
                            key={field.name}
                            type="number"
                            label={field.label}
                            required={field.required}
                            min={field.min}
                            max={field.max}
                            step={field.step ?? "1"}
                            value={values[field.name] ?? ""}
                            onChange={(event) =>
                                setField(
                                    field.name,
                                    event.target.value
                                )
                            }
                            placeholder="0"
                        />
                    );
                })}

                {isMaintenanceOutcome && (
                    <MaintenancePlanFields
                        vehicleId={outcomeVehicleId}
                        value={maintenancePlan}
                        onChange={setMaintenancePlan}
                        from={rental?.return?.date ?? null}
                    />
                )}

                {error && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default RentalActionModal;
