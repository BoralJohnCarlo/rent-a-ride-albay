import { useEffect, useState } from "react";

import { CarFront, Check, Hourglass, RotateCcw } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
import LoadingSpinner from "../common/LoadingSpinner";

import {
    changeVehicleForMaintenanceConflict,
    getMaintenanceConflictOptions,
    refundMaintenanceConflict,
    waitForLateVehicle,
} from "../../api/bookingApi";
import {
    VEHICLE_CONFLICT_CAUSE,
    formatConflictDateTime,
} from "../../constants/maintenanceConflict";

const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

const coverImage = (vehicle) => {
    const image = vehicle?.images?.[0];

    return typeof image === "string" ? image : image?.url ?? null;
};

/* What choosing this vehicle means for the customer's money. */
const describeSettlement = (option, reservationUnpaid) => {
    if (option.difference === 0) {
        return "Same price";
    }

    if (option.settlement?.kind === "covered") {
        return `Free upgrade — normally ${peso(option.difference)} more`;
    }

    if (option.settlement?.kind === "charge") {
        return `${peso(option.settlement.amount)} more — paid online before pickup`;
    }

    if (option.settlement?.kind === "refund") {
        return `${peso(option.settlement.amount)} back to you`;
    }

    if (option.difference > 0) {
        return reservationUnpaid
            ? `${peso(option.difference)} more on your total`
            : `${peso(option.difference)} more`;
    }

    return `${peso(Math.abs(option.difference))} less on what's due`;
};

/*
 * The choices after a booking's vehicle won't be ready. Maintenance:
 * another vehicle for the same dates (priced for them, with the difference
 * charged or refunded), or cancelling for a full refund. Late return: the
 * same, except a pricier vehicle is a free upgrade, plus waiting for the
 * vehicle. Used by the customer, and by an admin acting for them
 * (`mode="admin"`). Never shows booking codes or who has the vehicle.
 */
