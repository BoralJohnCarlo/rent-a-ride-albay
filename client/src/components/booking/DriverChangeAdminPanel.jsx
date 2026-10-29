import { AlertTriangle, History, Repeat2, UserRoundCheck } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import Button from "../common/Button";
import Select from "../common/Select";
import Textarea from "../common/Textarea";

import { getDrivers } from "../../api/driverApi";
import {
    approveDriverChangeRequest,
    changeBookingDriver,
    declineDriverChangeRequest,
} from "../../api/bookingApi";
import useToast from "../../hooks/toast/useToast";
import formatDate from "../../utils/formatDate";
import {
    getDriverIssue,
    getDriverName,
    getPendingDriverChangeRequest,
    isDriverChangeable,
} from "../../utils/driverChange";

const errorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

/**
 * Admin tools in the booking's Driver section before pickup: change the
 * driver (a reason is required), answer a customer's request for a
 * different one, and the change history. The price stays as quoted.
 */
const DriverChangeAdminPanel = ({ booking, onChanged }) => {
    const toast = useToast();

    // null | "change" | "approve" | "decline"
    const [mode, setMode] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [driversLoading, setDriversLoading] = useState(false);
    const [driverId, setDriverId] = useState("");
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const changeable = isDriverChangeable(booking);
    const issue = getDriverIssue(booking);
    const pending = getPendingDriverChangeRequest(booking);
    const currentDriverId = booking?.driver?._id ?? booking?.driver ?? null;

    const needsDriverList = mode === "change" || mode === "approve";
    const bookingId = booking?._id;
    const startDate = booking?.startDate;
    const endDate = booking?.endDate;

    // Free for this trip, with a licence that lasts it (busy ones marked).
    useEffect(() => {
        if (!needsDriverList || !bookingId) {
            return undefined;
        }

        let cancelled = false;

        setDriversLoading(true);

        getDrivers({
            status: "ACTIVE",
            availability: "BOOKABLE",
            startDate,
            endDate,
        })
            .then((response) => {
                if (!cancelled) {
                    setDrivers(response?.data ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDrivers([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setDriversLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [needsDriverList, bookingId, startDate, endDate]);

    const driverOptions = useMemo(
        () =>
            drivers
                .filter(
                    (driver) =>
                        String(driver._id) !== String(currentDriverId)
                )
                .map((driver) => ({
                    value: driver._id,
                    label: driver.busy
                        ? `${getDriverName(driver)} — booked on these dates`
                        : getDriverName(driver),
                    disabled: Boolean(driver.busy),
                })),
        [drivers, currentDriverId]
    );

    const open = (nextMode) => {
        setMode(nextMode);
        setText("");
        setError("");
        setDriverId(
            nextMode === "approve"
                ? (pending?.preferredDriver?._id ?? pending?.preferredDriver ?? "")
                : ""
        );
    };

    const close = () => {
        setMode(null);
        setError("");
    };

    const submit = async () => {
        if (mode === "change" && !driverId) {
            setError("Choose the new driver.");
            return;
        }

        if (mode === "change" && !text.trim()) {
            setError("Please give a reason for the change.");
            return;
        }

        if (mode === "approve" && !driverId) {
            setError("Choose the driver to assign.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            if (mode === "change") {
                await changeBookingDriver(bookingId, {
                    driverId,
                    reason: text.trim(),
                });
                toast.success(
                    "The customer has been told who their new driver is.",
                    "Driver Changed"
                );
            } else if (mode === "approve") {
                await approveDriverChangeRequest(bookingId, pending._id, {
                    driverId,
                    note: text.trim(),
                });
                toast.success(
                    "The new driver is assigned and the customer was notified.",
                    "Request Approved"
                );
            } else {
                await declineDriverChangeRequest(bookingId, pending._id, {
                    note: text.trim(),
                });
                toast.success(
                    "The customer keeps their current driver.",
                    "Request Declined"
                );
            }

            setMode(null);
            await onChanged?.();
        } catch (requestError) {
            setError(
                errorMessage(requestError, "The change couldn't be saved.")
            );
        } finally {
            setSaving(false);
        }
    };

    const history = [...(booking?.driverChanges || [])].reverse();

    if (!changeable && history.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3">
            {issue && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                        <span className="font-semibold">
                            Needs a new driver.
                        </span>{" "}
                        {issue} Pickup will be refused until the driver is
                        changed.
                    </span>
                </div>
            )}

            {changeable && pending && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                        The customer asked for a different driver
                    </p>
                    <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                        "{pending.reason}"
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
                        {pending.preferredDriver
                            ? `Prefers ${getDriverName(pending.preferredDriver)}`
                            : "No preferred driver"}{" "}
                        · {formatDate(pending.requestedAt, { hour: "numeric", minute: "2-digit" })}
                    </p>

                    {!mode && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="success"
                                leftIcon={<UserRoundCheck size={14} />}
                                onClick={() => open("approve")}
                            >
                                Approve
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => open("decline")}
                            >
                                Decline
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {changeable && !mode && !pending && (
                <Button
                    type="button"
                    size="sm"
                    variant={issue ? "danger" : "outline"}
                    leftIcon={<Repeat2 size={14} />}
                    onClick={() => open("change")}
                >
                    Change driver
                </Button>
            )}

            {changeable && mode && (
                <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    {mode !== "decline" && (
                        <Select
                            label={mode === "approve" ? "Driver to assign" : "New driver"}
                            name="newDriver"
                            value={driverId}
                            onChange={(event) => {
                                setDriverId(event.target.value);
                                setError("");
                            }}
                            options={driverOptions}
                            placeholder={
                                driversLoading
                                    ? "Loading drivers..."
                                    : driverOptions.length
                                      ? "Choose a driver"
                                      : "No other driver is free for these dates"
                            }
                            helperText="Only drivers free for these dates, with a license that lasts the trip. The customer keeps their quoted price."
                        />
                    )}

                    <Textarea
                        label={
                            mode === "change"
                                ? "Reason (required)"
                                : "Note to the customer (optional)"
                        }
                        name="driverChangeText"
                        rows={2}
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setError("");
                        }}
                        maxLength={500}
                    />

                    {error && (
                        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={close}
                            disabled={saving}
                        >
                            Back
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={mode === "decline" ? "danger" : "primary"}
                            loading={saving}
                            onClick={submit}
                        >
                            {mode === "change"
                                ? "Change driver"
                                : mode === "approve"
                                  ? "Approve & assign"
                                  : "Decline request"}
                        </Button>
                    </div>
                </div>
            )}

            {history.length > 0 && (
                <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        <History size={12} />
                        Driver changes
                    </p>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                        {history.map((change) => (
                            <li key={change._id}>
                                <span className="font-semibold">
                                    {change.previousDriver
                                        ? getDriverName(change.previousDriver)
                                        : "Unassigned"}{" "}
                                    → {getDriverName(change.newDriver)}
                                </span>{" "}
                                · {formatDate(change.changedAt, { hour: "numeric", minute: "2-digit" })}
                                {change.reason ? ` · ${change.reason}` : ""}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default DriverChangeAdminPanel;
