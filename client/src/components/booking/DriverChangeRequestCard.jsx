import { Repeat2 } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import Button from "../common/Button";
import Modal from "../common/Modal";
import Select from "../common/Select";
import Textarea from "../common/Textarea";

import { getAvailableDrivers } from "../../api/driverApi";
import {
    cancelDriverChangeRequest,
    requestDriverChange,
} from "../../api/bookingApi";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import useToast from "../../hooks/toast/useToast";
import { getDriverDailyRate } from "../../utils/driverPricing";
import {
    DRIVER_CHANGE_MIN_NOTICE_HOURS,
    getDriverName,
    getPendingDriverChangeRequest,
    isDriverChangeable,
    isWithinDriverChangeNotice,
} from "../../utils/driverChange";

const NO_PREFERENCE = "";

const errorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

/**
 * Customer: ask for a different driver before pickup (at least 24 hours
 * ahead), optionally naming one; an admin approves or declines. Shows a
 * pending request with a way to withdraw it.
 */
const DriverChangeRequestCard = ({ booking, onChanged }) => {
    const toast = useToast();

    const { driverPricing, requireAdminDriverAssignment } =
        usePublicRefundSettings();

    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [preferredId, setPreferredId] = useState(NO_PREFERENCE);
    const [drivers, setDrivers] = useState([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const pending = getPendingDriverChangeRequest(booking);
    const lastResolved = [...(booking?.driverChangeRequests || [])]
        .reverse()
        .find((request) => request?.status !== "Pending");

    const currentDriverId = booking?.driver?._id ?? booking?.driver ?? null;
    const lockedRate = Number(booking?.pricing?.driverDailyRate) || 0;
    const bookingId = booking?._id;
    const startDate = booking?.startDate;
    const endDate = booking?.endDate;

    // Drivers free for this trip who don't cost more than the quoted rate.
    useEffect(() => {
        if (!open || requireAdminDriverAssignment || !bookingId) {
            return undefined;
        }

        let cancelled = false;

        getAvailableDrivers({ startDate, endDate })
            .then((response) => {
                if (!cancelled) {
                    setDrivers(response?.data ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDrivers([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, requireAdminDriverAssignment, bookingId, startDate, endDate]);

    const options = useMemo(
        () => [
            { value: NO_PREFERENCE, label: "No preference — choose for me" },
            ...drivers
                .filter(
                    (driver) =>
                        !driver.busy &&
                        String(driver._id) !== String(currentDriverId) &&
                        getDriverDailyRate({
                            driverOption: "With Driver",
                            driver,
                            driverPricing,
                        }) <= lockedRate
                )
                .map((driver) => ({
                    value: driver._id,
                    label: getDriverName(driver),
                })),
        ],
        [drivers, currentDriverId, driverPricing, lockedRate]
    );

    if (!isDriverChangeable(booking) || !currentDriverId) {
        return null;
    }

    const withinNotice = isWithinDriverChangeNotice(booking);

    const submit = async () => {
        if (!reason.trim()) {
            setError("Please tell us why you'd like a different driver.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await requestDriverChange(bookingId, {
                reason: reason.trim(),
                preferredDriverId: preferredId || null,
            });

            toast.success(
                "We'll review it and let you know.",
                "Request Sent"
            );

            setOpen(false);
            setReason("");
            setPreferredId(NO_PREFERENCE);
            await onChanged?.();
        } catch (requestError) {
            setError(
                errorMessage(requestError, "Your request couldn't be sent.")
            );
        } finally {
            setSaving(false);
        }
    };

    const withdraw = async () => {
        setSaving(true);

        try {
            await cancelDriverChangeRequest(bookingId, pending._id);
            toast.success("Your current driver stays.", "Request Withdrawn");
            await onChanged?.();
        } catch (requestError) {
            toast.error(
                errorMessage(requestError, "Your request couldn't be withdrawn.")
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-3">
            {pending ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                        You asked for a different driver
                    </p>
                    <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
                        "{pending.reason}"
                        {pending.preferredDriver
                            ? ` · Preferred: ${getDriverName(pending.preferredDriver)}`
                            : ""}
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">
                        We'll let you know once our team has reviewed it.
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        loading={saving}
                        onClick={withdraw}
                    >
                        Withdraw request
                    </Button>
                </div>
            ) : (
                <>
                    {lastResolved?.status === "Declined" && (
                        <p className="mb-2 text-xs text-[#14161B]/50 dark:text-white/40">
                            Your last request for a different driver was
                            declined
                            {lastResolved.resolutionNote
                                ? `: ${lastResolved.resolutionNote}`
                                : "."}
                        </p>
                    )}

                    {withinNotice ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            leftIcon={<Repeat2 size={14} />}
                            onClick={() => {
                                setError("");
                                setOpen(true);
                            }}
                        >
                            Request a different driver
                        </Button>
                    ) : (
                        <p className="text-xs text-[#14161B]/50 dark:text-white/40">
                            Need a different driver? It's less than{" "}
                            {DRIVER_CHANGE_MIN_NOTICE_HOURS} hours to pickup,
                            so please contact us.
                        </p>
                    )}
                </>
            )}

            <Modal
                isOpen={open}
                onClose={() => !saving && setOpen(false)}
                title="Request a Different Driver"
                description="Our team reviews every request. Your price stays the same."
                size="md"
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            loading={saving}
                            onClick={submit}
                        >
                            Send request
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Textarea
                        label="Why would you like a different driver?"
                        name="driverChangeReason"
                        rows={3}
                        maxLength={500}
                        value={reason}
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError("");
                        }}
                    />

                    {!requireAdminDriverAssignment && (
                        <Select
                            label="Preferred driver (optional)"
                            name="preferredDriver"
                            value={preferredId}
                            onChange={(event) =>
                                setPreferredId(event.target.value)
                            }
                            options={options}
                            helperText="Only drivers free on your dates who don't cost more than your current driver rate."
                        />
                    )}

                    {error && (
                        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default DriverChangeRequestCard;
