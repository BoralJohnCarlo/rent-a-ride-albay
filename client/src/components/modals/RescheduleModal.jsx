import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CalendarClock, Clock, Info, Loader2 } from "lucide-react";

import {
    previewBookingReschedule,
    requestBookingReschedule,
} from "../../api/bookingApi";
import useToast from "../../hooks/toast/useToast";
import Button from "../common/Button";
import Modal from "../common/Modal";
import Select from "../common/Select";
import BookingDateRangeCalendar from "../vehicle/BookingDateRangeCalendar";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import {
    formatPickupHours,
    getPickupTimeOf,
    getPickupTimeOptions,
    isPickupTooSoon,
    toPickupDateTime,
} from "../../utils/pickupTime";

const peso = (value) =>
    `₱${Math.abs(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleString("en-PH", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "—";

const errorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

/* What happens to the price difference, in the reader's terms. */
const describeSettlement = (quote, mode) => {
    if (!quote) return null;

    const { difference, settlement } = quote;
    const who = mode === "admin" ? "The customer" : "You";

    if (settlement?.kind === "charge") {
        return {
            tone: "amber",
            text:
                mode === "admin"
                    ? `The customer will owe ${peso(settlement.amount)} more, payable online from their booking.`
                    : `The new dates cost ${peso(settlement.amount)} more. Once approved, you'll pay the difference online from your booking.`,
        };
    }

    if (settlement?.kind === "refund") {
        return {
            tone: "emerald",
            text: `${who} already paid more than the new total, so ${peso(
                settlement.amount
            )} will be refunded${mode === "admin" ? "" : " to you once approved"}.`,
        };
    }

    if (difference < 0) {
        return {
            tone: "emerald",
            text: `The new dates cost ${peso(difference)} less - that comes off what's due at pickup.`,
        };
    }

    return { tone: "gray", text: "No change in price." };
};

const TONES = {
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    emerald:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300",
};

/*
 * Pick new dates for a booking (same vehicle) with a live price quote.
 * mode "customer" submits a request for admin approval; mode "admin"
 * reschedules immediately. The server re-validates everything - the
 * calendar only greys out days that are obviously taken.
 */