const MaintenanceOptionsDialog = ({
    isOpen,
    onClose,
    booking,
    mode = "customer",
    onDone,
}) => {
    const isAdmin = mode === "admin";

    const [options, setOptions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const bookingId = booking?._id;

    useEffect(() => {
        if (!isOpen || !bookingId) {
            return undefined;
        }

        let active = true;

        setOptions(null);
        setSelectedId(null);
        setLoadError("");
        setSubmitError("");
        setLoading(true);

        getMaintenanceConflictOptions(bookingId)
            .then((response) => {
                if (active) {
                    setOptions(response?.data ?? null);
                }
            })
            .catch((error) => {
                if (active) {
                    setLoadError(
                        error?.response?.data?.message ||
                            "Couldn't load your options. Please try again."
                    );
                }
            })
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [isOpen, bookingId]);

    const selected = options?.alternatives?.find(
        (option) => String(option._id) === String(selectedId)
    );

    const run = async (action) => {
        setSubmitting(true);
        setSubmitError("");

        try {
            const response = await action();

            setConfirm(null);
            onDone?.(response?.data ?? null, response?.message);
            onClose?.();
        } catch (error) {
            setConfirm(null);
            setSubmitError(
                error?.response?.data?.message ||
                    "Something went wrong. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const currentVehicle = vehicleName(booking?.vehicle);
    const lateReturn =
        (options?.cause ?? booking?.maintenanceConflict?.cause) ===
        VEHICLE_CONFLICT_CAUSE.LATE_RETURN;
    const they = isAdmin ? "they" : "you";
    const their = isAdmin ? "their" : "your";
    const totalFor = (option) =>
        option?.customerTotalAmount ?? option?.totalAmount;

    return (
        <>
            <Modal
                isOpen={isOpen && !confirm}
                onClose={submitting ? undefined : onClose}
                title={
                    isAdmin
                        ? "Resolve for the customer"
                        : lateReturn
                          ? "Your vehicle is running late"
                          : "Your vehicle needs maintenance"
                }
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
                            variant="danger"
                            onClick={() => setConfirm("refund")}
                            disabled={!options || submitting}
                        >
                            {isAdmin
                                ? "Cancel with full refund"
                                : "Cancel for a full refund"}
                        </Button>
                        <Button
                            onClick={() => setConfirm("vehicle")}
                            disabled={!selected || submitting}
                        >
                            {selected
                                ? `Switch to ${vehicleName(selected)}`
                                : "Choose a vehicle"}
                        </Button>
                    </>
                }
            >
                {loading && (
                    <div className="flex justify-center py-10">
                        <LoadingSpinner />
                    </div>
                )}

                {loadError && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {loadError}
                    </p>
                )}

                {options && (
                    <div className="space-y-5">
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            <p>
                                The <strong>{currentVehicle}</strong>{" "}
                                {isAdmin ? "the customer" : "you"} booked for{" "}
                                <strong>
                                    {formatConflictDateTime(options.startDate)}
                                </strong>{" "}
                                –{" "}
                                <strong>
                                    {formatConflictDateTime(options.endDate)}
                                </strong>{" "}
                                {lateReturn
                                    ? `is still out with its previous renter${
                                          options.dueBackAt
                                              ? `, who was due to return it ${formatConflictDateTime(
                                                    options.dueBackAt
                                                )}`
                                              : ""
                                      }`
                                    : options.maintenanceUntil
                                      ? `needs maintenance until ${formatConflictDateTime(
                                            options.maintenanceUntil
                                        )}`
                                      : "is off the road for maintenance"}
                                , so it won't be ready in time. This isn't{" "}
                                {their} fault —{" "}
                                {lateReturn
                                    ? `${they} can switch to another vehicle for the same dates at no extra cost, wait for this one, or cancel and get every peso back.`
                                    : `${they} can switch to another vehicle for the same dates, or cancel and get every peso back.`}
                            </p>
                            {options.waiting && options.waitUntil ? (
                                <p className="mt-2 font-semibold">
                                    {isAdmin ? "They're" : "You're"} waiting
                                    for this vehicle until{" "}
                                    {formatConflictDateTime(options.waitUntil)}
                                    .{" "}
                                    <span className="font-normal">
                                        If it isn't back by then, the booking
                                        is cancelled and refunded in full
                                        automatically. Switching or cancelling
                                        below still works until then.
                                    </span>
                                </p>
                            ) : (
                                options.respondBy && (
                                    <p className="mt-2 font-semibold">
                                        {isAdmin ? "Their" : "Please choose by"}{" "}
                                        {isAdmin ? "deadline: " : ""}
                                        {formatConflictDateTime(
                                            options.respondBy
                                        )}
                                        .{" "}
                                        <span className="font-normal">
                                            {lateReturn
                                                ? "If no option is chosen by then and the vehicle still isn't back, the booking is cancelled and fully refunded automatically. If it comes back first, the booking simply goes ahead."
                                                : "If no option is chosen by then, the booking is cancelled and fully refunded automatically."}
                                        </span>
                                    </p>
                                )
                            )}
                        </div>

                        {options.waitAvailable && (
                            <section className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    <Hourglass size={16} />
                                    Wait for the {currentVehicle}
                                </h3>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                    Keep this booking and pick it up as soon
                                    as it's back and ready — we'll notify{" "}
                                    {isAdmin ? "them" : "you"}. The rental
                                    starts at pickup, with the full booked
                                    duration. If it isn't back by{" "}
                                    <strong>
                                        {formatConflictDateTime(
                                            options.waitUntil
                                        )}
                                    </strong>
                                    , the booking is cancelled and refunded in
                                    full automatically.
                                </p>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="mt-3"
                                    onClick={() => setConfirm("wait")}
                                    disabled={submitting}
                                >
                                    Wait for this vehicle
                                </Button>
                            </section>
                        )}

                        <section>
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                <CarFront size={16} />
                                Switch to another vehicle
                            </h3>

                            {!options.vehicleChangeAvailable ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    {options.vehicleChangeBlockedReason}
                                </p>
                            ) : options.alternatives.length === 0 ? (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    No other vehicle is free for these exact
                                    dates
                                    {booking?.driverOption ===
                                    "Without Driver"
                                        ? " that your driver's license covers"
                                        : ""}
                                    . A full refund is the remaining option.
                                </p>
                            ) : (
                                <>
                                    <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                                        Same pickup and return times, same
                                        pickup/return locations
                                        {booking?.driverOption ===
                                        "With Driver"
                                            ? " and driver"
                                            : ""}
                                        . Prices are for{" "}
                                        {isAdmin ? "their" : "your"} dates;
                                        any voucher still applies.
                                        {options.coversUpgrades &&
                                            ` A pricier vehicle costs ${
                                                isAdmin ? "them" : "you"
                                            } nothing extra (we cover it); a cheaper one refunds the difference.`}
                                    </p>
                                    <div className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                        {options.alternatives.map(
                                            (option) => {
                                                const isSelected =
                                                    String(option._id) ===
                                                    String(selectedId);
                                                const image =
                                                    coverImage(option);

                                                return (
                                                    <button
                                                        key={option._id}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedId(
                                                                option._id
                                                            )
                                                        }
                                                        aria-pressed={
                                                            isSelected
                                                        }
                                                        className={`flex gap-3 rounded-lg border p-2 text-left transition ${
                                                            isSelected
                                                                ? "border-yellow-400 bg-yellow-50 ring-1 ring-yellow-400 dark:border-yellow-500/60 dark:bg-yellow-500/10"
                                                                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                                                        }`}
                                                    >
                                                        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                                                            {image ? (
                                                                <img
                                                                    src={
                                                                        image
                                                                    }
                                                                    alt=""
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            ) : (
                                                                <CarFront
                                                                    size={
                                                                        24
                                                                    }
                                                                    className="m-auto mt-5 text-gray-400"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="flex items-center gap-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                                {isSelected && (
                                                                    <Check
                                                                        size={
                                                                            14
                                                                        }
                                                                        className="shrink-0 text-yellow-600"
                                                                    />
                                                                )}
                                                                {vehicleName(
                                                                    option
                                                                )}
                                                                {option.year
                                                                    ? ` ${option.year}`
                                                                    : ""}
                                                            </p>
                                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                                {[
                                                                    option
                                                                        .category
                                                                        ?.name,
                                                                    option
                                                                        .specifications
                                                                        ?.transmission,
                                                                    option
                                                                        .specifications
                                                                        ?.seatingCapacity &&
                                                                        `${option.specifications.seatingCapacity} seats`,
                                                                ]
                                                                    .filter(
                                                                        Boolean
                                                                    )
                                                                    .join(
                                                                        " · "
                                                                    )}
                                                            </p>
                                                            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                                                                {peso(
                                                                    totalFor(
                                                                        option
                                                                    )
                                                                )}{" "}
                                                                total
                                                            </p>
                                                            <p
                                                                className={`text-xs font-medium ${
                                                                    option
                                                                        .settlement
                                                                        ?.kind ===
                                                                    "covered"
                                                                        ? "text-emerald-700 dark:text-emerald-400"
                                                                        : option.difference >
                                                                    0
                                                                        ? "text-amber-700 dark:text-amber-400"
                                                                        : option.difference <
                                                                            0
                                                                          ? "text-emerald-700 dark:text-emerald-400"
                                                                          : "text-gray-500 dark:text-gray-400"
                                                                }`}
                                                            >
                                                                {describeSettlement(
                                                                    option,
                                                                    options.reservationUnpaid
                                                                )}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            }
                                        )}
                                    </div>
                                </>
                            )}
                        </section>

                        <section className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                <RotateCcw size={16} />
                                Or cancel for a full refund
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                {options.refundAmount > 0 ? (
                                    <>
                                        <strong>
                                            {peso(options.refundAmount)}
                                        </strong>{" "}
                                        — everything{" "}
                                        {isAdmin ? "they" : "you"} paid,
                                        with no cancellation fee — goes back
                                        to the original payment method. Any
                                        voucher used is returned.
                                    </>
                                ) : (
                                    "Nothing has been paid yet, so there's nothing to refund — the booking is simply cancelled at no cost."
                                )}
                            </p>
                        </section>

                        {submitError && (
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                {submitError}
                            </p>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                isOpen={confirm === "vehicle"}
                onClose={() => !submitting && setConfirm(null)}
                onConfirm={() =>
                    run(() =>
                        changeVehicleForMaintenanceConflict(
                            bookingId,
                            selected._id
                        )
                    )
                }
                loading={submitting}
                confirmVariant="primary"
                title={`Switch to the ${vehicleName(selected)}?`}
                message={
                    selected
                        ? `The booking keeps the same dates and times and moves from the ${currentVehicle} to the ${vehicleName(
                              selected
                          )}. New total: ${peso(totalFor(selected))} (${describeSettlement(
                              selected,
                              options?.reservationUnpaid
                          ).toLowerCase()}).`
                        : ""
                }
                confirmText="Switch vehicle"
            />

            <ConfirmDialog
                isOpen={confirm === "wait"}
                onClose={() => !submitting && setConfirm(null)}
                onConfirm={() => run(() => waitForLateVehicle(bookingId))}
                loading={submitting}
                confirmVariant="primary"
                title={`Wait for the ${currentVehicle}?`}
                message={`The booking stays as it is and ${they}'ll be notified the moment the vehicle is back and ready. ${
                    isAdmin ? "They" : "You"
                } can still switch vehicles or cancel for a full refund until ${formatConflictDateTime(
                    options?.waitUntil
                )} — if it isn't back by then, the booking is cancelled and refunded in full automatically.`}
                confirmText="Wait for it"
            />

            <ConfirmDialog
                isOpen={confirm === "refund"}
                onClose={() => !submitting && setConfirm(null)}
                onConfirm={() =>
                    run(() => refundMaintenanceConflict(bookingId))
                }
                loading={submitting}
                title="Cancel for a full refund?"
                message={`The booking is cancelled${
                    options?.refundAmount > 0
                        ? ` and ${peso(
                              options.refundAmount
                          )} is refunded in full`
                        : ""
                }. This can't be undone.`}
                confirmText="Cancel & refund"
            />
        </>
    );
};

export default MaintenanceOptionsDialog;
