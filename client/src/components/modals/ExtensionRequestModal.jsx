import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import useToast from "../../hooks/toast/useToast";
import Button from "../common/Button";
import Input from "../common/Input";
import Modal from "../common/Modal";
import {
    addDaysToDateKey,
    formatPickupTime,
    getManilaDateKey,
    getPickupTimeOf,
    toPickupDateTime,
} from "../../utils/pickupTime";

const ExtensionRequestModal = ({
    isOpen,
    onClose,
    onSubmit,
    loading = false,
    booking,
}) => {
    const toast = useToast();
    const [requestedEndDate, setRequestedEndDate] = useState("");
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setRequestedEndDate("");
            setReason("");
        }
    }, [isOpen]);

    if (!booking) return null;

    const currentEndDate = booking.endDate
        ? new Date(booking.endDate)
        : null;

    /*
     * Extensions keep the rental's return time (e.g. 2:00 PM) and move it
     * by whole days: the customer picks the new return date. A bare date
     * would otherwise mean 8:00 AM on it and cut hours off, since the
     * return time follows the actual pickup.
     */
    const returnTime = currentEndDate
        ? getPickupTimeOf(currentEndDate)
        : null;

    const minEndDate = currentEndDate
        ? addDaysToDateKey(getManilaDateKey(currentEndDate), 1)
        : "";

    const handleSubmit = async () => {
        if (!requestedEndDate || !returnTime) return;

        const requested = toPickupDateTime(
            requestedEndDate,
            returnTime
        );

        if (requested <= new Date()) {
            toast.error(
                "Requested end date must be in the future.",
                "Invalid Date"
            );
            return;
        }

        await onSubmit({
            requestedEndDate: requested.toISOString(),
            ...(reason.trim() && { reason: reason.trim() }),
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Request Extension"
            size="md"
            footer={
                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={!requestedEndDate}
                    >
                        Submit Request
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
                        <CalendarClock size={16} />
                        <span>
                            Currently due back:{" "}
                            {currentEndDate
                                ? currentEndDate.toLocaleString(
                                      "en-PH",
                                      {
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                      }
                                  )
                                : "—"}
                        </span>
                    </div>
                </div>

                <Input
                    id="extension-end-date"
                    name="requestedEndDate"
                    type="date"
                    label="New Return Date"
                    required
                    min={minEndDate}
                    value={requestedEndDate}
                    onChange={(event) =>
                        setRequestedEndDate(event.target.value)
                    }
                    helperText={
                        returnTime
                            ? `You'd return it at ${formatPickupTime(returnTime)} on this date (Philippine time), the same time as now.`
                            : undefined
                    }
                />

                <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300">
                    The extension price is calculated securely from the
                    vehicle's daily rate.
                </p>

                <div>
                    <label
                        htmlFor="extension-reason"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        Reason{" "}
                        <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                        id="extension-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Why do you need to extend?"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {reason.length}/500
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default ExtensionRequestModal;