const RescheduleModal = ({ isOpen, onClose, booking, mode = "customer", onDone }) => {
    const toast = useToast();

    const [range, setRange] = useState({ startDate: "", endDate: "" });
    // null = keep the booking's current pickup time.
    const [pickupTime, setPickupTime] = useState(null);
    const [reason, setReason] = useState("");
    const [quote, setQuote] = useState(null);
    const [quoteError, setQuoteError] = useState("");
    const [quoting, setQuoting] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const requestId = useRef(0);

    const bookingId = booking?._id;
    const vehicleId = booking?.vehicle?._id ?? booking?.vehicle;

    useEffect(() => {
        if (!isOpen) {
            setRange({ startDate: "", endDate: "" });
            setPickupTime(null);
            setReason("");
            setQuote(null);
            setQuoteError("");
        }
    }, [isOpen]);

    const { pickupHours } = usePublicRefundSettings();

    /*
     * Only times that can be booked: inside the configured pickup window
     * and, on the chosen day, still at least the minimum notice away.
     */
    const [clockNow, setClockNow] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const tick = () => setClockNow(Date.now());

        tick();

        const timer = setInterval(tick, 60 * 1000);

        return () => clearInterval(timer);
    }, [isOpen]);

    const timeOptions = useMemo(
        () =>
            getPickupTimeOptions(pickupHours).filter(
                ({ value }) =>
                    !range.startDate ||
                    !clockNow ||
                    !isPickupTooSoon(range.startDate, value, clockNow)
            ),
        [pickupHours, range.startDate, clockNow]
    );

    // The chosen time, else the booking's current one; if that's no longer
    // valid (outside the window, or passed), the first valid time.
    const wantedTime =
        pickupTime ?? getPickupTimeOf(booking?.startDate);

    const selectedTime = timeOptions.some(
        ({ value }) => value === wantedTime
    )
        ? wantedTime
        : timeOptions[0]?.value ?? wantedTime;

    // The chosen days at the chosen pickup time, as the server expects.
    const requestedDates = useMemo(
        () =>
            range.startDate && range.endDate
                ? {
                      startDate: toPickupDateTime(
                          range.startDate,
                          selectedTime
                      ).toISOString(),
                      endDate: toPickupDateTime(
                          range.endDate,
                          selectedTime
                      ).toISOString(),
                  }
                : null,
        [range, selectedTime]
    );

    // Live quote once both dates are picked (debounced, latest wins).
    useEffect(() => {
        if (!isOpen || !bookingId || !requestedDates) {
            setQuote(null);
            setQuoteError("");
            return undefined;
        }

        const current = ++requestId.current;
        setQuoting(true);
        setQuoteError("");

        const timer = setTimeout(async () => {
            try {
                const response = await previewBookingReschedule(
                    bookingId,
                    requestedDates
                );

                if (current === requestId.current) {
                    setQuote(response?.data ?? null);
                }
            } catch (error) {
                if (current === requestId.current) {
                    setQuote(null);
                    setQuoteError(
                        errorMessage(error, "These dates can't be used.")
                    );
                }
            } finally {
                if (current === requestId.current) {
                    setQuoting(false);
                }
            }
        }, 350);

        return () => clearTimeout(timer);
    }, [isOpen, bookingId, requestedDates]);

    if (!booking) return null;

    const settlement = describeSettlement(quote, mode);

    const handleSubmit = async () => {
        if (!quote || !requestedDates) return;

        setSubmitting(true);

        try {
            const response = await requestBookingReschedule(bookingId, {
                ...requestedDates,
                ...(reason.trim() && { reason: reason.trim() }),
            });

            toast.success(
                mode === "admin"
                    ? "The booking was moved to the new dates."
                    : "Your reschedule request was sent for review.",
                mode === "admin" ? "Booking Rescheduled" : "Request Sent"
            );

            onDone?.(response?.data);
            onClose();
        } catch (error) {
            toast.error(
                errorMessage(error, "Unable to reschedule this booking."),
                "Reschedule Failed"
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={submitting ? undefined : onClose}
            title="Reschedule Booking"
            size="lg"
            footer={
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        loading={submitting}
                        disabled={!quote || quoting}
                    >
                        {mode === "admin" ? "Reschedule Now" : "Send Request"}
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                {/* Current → new */}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            Current dates
                        </p>
                        <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                            {formatDate(booking.startDate)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            to {formatDate(booking.endDate)}
                        </p>
                    </div>

                    <ArrowRight className="mx-auto hidden text-gray-300 sm:block dark:text-gray-600" size={18} />

                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            New dates
                        </p>
                        {requestedDates ? (
                            <>
                                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                                    {formatDate(requestedDates.startDate)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    to {formatDate(requestedDates.endDate)}
                                </p>
                            </>
                        ) : (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Pick a pickup and return day below.
                            </p>
                        )}
                    </div>
                </div>

                <BookingDateRangeCalendar
                    vehicleId={vehicleId}
                    startDate={range.startDate}
                    endDate={range.endDate}
                    onChange={setRange}
                    disabled={submitting}
                    freeRange={{ startDate: booking.startDate, endDate: booking.endDate }}
                />

                <Select
                    name="reschedulePickupTime"
                    label="Pickup time"
                    leftIcon={<Clock size={16} />}
                    value={selectedTime}
                    options={timeOptions}
                    onChange={(event) => setPickupTime(event.target.value)}
                    disabled={submitting || timeOptions.length === 0}
                    placeholder="No pickup times left"
                    helperText={`Pickup hours: ${formatPickupHours(
                        pickupHours
                    )} (Philippine time). The return is at the same time on the return day.`}
                />

                {/* Quote */}
                {quoting && (
                    <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Loader2 size={15} className="animate-spin" />
                        Checking the dates and price…
                    </p>
                )}

                {!quoting && quoteError && (
                    <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        {quoteError}
                    </p>
                )}

                {!quoting && quote && (
                    <div className="space-y-3">
                        <dl className="grid grid-cols-3 gap-2 rounded-xl border border-gray-200 p-2.5 text-center sm:gap-3 sm:p-3 dark:border-gray-800">
                            <div>
                                <dt className="text-[11px] text-gray-500 dark:text-gray-400">Days</dt>
                                <dd className="text-sm font-bold text-gray-900 sm:text-base dark:text-white">{quote.rentalDays}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] text-gray-500 dark:text-gray-400">New total</dt>
                                <dd className="text-sm font-bold text-gray-900 sm:text-base dark:text-white">{peso(quote.totalAmount)}</dd>
                            </div>
                            <div>
                                <dt className="text-[11px] text-gray-500 dark:text-gray-400">Difference</dt>
                                <dd
                                    className={`text-sm font-bold sm:text-base ${
                                        quote.difference > 0
                                            ? "text-amber-600 dark:text-amber-400"
                                            : quote.difference < 0
                                              ? "text-emerald-600 dark:text-emerald-400"
                                              : "text-gray-900 dark:text-white"
                                    }`}
                                >
                                    {quote.difference > 0 ? "+" : quote.difference < 0 ? "−" : ""}
                                    {peso(quote.difference)}
                                </dd>
                            </div>
                        </dl>

                        {settlement && (
                            <p className={`rounded-xl border p-3 text-sm ${TONES[settlement.tone]}`}>
                                {settlement.text}
                            </p>
                        )}
                    </div>
                )}

                <div>
                    <label
                        htmlFor="reschedule-reason"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        Reason <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                        id="reschedule-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder={
                            mode === "admin"
                                ? "Why is this booking being moved?"
                                : "Why do you need new dates?"
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                    />
                </div>

                <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {mode === "admin" ? <Info size={14} className="mt-0.5 shrink-0" /> : <CalendarClock size={14} className="mt-0.5 shrink-0" />}
                    {mode === "admin"
                        ? "This applies right away and counts as the booking's one reschedule. Cancellation fees keep using the original pickup time."
                        : "A booking can be rescheduled once, at least 24 hours before pickup, on the same vehicle. Cancellation fees keep using your original pickup time."}
                </p>
            </div>
        </Modal>
    );
};

export default RescheduleModal;
