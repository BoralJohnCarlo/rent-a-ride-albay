import { useState } from "react";

import {
    CarFront,
    CheckCircle2,
    Clock3,
    Hourglass,
    Wrench,
} from "lucide-react";

import Button from "../common/Button";
import MaintenanceOptionsDialog from "./MaintenanceOptionsDialog";

import {
    MAINTENANCE_CONFLICT_STATUS,
    formatConflictDateTime,
    hasOpenMaintenanceConflict,
    isAwaitingCustomerChoice,
    isLateReturnConflict,
} from "../../constants/maintenanceConflict";

const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "your vehicle";

const TONES = {
    amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
    gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
};

const Card = ({ tone, icon: Icon, title, children }) => (
    <div className={`rounded-xl border p-4 text-sm ${TONES[tone]}`}>
        <div className="flex items-start gap-3">
            {Icon && <Icon size={18} className="mt-0.5 shrink-0" />}
            <div className="min-w-0 flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children}
            </div>
        </div>
    </div>
);

/* "What happens next" bullets on the late-return heads-up. */
const NextSteps = ({ items }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
        {items.map((item) => (
            <li key={item}>{item}</li>
        ))}
    </ul>
);

/*
 * The customer's side of a booking whose vehicle won't be ready: under
 * maintenance, or still out with its previous renter (late return). While
 * open, what happened and what happens next — and, once the options are
 * out, the button to choose; afterwards, with `showResolved`, how it was
 * resolved. Never shows booking codes or who has the vehicle.
 */
