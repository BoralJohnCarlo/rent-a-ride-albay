import { useState } from "react";

import { Clock3, Wrench } from "lucide-react";

import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";
import MaintenanceOptionsDialog from "./MaintenanceOptionsDialog";

import { sendMaintenanceConflictOptions } from "../../api/bookingApi";
import {
    MAINTENANCE_CONFLICT_STATUS,
    formatConflictDateTime,
    formatLateness,
    getConflictLabel,
    hasOpenMaintenanceConflict,
    isLateReturnConflict,
} from "../../constants/maintenanceConflict";
import useToast from "../../hooks/toast/useToast";

const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "the vehicle";

const personName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ");

const RESOLVED_BY = {
    customer: "the customer",
    admin: "an admin",
    system: "automatically (deadline passed)",
};

const Row = ({ label, children }) => (
    <div>
        <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
        <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {children}
        </dd>
    </div>
);

/*
 * Admin view of a booking whose vehicle won't be ready — under maintenance,
 * or still out on a late return: what happened, where it stands, and the
 * actions — send the customer their options (late returns send them
 * automatically once the vehicle can't be ready in time), choose for them,
 * or cancel with a full refund. Shows the outcome once resolved (including
 * a vehicle switch and how its price difference was settled or covered).
 */
const MaintenanceConflictAdminPanel = ({ booking, onChanged }) => {
    const toast = useToast();
    const [confirmSend, setConfirmSend] = useState(false);
    const [sending, setSending] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);

    const conflict = booking?.maintenanceConflict;

    if (!conflict) {
        return null;
    }

    const isOpen = hasOpenMaintenanceConflict(booking);
    const lateReturn = isLateReturnConflict(booking);
    const change = conflict.vehicleChange;
    const changed =
        conflict.status === MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED &&
        change?.newVehicle;
    const covered = Number(change?.pricing?.coveredAmount || 0);
    const Icon = lateReturn ? Clock3 : Wrench;
    const rentalCode = conflict.blockingRental?.rentalCode;

    const send = async () => {
        setSending(true);

        try {
            await sendMaintenanceConflictOptions(booking._id);
            toast.success(
                lateReturn
                    ? "The customer was notified and can now switch vehicles (no extra cost), wait, or take a full refund."
                    : "The customer was notified and can now choose another vehicle or a full refund.",
                "Options sent"
            );
            setConfirmSend(false);
            onChanged?.();
        } catch (error) {
            toast.error(
                error?.response?.data?.message || "Couldn't send the options.",
                "Failed"
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <section
            className={`rounded-xl border p-4 ${
                isOpen
                    ? "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20"
                    : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60"
            }`}
        >
            <div className="flex items-start gap-3">
                <Icon
                    size={18}
                    className={`mt-0.5 shrink-0 ${
                        isOpen
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-gray-500"
                    }`}
                />
                <div className="min-w-0 flex-1">
                    <h3
                        className={`text-sm font-semibold ${
                            isOpen
                                ? "text-rose-800 dark:text-rose-300"
                                : "text-gray-900 dark:text-white"
                        }`}
                    >
                        {lateReturn
                            ? "Late return conflict"
                            : "Vehicle maintenance conflict"}{" "}
                        · {getConflictLabel(conflict)}
                    </h3>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {lateReturn
                            ? `The ${vehicleName(
                                  changed ? change.previousVehicle : booking.vehicle
                              )} wasn't back from its previous rental${
                                  rentalCode ? ` (${rentalCode})` : ""
                              } by its due-back time, putting this booking at risk.${
                                  isOpen &&
                                  conflict.status ===
                                      MAINTENANCE_CONFLICT_STATUS.DETECTED
                                      ? " The customer was warned. If the vehicle can't be back and turned around by pickup, they're sent their options automatically — or send them now."
                                      : ""
                              }${
                                  isOpen
                                      ? " If it comes back in time, this clears by itself and the booking goes ahead."
                                      : ""
                              }`
                            : changed
                              ? `The booked ${vehicleName(
                                    change.previousVehicle
                                )} went under maintenance over this booking.`
                              : `The ${vehicleName(
                                    booking.vehicle
                                )} went under maintenance over this booking, so it can't be approved or picked up as is.`}
                    </p>

                    <dl className="mt-3 grid grid-cols-2 gap-3">
                        {lateReturn ? (
                            <>
                                {rentalCode && (
                                    <Row label="Late rental">{rentalCode}</Row>
                                )}
                                <Row label="Was due back">
                                    {formatConflictDateTime(conflict.dueBackAt)}
                                </Row>
                                <Row
                                    label={
                                        conflict.vehicleReturnedAt
                                            ? "Returned"
                                            : "Late by"
                                    }
                                >
                                    {conflict.vehicleReturnedAt
                                        ? `${formatConflictDateTime(
                                              conflict.vehicleReturnedAt
                                          )} (${formatLateness(
                                              conflict.dueBackAt,
                                              conflict.vehicleReturnedAt
                                          )} late)`
                                        : isOpen
                                          ? `${formatLateness(
                                                conflict.dueBackAt
                                            )} and counting`
                                          : "—"}
                                </Row>
                                <Row label="Booked pickup">
                                    {formatConflictDateTime(booking.startDate)}
                                </Row>
                            </>
                        ) : (
                            <Row label="Maintenance">
                                {conflict.maintenanceUntil
                                    ? `Until ${formatConflictDateTime(
                                          conflict.maintenanceUntil
                                      )}`
                                    : "Off road — no end date"}
                            </Row>
                        )}
                        <Row label={lateReturn ? "Customer warned" : "Flagged"}>
                            {formatConflictDateTime(conflict.detectedAt)}
                        </Row>
                        {conflict.optionsSentAt && (
                            <Row label="Options sent">
                                {formatConflictDateTime(
                                    conflict.optionsSentAt
                                )}
                                {personName(conflict.optionsSentBy)
                                    ? ` by ${personName(
                                          conflict.optionsSentBy
                                      )}`
                                    : lateReturn
                                      ? " (automatically)"
                                      : ""}
                            </Row>
                        )}
                        {conflict.respondBy &&
                            isOpen &&
                            conflict.status !==
                                MAINTENANCE_CONFLICT_STATUS.WAITING && (
                                <Row label="Customer must choose by">
                                    {formatConflictDateTime(conflict.respondBy)}
                                </Row>
                            )}
                        {conflict.waitUntil && (
                            <Row
                                label={
                                    isOpen
                                        ? "Waiting — refunded if not back by"
                                        : "Customer waited until"
                                }
                            >
                                {formatConflictDateTime(conflict.waitUntil)}
                            </Row>
                        )}
                        {conflict.resolvedAt && (
                            <Row label="Resolved">
                                {formatConflictDateTime(conflict.resolvedAt)}
                                {conflict.resolvedByRole
                                    ? ` by ${
                                          RESOLVED_BY[
                                              conflict.resolvedByRole
                                          ] ?? conflict.resolvedByRole
                                      }`
                                    : ""}
                            </Row>
                        )}
                        {conflict.status ===
                            MAINTENANCE_CONFLICT_STATUS.REFUNDED && (
                            <Row label="Refunded">
                                {peso(conflict.refundAmount)}
                            </Row>
                        )}
                        {changed && (
                            <>
                                <Row label="Moved">
                                    {vehicleName(change.previousVehicle)} →{" "}
                                    {vehicleName(booking.vehicle)}
                                </Row>
                                {covered > 0 ? (
                                    <Row label="Free upgrade">
                                        Customer kept{" "}
                                        {peso(change.pricing?.previousTotalAmount)}
                                        ; platform covers {peso(covered)} (the
                                        new partner is paid its full rate)
                                    </Row>
                                ) : (
                                    <Row label="New total">
                                        {peso(change.pricing?.totalAmount)} (
                                        {change.pricing?.difference > 0
                                            ? "+"
                                            : change.pricing?.difference < 0
                                              ? "−"
                                              : "±"}
                                        {peso(
                                            Math.abs(
                                                change.pricing?.difference || 0
                                            )
                                        )}
                                        )
                                    </Row>
                                )}
                                {change.settlement?.kind &&
                                    change.settlement.kind !== "none" && (
                                        <Row label="Settlement">
                                            {change.settlement.kind ===
                                            "charge"
                                                ? `${peso(
                                                      change.settlement
                                                          .amount
                                                  )} charged to the customer${
                                                      booking.extensionPaymentPurpose ===
                                                          "vehicleChange" &&
                                                      booking.extensionPaymentStatus
                                                          ? ` (${String(
                                                                booking.extensionPaymentStatus
                                                            ).toLowerCase()})`
                                                          : ""
                                                  }`
                                                : `${peso(
                                                      change.settlement
                                                          .amount
                                                  )} refunded`}
                                            {change.settlement.manual
                                                ? " — needs manual handling (see Owed refunds)"
                                                : ""}
                                        </Row>
                                    )}
                            </>
                        )}
                    </dl>

                    {conflict.resolutionNote && !isOpen && (
                        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                            {conflict.resolutionNote}
                        </p>
                    )}

                    {isOpen && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {conflict.status ===
                                MAINTENANCE_CONFLICT_STATUS.DETECTED && (
                                <Button
                                    size="sm"
                                    onClick={() => setConfirmSend(true)}
                                >
                                    {lateReturn
                                        ? "Send options now"
                                        : "Send options to customer"}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setOptionsOpen(true)}
                            >
                                {lateReturn
                                    ? "Choose for them"
                                    : "Choose vehicle or refund for them"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={confirmSend}
                onClose={() => !sending && setConfirmSend(false)}
                onConfirm={send}
                loading={sending}
                confirmVariant="primary"
                title="Send the customer their options?"
                message={
                    lateReturn
                        ? "They'll be told the vehicle is running late and asked to choose now rather than wait for the automatic send: another vehicle for the same dates at no extra cost (a cheaper one refunds the difference), waiting for this one, or a full refund. Their deadline is the pickup time plus the no-show grace; if the vehicle still isn't back by then and they haven't chosen, the booking is refunded in full automatically."
                        : "They'll be notified that their vehicle needs maintenance and asked to choose: another vehicle for the same dates (any price difference charged or refunded), or cancelling for a full refund. They get until 48 hours from now — but no later than 24 hours before pickup — after which the booking is cancelled and refunded in full automatically."
                }
                confirmText="Send options"
            />

            <MaintenanceOptionsDialog
                isOpen={optionsOpen}
                onClose={() => setOptionsOpen(false)}
                booking={booking}
                mode="admin"
                onDone={(_, message) => {
                    toast.success(message || "Done.", "Success");
                    onChanged?.();
                }}
            />
        </section>
    );
};

export default MaintenanceConflictAdminPanel;
