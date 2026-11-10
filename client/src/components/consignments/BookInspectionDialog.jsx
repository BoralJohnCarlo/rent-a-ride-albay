import { useEffect, useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Alert from "../common/Alert";
import Textarea from "../common/Textarea";

import ConsignmentSummaryCard from "./ConsignmentSummaryCard";

import { getInspectionAvailability } from "../../api/inspectionSettingApi";
import formatDate from "../../utils/formatDate";

const BookInspectionDialog = ({
    open,
    consignment,
    loading = false,
    onClose,
    onSubmit,
    requestMode = false,
}) => {
    const [slots, setSlots] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [selected, setSelected] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [reason, setReason] = useState("");

    const currentAppointment =
        consignment?.application?.inspection?.scheduledDate
            ? {
                  date: consignment.application.inspection.scheduledDate,
                  time: consignment.application.inspection.scheduledTime,
              }
            : null;

    useEffect(() => {
        if (!open) {
            setSelected(null);
            setReason("");
            setLoadError("");
            return;
        }

        let cancelled = false;
        setSlots([]);
        setSelected(null);
        setFetching(true);
        setLoadError("");

        getInspectionAvailability()
            .then(({ data }) => {
                if (cancelled) return;
                setSlots(data?.data?.slots ?? []);
            })
            .catch((error) => {
                if (cancelled) return;
                setSlots([]);
                setLoadError(
                    error?.response?.data?.message ||
                        "Unable to load inspection availability."
                );
            })
            .finally(() => {
                if (!cancelled) setFetching(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, consignment?._id, retryCount]);

    const bookableSlots = useMemo(
        () =>
            slots
                .map((day) => ({
                    ...day,
                    timeSlots: (day.timeSlots ?? []).filter(
                        (ts) => ts.remaining > 0
                    ),
                }))
                .filter((day) => day.timeSlots.length > 0),
        [slots]
    );

    const handleSubmit = async () => {
        if (!selected || loading || fetching || loadError || (requestMode && !reason.trim())) return;
        await onSubmit?.({ ...selected, reason: reason.trim() });
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={
                currentAppointment
                    ? "Reschedule Inspection"
                    : "Schedule Inspection"
            }
            size="lg"
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        loading={loading}
                        disabled={!selected || loading || fetching || !!loadError || (requestMode && !reason.trim())}
                        onClick={handleSubmit}
                    >
                        {requestMode ? "Request Reschedule" : currentAppointment
                            ? "Move Appointment"
                            : "Confirm Appointment"}
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <ConsignmentSummaryCard consignment={consignment} />
                {requestMode && <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Your current appointment stays confirmed until an administrator approves the new time.</p>
                    <Textarea id="inspection-reschedule-reason" label="Reason for rescheduling" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} disabled={loading} required className="text-base" />
                </div>}

                {currentAppointment && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                        Current appointment:{" "}
                        <span className="font-semibold">
                            {formatDate(currentAppointment.date)}
                            {currentAppointment.time
                                ? ` at ${currentAppointment.time}`
                                : ""}
                        </span>
                    </div>
                )}

                {loadError && (
                    <div className="space-y-3">
                        <Alert variant="error" message={loadError} />
                        <Button size="sm" variant="outline" disabled={fetching || loading} onClick={() => setRetryCount((count) => count + 1)} className="w-full sm:w-auto">Retry available slots</Button>
                    </div>
                )}

                {fetching ? (
                    <p className="text-sm text-gray-500">
                        Loading available slots…
                    </p>
                ) : loadError ? null : bookableSlots.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        No inspection slots are currently open. Please check
                        back later or contact the administrator.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookableSlots.map((day) => (
                            <div key={day.date}>
                                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {formatDate(day.date, {
                                        weekday: "short",
                                    })}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {day.timeSlots.map((ts) => {
                                        const isSelected =
                                            selected?.date === day.date &&
                                            selected?.time === ts.time;
                                        return (
                                            <button
                                                key={ts.time}
                                                type="button"
                                                disabled={loading || fetching || !!loadError}
                                                onClick={() =>
                                                    setSelected({
                                                        date: day.date,
                                                        time: ts.time,
                                                    })
                                                }
                                                className={`min-h-11 rounded-lg border px-3 py-2 text-sm transition ${
                                                    isSelected
                                                        ? "border-blue-600 bg-blue-600 text-white"
                                                        : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                                }`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <CalendarCheck size={14} />
                                                    {ts.time}
                                                    {ts.endTime
                                                        ? ` – ${ts.endTime}`
                                                        : ""}
                                                </span>
                                                <span
                                                    className={`mt-0.5 block text-[11px] ${
                                                        isSelected
                                                            ? "text-blue-100"
                                                            : "text-gray-400"
                                                    }`}
                                                >
                                                    {ts.remaining} left
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BookInspectionDialog;