const MaintenanceConflictNotice = ({
    booking,
    onChanged,
    showResolved = false,
    compact = false,
}) => {
    const [optionsOpen, setOptionsOpen] = useState(false);

    const conflict = booking?.maintenanceConflict;

    if (!conflict) {
        return null;
    }

    const lateReturn = isLateReturnConflict(booking);
    const open = hasOpenMaintenanceConflict(booking);
    const until = conflict.maintenanceUntil;
    const change = conflict.vehicleChange;
    const name = vehicleName(booking.vehicle);

    const optionsButton = (label) => (
        <div className="mt-3">
            <Button
                size="sm"
                onClick={(event) => {
                    event.stopPropagation();
                    setOptionsOpen(true);
                }}
            >
                {label}
            </Button>
        </div>
    );

    const dialog = (
        <MaintenanceOptionsDialog
            isOpen={optionsOpen}
            onClose={() => setOptionsOpen(false)}
            booking={booking}
            onDone={() => onChanged?.()}
        />
    );

    if (open && lateReturn) {
        const dueBack = formatConflictDateTime(conflict.dueBackAt);

        if (conflict.status === MAINTENANCE_CONFLICT_STATUS.WAITING) {
            return (
                <>
                    <Card
                        tone="blue"
                        icon={Hourglass}
                        title={`You're waiting for the ${name}`}
                    >
                        <p className="mt-1">
                            We'll notify you the moment it's back and ready.
                            Your rental starts when you pick it up, and you
                            still get the full booked duration from then.
                        </p>
                        {!compact && conflict.waitUntil && (
                            <p className="mt-2 text-xs">
                                If it isn't back by{" "}
                                <strong>
                                    {formatConflictDateTime(conflict.waitUntil)}
                                </strong>
                                , your booking is cancelled and refunded in
                                full automatically. You can still switch
                                vehicles (no extra cost) or cancel for a full
                                refund before then.
                            </p>
                        )}
                        {optionsButton("Change my choice")}
                    </Card>
                    {dialog}
                </>
            );
        }

        if (isAwaitingCustomerChoice(booking)) {
            return (
                <>
                    <Card
                        tone="amber"
                        icon={Clock3}
                        title="Action needed: your vehicle is running late"
                    >
                        <p className="mt-1">
                            The {name} won't be back in time for your pickup
                            — its previous renter still hasn't returned it
                            {dueBack ? ` (it was due ${dueBack})` : ""}. This
                            isn't your fault, so choose what works for you:
                            switch to another vehicle at no extra cost, wait
                            for this one, or cancel for a full refund.
                        </p>
                        {!compact && conflict.respondBy && (
                            <p className="mt-2 text-xs">
                                Please choose by{" "}
                                <strong>
                                    {formatConflictDateTime(conflict.respondBy)}
                                </strong>
                                . If you don't and the vehicle still isn't
                                back by then, your booking is cancelled and
                                refunded in full automatically.
                            </p>
                        )}
                        {optionsButton("See my options")}
                    </Card>
                    {dialog}
                </>
            );
        }

        return (
            <Card
                tone="amber"
                icon={Clock3}
                title="Heads-up: your vehicle is running late"
            >
                <p className="mt-1">
                    The {name} is still out with its previous renter
                    {dueBack ? `, who was due to return it ${dueBack}` : ""}.
                    We're working to get it back and ready for you.
                </p>
                {!compact && (
                    <NextSteps
                        items={[
                            "If it's back and ready in time, your booking goes ahead — there's nothing you need to do.",
                            "If it can't be ready by your pickup, we'll message you right away with your options: another vehicle at no extra cost, waiting for this one, or a full refund.",
                            "Rather not wait to find out? You can cancel any time for a full refund, with no fees.",
                        ]}
                    />
                )}
            </Card>
        );
    }

    if (open) {
        const awaiting = isAwaitingCustomerChoice(booking);

        return (
            <>
                <Card
                    tone="amber"
                    icon={Wrench}
                    title={
                        awaiting
                            ? "Action needed: your vehicle needs maintenance"
                            : "Your vehicle needs maintenance"
                    }
                >
                    <p className="mt-1">
                        The {name}{" "}
                        {until
                            ? `is under maintenance until ${formatConflictDateTime(
                                  until
                              )}`
                            : "is temporarily off the road for maintenance"}
                        , so it won't be ready for your rental.{" "}
                        {awaiting
                            ? "You can switch to another vehicle for the same dates, or cancel for a full refund — no cancellation fee either way."
                            : "We're reviewing your booking and will send you your options shortly: another vehicle for the same dates, or a full refund. You can also cancel now — it's refunded in full."}
                    </p>
                    {awaiting && conflict.respondBy && !compact && (
                        <p className="mt-2 text-xs">
                            Please choose by{" "}
                            <strong>
                                {formatConflictDateTime(conflict.respondBy)}
                            </strong>
                            . If you don't, your booking is cancelled and
                            fully refunded automatically.
                        </p>
                    )}
                    {awaiting && optionsButton("See my options")}
                </Card>
                {dialog}
            </>
        );
    }

    if (!showResolved) {
        return null;
    }

    if (
        conflict.status === MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED &&
        change?.newVehicle
    ) {
        const settlement = change.settlement;
        const covered = Number(change.pricing?.coveredAmount || 0);

        return (
            <Card tone="blue" icon={CarFront} title="Vehicle changed">
                <p className="mt-1">
                    Your booking moved from the{" "}
                    {vehicleName(change.previousVehicle)} (
                    {lateReturn
                        ? "not back from its previous rental in time"
                        : "under maintenance"}
                    ) to the {name}, with the same dates and times.{" "}
                    {covered > 0
                        ? `It's a free upgrade — it normally costs ${peso(
                              covered
                          )} more for your dates, but your price stayed the same.`
                        : settlement?.kind === "charge"
                          ? `It costs ${peso(
                                settlement.amount
                            )} more — pay the difference below before pickup.`
                          : settlement?.kind === "refund"
                            ? `It costs less, so ${peso(
                                  settlement.amount
                              )} is being refunded to you.`
                            : change.pricing?.difference < 0
                              ? `It costs ${peso(
                                    Math.abs(change.pricing.difference)
                                )} less, taken off what's due.`
                              : change.pricing?.difference > 0
                                ? `Your new total is ${peso(
                                      change.pricing.totalAmount
                                  )}.`
                                : "The price stays the same."}
                </p>
            </Card>
        );
    }

    if (conflict.status === MAINTENANCE_CONFLICT_STATUS.REFUNDED) {
        return (
            <Card tone="gray">
                Cancelled because{" "}
                {lateReturn
                    ? "the vehicle wasn't back from its previous rental in time"
                    : "the vehicle needed maintenance"}
                {conflict.resolvedByRole === "system"
                    ? conflict.waitUntil
                        ? " (it still wasn't back by the end of the wait)"
                        : " (no option was chosen in time)"
                    : ""}
                .{" "}
                {conflict.refundAmount > 0
                    ? `${peso(
                          conflict.refundAmount
                      )} was refunded in full, with no cancellation fee.`
                    : "Nothing had been paid, so no refund was needed."}
            </Card>
        );
    }

    if (
        lateReturn &&
        conflict.status === MAINTENANCE_CONFLICT_STATUS.CLEARED &&
        conflict.vehicleReturnedAt
    ) {
        return (
            <Card tone="green" icon={CheckCircle2} title="Your vehicle is back">
                <p className="mt-1">
                    The {name} was returned{" "}
                    {formatConflictDateTime(conflict.vehicleReturnedAt)}, so
                    your booking went ahead as booked. If it was ready after
                    your pickup time, your rental counts from when you picked
                    it up — you keep the full booked duration.
                </p>
            </Card>
        );
    }

    return null;
};

export default MaintenanceConflictNotice;
