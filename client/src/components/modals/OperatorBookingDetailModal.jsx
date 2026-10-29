import {
    CalendarDays,
    Car,
    Clock3,
    ImageOff,
    Loader2,
    UserRound,
    Wallet,
} from "lucide-react";

import Modal from "../common/Modal";
import StatusChip from "../common/StatusChip";
import ReturnTimingNote from "../booking/ReturnTimingNote";
import getVehicleCardData from "../../utils/getVehicleCardData";

import {
    formatBookingDate,
    formatDuration,
    getRenterName,
    peso,
} from "../../utils/operatorBookingFormat";

const WITH_TIME = { hour: "numeric", minute: "2-digit" };

const PAYOUT_LABELS = {
    SCHEDULED: "Scheduled",
    PENDING: "Pending",
    APPROVED: "Approved",
    PAID: "Paid to your wallet",
};

const Section = ({ icon: Icon, title, children }) => (
    <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            <Icon size={14} />
            {title}
        </h3>
        <dl className="divide-y divide-gray-100 dark:divide-gray-800">
            {children}
        </dl>
    </section>
);

const Row = ({ label, children, strong = false }) => (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
        <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
        <dd
            className={`text-right ${
                strong
                    ? "font-bold text-gray-900 dark:text-white"
                    : "font-medium text-gray-800 dark:text-gray-200"
            }`}
        >
            {children}
        </dd>
    </div>
);

/*
 * Read-only view of one booking on a partner's vehicle: the trip and the
 * partner's own earnings. The server sends partners an allowlisted booking
 * (toOperatorBookingView) - no customer contact details, payments, refunds
 * or admin notes - so there's nothing else to show here, and no actions:
 * the platform (admin) runs the booking end to end.
 */
const OperatorBookingDetailModal = ({
    isOpen,
    onClose,
    booking,
    loading = false,
}) => {
    const image = booking
        ? getVehicleCardData(booking.vehicle ?? {}).image
        : null;

    const rental = booking?.rental;
    const earnings = booking?.earnings;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={booking?.bookingCode || "Booking"}
            size="lg"
        >
            {loading || !booking ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Vehicle */}
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                            {image ? (
                                <img
                                    src={image}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <ImageOff size={20} className="text-gray-400" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-bold text-gray-900 dark:text-white">
                                {[booking.vehicle?.brand, booking.vehicle?.model]
                                    .filter(Boolean)
                                    .join(" ") || "Your vehicle"}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {booking.vehicle?.plateNumber ||
                                    booking.vehicle?.vehicleCode ||
                                    "—"}
                            </p>
                        </div>

                        <StatusChip status={booking.status} />
                    </div>

                    {/* Trip */}
                    <Section icon={CalendarDays} title="Trip">
                        <Row label={booking.scheduledStartDate ? "Picked up" : "Pickup"}>
                            {formatBookingDate(booking.startDate, WITH_TIME)}
                        </Row>
                        <Row
                            label={
                                rental?.returnedAt
                                    ? "Returned"
                                    : booking.scheduledStartDate
                                      ? "Due back"
                                      : "Return"
                            }
                        >
                            {formatBookingDate(
                                rental?.returnedAt ?? booking.endDate,
                                WITH_TIME
                            )}
                            {rental?.returnedAt && booking.dueBackDate && (
                                <ReturnTimingNote
                                    dueBackAt={booking.dueBackDate}
                                    returnedAt={rental.returnedAt}
                                    dueBackLabel={formatBookingDate(
                                        booking.dueBackDate,
                                        WITH_TIME
                                    )}
                                />
                            )}
                            {booking.scheduledStartDate && (
                                <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                                    Booked{" "}
                                    {formatBookingDate(booking.scheduledStartDate, WITH_TIME)}{" "}
                                    – {formatBookingDate(booking.scheduledEndDate, WITH_TIME)}
                                </span>
                            )}
                            {booking.extensionCount > 0 && (
                                <span className="mt-0.5 block text-xs font-normal text-blue-600 dark:text-blue-400">
                                    Extended
                                    {booking.originalEndDate
                                        ? ` from ${formatBookingDate(booking.originalEndDate, WITH_TIME)}`
                                        : ""}
                                </span>
                            )}
                        </Row>
                        <Row label="Duration">
                            {formatDuration(booking.rentalDays)}
                        </Row>
                        <Row label="Driver">
                            {booking.driverOption || "—"}
                        </Row>
                        <Row label="Rented by">
                            <span className="inline-flex items-center gap-1.5">
                                <UserRound size={14} className="text-gray-400" />
                                {getRenterName(booking.customer)}
                            </span>
                        </Row>
                    </Section>

                    {/* Rental progress */}
                    <Section icon={Clock3} title="Rental">
                        {!rental ? (
                            <p className="py-2 text-sm text-gray-500 dark:text-gray-400">
                                The rental starts when the customer picks up
                                your vehicle.
                            </p>
                        ) : (
                            <>
                                <Row label="Rental code">
                                    {rental.rentalCode || "—"}
                                </Row>
                                <Row label="Status">
                                    <StatusChip status={rental.status} size="sm" />
                                </Row>
                                {rental.returnedAt && (
                                    <Row label="Returned">
                                        {formatBookingDate(rental.returnedAt, {
                                            hour: "numeric",
                                            minute: "2-digit",
                                        })}
                                        {rental.lateMinutes > 0 && (
                                            <span className="mt-0.5 block text-xs font-normal text-amber-600 dark:text-amber-400">
                                                {formatDuration(
                                                    null,
                                                    rental.lateMinutes
                                                )}{" "}
                                                late
                                            </span>
                                        )}
                                        {rental.earlyReturn && (
                                            <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                                                Returned early
                                            </span>
                                        )}
                                    </Row>
                                )}
                            </>
                        )}
                    </Section>

                    {/* Earnings */}
                    <Section icon={Wallet} title="Your earnings">
                        {!earnings ? (
                            <p className="py-2 text-sm text-gray-500 dark:text-gray-400">
                                {booking.status === "Completed"
                                    ? "Your payout for this booking hasn't been scheduled yet."
                                    : "Your payout is scheduled once this rental is completed."}
                            </p>
                        ) : (
                            <>
                                <Row label="Booking amount">
                                    {peso(earnings.bookingAmount)}
                                </Row>
                                {earnings.refundDeduction > 0 && (
                                    <Row label="Vehicle-issue refund">
                                        −{peso(earnings.refundDeduction)}
                                    </Row>
                                )}
                                <Row label="Platform commission">
                                    −{peso(earnings.platformCommission)}
                                </Row>
                                <Row label="You earn" strong>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                        {peso(earnings.amount)}
                                    </span>
                                </Row>
                                <Row label="Payout">
                                    {PAYOUT_LABELS[earnings.payoutStatus] ||
                                        earnings.payoutStatus}
                                    {earnings.releaseAt && (
                                        <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                                            {earnings.payoutStatus === "PAID"
                                                ? "on "
                                                : "releases "}
                                            {formatBookingDate(earnings.releaseAt)}
                                        </span>
                                    )}
                                </Row>
                            </>
                        )}
                    </Section>

                    <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Car size={14} className="mt-0.5 shrink-0" />
                        Bookings are handled by Rent-A-Ride Albay. Contact
                        the admin if something about this booking needs
                        attention.
                    </p>
                </div>
            )}
        </Modal>
    );
};

export default OperatorBookingDetailModal;
