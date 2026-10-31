import createError from "../utils/createError.js";
import { getAllocatedPriceChangeRefund } from "../utils/bookingRefundAllocations.js";

import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import { withBookingCreationTransaction } from "./bookingCreationTransaction.js";
import Vehicle from "../models/Vehicle.js";
import Driver from "../models/Driver.js";
import ServiceLocation from "../models/ServiceLocation.js";
import Rental from "../models/Rental.js";
import Review from "../models/Review.js";
import { nextSequence } from "../models/Sequence.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import PayoutRequest from "../models/PayoutRequest.js";
import { PAYOUT_STATUS } from "../constants/payoutConstants.js";

import { calculateDistanceKm } from "../utils/distance.js";
import {
    isUserEffectivelyVerified,
    isValidIdExpired,
} from "../utils/userFormatter.js";

import {
    getDistanceFeeRuleForDistance,
} from "./distanceFeeRuleService.js";

import {
    getEnabledServiceLocations,
} from "./serviceLocationService.js";

import {
    getBookingLocationPolicy,
    getOffRoadVehicleSettings,
    getTurnaroundBufferMs,
    resolveRefundSettings,
} from "./settingsService.js";
import { buildBookingTermsAcceptance } from "./legalDocumentService.js";
import {
    getEarliestPickupMs,
    getPickupSlotMinutes,
    parseBookingHoursTime,
} from "../utils/bookingHours.js";

import {
    syncApprovedBookingExtension,
} from "./rentalService.js";

import {
    hasBookingConflict,
    ensureNoBookingConflict,
    hasDriverBookingConflict,
    ensureNoDriverBookingConflict,
    isDriverBookable,
    releaseDriverIfIdle,
    findVehiclesWithBookingConflict,
} from "./bookingConflictService.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
    BOOKING_DRIVER_OPTIONS,
    BOOKING_CODE_PREFIX,
    BOOKING_EXTENSION_STATUS,
    BOOKING_EXTENSION_PRICING_METHOD,
    BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS,
    BOOKING_RESERVATION_PAYMENT_REMINDER_HOURS,
    BOOKING_RESCHEDULE_STATUS,
    BOOKING_RESCHEDULE_MIN_NOTICE_HOURS,
    DRIVER_CHANGE_REQUEST_STATUS,
    DRIVER_CHANGE_MIN_NOTICE_HOURS,
    BOOKING_RESCHEDULE_MAX_APPROVED,
    BOOKING_RESCHEDULE_SETTLEMENT,
    BOOKING_MIN_LEAD_HOURS,
    BOOKING_APPROVAL_ALERT_HOURS,
    BOOKING_MAINTENANCE_CONFLICT_STATUS,
    BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
    BOOKING_MAINTENANCE_CONFLICT_RESPONSE_HOURS,
    BOOKING_MAINTENANCE_CONFLICT_RESPONSE_BEFORE_PICKUP_HOURS,
    BOOKING_MAINTENANCE_CONFLICT_MIN_RESPONSE_HOURS,
    BOOKING_VEHICLE_CONFLICT_CAUSE,
    LATE_RETURN_WAIT_MAX_HOURS,
} from "../constants/bookingConstants.js";

import { getBusinessMinuteOfDay } from "../utils/businessTime.js";

import {
    getMaintenanceWindow,
    overlapsMaintenance,
    describeMaintenanceBlock,
    formatMaintenanceDate,
} from "../utils/vehicleMaintenance.js";

import { reconcileMaintenanceConflicts } from "./vehicleMaintenanceService.js";
import {
    openLateReturnOptions,
    reconcileLateReturnConflicts,
} from "./lateReturnConflictService.js";

// A vehicle conflict caused by the previous renter returning it late.
const isLateReturnCause = (conflict) =>
    conflict?.cause === BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN;

import {
    getUpfrontFees,
    getGrossUpfrontAmount,
} from "../utils/bookingFees.js";

/*
 * Statuses that can take new bookings (time conflicts permitting). Under
 * maintenance, only the maintenance window is refused
 * (validateVehicleDateAvailability).
 */
const BOOKABLE_VEHICLE_STATUSES = [
    VEHICLE_STATUS.AVAILABLE,
    VEHICLE_STATUS.RESERVED,
    VEHICLE_STATUS.PICKUP_IN_PROGRESS,
    VEHICLE_STATUS.RENTED,
    VEHICLE_STATUS.MAINTENANCE,
];

import {
    VEHICLE_STATUS,
} from "../constants/vehicleConstants.js";

import {
    validateVoucherForUser,
    calculatePricingWithVoucher,
    claimVoucherUsage,
    releaseVoucherUsage,
} from "./voucherService.js";

import Voucher from "../models/Voucher.js";

import {
    getActiveDiscounts,
    resolveVehicleRate,
    resolveVehicleRateNow,
    applyVehicleDiscountToPricing,
} from "./discountService.js";

import {
    DRIVER_STATUS,
    DRIVER_AVAILABILITY,
} from "../constants/driverConstants.js";

import {
    PAYMENT_TYPE,
    PAYMENT_STATUS,
    PAYMENT_METHOD,
    PAYMENT_REFUND_REASON,
    PAYMENT_REFUND_STATUS,
    CASH_RESERVATION_NOT_ALLOWED_MESSAGE,
} from "../constants/paymentConstants.js";

import {
    RENTAL_STATUS,
    RENTAL_REFUND_REASON,
} from "../constants/rentalConstants.js";

import {
    recordRefund,
    computeRefundableAmount,
    formatAmount,
} from "./rentalService.js";

import {
    notifyUser,
    notifyAdmins,
    hasRecentNotification,
} from "./notificationService.js";

import {
    verifyPaymentByCheckoutSession,
    processBookingRefund,
    refundPayment,
    refundBookingExtensionFees,
    cancelPendingBookingPayments,
    closeCheckoutSession,
} from "./paymentService.js";

import {
    retrieveCheckoutSession,
} from "./paymongoService.js";

import { sendEmailInBackground } from "./emailService.js";
import { appLink, renderEmail } from "../utils/emailTemplates.js";

import { createManualRefund } from "./manualRefundService.js";

import {
    applyDriverFee,
    areDriversOfferedForVehicle,
    getExtensionDriverCharge,
    resolveDriverDailyRate,
} from "./driverPricingService.js";

import ManualRefund from "../models/ManualRefund.js";

import {
    getNextRefundChange,
    getPickupReference,
    getReservationPaymentDeadline,
    getBookingApprovedAt,
    getNoShowEligibleAt,
    getNoShowAutoAt,
    getNoShowReference,
    getCustomerCancelCutoff,
} from "./cancellationPolicyService.js";
import {
    computeBookingCancellationRefund,
    computeBookingNoShowRefund,
    describePolicySource,
    describePolicySourceForCustomer,
    getBookingNoShowTiming,
} from "./lockedTermsService.js";

import Settings from "../models/Settings.js";

import { getDriverLicenseIssue } from "../utils/driverLicense.js";

/*
 * Best-effort notice to the operator that owns the vehicle in a booking.
 * A failure here must never roll back the booking action.
 */
const notifyVehicleOperator = async (operatorId, booking, { type, title, message, variant = "info" }) => {
    if (!operatorId) {
        return;
    }

    try {
        await notifyUser(operatorId, {
            type,
            title,
            message,
            variant,
            category: "Booking",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify vehicle operator of booking event:",
            notificationError
        );
    }
};

/*
 * Best-effort notice to the customer who owns a booking about a status change.
 * A failure here must never roll back the booking action.
 */
const notifyBookingCustomer = async (
    booking,
    { type, title, message, variant = "info", email = null }
) => {
    if (!booking?.customer) {
        return;
    }

    try {
        await notifyUser(booking.customer, {
            type,
            title,
            message,
            variant,
            category: "Booking",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
            email,
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify booking customer of booking event:",
            notificationError
        );
    }
};

/*
 * Email option for a customer notice that involves money (a refund started,
 * a fee kept): the button opens the booking's statement, which lists every
 * payment and refund with its receipt.
 */
const statementEmail = (booking) => ({
    actionLabel: "View booking statement",
    actionPath: `/documents/statements/${booking._id}`,
});

/* A calendar date (optionally with time) as it reads in the Philippines. */
const formatManilaDate = (value, { withTime = false } = {}) =>
    new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "long",
        day: "numeric",
        year: "numeric",
        ...(withTime
            ? { hour: "numeric", minute: "2-digit" }
            : {}),
    });

/* "October 1, 2026, 2:00 PM – October 4, 2026, 2:00 PM" (Manila time). */
const formatBookingWindow = (start, end) =>
    `${formatManilaDate(start, { withTime: true })} – ${formatManilaDate(end, {
        withTime: true,
    })}`;

const formatEmailDate = (value) =>
    value
        ? new Date(value).toLocaleString("en-PH", {
              // Philippine time whatever the server's own timezone is.
              timeZone: "Asia/Manila",
              weekday: "short",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";

/*
 * Best-effort email to the customer with the complete booking details once
 * a booking is approved. A failure here must never roll back the approval.
 */
const sendBookingApprovedEmail = async (
    booking,
    vehicle,
    customer,
    driver
) => {
    if (!customer?.email) {
        return;
    }

    try {
        const pricing = booking.pricing || {};

        const vehicleName = [
            vehicle?.brand,
            vehicle?.model,
        ]
            .filter(Boolean)
            .join(" ") || "Vehicle";

        // No booking code: customers know their trips by vehicle and dates.
        const rows = [
            [
                "Vehicle",
                vehicle?.plateNumber
                    ? `${vehicleName} (${vehicle.plateNumber})`
                    : vehicleName,
            ],
            ["Pickup Date & Time", formatEmailDate(booking.startDate)],
            ["Return Date & Time", formatEmailDate(booking.endDate)],
            [
                "Pickup Location",
                booking.pickupLocation?.address || "—",
            ],
            [
                "Return Location",
                booking.returnLocation?.address || "—",
            ],
            ["Driver Option", booking.driverOption || "—"],
        ];

        if (
            booking.driverOption ===
                BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
            driver
        ) {
            rows.push([
                "Assigned Driver",
                [driver.firstName, driver.lastName]
                    .filter(Boolean)
                    .join(" ") || "—",
            ]);

            rows.push([
                "Driver Contact",
                driver.phoneNumber ||
                    driver.contactNumber ||
                    "—",
            ]);
        }

        if (pricing.vehicleDiscount?.amountPerDay > 0) {
            rows.push([
                "Daily Rate",
                `${formatAmount(pricing.dailyRate)} (was ${formatAmount(
                    pricing.originalDailyRate
                )} — ${
                    pricing.vehicleDiscount.label ||
                    pricing.vehicleDiscount.name ||
                    "discount"
                })`,
            ]);
        } else {
            rows.push([
                "Daily Rate",
                formatAmount(pricing.dailyRate),
            ]);
        }
        rows.push([
            "Rental Days",
            pricing.rentalDays ?? "—",
        ]);
        rows.push([
            "Subtotal",
            formatAmount(pricing.subtotal),
        ]);

        if (Number(pricing.driverFee) > 0) {
            rows.push([
                "Driver Fee",
                `${formatAmount(pricing.driverFee)} (${formatAmount(
                    pricing.driverDailyRate
                )} × ${pricing.rentalDays ?? "—"} day${
                    Number(pricing.rentalDays) === 1 ? "" : "s"
                })`,
            ]);
        }

        rows.push([
            "Reservation Fee",
            formatAmount(pricing.reservationFee),
        ]);

        if (Number(pricing.pickupDistanceFee) > 0) {
            rows.push([
                "Pickup Distance Fee",
                formatAmount(pricing.pickupDistanceFee),
            ]);
        }

        if (Number(pricing.returnDistanceFee) > 0) {
            rows.push([
                "Return Distance Fee",
                formatAmount(pricing.returnDistanceFee),
            ]);
        }

        if (booking.voucher?.code) {
            rows.push([
                "Voucher Applied",
                `${booking.voucher.code} (-${formatAmount(
                    booking.voucher.discountAmount
                )})`,
            ]);
        }

        rows.push([
            "Total Amount",
            formatAmount(pricing.totalAmount),
        ]);

        const actionUrl = appLink(`/customer/bookings/${booking._id}`);

        sendEmailInBackground(
            {
                to: customer.email,
                ...renderEmail({
                    subject: `Booking Confirmed — ${vehicleName}, ${formatManilaDate(booking.startDate)}`,
                    heading: "Your Booking Has Been Approved",
                    greetingName: customer.firstName || "there",
                    paragraphs:
                        "Great news — your booking has been approved. Here are your complete booking details:",
                    rows,
                    action: actionUrl
                        ? { label: "View your booking", url: actionUrl }
                        : null,
                    footnote:
                        "Please settle any remaining payment to keep your reservation, and bring a valid ID at pickup.",
                }),
            },
            "booking approval email"
        );
    } catch (emailError) {
        console.error(
            "Failed to send booking approval email:",
            emailError
        );
    }
};

/*
 * Gives the voucher a booking used back to the customer when the booking ends
 * without ever reaching pickup (rejected, cancelled, expired) — the discount
 * was never redeemed, so it shouldn't stay burned. Best-effort: a failure
 * here must never block the booking's status change. Returns the voucher code
 * that was returned ("" when nothing was), for the customer's notification.
 */
const releaseBookingVoucher = async (booking) => {
    const voucherId = booking?.voucher?.voucher;

    if (!voucherId) {
        return "";
    }

    try {
        const released = await releaseVoucherUsage(
            voucherId,
            booking._id
        );

        return released
            ? booking.voucher.code || "your voucher"
            : "";
    } catch (voucherError) {
        console.error(
            `Failed to release the voucher on booking ${booking._id}:`,
            voucherError
        );

        return "";
    }
};

/*
 * An extension request only makes sense while the booking can still happen.
 * When an Approved booking ends without a trip (cancelled, no-show) any
 * request still awaiting a decision is closed, otherwise it sits "Pending"
 * forever — in the admin's "Awaiting review" list, with an Approve that the
 * server refuses. No money is involved: an extension fee is only created on
 * approval. Best-effort; returns nothing.
 */
const closePendingExtensions = async (
    booking,
    closedBy,
    reason,
    session = null
) => {
    try {
        await Booking.updateOne(
            {
                _id: booking._id,
                "extensions.status":
                    BOOKING_EXTENSION_STATUS.PENDING,
            },
            {
                $set: {
                    "extensions.$[pending].status":
                        BOOKING_EXTENSION_STATUS.CANCELLED,
                    "extensions.$[pending].cancelledAt":
                        new Date(),
                    "extensions.$[pending].cancelledBy":
                        closedBy || null,
                    "extensions.$[pending].cancellationReason":
                        reason,
                },
            },
            {
                session,
                arrayFilters: [
                    {
                        "pending.status":
                            BOOKING_EXTENSION_STATUS.PENDING,
                    },
                ],
            }
        );
    } catch (extensionError) {
        if (session) throw extensionError;
        console.error(
            `Failed to close pending extension requests on booking ${booking._id}:`,
            extensionError
        );
    }

    await closePendingReschedules(booking, closedBy, reason, session);
};

/*
 * Same idea for a reschedule request: once the booking has ended (or been
 * picked up) there's nothing left to move. Best-effort; returns nothing.
 */
const closePendingReschedules = async (
    booking,
    closedBy,
    reason,
    session = null
) => {
    try {
        await Booking.updateOne(
            {
                _id: booking._id,
                "reschedules.status":
                    BOOKING_RESCHEDULE_STATUS.PENDING,
            },
            {
                $set: {
                    "reschedules.$[pending].status":
                        BOOKING_RESCHEDULE_STATUS.CANCELLED,
                    "reschedules.$[pending].cancelledAt":
                        new Date(),
                    "reschedules.$[pending].cancelledBy":
                        closedBy || null,
                    "reschedules.$[pending].cancellationReason":
                        reason,
                },
            },
            {
                session,
                arrayFilters: [
                    {
                        "pending.status":
                            BOOKING_RESCHEDULE_STATUS.PENDING,
                    },
                ],
            }
        );
    } catch (rescheduleError) {
        if (session) throw rescheduleError;
        console.error(
            `Failed to close pending reschedule requests on booking ${booking._id}:`,
            rescheduleError
        );
    }

    await closePendingDriverChangeRequests(booking, closedBy, reason, session);
};

/*
 * Same for a request for a different driver: once the booking has ended (or
 * been picked up), there's no driver left to change. Best-effort.
 */
export const closePendingDriverChangeRequests = async (
    booking,
    closedBy,
    reason,
    session = null
) => {
    try {
        await Booking.updateOne(
            {
                _id: booking._id,
                "driverChangeRequests.status":
                    DRIVER_CHANGE_REQUEST_STATUS.PENDING,
            },
            {
                $set: {
                    "driverChangeRequests.$[pending].status":
                        DRIVER_CHANGE_REQUEST_STATUS.CANCELLED,
                    "driverChangeRequests.$[pending].resolvedAt":
                        new Date(),
                    "driverChangeRequests.$[pending].resolvedBy":
                        closedBy || null,
                    "driverChangeRequests.$[pending].resolutionNote":
                        reason,
                },
            },
            {
                session,
                arrayFilters: [
                    {
                        "pending.status":
                            DRIVER_CHANGE_REQUEST_STATUS.PENDING,
                    },
                ],
            }
        );
    } catch (driverRequestError) {
        if (session) throw driverRequestError;
        console.error(
            `Failed to close pending driver change requests on booking ${booking._id}:`,
            driverRequestError
        );
    }
};

const getApprovedReschedules = (booking) =>
    (booking?.reschedules || []).filter(
        (reschedule) =>
            reschedule.status ===
            BOOKING_RESCHEDULE_STATUS.APPROVED
    );

/*
 * What approved reschedules — and a move to a cheaper vehicle after a
 * maintenance conflict — already refunded from the reservation payment (or
 * promised to, when handed to an admin). A Payment carries only one refund,
 * so later refunds on the booking must count this first.
 */
const getRescheduleRefundedAmount = (booking) => getAllocatedPriceChangeRefund(booking);
/*
 * Cancellation fees follow the EARLIER of the original and current pickup
 * dates, so a customer can't reschedule far out just to cancel later for a
 * full refund.
 */
const getCancellationPolicyStartDate = (booking) => {
    const times = [
        booking?.startDate,
        ...getApprovedReschedules(booking).map(
            (reschedule) => reschedule.previousStartDate
        ),
    ]
        .map((value) => new Date(value).getTime())
        .filter(Number.isFinite);

    return times.length ? new Date(Math.min(...times)) : booking?.startDate;
};

const voucherReturnedNote = (code) =>
    code
        ? ` Your voucher ${code} has been returned to you.`
        : "";

/*
 * Until an admin approves a booking nothing has been committed to the
 * customer (no vehicle or driver reserved for them), which the cancellation
 * policy treats more generously than an approved one.
 */
const isBookingApproved = (booking) =>
    ![
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.PAYMENT_RECEIVED,
    ].includes(booking.status);

/*
 * What the customer actually paid up front for a booking (0 when nothing is
 * verified). The Payment is typed RESERVATION_FEE either way, but its amount
 * is the whole rental total when the customer chose to pay in full — so
 * refunds must read this rather than recompute an "expected" figure from
 * booking.pricing.
 */
const getVerifiedPrePickupPaymentAmount = async (
    bookingId
) => {
    const payment = await Payment.findOne({
        booking: bookingId,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        status: PAYMENT_STATUS.VERIFIED,
    })
        .select("_id amount refund")
        .lean();

    const amount = Number(payment?.amount || 0);

    if (amount <= 0) {
        return 0;
    }

    // Net of anything an approved reschedule (or vehicle change) already
    // gave back.
    const booking = await Booking.findById(bookingId)
        .select("reschedules vehicleChanges")
        .lean();

    return Math.max(
        0,
        Math.round(
            (amount - getAllocatedPriceChangeRefund(booking, payment._id)) * 100
        ) / 100
    );
};

// Price changes must count reservation payments AND paid reschedule top-ups.
// Count promised refunds too, so a held/manual refund isn't promised twice.
const getPrePickupTotalPaid = async (bookingId) => {
    const payments = await Payment.find({
        booking: bookingId,
        paymentType: { $in: [PAYMENT_TYPE.RESERVATION_FEE, PAYMENT_TYPE.EXTENSION_FEE] },
        status: { $in: [PAYMENT_STATUS.VERIFIED, PAYMENT_STATUS.REFUNDED] },
    }).select("amount refund").lean();
    const booking = await Booking.findById(bookingId).select("reschedules vehicleChanges").lean();
    const gross = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const refunded = payments.reduce((sum, p) => sum + (p.refund?.status !== PAYMENT_REFUND_STATUS.FAILED ? Number(p.refund?.amount || 0) : 0), 0);
    return Math.max(0, roundMoney(gross - Math.max(refunded, getRescheduleRefundedAmount(booking))));
};

const allocatePriceChangeRefund = async (booking, amount, options, initiatedBy, settlement) => {
    const payments = await Payment.find({
        booking: booking._id,
        paymentType: { $in: [PAYMENT_TYPE.RESERVATION_FEE, PAYMENT_TYPE.EXTENSION_FEE] },
        status: PAYMENT_STATUS.VERIFIED,
    }).sort({ paymentType: -1, createdAt: 1, _id: 1 });
    const allocations = [];
    // Preserve each successful share even if a later payment fails.
    settlement.allocations = allocations;
    let remaining = amount;
    let manual = false;
    for (const payment of payments) {
        if (remaining <= 0) break;
        const reserved = getAllocatedPriceChangeRefund(booking, payment._id, payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE);
        const available = roundMoney(Number(payment.amount) - Math.max(reserved, Number(payment.refund?.amount || 0)));
        const part = Math.min(remaining, Math.max(0, available));
        if (!part) continue;
        if (payment.refund) {
            const record = await createManualRefund({ booking, amount: part, payment: payment._id,
                reason: options.notes + " This payment already carries a refund; settle the remaining share manually.", createdBy: initiatedBy });
            if (!record) throw createError("The owed refund could not be recorded. Admin review is required.", 409);
            manual = true;
        } else {
            const result = await refundPayment(payment, { ...options, amount: part }, initiatedBy);
            if (!result?.refund || Number(result.refund.amount) !== part) throw createError("The refund payment changed. Admin review is required.", 409);
            manual ||= result.refund.status === PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION;
        }
        allocations.push({ payment: payment._id, amount: part });
        settlement.amount = roundMoney((settlement.amount || 0) + part);
        settlement.payment ||= payment._id;
        settlement.manual = manual;
        remaining = roundMoney(remaining - part);
    }
    if (remaining > 0) throw createError("The remaining refund could not be allocated to a paid payment. Admin review is required.", 409);
    return { allocations, manual, payment: allocations[0]?.payment ?? null };
};

/*
 * Best-effort refund of any extension fees the customer paid on a booking
 * that ended before pickup. The extension only bought extra days on a rental
 * that will now never happen, so it is always refunded in full — the
 * cancellation policy governs the reservation fee alone. A failure here must
 * never block the booking's status change. Returns the refunded payments.
 */
const refundPrePickupExtensionFees = async (
    booking,
    { notes, manualThreshold = 0 },
    initiatedBy
) => {
    try {
        return await refundBookingExtensionFees(
            booking._id,
            {
                reason: PAYMENT_REFUND_REASON.OTHERS,
                notes,
                manualThreshold,
            },
            initiatedBy
        );
    } catch (refundError) {
        console.error(
            `Failed to refund extension fees for booking ${booking._id}:`,
            refundError
        );

        return [];
    }
};

const extensionRefundNote = (refundedPayments) => {
    const total = refundedPayments.reduce(
        (sum, payment) =>
            sum + Number(payment.refund?.amount || 0),
        0
    );

    return total > 0
        ? ` The ${formatAmount(
              total
          )} extension fee you paid is also being refunded.`
        : "";
};

/*
 * Best-effort refund of a booking's VERIFIED reservation-fee payment before
 * any Rental exists (once a Rental exists, cancelBooking's Rental-based
 * refund block below is used instead). Returns the updated Payment, or null
 * when there was nothing to refund. A failure here must never block the
 * booking's status transition; `processBookingRefund` already notifies
 * admins itself when an automated refund can't be completed, and syncs
 * `booking.refundAmount` itself once (and only once) the refund actually
 * succeeds — never on a merely-initiated or since-failed one.
 */
const refundPrePickupBooking = async (
    booking,
    {
        amount,
        reason,
        notes,
        forceManual = false,
    },
    initiatedBy
) => {
    /*
     * A reschedule to fewer days already used the reservation payment's one
     * refund slot. Any further refund on it can't go through the gateway
     * automatically, so it goes on the Owed Refunds list for an admin to pay
     * by hand, instead of living only in a notification.
     */
    if (
        Number(amount) > 0 &&
        getRescheduleRefundedAmount(booking) > 0
    ) {
        const reservationPayment = await Payment.findOne({
            booking: booking._id,
            paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        })
            .select("_id")
            .lean();

        await createManualRefund({
            booking,
            amount,
            payment: reservationPayment?._id ?? null,
            reason: `Its reservation payment was already partly refunded when the booking was rescheduled or moved to another vehicle, so this refund can't be sent automatically. ${
                notes || ""
            }`.trim(),
            createdBy: initiatedBy || null,
        });

        return {
            refund: {
                amount: Number(amount),
                status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
            },
        };
    }

    try {
        return await processBookingRefund(
            booking._id,
            {
                amount,
                reason,
                notes,
                forceManual,
            },
            initiatedBy
        );
    } catch (refundError) {
        console.error(
            `Failed to refund booking ${booking._id}:`,
            refundError
        );

        return null;
    }
};

/*
 * `nextSequence` is the sole source of the running booking number, so no
 * collection scan is needed to "catch up" on every call. `ensureBookingCodeAvailable`
 * plus the E11000 retry path in `createBooking` remain as the safety net for
 * the rare case the counter is ever out of sync with existing data.
 */
const generateBookingCode = async () => {
    const nextNumber = await nextSequence(
        "bookingCode"
    );

    return `${BOOKING_CODE_PREFIX}${String(
        nextNumber
    ).padStart(4, "0")}`;
};

const ensureBookingCodeAvailable = async (
    bookingCode,
    excludeBookingId = null
) => {
    const query = {
        bookingCode,
    };

    if (excludeBookingId) {
        query._id = {
            $ne: excludeBookingId,
        };
    }

    const existingBooking =
        await Booking.findOne(query)
            .select("_id")
            .lean();

    if (existingBooking) {
        throw createError(
            "Booking code already exists.",
            409
        );
    }
};

/*
 * Resolves a client-supplied serviceLocationId against the admin-managed
 * ServiceLocation list. A missing ID is not an error here - it means the
 * customer picked a custom (non-predefined) location, which callers handle
 * by falling back to the client-supplied address/coordinates instead of an
 * authoritative ServiceLocation record.
 */
const validateServiceLocation = async (
    serviceLocationId
) => {
    if (!serviceLocationId) {
        return null;
    }

    const serviceLocation =
        await ServiceLocation.findById(
            serviceLocationId
        ).lean();

    if (!serviceLocation) {
        throw createError(
            "Selected service location does not exist.",
            400
        );
    }

    if (!serviceLocation.enabled) {
        throw createError(
            "Selected service location is not available.",
            400
        );
    }

    return serviceLocation;
};

const findDefaultServiceLocation = async () => {
    const locations =
        await getEnabledServiceLocations();

    const defaultLocation =
        locations.find(
            (location) =>
                location.isDefault === true
        );

    if (!defaultLocation) {
        throw createError(
            "The rental service default location has not been configured. Please contact support.",
            500
        );
    }

    if (
        defaultLocation.latitude == null ||
        defaultLocation.longitude == null ||
        !Number.isFinite(Number(defaultLocation.latitude)) ||
        !Number.isFinite(Number(defaultLocation.longitude)) ||
        Math.abs(Number(defaultLocation.latitude)) > 90 ||
        Math.abs(Number(defaultLocation.longitude)) > 180
    ) {
        throw createError(
            "The default service location does not have valid coordinates. Please contact support.",
            500
        );
    }

    return defaultLocation;
};

const validateLocationPolicy = async (
    pickupServiceLocationId,
    returnServiceLocationId
) => {
    const settings =
        await getBookingLocationPolicy();

    const allowOnlyDefaultLocation =
        settings?.allowOnlyDefaultLocation ?? false;

    if (!allowOnlyDefaultLocation) {
        return;
    }

    const defaultLocation =
        await findDefaultServiceLocation();

    /*
     * Not gated on the ID being present - a custom (no serviceLocationId)
     * location must be rejected here too, otherwise the default-only policy
     * could be bypassed simply by not matching a predefined location.
     */
    if (
        pickupServiceLocationId !==
        defaultLocation._id.toString()
    ) {
        throw createError(
            "Only the default service location is allowed for pickup.",
            400
        );
    }

    if (
        returnServiceLocationId !==
        defaultLocation._id.toString()
    ) {
        throw createError(
            "Only the default service location is allowed for return.",
            400
        );
    }
};

/*
 * A custom (no matched ServiceLocation) pickup/return needs its own address
 * and coordinates from the client - there's no admin record to fall back to
 * for identity or for distance-fee/policy resolution.
 */
const ensureCustomLocationHasCoordinates = (
    serviceLocation,
    clientLocation,
    label
) => {
    if (serviceLocation) {
        return;
    }

    if (
        !clientLocation?.address ||
        clientLocation.latitude == null ||
        clientLocation.longitude == null
    ) {
        throw createError(
            `A custom ${label} location requires an address and map coordinates. Please pick a location on the map or select one from the list.`,
            400
        );
    }
};

const calculateDistanceFees = async (
    pickupLatitude,
    pickupLongitude,
    returnLatitude,
    returnLongitude
) => {
    return previewBookingLocationFees({
        pickupLatitude, pickupLongitude, returnLatitude, returnLongitude,
    });
};

/*
 * Authoritative pickup/return fee resolution for booking create/update.
 *
 * - Self-drive with a driver: no location fees (the driver handles delivery).
 * - Distance-fee calculation ON: fee comes from the distance-fee rule for the
 *   straight-line distance between the default location and each side's
 *   coordinates - a predefined service location's OWN coordinates when one
 *   was matched, otherwise the client-supplied coordinates for a custom
 *   (non-predefined) location. Pickup and return are resolved independently
 *   so a missing coordinate on one side does not zero out the other.
 * - Distance-fee calculation OFF: fee comes from each matched service
 *   location's own configured pickupFee / returnFee. A custom location has
 *   no such configured rate, so it's free in this mode.
 */
const resolveBookingLocationFees = async ({
    pickupServiceLocation,
    returnServiceLocation,
    pickupLocation,
    returnLocation,
    driverOption,
    enableDistanceFeeCalculation,
}) => {
    const fees = {
        pickupDistanceKm: null,
        returnDistanceKm: null,
        pickupDistanceFee: 0,
        returnDistanceFee: 0,
    };

    if (
        driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        return fees;
    }

    if (!enableDistanceFeeCalculation) {
        fees.pickupDistanceFee =
            Number(
                pickupServiceLocation?.pickupFee
            ) || 0;

        fees.returnDistanceFee =
            Number(
                returnServiceLocation?.returnFee
            ) || 0;

        return fees;
    }

    const defaultLocation =
        await findDefaultServiceLocation();

    const pickupCoords =
        pickupServiceLocation ?? pickupLocation;

    const returnCoords =
        returnServiceLocation ?? returnLocation;

    for (const [label, coords] of [["pickup", pickupCoords], ["return", returnCoords]]) {
        if (coords?.latitude == null || coords?.longitude == null ||
            !Number.isFinite(Number(coords.latitude)) ||
            !Number.isFinite(Number(coords.longitude)) ||
            Math.abs(Number(coords.latitude)) > 90 ||
            Math.abs(Number(coords.longitude)) > 180) {
            throw createError(`The selected ${label} location requires valid map coordinates for distance pricing. Please select another location or contact support.`, 400);
        }
    }

    const pickupDistanceKm =
        calculateDistanceKm(
            defaultLocation.latitude,
            defaultLocation.longitude,
            pickupCoords?.latitude,
            pickupCoords?.longitude
        );

    if (pickupDistanceKm != null) {
        const pickupRule =
            await getDistanceFeeRuleForDistance(
                pickupDistanceKm
            );

        fees.pickupDistanceKm =
            pickupDistanceKm;

        fees.pickupDistanceFee =
            Number(pickupRule?.pickupFee) || 0;
    }

    const returnDistanceKm =
        calculateDistanceKm(
            defaultLocation.latitude,
            defaultLocation.longitude,
            returnCoords?.latitude,
            returnCoords?.longitude
        );

    if (returnDistanceKm != null) {
        const returnRule =
            await getDistanceFeeRuleForDistance(
                returnDistanceKm
            );

        fees.returnDistanceKm =
            returnDistanceKm;

        fees.returnDistanceFee =
            Number(returnRule?.returnFee) || 0;
    }

    return fees;
};

// Preview and booking writes share authoritative location and fee resolution.
const previewBookingLocationFees = async ({
    pickupLatitude, pickupLongitude, returnLatitude, returnLongitude,
    pickupServiceLocationId, returnServiceLocationId, driverOption,
}) => {
    const [pickupServiceLocation, returnServiceLocation, policy] = await Promise.all([
        validateServiceLocation(pickupServiceLocationId),
        validateServiceLocation(returnServiceLocationId),
        getBookingLocationPolicy(),
    ]);
    return resolveBookingLocationFees({
        pickupServiceLocation, returnServiceLocation, driverOption,
        pickupLocation: { latitude: pickupLatitude, longitude: pickupLongitude },
        returnLocation: { latitude: returnLatitude, longitude: returnLongitude },
        enableDistanceFeeCalculation: policy?.enableDistanceFeeCalculation,
    });
};

/*
 * Build the location subdocument stored on the booking.
 *
 * When the customer matched a predefined ServiceLocation, coordinates and
 * identity are taken from that authoritative server record (not the client
 * payload) - only the free-text `type` label falls back to what the client
 * sent. When there's no matched ServiceLocation (a custom, self-picked
 * location), the client payload IS the source of truth: its address and
 * coordinates are what the customer actually chose. `fee` is always the
 * already-resolved pickup/return fee.
 */
const buildBookingLocation = (
    serviceLocation,
    clientLocation,
    resolvedFee
) => {
    if (!serviceLocation) {
        return {
            type:
                clientLocation?.type ||
                clientLocation?.address ||
                "Custom Location",
            address: clientLocation?.address || "",
            serviceLocationId: null,
            name: clientLocation?.name || "",
            region: clientLocation?.region || "",
            province: clientLocation?.province || "",
            city: clientLocation?.city || "",
            barangay: clientLocation?.barangay || "",
            latitude:
                clientLocation?.latitude ?? null,
            longitude:
                clientLocation?.longitude ?? null,
            fee: Number(resolvedFee) || 0,
        };
    }

    const addressParts = [
        serviceLocation.barangay,
        serviceLocation.city,
        serviceLocation.province,
        serviceLocation.region,
    ].filter(Boolean);

    const address =
        addressParts.join(", ") ||
        serviceLocation.address ||
        clientLocation?.address ||
        "";

    return {
        type:
            clientLocation?.type ||
            address ||
            "Office",
        address,
        serviceLocationId: serviceLocation._id,
        name: serviceLocation.name || "",
        region: serviceLocation.region || "",
        province: serviceLocation.province || "",
        city: serviceLocation.city || "",
        barangay: serviceLocation.barangay || "",
        latitude:
            serviceLocation.latitude ?? null,
        longitude:
            serviceLocation.longitude ?? null,
        fee: Number(resolvedFee) || 0,
    };
};

const validateBookingDateRange = (
    startDate,
    endDate
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        throw createError(
            "Booking dates must be valid dates.",
            400
        );
    }

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    if (start < todayStart) {
        throw createError(
            "Start date cannot be in the past.",
            400
        );
    }

    if (end <= start) {
        throw createError(
            "End date must be after the start date.",
            400
        );
    }

    return {
        start,
        end,
    };
};

const formatMinuteOfDay = (minute) => {
    const hour = Math.floor(minute / 60);

    return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${
        hour < 12 ? "AM" : "PM"
    }`;
};

/*
 * The pickup time a customer chose must be a bookable slot (office hours, on
 * the half hour, Manila time), and the return is at the same time of day so
 * the rental is whole days. `requireFuture` is for new or moved bookings: the
 * pickup time can't already have passed. Date-only input (older clients)
 * parses as 8:00 AM Manila, a valid slot with the default pickup hours.
 * `pickupHours` is Settings → Bookings → Pickup Hours (default 8 AM – 6 PM).
 */
const validatePickupSchedule = (
    start,
    end,
    {
        requireFuture = false,
        earliestPickupMs = null,
        bookingHours = null,
        pickupHours = null,
    } = {}
) => {
    const pickupMinute = getBusinessMinuteOfDay(start);
    const slotMinutes = getPickupSlotMinutes(pickupHours);

    if (!slotMinutes.includes(pickupMinute)) {
        throw createError(
            `Pickup time must be between ${formatMinuteOfDay(slotMinutes[0])} and ${formatMinuteOfDay(slotMinutes.at(-1))} (Philippine time), on the hour or half hour.`,
            400
        );
    }

    if (getBusinessMinuteOfDay(end) !== pickupMinute) {
        throw createError(
            "The return time must be the same as the pickup time. Rentals are booked in whole days.",
            400
        );
    }

    // Leaves time to pay the reservation fee and for an admin to approve.
    const leadMs = BOOKING_MIN_LEAD_HOURS * 60 * 60 * 1000;

    if (
        requireFuture &&
        start.getTime() < (earliestPickupMs ?? Date.now() + leadMs)
    ) {
        // Booking hours pushed it later than the plain notice would.
        if (
            earliestPickupMs &&
            bookingHours?.enabled &&
            earliestPickupMs > Date.now() + leadMs
        ) {
            throw createError(
                `Bookings are approved between ${formatMinuteOfDay(
                    parseBookingHoursTime(bookingHours.openTime)
                )} and ${formatMinuteOfDay(
                    parseBookingHoursTime(bookingHours.closeTime)
                )}, and need ${BOOKING_MIN_LEAD_HOURS} hours of that time before pickup. The earliest pickup you can book now is ${formatManilaDate(
                    new Date(earliestPickupMs),
                    { withTime: true }
                )}. Please choose a later time.`,
                400
            );
        }

        throw createError(
            `Pickup must be at least ${BOOKING_MIN_LEAD_HOURS} hours from now, so there's time to pay the reservation fee and get the booking approved. Please choose a later time.`,
            400
        );
    }
};

/*
 * A customer with an expired driver's license cannot legally drive, so a new
 * booking (self-drive or with-driver — the license also serves as an
 * identity credential on this platform) is blocked until they update it on
 * their profile. Customers without a license on file yet (shouldn't happen —
 * it's required at registration) are not blocked by this check; that's a
 * separate profile-completeness concern.
 */
const ensureCustomerLicenseNotExpired = async (
    customerId,
    { validThrough = null, session = null } = {}
) => {
    const customer = await User.findById(
        customerId
    )
        .select("licenseExpirationDate")
        .session(session)
        .lean();

    if (!customer?.licenseExpirationDate) {
        return;
    }

    const expiresAt = new Date(
        customer.licenseExpirationDate
    );

    if (expiresAt < new Date()) {
        throw createError(
            "Your driver's license has expired. Please update your license information in your profile before booking.",
            400
        );
    }

    /*
     * Self-drive: the customer drives the whole rental, so the license must
     * still be valid on the return date — otherwise the booking is made, paid
     * for, and then can't be released at the counter.
     */
    if (validThrough && expiresAt < new Date(validThrough)) {
        throw createError(
            `Your driver's license expires on ${formatManilaDate(
                expiresAt
            )}, before this rental ends. Renew it and update your profile, choose dates that end before it expires, or book with a driver.`,
            400
        );
    }
};

const ensureCustomerLicenseForDateChange = async (booking, end, settings = null, session = null) => {
    const policy = settings ?? await getBookingLocationPolicy();
    if (booking.driverOption === BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER &&
        policy.customerBookingSettings?.licenseRestrictionEnabled !== false) {
        await ensureCustomerLicenseNotExpired(booking.customer, { validThrough: end, session });
    }
};

/*
 * A customer who has explicitly said they don't hold a driver's license
 * (hasDriversLicense === false) can only book with a company driver. Unlike
 * the missing-declarations carve-outs elsewhere in this file, `null`
 * (never answered - every pre-existing account) is NOT blocked here: only
 * an explicit "no" restricts self-drive, so this can't retroactively lock
 * out customers who registered before this field existed. Gated by the
 * same licenseRestrictionEnabled check as ensureCustomerCanDriveVehicle so
 * turning that setting off disables every license-based booking
 * restriction consistently, not just the category/transmission match.
 */
const ensureCustomerHasDriversLicenseForSelfDrive = async (
    customerId
) => {
    const customer = await User.findById(
        customerId
    )
        .select("hasDriversLicense")
        .lean();

    if (customer?.hasDriversLicense === false) {
        throw createError(
            "You haven't indicated a driver's license on your profile. This account can only book vehicles with a driver.",
            400
        );
    }
};

const VEHICLE_TYPE_TO_LICENSE_CODE = {
    Car: "B",
    Motorcycle: "A",
};

/*
 * A customer's declared license codes (A = Motorcycle, B = Car) and, within
 * each, their declared transmission capability determine which vehicles
 * they may legally drive. A customer who can drive manual is assumed able
 * to drive automatic/CVT too, so "manual" unlocks every transmission for
 * that vehicle type. Missing declarations (no licenseCodes on file, or a
 * code selected without its transmission array) are not blocked here -
 * that's the same profile-completeness carve-out as the license-expiry
 * check above, not something this gate should punish.
 *
 * Only relevant to self-drive ("Without Driver") bookings - when a company
 * driver does the driving, the customer's own license doesn't govern the
 * vehicle at all (drivers carry their own separate license codes), so the
 * caller must only invoke this for BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER.
 */
const ensureCustomerCanDriveVehicle = async (
    customerId,
    vehicle
) => {
    const customer = await User.findById(
        customerId
    )
        .select(
            "licenseCodes carTransmission motorcycleTransmission"
        )
        .lean();

    const licenseCodes = customer?.licenseCodes;

    if (
        !Array.isArray(licenseCodes) ||
        licenseCodes.length === 0
    ) {
        return;
    }

    const requiredCode =
        VEHICLE_TYPE_TO_LICENSE_CODE[
            vehicle.vehicleType
        ];

    if (!requiredCode) {
        return;
    }

    if (!licenseCodes.includes(requiredCode)) {
        throw createError(
            `Your driver's license does not cover ${vehicle.vehicleType.toLowerCase()} rentals. Please update your license information in your profile before booking.`,
            400
        );
    }

    const declaredTransmissions =
        vehicle.vehicleType === "Car"
            ? customer.carTransmission
            : customer.motorcycleTransmission;

    if (
        !Array.isArray(declaredTransmissions) ||
        declaredTransmissions.length === 0
    ) {
        return;
    }

    const normalizedTransmissions =
        declaredTransmissions.map((value) =>
            String(value).toLowerCase()
        );

    if (normalizedTransmissions.includes("manual")) {
        return;
    }

    const vehicleTransmission = String(
        vehicle.specifications?.transmission || ""
    ).toLowerCase();

    if (
        vehicleTransmission !== "automatic" &&
        vehicleTransmission !== "cvt"
    ) {
        throw createError(
            `Your license only covers automatic-transmission ${vehicle.vehicleType.toLowerCase()}s. Please update your license information in your profile before booking this manual-transmission vehicle.`,
            400
        );
    }
};

const calculateRentalDays = (
    startDate,
    endDate
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const millisecondsPerDay =
        1000 * 60 * 60 * 24;

    /*
     * Whole 24-hour periods from the pickup time. New or changed dates
     * always share a time of day (validatePickupSchedule), so this is the
     * number of days between them. Rounded down, not up: the only partial
     * day is an approved extension's extra hours (a re-priced admin edit),
     * and those are charged separately as the extension fee.
     */
    return Math.floor(
        (end.getTime() -
            start.getTime()) /
            millisecondsPerDay
    );
};

const calculatePricing = (
    dailyRate,
    reservationFee,
    startDate,
    endDate
) => {
    const rentalDays =
        calculateRentalDays(
            startDate,
            endDate
        );

    if (rentalDays < 1) {
        throw createError(
            "Rental period must be at least one day.",
            400
        );
    }

    const normalizedDailyRate =
        Number(dailyRate);

    const normalizedReservationFee =
        Number(reservationFee);

    if (
        !Number.isFinite(
            normalizedDailyRate
        ) ||
        normalizedDailyRate < 0
    ) {
        throw createError(
            "Vehicle daily rate must be a valid non-negative number.",
            400
        );
    }

    if (
        !Number.isFinite(
            normalizedReservationFee
        ) ||
        normalizedReservationFee < 0
    ) {
        throw createError(
            "Vehicle reservation fee must be a valid non-negative number.",
            400
        );
    }

    const subtotal =
        normalizedDailyRate *
        rentalDays;

    const totalAmount =
        subtotal +
        normalizedReservationFee;

    return {
        dailyRate:
            normalizedDailyRate,

        reservationFee:
            normalizedReservationFee,

        rentalDays,

        subtotal,

        pickupDistanceKm: null,

        returnDistanceKm: null,

        pickupDistanceFee: 0,

        returnDistanceFee: 0,

        totalAmount,
    };
};

const calculateExtensionPricing = (
    dailyRate,
    additionalHours
) => {
    const hours =
        Number(additionalHours);

    if (
        !Number.isFinite(hours) ||
        hours < 1
    ) {
        throw createError(
            "Additional hours must be at least one hour.",
            400
        );
    }

    const normalizedDailyRate = Number(dailyRate);
    if (
        !Number.isFinite(normalizedDailyRate) ||
        normalizedDailyRate < 0
    ) {
        throw createError(
            "Vehicle daily rate must be a valid non-negative number.",
            400
        );
    }

    const hourlyRate = normalizedDailyRate / 24;

    return {
        pricingMethod:
            BOOKING_EXTENSION_PRICING_METHOD.PER_HOUR,
        fixedRate: null,
        hourlyRate,
        additionalHours: hours,
        amount: Math.round(hourlyRate * hours * 100) / 100,
    };
};

const validateVehicleBookingEligibility = (
    vehicle,
    {
        allowReserved = true,
    } = {}
) => {
    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw createError(
            "Archived vehicles cannot be booked.",
            400
        );
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.EXPIRED_REGISTRATION
    ) {
        throw createError(
            "Vehicle's registration has expired and cannot be booked.",
            400
        );
    }

    if (
        vehicle.status ===
        VEHICLE_STATUS.RESERVED &&
        !allowReserved
    ) {
        throw createError(
            "Vehicle is currently reserved.",
            400
        );
    }

    /*
     * A vehicle that's reserved or out on a rental can still be booked for
     * other times: availability is decided by the time-based conflict checks
     * (bookingConflictService), including the turnaround buffer and a rental
     * that's overdue.
     */
    if (
        !BOOKABLE_VEHICLE_STATUSES.includes(
            vehicle.status
        )
    ) {
        throw createError(
            "Vehicle is currently unavailable for booking.",
            400
        );
    }

    if (
        vehicle.availability?.bookingEnabled ===
        false
    ) {
        throw createError(
            "Vehicle booking is currently disabled.",
            400
        );
    }
};

const validateVehicleExtensionEligibility = (
    vehicle,
    bookingStatus
) => {
    if (
        vehicle.status ===
        VEHICLE_STATUS.ARCHIVED
    ) {
        throw createError(
            "Archived vehicles cannot have booking extensions.",
            400
        );
    }

    // Maintenance: the extra time is checked against its window by
    // validateVehicleDateAvailability, which every caller runs next.

    if (
        bookingStatus ===
        BOOKING_STATUS.APPROVED
    ) {
        if (
            !BOOKABLE_VEHICLE_STATUSES.includes(
                vehicle.status
            )
        ) {
            throw createError(
                "The approved booking's vehicle is not available for extension.",
                400
            );
        }
    }

    if (
        bookingStatus ===
        BOOKING_STATUS.ONGOING
    ) {
        if (
            vehicle.status !==
            VEHICLE_STATUS.RENTED
        ) {
            throw createError(
                "The ongoing rental's vehicle must currently be Rented.",
                400
            );
        }
    }

    if (
        vehicle.availability?.bookingEnabled ===
        false
    ) {
        throw createError(
            "Vehicle booking is currently disabled.",
            400
        );
    }
};

const hasBlockedDateConflict = (
    blockedDates = [],
    startDate,
    endDate
) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return blockedDates.some(
        (blockedDate) => {
            const blockedStart =
                new Date(
                    blockedDate.startDate
                );

            const blockedEnd =
                new Date(
                    blockedDate.endDate
                );

            return (
                start < blockedEnd &&
                end > blockedStart
            );
        }
    );
};

const validateVehicleDateAvailability = async (
    vehicle,
    startDate,
    endDate
) => {
    const {
        start,
        end,
    } = validateBookingDateRange(
        startDate,
        endDate
    );

    const availableFrom =
        vehicle.availability?.availableFrom;

    if (
        availableFrom &&
        start < new Date(availableFrom)
    ) {
        throw createError(
            "Vehicle is not available during the requested period.",
            400
        );
    }

    const blockedDates =
        vehicle.availability?.blockedDates ||
        [];

    if (
        hasBlockedDateConflict(
            blockedDates,
            start,
            end
        )
    ) {
        throw createError(
            "Vehicle is blocked during the requested period.",
            400
        );
    }

    if (overlapsMaintenance(vehicle, start, end)) {
        throw createError(
            describeMaintenanceBlock(getMaintenanceWindow(vehicle), {
                showOffRoadNotice: (await getOffRoadVehicleSettings())
                    .showNotice,
            }),
            400
        );
    }

    return {
        start,
        end,
    };
};

/*
 * Admin-configurable cap on how many bookings (across any vehicle) a single
 * customer may hold with overlapping date ranges at once. `maxConcurrentBookings`
 * of 0 (or unset) means no limit - preserves pre-feature behavior until an
 * admin opts in via Customer Settings. Uses the same $lt/$gt overlap idiom
 * as the vehicle/driver conflict checks above, scoped to `customer` instead.
 */
const ensureCustomerBookingLimitNotExceeded = async (
    customerId,
    startDate,
    endDate,
    maxConcurrentBookings,
    excludeBookingId = null,
    { session = null } = {}
) => {
    if (
        !maxConcurrentBookings ||
        maxConcurrentBookings <= 0
    ) {
        return;
    }

    const overlappingCount =
        await Booking.countDocuments({
            customer: customerId,

            status: {
                $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
            },

            startDate: {
                $lt: endDate,
            },

            endDate: {
                $gt: startDate,
            },

            // A reschedule checks the booking's new dates against the
            // customer's OTHER bookings.
            ...(excludeBookingId
                ? { _id: { $ne: excludeBookingId } }
                : {}),
        }).session(session);

    if (overlappingCount >= maxConcurrentBookings) {
        throw createError(
            `You already have ${overlappingCount} booking(s) for these dates, which is the maximum allowed (${maxConcurrentBookings}). Please choose different dates or complete/cancel an existing booking first.`,
            400
        );
    }
};

const refreshVehicleReservationStatus = async (
    vehicleId
) => {
    const hasApprovedBooking = await Booking.exists({
        vehicle: vehicleId,
        status: BOOKING_STATUS.APPROVED,
    });

    if (!hasApprovedBooking) {
        await Vehicle.updateOne(
            {
                _id: vehicleId,
                status: VEHICLE_STATUS.RESERVED,
            },
            {
                $set: {
                    status: VEHICLE_STATUS.AVAILABLE,
                },
            }
        );
    }
};

/*
 * The driver a booking is (or will be) driven by must exist, be active and
 * not archived, be bookable, and hold a license valid through `validThrough`
 * (the trip's end). `allowUnassigned`: "With Driver" without a driver yet —
 * while admins assign drivers at approval (Settings → Drivers).
 */
const validateDriverSelection = async (
    driverOption,
    driverId,
    { allowUnassigned = false, validThrough = null } = {}
) => {
    if (
        driverOption ===
        BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
    ) {
        if (driverId) {
            throw createError(
                "Driver must not be provided when booking without a driver.",
                400
            );
        }

        return null;
    }

    if (
        driverOption !==
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        throw createError(
            "Invalid driver option.",
            400
        );
    }

    if (!driverId) {
        if (allowUnassigned) {
            return null;
        }

        throw createError(
            "A driver is required when booking with a driver.",
            400
        );
    }

    const driver =
        await Driver.findById(driverId);

    if (!driver) {
        throw createError(
            "Driver not found.",
            404
        );
    }

    if (
        driver.status !==
            DRIVER_STATUS.ACTIVE ||
        driver.archive?.isArchived
    ) {
        throw createError(
            "Selected driver is not active.",
            400
        );
    }

    if (!(await isDriverBookable(driver))) {
        throw createError(
            "Selected driver is not available.",
            400
        );
    }

    const licenseIssue = getDriverLicenseIssue(driver, validThrough);

    if (licenseIssue) {
        throw createError(
            licenseIssue === "expired"
                ? "The selected driver's license has expired. Please choose another driver."
                : "The selected driver's license expires before this trip ends. Please choose another driver.",
            400
        );
    }

    return driver;
};

/* Settings → Drivers: admins pick the driver at approval, customers can't. */
const isAdminDriverAssignment = (settings) =>
    settings?.driverAssignmentSettings?.requireAdminDriverAssignment ===
    true;

/* Settings → Drivers can make motorcycles self-drive only. */
const ensureDriverOptionOffered = (driverOption, vehicle, settings) => {
    if (
        driverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
        !areDriversOfferedForVehicle(vehicle, settings)
    ) {
        throw createError(
            "Motorcycles are self-drive only right now, so they can't be booked with a driver. Please choose self-drive.",
            400
        );
    }
};

const findBookingById = async (
    bookingId
) => {
    const booking =
        await Booking.findById(
            bookingId
        );

    if (!booking) {
        throw createError(
            "Booking not found.",
            404
        );
    }

    return booking;
};

// Every operation that claims a new slot must use the same resource guards
// as booking creation. Recheck on the transaction's snapshot after acquiring
// them; a conditional write on this booking alone cannot protect other ones.
const withBookingChangeTransaction = async (booking, changes, persist) => {
    const vehicle = changes.vehicle ?? booking.vehicle;
    const driver = changes.driver === undefined ? booking.driver : changes.driver;
    const start = changes.start ?? booking.startDate;
    const end = changes.end ?? booking.endDate;
    return withBookingCreationTransaction(
        [
            `booking:${booking._id}`, `customer:${booking.customer}`,
            ...[booking.vehicle, vehicle].map((id) => `vehicle:${id}`),
            ...[booking.driver, driver].filter(Boolean).map((id) => `driver:${id}`),
        ],
        async (session) => {
            const fresh = await Booking.findById(booking._id).session(session);
            if (!fresh || fresh.status !== booking.status ||
                fresh.updatedAt?.getTime() !== booking.updatedAt?.getTime() ||
                String(fresh.vehicle) !== String(booking.vehicle) ||
                String(fresh.driver ?? "") !== String(booking.driver ?? "") ||
                new Date(fresh.startDate).getTime() !== new Date(booking.startDate).getTime() ||
                new Date(fresh.endDate).getTime() !== new Date(booking.endDate).getTime()) {
                throw createError("This booking changed while you were working on it. Refresh and try again.", 409);
            }
            await ensureNoBookingConflict(vehicle, start, end, booking._id, { session });
            await ensureNoDriverBookingConflict(driver, start, end, booking._id, { session });
            if (changes.start || changes.end) {
                await ensureCustomerLicenseForDateChange(booking, end, null, session);
            }
            if (changes.checkLimit) {
                const settings = await Settings.findOne().session(session).lean();
                await ensureCustomerBookingLimitNotExceeded(
                    booking.customer, start, end,
                    settings?.customerBookingSettings?.maxConcurrentBookings,
                    booking._id, { session }
                );
            }
            const updated = await persist(session, fresh);
            if (!updated) {
                throw createError("This booking changed while you were working on it. Refresh and try again.", 409);
            }
            return updated;
        }
    );
};

/*
 * `prefetched` lets a caller that already looked up the reservation-fee
 * Payment / Rental for a batch of bookings (see `getBookings`) hand them in
 * directly instead of each booking issuing its own two queries.
 */
/*
 * The driver fields a booking response carries (admins and customers alike):
 * enough to name, call and check them — status, archive and licence expiry
 * drive the admin's "needs a new driver" badge — and nothing private.
 */
const BOOKING_DRIVER_FIELDS =
    "firstName lastName profileImage phoneNumber driverCode status availability archive.isArchived license.licenseType license.restrictionCodes license.expiryDate pricing.dailyRate";

const populateBooking = async (
    booking,
    {
        prefetched = false,
        payment: prefetchedPayment = null,
        rental: prefetchedRental = null,
        extensionPayment: prefetchedExtensionPayment = null,
        owedRefunds: prefetchedOwedRefunds = [],
        extensionRefunds: prefetchedExtensionRefunds = [],
        hasReview: prefetchedHasReview = false,
    } = {}
) => {
    if (!booking) {
        return null;
    }

    await booking.populate([
        {
            path: "customer",
            select: "-password",
        },
        {
            path: "vehicle",
            populate: {
                path: "category",
            },
        },
        {
            path: "driver",
            select: BOOKING_DRIVER_FIELDS,
        },
        {
            path: "driverChanges.previousDriver",
            select: "firstName lastName",
        },
        {
            path: "driverChanges.newDriver",
            select: "firstName lastName",
        },
        {
            path: "driverChangeRequests.preferredDriver",
            select: "firstName lastName profileImage",
        },
        {
            path: "driverChangeRequests.assignedDriver",
            select: "firstName lastName",
        },
        {
            path: "extensions.requestedBy",
            select: "-password",
        },
        {
            path: "extensions.approvedBy",
            select: "-password",
        },
        {
            path: "extensions.rejectedBy",
            select: "-password",
        },
        {
            path: "extensions.cancelledBy",
            select: "-password",
        },
        {
            path: "statusHistory.changedBy",
            select: "-password",
        },
        {
            path: "maintenanceConflict.vehicleChange.previousVehicle",
            select: "brand model plateNumber images vehicleCode",
        },
        {
            path: "maintenanceConflict.optionsSentBy",
            select: "firstName lastName",
        },
        {
            path: "maintenanceConflict.resolvedBy",
            select: "firstName lastName role",
        },
        {
            // Late return: just the late rental's code and booking (for the
            // admin panel's link) — never who rented it.
            path: "maintenanceConflict.blockingRental",
            select: "rentalCode booking",
        },
        {
            path: "audit.createdBy",
            select: "-password",
        },
        {
            path: "audit.updatedBy",
            select: "-password",
        },
    ]);

    const [
        payment,
        rental,
        extensionPayment,
        owedRefunds,
        extensionRefunds,
    ] = prefetched
        ? [
              prefetchedPayment,
              prefetchedRental,
              prefetchedExtensionPayment,
              prefetchedOwedRefunds,
              prefetchedExtensionRefunds,
          ]
        : await Promise.all([
              Payment.findOne({
                  booking: booking._id,
                  paymentType: "RESERVATION_FEE",
              }).select(
                  "_id status amount paymentMethod refund paymongo.checkoutSessionId"
              ),

              Rental.findOne({
                  booking: booking._id,
              })
                  .select(
                      "rentalCode vehicle lateReturn earlyReturn financial.lateCharges financial.balance financial.finalAmount financial.amountPaid status actualEndDate bookingPeriod pickup.fuelLevel return.date vehicleOutcome securityDeposit.required securityDeposit.status penaltyHistory refunds"
                  )
                  .populate(
                      "penaltyHistory.performedBy",
                      "firstName lastName email"
                  )
                  .lean(),

              /*
               * Most recent extension-fee payment, if any - a booking with an
               * approved extension has exactly one of these per approval (see
               * approveBookingExtension), and only the latest one matters for
               * "is there something still owed for an extension". Never
               * required, so a booking without one just carries none of these
               * fields below.
               */
              Payment.findOne({
                  booking: booking._id,
                  paymentType: "EXTENSION_FEE",
              })
                  .sort({ createdAt: -1 })
                  .select("_id status paymentMethod amount bookingReschedule bookingVehicleChange"),

              ManualRefund.find({ booking: booking._id })
                  .select(OWED_REFUND_FIELDS)
                  .lean(),

              Payment.find({
                  booking: booking._id,
                  paymentType: PAYMENT_TYPE.EXTENSION_FEE,
                  refund: { $ne: null },
              })
                  .select(EXTENSION_REFUND_FIELDS)
                  .lean(),
          ]);

    const bookingObj = booking.toObject();

    // Same "verified right now" view as everywhere else: an expired valid ID
    // or license puts the badge on hold (see isUserEffectivelyVerified).
    if (bookingObj.customer?._id) {
        bookingObj.customer.verifiedByAdmin = Boolean(
            bookingObj.customer.isVerified
        );
        bookingObj.customer.validIdExpired = isValidIdExpired(
            bookingObj.customer
        );
        bookingObj.customer.isVerified = isUserEffectivelyVerified(
            bookingObj.customer
        );
    }

    if (payment) {
        bookingObj.paymentId = payment._id;
        bookingObj.paymentStatus = payment.status;
        bookingObj.paymentAmount = payment.amount;
        bookingObj.paymentMethod = payment.paymentMethod;
        /*
         * A PayMongo checkout was opened for it: if it's still PENDING, the
         * customer may have paid and the webhook not arrived yet, so My
         * Bookings asks PayMongo directly (payments/:id/reconcile). The
         * session id itself isn't exposed.
         */
        bookingObj.paymentCheckoutStarted = Boolean(
            payment.paymongo?.checkoutSessionId
        );

        if (payment.refund) {
            bookingObj.paymentRefund = payment.refund;
        }
    }

    if (extensionPayment) {
        bookingObj.extensionPaymentId =
            extensionPayment._id;
        bookingObj.extensionPaymentStatus =
            extensionPayment.status;
        bookingObj.extensionPaymentMethod =
            extensionPayment.paymentMethod;
        bookingObj.extensionPaymentAmount =
            extensionPayment.amount;
        // The same fee type also collects a reschedule's extra days and a
        // vehicle change's price difference.
        bookingObj.extensionPaymentPurpose =
            extensionPayment.bookingReschedule
                ? "reschedule"
                : extensionPayment.bookingVehicleChange
                  ? "vehicleChange"
                  : "extension";
    }

    if (rental) {
        bookingObj.rental = rental;
    }

    /* Whether the trip has been rated (one review per rental), so My
       Bookings stops offering "Review" once it has. */
    bookingObj.hasReview = prefetched
        ? prefetchedHasReview
        : Boolean(rental && (await Review.exists({ rental: rental._id })));

    /*
     * Refunds beyond the reservation payment's own: ones owed by hand (see
     * ManualRefund) and extension-fee refunds, so the refund badge can show
     * money that's still on its way, not just what has already arrived.
     */
    bookingObj.owedRefunds = owedRefunds ?? [];
    bookingObj.extensionRefunds = (extensionRefunds ?? []).map(
        (extension) => ({ ...extension.refund, paymentId: extension._id })
    );

    return bookingObj;
};

const OWED_REFUND_FIELDS = "booking amount status createdAt settledAt";

const EXTENSION_REFUND_FIELDS = "booking refund.amount refund.status";

const getPopulatedBooking = async (
    bookingId
) => {
    const booking =
        await Booking.findById(
            bookingId
        );

    return populateBooking(booking);
};

const getPendingExtension = (
    booking
) => {
    return booking.extensions.find(
        (extension) =>
            extension.status ===
            BOOKING_EXTENSION_STATUS.PENDING
    );
};

const findExtensionById = (
    booking,
    extensionId
) => {
    const extension =
        booking.extensions.id(
            extensionId
        );

    if (!extension) {
        throw createError(
            "Booking extension not found.",
            404
        );
    }

    return extension;
};

const validateExtensionBookingStatus = (
    booking
) => {
    if (
        ![
            BOOKING_STATUS.APPROVED,
            BOOKING_STATUS.ONGOING,
        ].includes(booking.status)
    ) {
        throw createError(
            "Only approved or ongoing bookings can request an extension.",
            400
        );
    }
};

const validateExtensionEndDate = (
    requestedEndDate,
    currentEndDate
) => {
    const requestedEnd =
        new Date(requestedEndDate);

    const currentEnd =
        new Date(currentEndDate);

    if (
        Number.isNaN(
            requestedEnd.getTime()
        )
    ) {
        throw createError(
            "Requested end date must be a valid date.",
            400
        );
    }

    if (
        requestedEnd <= currentEnd
    ) {
        throw createError(
            "Requested end date must be after the current booking end date.",
            400
        );
    }

    const now = new Date();

    if (requestedEnd <= now) {
        throw createError(
            "Requested end date must be in the future.",
            400
        );
    }

    return requestedEnd;
};

const calculateExtensionHours = (
    currentEndDate,
    requestedEndDate
) => {
    const currentEnd =
        new Date(currentEndDate);

    const requestedEnd =
        new Date(requestedEndDate);

    const milliseconds =
        requestedEnd.getTime() -
        currentEnd.getTime();

    const hours =
        milliseconds /
        (1000 * 60 * 60);

    if (
        !Number.isFinite(hours) ||
        hours < 1
    ) {
        throw createError(
            "Extension period must be at least one hour.",
            400
        );
    }

    return hours;
};

const createBooking = async (
    bookingData,
    currentUserId
) => {
    const {
        vehicle: vehicleId,
        driverOption,
        driver: requestedDriverId = null,
        startDate,
        endDate,
        paymentMethod,
        payInFull = false,
        voucherCode,
    } = bookingData;

    const settings =
        await getBookingLocationPolicy();

    /*
     * The Terms & Conditions version the customer was shown and accepted
     * (createBookingValidator requires it from customers). Checked first, so
     * a version too old to accept fails before anything is claimed.
     */
    const termsAcceptance = bookingData.termsVersionId
        ? await buildBookingTermsAcceptance(
              bookingData.termsVersionId,
              settings
          )
        : null;

    // While admins assign drivers, the customer's pick (if any) is ignored:
    // the booking waits for one at approval.
    const adminAssignsDriver = isAdminDriverAssignment(settings);

    const driverId = adminAssignsDriver
        ? null
        : requestedDriverId || null;

    const {
        start,
        end,
    } = validateBookingDateRange(
        startDate,
        endDate
    );

    await ensureCustomerLicenseNotExpired(
        currentUserId,
        {
            validThrough:
                driverOption ===
                    BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER &&
                settings.customerBookingSettings
                    ?.licenseRestrictionEnabled !== false
                    ? end
                    : null,
        }
    );

    // Booking hours: overnight bookings can't take the first morning slots.
    const bookingHours = settings.bookingSettings?.bookingHours ?? null;

    validatePickupSchedule(start, end, {
        requireFuture: true,
        bookingHours,
        pickupHours: settings.bookingSettings?.pickupHours ?? null,
        earliestPickupMs: getEarliestPickupMs(Date.now(), bookingHours),
    });

    const vehicle =
        await Vehicle.findById(
            vehicleId
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    ensureDriverOptionOffered(driverOption, vehicle, settings);

    if (
        driverOption ===
            BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER &&
        settings.customerBookingSettings
            ?.licenseRestrictionEnabled !== false
    ) {
        await ensureCustomerHasDriversLicenseForSelfDrive(
            currentUserId
        );
        await ensureCustomerCanDriveVehicle(
            currentUserId,
            vehicle
        );
    }

    validateVehicleBookingEligibility(
        vehicle
    );

    await validateVehicleDateAvailability(
        vehicle,
        start,
        end
    );

    await ensureNoBookingConflict(
        vehicle._id,
        start,
        end
    );

    await ensureCustomerBookingLimitNotExceeded(
        currentUserId,
        start,
        end,
        settings.customerBookingSettings
            ?.maxConcurrentBookings
    );

    await validateDriverSelection(
        driverOption,
        driverId,
        {
            allowUnassigned: adminAssignsDriver,
            validThrough: end,
        }
    );

    if (
        driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        await ensureNoDriverBookingConflict(
            driverId,
            start,
            end
        );
    }

    const pickupServiceLocation =
        await validateServiceLocation(
            bookingData.pickupLocation
                ?.serviceLocationId
        );

    const returnServiceLocation =
        await validateServiceLocation(
            bookingData.returnLocation
                ?.serviceLocationId
        );

    await validateLocationPolicy(
        bookingData.pickupLocation
            ?.serviceLocationId,
        bookingData.returnLocation
            ?.serviceLocationId
    );

    ensureCustomLocationHasCoordinates(
        pickupServiceLocation,
        bookingData.pickupLocation,
        "pickup"
    );

    ensureCustomLocationHasCoordinates(
        returnServiceLocation,
        bookingData.returnLocation,
        "return"
    );

    // A running vehicle discount (holiday sale etc.) lowers the daily rate.
    const vehicleRate =
        await resolveVehicleRateNow(vehicle);

    let pricing = applyVehicleDiscountToPricing(
        calculatePricing(
            vehicleRate.dailyRate,
            vehicle.pricing.reservationFee,
            start,
            end
        ),
        vehicleRate
    );

    const distanceFees =
        await resolveBookingLocationFees({
            pickupServiceLocation,
            returnServiceLocation,
            pickupLocation:
                bookingData.pickupLocation,
            returnLocation:
                bookingData.returnLocation,
            driverOption,
            enableDistanceFeeCalculation:
                settings?.enableDistanceFeeCalculation,
        });

    const totalAmount =
        pricing.subtotal +
        pricing.reservationFee +
        distanceFees.pickupDistanceFee +
        distanceFees.returnDistanceFee;

    pricing.pickupDistanceKm =
        distanceFees.pickupDistanceKm;
    pricing.returnDistanceKm =
        distanceFees.returnDistanceKm;
    pricing.pickupDistanceFee =
        distanceFees.pickupDistanceFee;
    pricing.returnDistanceFee =
        distanceFees.returnDistanceFee;
    pricing.totalAmount = totalAmount;

    // Priced here and locked: a later driver assignment, reassignment or
    // rate change doesn't alter what this booking pays for its driver.
    applyDriverFee(
        pricing,
        await resolveDriverDailyRate({
            driverOption,
            driverId,
            settings,
        })
    );

    let voucherDiscount = null;

    if (voucherCode) {
        const voucher =
            await validateVoucherForUser(
                voucherCode,
                currentUserId
            );

        pricing = calculatePricingWithVoucher(
            pricing,
            voucher,
            currentUserId
        );

        voucherDiscount = {
            voucher: voucher._id,
            code: voucher.code,
            name: voucher.name,
            type: voucher.type,
            discountMethod:
                voucher.discountMethod,
            discountValue:
                voucher.discountValue,
            discountAmount:
                pricing.voucher?.discount
                    ? Object.entries(
                          pricing.voucher.discount
                      )
                          .filter(
                              ([key]) =>
                                  key.endsWith(
                                      "Discount"
                                  )
                          )
                          .reduce(
                              (sum, [_, val]) =>
                                  sum +
                                  (Number(val) || 0),
                              0
                          )
                    : 0,
        };
    }

    // What's paid up front: the reservation and pickup distance fees, less
    // a voucher on either of them.
    const upfrontAmount = getUpfrontFees({
        pricing,
        voucher: voucherDiscount,
    }).total;

    if (
        upfrontAmount > 0 &&
        !paymentMethod
    ) {
        throw createError(
            "Payment method is required for the reservation fee.",
            400
        );
    }

    /*
     * The reservation fee is paid online before approval, whatever the
     * customer pays the rest with. A Cash on Pickup reservation was approved
     * with nothing paid, so a customer who never came lost nothing — the
     * no-show rules had no fee to keep. The rest of the rental is still paid
     * at pickup. (Bookings made before this keep their Cash on Pickup
     * reservation; approving and picking those up is unchanged.)
     */
    if (
        paymentMethod ===
        PAYMENT_METHOD.CASH_ON_PICKUP
    ) {
        throw createError(
            CASH_RESERVATION_NOT_ALLOWED_MESSAGE,
            400
        );
    }

    const bookingCode =
        await generateBookingCode();

    await ensureBookingCodeAvailable(
        bookingCode
    );

    const bookingId = new mongoose.Types.ObjectId();
    let booking;

    try {
        booking = await withBookingCreationTransaction(
            [
                `customer:${currentUserId}`,
                `vehicle:${vehicle._id}`,
                ...(driverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER && driverId
                    ? [`driver:${driverId}`]
                    : []),
            ],
            async (session) => {
                // Preflight checks above provide quick feedback; these checks
                // under the resource guards decide whether the slot is saved.
                await ensureNoBookingConflict(vehicle._id, start, end, null, { session });
                if (driverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER) {
                    await ensureNoDriverBookingConflict(driverId, start, end, null, { session });
                }
                await ensureCustomerBookingLimitNotExceeded(
                    currentUserId, start, end,
                    settings.customerBookingSettings?.maxConcurrentBookings,
                    null, { session }
                );
                if (voucherDiscount?.voucher && !(await claimVoucherUsage(
                    voucherDiscount.voucher, currentUserId, bookingId, session
                ))) {
                    throw createError("You have already used this voucher.", 400);
                }

                const [createdBooking] =
                    await Booking.create([{
                        _id: bookingId,

                        bookingCode,

                        customer:
                            currentUserId,

                        vehicle:
                            vehicle._id,

                        driverOption,

                        driver:
                            driverOption ===
                            BOOKING_DRIVER_OPTIONS.WITH_DRIVER
                                ? driverId
                                : null,

                        startDate:
                            start,

                        endDate:
                            end,

                        pickupLocation:
                            buildBookingLocation(
                                pickupServiceLocation,
                                bookingData.pickupLocation,
                                distanceFees.pickupDistanceFee
                            ),

                        returnLocation:
                            buildBookingLocation(
                                returnServiceLocation,
                                bookingData.returnLocation,
                                distanceFees.returnDistanceFee
                            ),

                        pricing,

                        voucher: voucherDiscount,

                        status:
                            BOOKING_STATUS.PENDING,

                        customerNotes:
                            bookingData.customerNotes ||
                            "",

                        internalNotes: "",

                        termsAcceptance,

                        audit: {
                            createdBy:
                                currentUserId ||
                                null,

                            updatedBy:
                                currentUserId ||
                                null,
                        },
                    }], { session });

                /*
                 * payInFull is GCash-only (see createBookingValidator) - a customer
                 * who chose to pay the whole rental total now instead of just the
                 * reservation fee. The Payment record itself stays typed as
                 * RESERVATION_FEE either way (only the amount differs): everything
                 * downstream - webhook verification, calculateFinancials in
                 * rentalService.js, cancellation refunds - keys off that type plus
                 * VERIFIED status, not its magnitude, so a bigger amount here is
                 * enough to correctly zero out the balance due at pickup.
                 */
                const initialPaymentAmount =
                    payInFull &&
                    paymentMethod ===
                        PAYMENT_METHOD.GCASH
                        ? pricing.totalAmount
                        : upfrontAmount;

                if (
                    initialPaymentAmount > 0 &&
                    paymentMethod
                ) {
                    await Payment.create([{
                        booking: createdBooking._id,
                        rental: null,
                        customer:
                            currentUserId,
                        paymentType:
                            PAYMENT_TYPE.RESERVATION_FEE,
                        paymentMethod,
                        amount:
                            initialPaymentAmount,
                        status:
                            PAYMENT_STATUS.PENDING,
                        verification: {
                            verifiedBy: null,
                            verifiedAt: null,
                            rejectionReason: "",
                        },
                        processedBy: null,
                        processedAt: null,
                        notes: "",
                        audit: {
                            createdBy:
                                currentUserId,
                            updatedBy:
                                currentUserId,
                        },
                    }], { session });
                }
                return createdBooking;
            }
        );

        try {
            await notifyAdmins({
                type: "booking",
                title: "New Booking Request",
                message: `Booking ${booking.bookingCode} for ${vehicle.brand} ${vehicle.model} (${formatBookingWindow(start, end)}) was submitted and is awaiting review.`,
                variant: "info",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of new booking:",
                notificationError
            );
        }

        await notifyVehicleOperator(vehicle.operator, booking, {
            type: "booking",
            title: "New Booking on Your Vehicle",
            message: `Your ${vehicle.brand} ${vehicle.model} has a new booking request (${booking.bookingCode}) for ${formatBookingWindow(start, end)}.`,
            variant: "info",
        });

        await notifyBookingCustomer(booking, {
            type: "booking",
            title: "Booking Submitted",
            message: `Your booking ${booking.bookingCode} for the ${vehicle.brand} ${vehicle.model} (${formatBookingWindow(start, end)}) was submitted and is awaiting review.`,
            variant: "info",
        });

        return getPopulatedBooking(
            booking._id
        );
    } catch (error) {
        if (error?.code === 11000) {
            throw createError(
                "Booking code already exists. Please try again.",
                409
            );
        }

        throw error;
    }
};

const getOperatorVehicleIds = async (
    operatorId
) => {
    const vehicles = await Vehicle.find({
        operator: operatorId,
    })
        .select("_id")
        .lean();

    return vehicles.map(
        (vehicle) => vehicle._id
    );
};

/*
 * What a partner (operator) gets for a booking on one of their vehicles - an
 * allowlist, not a redaction. A fully populated booking carries a lot a
 * partner must not see: the customer's whole profile (via audit.createdBy
 * and extensions.requestedBy, not just `customer`), admins' and drivers'
 * user records, internal notes, customer notes, pickup/return addresses,
 * payment/refund records and penalty history. Building the view from
 * scratch means a field added to Booking later stays hidden by default.
 *
 * The partner does get their own money for the booking: the payout item
 * (their share after commission) once one has been scheduled.
 */
const OPERATOR_HIDDEN_PAYOUT_STATUSES = [
    PAYOUT_STATUS.REJECTED,
    PAYOUT_STATUS.CANCELLED,
];

const getOperatorEarningsByBooking = async (
    operatorId,
    bookingIds
) => {
    const earnings = new Map();

    if (!operatorId || !bookingIds.length) {
        return earnings;
    }

    const payouts = await PayoutRequest.find({
        operator: operatorId,
        "items.booking": { $in: bookingIds },
        status: { $nin: OPERATOR_HIDDEN_PAYOUT_STATUSES },
    })
        .select("status scheduledReleaseAt processedAt items")
        .lean();

    const wanted = new Set(bookingIds.map(String));

    for (const payout of payouts) {
        for (const item of payout.items || []) {
            const key = String(item.booking);

            if (!wanted.has(key) || earnings.has(key)) {
                continue;
            }

            earnings.set(key, {
                bookingAmount: item.bookingAmount,
                refundDeduction: item.refundDeduction || 0,
                platformCommission: item.platformCommission,
                amount: item.operatorEarnings,
                payoutStatus: payout.status,
                releaseAt:
                    payout.status === PAYOUT_STATUS.PAID
                        ? payout.processedAt
                        : payout.scheduledReleaseAt,
            });
        }
    }

    return earnings;
};

const toOperatorBookingView = (booking, earnings = null) => {
    const vehicle = booking.vehicle || {};
    const customer = booking.customer || {};
    const rental = booking.rental || null;

    const approvedExtensions = (booking.extensions || []).filter(
        (extension) =>
            extension.status === BOOKING_EXTENSION_STATUS.APPROVED
    );

    return {
        _id: booking._id,
        bookingCode: booking.bookingCode,
        status: booking.status,
        createdAt: booking.createdAt,
        startDate: booking.startDate,
        endDate: booking.endDate,
        // Set at pickup, when startDate/endDate move to the actual times.
        scheduledStartDate: booking.scheduledStartDate ?? null,
        scheduledEndDate: booking.scheduledEndDate ?? null,
        // Set at return, when endDate moves to the actual return time.
        dueBackDate: booking.dueBackDate ?? null,
        rentalDays: booking.pricing?.rentalDays ?? null,
        driverOption: booking.driverOption,
        extensionCount: approvedExtensions.length,
        originalEndDate: approvedExtensions.length
            ? approvedExtensions[0].previousEndDate ?? null
            : null,

        // Only that the booking is hit by maintenance or a late return on
        // their vehicle.
        maintenanceConflict: booking.maintenanceConflict
            ? {
                  status: booking.maintenanceConflict.status,
                  cause:
                      booking.maintenanceConflict.cause ||
                      BOOKING_VEHICLE_CONFLICT_CAUSE.MAINTENANCE,
                  maintenanceUntil:
                      booking.maintenanceConflict.maintenanceUntil ?? null,
              }
            : null,

        // First name + surname initial: enough to recognise a renter.
        customer: {
            firstName: customer.firstName,
            lastInitial: customer.lastName?.trim()?.[0] ?? "",
        },

        vehicle: {
            _id: vehicle._id,
            vehicleCode: vehicle.vehicleCode,
            brand: vehicle.brand,
            model: vehicle.model,
            plateNumber: vehicle.plateNumber,
            images: vehicle.images || [],
        },

        rental: rental
            ? {
                  _id: rental._id,
                  rentalCode: rental.rentalCode,
                  status: rental.status,
                  // actualEndDate is the due-back time, not the return.
                  returnedAt: rental.return?.date || null,
                  lateMinutes:
                      rental.lateReturn?.lateDurationMinutes || 0,
                  earlyReturn: Boolean(rental.earlyReturn?.detected),
              }
            : null,

        earnings,
    };
};

const getBookings = async (
    filters = {},
    currentUserId,
    currentUserRole,
    sort = { createdAt: -1 }
) => {
    const query = {};

    if (
        currentUserRole ===
        "customer"
    ) {
        query.customer =
            currentUserId;
    }

    if (
        currentUserRole === "operator"
    ) {
        const operatorVehicleIds =
            await getOperatorVehicleIds(
                currentUserId
            );

        if (!operatorVehicleIds.length) {
            return [];
        }

        query.vehicle = {
            $in: operatorVehicleIds,
        };
    }

    if (
        currentUserRole === "admin" &&
        filters.customer
    ) {
        query.customer =
            filters.customer;
    }

    if (filters.vehicle) {
        if (currentUserRole === "operator") {
            /*
             * Never let a client-supplied vehicle filter escape the
             * operator's own vehicle scope set above — narrow within it
             * instead of overwriting it, or another operator's bookings
             * would be one query param away from leaking.
             */
            const isOwnVehicle = (
                query.vehicle?.$in ?? []
            ).some(
                (id) =>
                    String(id) ===
                    String(filters.vehicle)
            );

            if (isOwnVehicle) {
                query.vehicle = filters.vehicle;
            }
        } else {
            query.vehicle =
                filters.vehicle;
        }
    }

    if (filters.driver) {
        query.driver =
            filters.driver;
    }

    if (filters.status) {
        query.status =
            filters.status;
    }

    if (filters.driverOption) {
        query.driverOption =
            filters.driverOption;
    }

    // Bookings hit by vehicle maintenance that still need resolving.
    if (filters.maintenanceConflict === "active") {
        query["maintenanceConflict.status"] = {
            $in: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
        };
        query.status ??= { $in: RESCHEDULABLE_STATUSES };
    }

    const bookings =
        await Booking.find(query)
            .sort(sort);

    if (!bookings.length) {
        return [];
    }

    /*
     * Look up the reservation-fee Payment and Rental for every booking in
     * this page with two queries instead of two-per-booking (populateBooking
     * used to run these individually, an N+1 that grows with the list).
     */
    const bookingIds = bookings.map(
        (booking) => booking._id
    );

    const [payments, rentals, extensionPayments] = await Promise.all([
        Payment.find({
            booking: { $in: bookingIds },
            paymentType: "RESERVATION_FEE",
        }).select(
            "_id status amount booking paymentMethod refund paymongo.checkoutSessionId"
        ),

        Rental.find({
            booking: { $in: bookingIds },
        })
            .select(
                "booking rentalCode vehicle lateReturn earlyReturn financial.lateCharges financial.balance financial.finalAmount financial.amountPaid status actualEndDate bookingPeriod pickup.fuelLevel return.date vehicleOutcome securityDeposit.required securityDeposit.status penaltyHistory refunds"
            )
            .populate(
                "penaltyHistory.performedBy",
                "firstName lastName email"
            )
            .lean(),

        Payment.find({
            booking: { $in: bookingIds },
            paymentType: "EXTENSION_FEE",
        })
            .sort({ createdAt: -1 })
            .select("_id status booking paymentMethod amount bookingReschedule bookingVehicleChange"),
    ]);

    const [owedRefunds, extensionRefunds, reviewedRentalIds] = await Promise.all([
        ManualRefund.find({ booking: { $in: bookingIds } })
            .select(OWED_REFUND_FIELDS)
            .lean(),

        Payment.find({
            booking: { $in: bookingIds },
            paymentType: PAYMENT_TYPE.EXTENSION_FEE,
            refund: { $ne: null },
        })
            .select(EXTENSION_REFUND_FIELDS)
            .lean(),

        Review.distinct("rental", {
            rental: { $in: rentals.map((rental) => rental._id) },
        }),
    ]);

    const reviewedRentals = new Set(reviewedRentalIds.map(String));

    const groupByBooking = (items) => {
        const groups = new Map();

        for (const item of items) {
            const key = String(item.booking);

            groups.set(key, [...(groups.get(key) ?? []), item]);
        }

        return groups;
    };

    const owedRefundsByBookingId = groupByBooking(owedRefunds);
    const extensionRefundsByBookingId =
        groupByBooking(extensionRefunds);

    const paymentByBookingId = new Map();

    for (const payment of payments) {
        const key = payment.booking.toString();

        if (!paymentByBookingId.has(key)) {
            paymentByBookingId.set(key, payment);
        }
    }

    const rentalByBookingId = new Map();

    for (const rental of rentals) {
        const key = rental.booking.toString();

        if (!rentalByBookingId.has(key)) {
            rentalByBookingId.set(key, rental);
        }
    }

    /*
     * Sorted newest-first, so the first one seen per booking is its most
     * recent extension-fee payment - same "first wins" pattern as the
     * reservation-fee map above.
     */
    const extensionPaymentByBookingId = new Map();

    for (const extensionPayment of extensionPayments) {
        const key = extensionPayment.booking.toString();

        if (!extensionPaymentByBookingId.has(key)) {
            extensionPaymentByBookingId.set(
                key,
                extensionPayment
            );
        }
    }

    const populated = await Promise.all(
        bookings.map((booking) =>
            populateBooking(booking, {
                prefetched: true,
                payment: paymentByBookingId.get(
                    booking._id.toString()
                ),
                rental: rentalByBookingId.get(
                    booking._id.toString()
                ),
                extensionPayment:
                    extensionPaymentByBookingId.get(
                        booking._id.toString()
                    ),
                owedRefunds:
                    owedRefundsByBookingId.get(
                        booking._id.toString()
                    ) ?? [],
                extensionRefunds:
                    extensionRefundsByBookingId.get(
                        booking._id.toString()
                    ) ?? [],
                hasReview: reviewedRentals.has(
                    String(
                        rentalByBookingId.get(booking._id.toString())
                            ?._id
                    )
                ),
            })
        )
    );

    if (currentUserRole === "operator") {
        const earnings = await getOperatorEarningsByBooking(
            currentUserId,
            bookingIds
        );

        return populated.map((booking) =>
            toOperatorBookingView(
                booking,
                earnings.get(String(booking._id)) ?? null
            )
        );
    }

    return populated;
};

const getBookingById = async (
    bookingId,
    currentUserId,
    currentUserRole
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    if (
        currentUserRole ===
            "customer" &&
        booking.customer.toString() !==
            currentUserId.toString()
    ) {
        throw createError(
            "You are not authorized to access this booking.",
            403
        );
    }

    if (currentUserRole === "operator") {
        const vehicle = await Vehicle.findById(
            booking.vehicle
        )
            .select("operator")
            .lean();

        if (
            !vehicle ||
            String(vehicle.operator) !==
                String(currentUserId)
        ) {
            throw createError(
                "You are not authorized to access this booking.",
                403
            );
        }
    }

    const fullBooking = await populateBooking(booking);

    if (currentUserRole === "operator") {
        const earnings = await getOperatorEarningsByBooking(
            currentUserId,
            [fullBooking._id]
        );

        return toOperatorBookingView(
            fullBooking,
            earnings.get(String(fullBooking._id)) ?? null
        );
    }

    return fullBooking;
};

/*
 * Keeps an unpaid reservation payment in step with a repriced booking.
 *
 * - A pay-in-full payment (sized to the old total) stays pay-in-full.
 * - A customer-cancelled attempt is resized too: "pay again" reopens this same
 *   payment, and a stale amount would later fail the approval amount check.
 * - A PayMongo checkout already opened for the old amount is closed first —
 *   left open, the customer could still pay the old figure on it. If closing
 *   shows it was paid meanwhile, the edit is refused.
 *
 * Throws (409) before anything is saved when the booking can't be repriced.
 */
const syncReservationPaymentAmount = async (
    booking,
    {
        previousTotalAmount,
        previousUpfrontAmount,
        pricing,
        updatedBy,
        session = null,
        prepareOnly = false,
    }
) => {
    let payment = await Payment.findOne({
        booking: booking._id,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
    }).session(session);

    if (!payment) {
        const amount = roundMoney(getUpfrontFees({ pricing, voucher: booking.voucher }).total);
        if (!prepareOnly && amount > 0) {
            await Payment.create([{
                booking: booking._id, rental: null, customer: booking.customer,
                paymentType: PAYMENT_TYPE.RESERVATION_FEE,
                paymentMethod: PAYMENT_METHOD.GCASH,
                amount, status: PAYMENT_STATUS.PENDING,
                audit: { createdBy: updatedBy || null, updatedBy: updatedBy || null },
            }], { session });
        }
        return;
    }

    const alreadyPaid = () =>
        createError(
            "This booking's reservation fee has already been paid, so it can no longer be edited. Cancel it and book again, or request a reschedule.",
            409
        );

    if (payment.status === PAYMENT_STATUS.VERIFIED) {
        throw alreadyPaid();
    }

    if (
        ![
            PAYMENT_STATUS.PENDING,
            PAYMENT_STATUS.CANCELLED,
        ].includes(payment.status)
    ) {
        return;
    }

    const currentAmount = Number(payment.amount);

    const paysInFull =
        previousTotalAmount !== previousUpfrontAmount &&
        currentAmount === previousTotalAmount;

    const nextAmount = roundMoney(
        paysInFull
            ? pricing.totalAmount
            : getUpfrontFees({ pricing, voucher: booking.voucher }).total
    );

    if (nextAmount === currentAmount) {
        return;
    }

    const hasCheckout = Boolean(payment.paymongo?.checkoutSessionId);
    const hasOpenCheckout =
        hasCheckout &&
        !payment.paymongo?.checkoutExpiredAt;

    if (hasOpenCheckout) {
        if (session) {
            throw createError("A payment attempt was opened during this edit. Please try again.", 409);
        }
        await closeCheckoutSession(payment);

        payment = await Payment.findById(payment._id);

        if (payment.status === PAYMENT_STATUS.VERIFIED) {
            throw alreadyPaid();
        }

        if (!payment.paymongo?.checkoutExpiredAt) {
            throw createError(
                "A payment for this booking is still being processed. Please wait a few minutes before changing it.",
                409
            );
        }
    }

    // Closing an external checkout must happen before the retryable database
    // transaction. Resize the payment only when the booking can also be saved.
    if (prepareOnly) return;

    const resized = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            status: {
                $in: [
                    PAYMENT_STATUS.PENDING,
                    PAYMENT_STATUS.CANCELLED,
                ],
            },
        },
        {
            $set: {
                amount: nextAmount,
                ...(nextAmount <= 0 ? { status: PAYMENT_STATUS.CANCELLED } : {}),
                "audit.updatedBy": updatedBy || null,
                ...(hasCheckout
                    ? { "paymongo.checkoutExpiredAt": null }
                    : {}),
            },
            // The closed checkout was for the old amount; a new one is
            // created when the customer pays. Unset, not "": the session-id
            // index is unique.
            ...(hasCheckout
                ? {
                      $unset: {
                          "paymongo.checkoutSessionId": "",
                      },
                  }
                : {}),
        },
        { new: true, session }
    );

    if (!resized) {
        throw alreadyPaid();
    }
};

const updateBooking = async (
    bookingId,
    updateData,
    currentUserId
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    const originalUpdatedAt = booking.updatedAt;
    const originalVehicleId = booking.vehicle;
    const originalDriverId = booking.driver;

    if (
        booking.customer.toString() !==
        currentUserId.toString()
    ) {
        throw createError(
            "You are not authorized to update this booking.",
            403
        );
    }

    if (
        booking.status !==
        BOOKING_STATUS.PENDING
    ) {
        throw createError(
            "Only pending bookings can be updated.",
            400
        );
    }

    // What the reservation payment was sized from, before repricing below.
    const previousTotalAmount = Number(
        booking.pricing?.totalAmount || 0
    );
    const previousUpfrontAmount =
        getUpfrontFees(booking).total;

    const nextVehicleId =
        updateData.vehicle ??
        booking.vehicle;

    const nextStartDate =
        updateData.startDate ??
        booking.startDate;

    const nextEndDate =
        updateData.endDate ??
        booking.endDate;

    const nextDriverOption =
        updateData.driverOption ??
        booking.driverOption;

    let nextDriverId;

    if (
        nextDriverOption ===
        BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER
    ) {
        if (
            updateData.driver !==
                undefined &&
            updateData.driver
        ) {
            throw createError(
                "Driver must not be provided when booking without a driver.",
                400
            );
        }

        nextDriverId = null;
    } else {
        nextDriverId =
            updateData.driver !==
            undefined
                ? updateData.driver
                : booking.driver;
    }

    const vehicle =
        await Vehicle.findById(
            nextVehicleId
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    validateVehicleBookingEligibility(
        vehicle
    );

    const {
        start,
        end,
    } = validateBookingDateRange(
        nextStartDate,
        nextEndDate
    );

    const datesChanged =
        start.getTime() !== new Date(booking.startDate).getTime() ||
        end.getTime() !== new Date(booking.endDate).getTime();

    // Only when the dates are being changed: an untouched booking may carry
    // an already-passed pickup time. New dates get the same rules as a new
    // booking, including the minimum lead time.

    /*
     * The same customer rules as createBooking — otherwise a booking made
     * "with driver" (or for another vehicle) could be edited into a self-drive
     * booking the customer's license doesn't allow.
     */
    const settings =
        await getBookingLocationPolicy();

    if (datesChanged) {
        const bookingHours = settings.bookingSettings?.bookingHours ?? null;
        validatePickupSchedule(start, end, {
            requireFuture: true,
            bookingHours,
            pickupHours: settings.bookingSettings?.pickupHours ?? null,
            earliestPickupMs: getEarliestPickupMs(Date.now(), bookingHours),
        });
    }

    const asksForDriverAnew =
        nextDriverOption ===
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
        (booking.driverOption !==
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER ||
            String(nextVehicleId) !== String(booking.vehicle));

    if (asksForDriverAnew) {
        ensureDriverOptionOffered(nextDriverOption, vehicle, settings);
    }

    const licenseRulesApply =
        nextDriverOption ===
            BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER &&
        settings.customerBookingSettings
            ?.licenseRestrictionEnabled !== false;

    await ensureCustomerLicenseNotExpired(
        currentUserId,
        { validThrough: licenseRulesApply ? end : null }
    );

    if (licenseRulesApply) {
        await ensureCustomerHasDriversLicenseForSelfDrive(
            currentUserId
        );
        await ensureCustomerCanDriveVehicle(
            currentUserId,
            vehicle
        );
    }

    await validateVehicleDateAvailability(
        vehicle,
        start,
        end
    );

    await ensureNoBookingConflict(
        vehicle._id,
        start,
        end,
        booking._id
    );

    if (datesChanged) {
        await ensureCustomerBookingLimitNotExceeded(
            currentUserId,
            start,
            end,
            settings.customerBookingSettings
                ?.maxConcurrentBookings,
            booking._id
        );
    }

    const adminAssignsDriver = isAdminDriverAssignment(settings);

    if (adminAssignsDriver) {
        nextDriverId = null;
    }

    await validateDriverSelection(
        nextDriverOption,
        nextDriverId,
        {
            allowUnassigned: adminAssignsDriver,
            validThrough: end,
        }
    );

    if (
        nextDriverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        await ensureNoDriverBookingConflict(
            nextDriverId,
            start,
            end,
            booking._id
        );
    }

    /*
     * A present updateData.pickupLocation is the customer's full new choice
     * for that side (its serviceLocationId may be legitimately null for a
     * custom location) - only fall back to the booking's existing location
     * when that side wasn't touched by this update at all.
     */
    const nextPickupLocation =
        updateData.pickupLocation ??
        booking.pickupLocation;

    const nextReturnLocation =
        updateData.returnLocation ??
        booking.returnLocation;

    const nextPickupServiceLocationId =
        updateData.pickupLocation
            ? updateData.pickupLocation
                  .serviceLocationId
            : booking.pickupLocation
                  ?.serviceLocationId?.toString();

    const nextReturnServiceLocationId =
        updateData.returnLocation
            ? updateData.returnLocation
                  .serviceLocationId
            : booking.returnLocation
                  ?.serviceLocationId?.toString();

    const pickupServiceLocation =
        await validateServiceLocation(
            nextPickupServiceLocationId
        );

    const returnServiceLocation =
        await validateServiceLocation(
            nextReturnServiceLocationId
        );

    await validateLocationPolicy(
        nextPickupServiceLocationId,
        nextReturnServiceLocationId
    );

    ensureCustomLocationHasCoordinates(
        pickupServiceLocation,
        nextPickupLocation,
        "pickup"
    );

    ensureCustomLocationHasCoordinates(
        returnServiceLocation,
        nextReturnLocation,
        "return"
    );

    // Today's discounts, or the one the booking was made with if better
    // (only while it stays on the same vehicle).
    const vehicleRate =
        await resolveVehicleRateNow(vehicle, {
            lockedDiscount:
                String(vehicle._id) ===
                String(booking.vehicle)
                    ? booking.pricing?.vehicleDiscount
                    : null,
        });

    let pricing = applyVehicleDiscountToPricing(
        calculatePricing(
            vehicleRate.dailyRate,
            vehicle.pricing.reservationFee,
            start,
            end
        ),
        vehicleRate
    );

    const distanceFees =
        await resolveBookingLocationFees({
            pickupServiceLocation,
            returnServiceLocation,
            pickupLocation:
                nextPickupLocation,
            returnLocation:
                nextReturnLocation,
            driverOption: nextDriverOption,
            enableDistanceFeeCalculation:
                settings?.enableDistanceFeeCalculation,
        });

    const totalAmount =
        pricing.subtotal +
        pricing.reservationFee +
        distanceFees.pickupDistanceFee +
        distanceFees.returnDistanceFee;

    pricing.pickupDistanceKm =
        distanceFees.pickupDistanceKm;
    pricing.returnDistanceKm =
        distanceFees.returnDistanceKm;
    pricing.pickupDistanceFee =
        distanceFees.pickupDistanceFee;
    pricing.returnDistanceFee =
        distanceFees.returnDistanceFee;
    pricing.totalAmount = totalAmount;

    // An admin edit re-prices the whole booking, the driver included (at
    // the driver chosen now and today's rates, like the vehicle).
    applyDriverFee(
        pricing,
        await resolveDriverDailyRate({
            driverOption: nextDriverOption,
            driverId:
                nextDriverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER
                    ? nextDriverId
                    : null,
            settings,
        })
    );

    booking.vehicle =
        vehicle._id;

    booking.driverOption =
        nextDriverOption;

    booking.driver =
        nextDriverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
            ? nextDriverId
            : null;

    booking.startDate =
        start;

    booking.endDate =
        end;

    /*
     * Re-price any voucher that was applied at creation against the new
     * pricing so `pricing.totalAmount` and the stored voucher discount stay
     * consistent. If the voucher can no longer be resolved, drop it.
     */
    if (booking.voucher?.voucher) {
        try {
            const appliedVoucher =
                await Voucher.findById(
                    booking.voucher.voucher
                );

            if (appliedVoucher) {
                pricing =
                    calculatePricingWithVoucher(
                        pricing,
                        appliedVoucher,
                        booking.customer
                    );

                const discountAmount =
                    pricing.voucher?.discount
                        ? Object.entries(
                              pricing.voucher.discount
                          )
                              .filter(([key]) =>
                                  key.endsWith(
                                      "Discount"
                                  )
                              )
                              .reduce(
                                  (sum, [, val]) =>
                                      sum +
                                      (Number(val) || 0),
                                  0
                              )
                        : 0;

                booking.voucher.discountAmount =
                    discountAmount;
            } else {
                booking.voucher = null;
            }
        } catch (voucherError) {
            console.error(
                "Failed to re-apply voucher on booking update:",
                voucherError.message
            );

            booking.voucher = null;
        }
    }

    booking.pricing =
        pricing;

    booking.pickupLocation =
        buildBookingLocation(
            pickupServiceLocation,
            nextPickupLocation,
            distanceFees.pickupDistanceFee
        );

    booking.returnLocation =
        buildBookingLocation(
            returnServiceLocation,
            nextReturnLocation,
            distanceFees.returnDistanceFee
        );

    if (
        updateData.customerNotes !==
        undefined
    ) {
        booking.customerNotes =
            updateData.customerNotes;
    }

    booking.audit.updatedBy =
        currentUserId || null;

    await syncReservationPaymentAmount(booking, {
        previousTotalAmount,
        previousUpfrontAmount,
        pricing,
        updatedBy: currentUserId,
        prepareOnly: true,
    });

    const saved = await withBookingCreationTransaction(
        [
            `booking:${booking._id}`,
            `customer:${currentUserId}`,
            `vehicle:${originalVehicleId}`,
            `vehicle:${vehicle._id}`,
            ...[originalDriverId, booking.driver].filter(Boolean).map((id) => `driver:${id}`),
        ],
        async (session) => {
            const fresh = await Booking.findById(booking._id).session(session);
            if (!fresh || fresh.status !== BOOKING_STATUS.PENDING ||
                fresh.updatedAt?.getTime() !== originalUpdatedAt?.getTime()) {
                throw createError("This booking was updated by another request. Please reload and try again.", 409);
            }
            await ensureNoBookingConflict(vehicle._id, start, end, booking._id, { session });
            await ensureNoDriverBookingConflict(booking.driver, start, end, booking._id, { session });
            await ensureCustomerBookingLimitNotExceeded(
                currentUserId, start, end,
                settings.customerBookingSettings?.maxConcurrentBookings,
                booking._id, { session }
            );
            await syncReservationPaymentAmount(booking, {
                previousTotalAmount, previousUpfrontAmount, pricing,
                updatedBy: currentUserId, session,
            });
            const fields = booking.toObject();
            delete fields._id;
            delete fields.createdAt;
            delete fields.updatedAt;
            const updated = await Booking.findOneAndUpdate(
                { _id: booking._id, status: BOOKING_STATUS.PENDING, updatedAt: originalUpdatedAt },
                { $set: fields },
                { new: true, session, runValidators: true }
            );
            if (!updated) {
                throw createError("This booking was updated by another request. Please reload and try again.", 409);
            }
            return updated;
        }
    );

    return populateBooking(
        saved
    );
};

/*
 * Fetches and validates the reservation-fee Payment for a booking that has
 * one due (fee + pickup distance fee > 0): the fee amounts must be sane, the
 * payment must exist, and its amount must match what the booking expects.
 * Returns null when no reservation payment is required. Does NOT check
 * verification status — see the two callers below, which decide when that's
 * required.
 */
const getBookingReservationPayment = async (
    booking,
    context,
    { session = null } = {}
) => {
    const reservationFee = Number(
        booking.pricing?.reservationFee || 0
    );

    const pickupDistanceFee = Number(
        booking.pricing?.pickupDistanceFee || 0
    );

    if (
        !Number.isFinite(reservationFee) ||
        reservationFee < 0
    ) {
        throw createError(
            "Invalid booking reservation fee.",
            400
        );
    }

    if (
        !Number.isFinite(pickupDistanceFee) ||
        pickupDistanceFee < 0
    ) {
        throw createError(
            "Invalid pickup distance fee.",
            400
        );
    }

    // A reservation-fee or pickup-fee voucher lowers what's due up front.
    const totalInitial =
        getUpfrontFees(booking).total;

    if (totalInitial === 0) {
        return null;
    }

    const payment =
        await Payment.findOne({
            booking: booking._id,
            paymentType:
                PAYMENT_TYPE.RESERVATION_FEE,
        })
            .select(
                "paymentMethod amount status"
            )
            .session(session)
            .lean();

    if (!payment) {
        throw createError(
            `The reservation fee must be paid before the booking can be ${context}.`,
            400
        );
    }

    const totalAmount = Number(
        booking.pricing?.totalAmount || 0
    );

    const actualAmount = Number(
        payment.amount
    );

    /*
     * The fees after the voucher, the full total (paid in full) — or the
     * gross fees, which is what a reservation payment made before vouchers
     * applied up front was charged. A booking paid in full and then
     * rescheduled or moved to another vehicle was paid its total from
     * before that change (the difference is settled separately), so those
     * earlier totals count too.
     */
    const acceptedAmounts = [
        totalInitial,
        totalAmount,
        getGrossUpfrontAmount(booking),
        ...getApprovedReschedules(booking).map(
            (reschedule) => reschedule.pricing?.previousTotalAmount
        ),
        ...(booking.vehicleChanges || []).map(
            (change) => change.previousTotalAmount
        ),
    ]
        .filter((amount) => Number(amount) > 0)
        .map(roundMoney);

    if (
        !acceptedAmounts.includes(
            roundMoney(actualAmount)
        )
    ) {
        throw createError(
            "The payment amount does not match the expected booking payment amount.",
            400
        );
    }

    return payment;
};

/*
 * Approval gate: GCash must already be verified before a booking can be
 * approved. Cash on Pickup is allowed to approve unverified — the customer
 * pays at the counter, and `ensurePickupPaymentVerified` below is the actual
 * gate that keeps the vehicle from being released before that's settled.
 */
const validateBookingReservationPayment = async (
    booking,
    options = {}
) => {
    const payment =
        await getBookingReservationPayment(
            booking,
            "approved",
            options
        );

    if (!payment) {
        return null;
    }

    if (
        payment.paymentMethod ===
        PAYMENT_METHOD.CASH_ON_PICKUP
    ) {
        return payment;
    }

    if (
        payment.status !==
        PAYMENT_STATUS.VERIFIED
    ) {
        throw createError(
            "The reservation fee payment must be verified before the booking can be approved.",
            400
        );
    }

    return payment;
};

/*
 * Pickup gate: regardless of payment method, the reservation fee must be
 * verified before the vehicle is released. For GCash this is already true
 * by approval time (redundant but harmless); for Cash on Pickup this is the
 * point where it's actually enforced.
 */
const ensurePickupPaymentVerified = async (
    booking
) => {
    const payment =
        await getBookingReservationPayment(
            booking,
            "picked up"
        );

    if (!payment) {
        return null;
    }

    if (
        payment.status !==
        PAYMENT_STATUS.VERIFIED
    ) {
        throw createError(
            "The reservation fee payment must be verified before the vehicle can be picked up.",
            400
        );
    }

    return payment;
};

const approveBooking = async (
    bookingId,
    approvedBy,
    driverAssignment = null
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    if (
        ![
            BOOKING_STATUS.PENDING,
            BOOKING_STATUS.PAYMENT_RECEIVED,
        ].includes(booking.status)
    ) {
        throw createError(
            "Only pending or paid bookings can be approved.",
            400
        );
    }

    /*
     * A booking whose rental period is already over can never be picked up.
     * Approving it would only turn it into a no-show at the end of the day
     * and keep the customer's fee; expiring or rejecting it refunds them.
     */
    if (new Date() >= new Date(booking.endDate)) {
        throw createError(
            "This booking's rental period has already ended, so it can't be approved. Expire or reject it instead — the customer is refunded in full.",
            400
        );
    }

    const vehicle =
        await Vehicle.findById(
            booking.vehicle
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    validateVehicleBookingEligibility(
        vehicle
    );

    await validateVehicleDateAvailability(
        vehicle,
        booking.startDate,
        booking.endDate
    );

    await ensureNoBookingConflict(
        vehicle._id,
        booking.startDate,
        booking.endDate,
        booking._id
    );

    const settings = await Settings.findOne().lean();
    const requireAdminDriverAssignment = 
        settings?.driverAssignmentSettings?.requireAdminDriverAssignment ?? false;

    let driverToValidate = booking.driver;

    if (
        booking.driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        // The admin's pick applies while admins assign drivers, and to any
        // booking still without one (e.g. made while that setting was on).
        if (
            driverAssignment &&
            (requireAdminDriverAssignment || !booking.driver)
        ) {
            driverToValidate = driverAssignment;
            booking.driver = driverAssignment;
        }

        if (!driverToValidate) {
            throw createError(
                "A driver must be assigned before approving this booking. Please select a driver.",
                400
            );
        }

        // The driver may have been deactivated or put on leave since the
        // customer chose them (or the admin picked an ineligible one).
        await validateDriverSelection(
            booking.driverOption,
            driverToValidate,
            { validThrough: booking.endDate }
        );

        await ensureNoDriverBookingConflict(
            driverToValidate,
            booking.startDate,
            booking.endDate,
            booking._id
        );
    } else {
        if (driverToValidate) {
            booking.driver = null;
        }
    }

    await validateBookingReservationPayment(
        booking
    );

    /*
     * Atomic conditional transition, like reject/cancel/expire. Booking has
     * no versionKey, so a save() here would overwrite a cancel, rejection or
     * payment-window release that landed after the booking was read — putting
     * an already-refunded booking back to Approved.
     */
    const approved = await withBookingCreationTransaction(
        [
            `booking:${booking._id}`,
            `customer:${booking.customer}`,
            `vehicle:${booking.vehicle}`,
            ...(booking.driver ? [`driver:${booking.driver}`] : []),
        ],
        async (session) => {
            const fresh = await Booking.findById(booking._id).session(session);
            if (!fresh || ![BOOKING_STATUS.PENDING, BOOKING_STATUS.PAYMENT_RECEIVED].includes(fresh.status) ||
                fresh.updatedAt?.getTime() !== booking.updatedAt?.getTime()) {
                throw createError("This booking was updated by another request. Please reload and try again.", 409);
            }
            await ensureNoBookingConflict(booking.vehicle, booking.startDate, booking.endDate, booking._id, { session });
            await ensureNoDriverBookingConflict(booking.driver, booking.startDate, booking.endDate, booking._id, { session });
            await validateBookingReservationPayment(booking, { session });
            return Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    updatedAt: booking.updatedAt,
                    status: {
                        $in: [
                            BOOKING_STATUS.PENDING,
                            BOOKING_STATUS.PAYMENT_RECEIVED,
                        ],
                    },
                },
                {
                    $set: {
                        status: BOOKING_STATUS.APPROVED,
                        driver: booking.driver ?? null,
                        "audit.updatedBy": approvedBy,
                    },
                    $push: {
                        statusHistory: {
                            status: BOOKING_STATUS.APPROVED,
                            changedBy: approvedBy,
                            reason: "Booking approved by admin",
                        },
                    },
                },
                {
                    new: true,
                    session,
                }
            );

        }
    );

    if (!approved) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    // Only an idle vehicle becomes Reserved; one out on a rental (or mid
    // pickup) keeps that status until it's back — see completeRental.
    await Vehicle.updateOne(
        {
            _id: vehicle._id,
            status: VEHICLE_STATUS.AVAILABLE,
        },
        {
            $set: {
                status: VEHICLE_STATUS.RESERVED,
            },
        }
    );

    let customerNotifiedOfApproval = false;
    let assignedDriver = null;

    if (
        booking.driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
        booking.customer
    ) {
        const driver = await Driver.findById(booking.driver).lean();
        if (driver) {
            assignedDriver = driver;

            const driverName = [driver.firstName, driver.lastName].filter(Boolean).join(" ");
            const driverPhone = driver.phoneNumber || driver.contactNumber || "Not provided";

            await notifyUser(booking.customer, {
                type: "booking",
                title: "Driver Assigned to Your Booking",
                message: `Your booking has been approved. Your assigned driver is ${driverName}. Contact number: ${driverPhone}.`,
                variant: "success",
                category: "Booking",
                metadata: {
                    relatedId: booking._id,
                    relatedModel: "Booking",
                    driverId: driver._id,
                    driverName: driverName,
                    driverPhone: driverPhone,
                },
            });

            customerNotifiedOfApproval = true;
        }
    }

    if (!customerNotifiedOfApproval) {
        await notifyBookingCustomer(booking, {
            type: "booking",
            title: "Booking Approved",
            message: `Your booking ${booking.bookingCode} for the ${vehicle.brand} ${vehicle.model} was approved for ${formatBookingWindow(booking.startDate, booking.endDate)}. Please settle any remaining payment to confirm your reservation.`,
            variant: "success",
        });
    }

    await notifyVehicleOperator(vehicle.operator, booking, {
        type: "booking",
        title: "Booking Approved on Your Vehicle",
        message: `Booking ${booking.bookingCode} for your ${vehicle.brand} ${vehicle.model} was approved. The vehicle is reserved for ${formatBookingWindow(booking.startDate, booking.endDate)}.`,
        variant: "success",
    });

    const customer = await User.findById(booking.customer)
        .select("firstName lastName email")
        .lean();

    await sendBookingApprovedEmail(
        booking,
        vehicle,
        customer,
        assignedDriver
    );

    return populateBooking(
        approved
    );
};

const rejectBooking = async (
    bookingId,
    rejectedBy,
    reason = ""
) => {
    const existingBooking =
        await findBookingById(
            bookingId
        );

    const eligibleStatuses = [
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.PAYMENT_RECEIVED,
    ];

    if (
        !eligibleStatuses.includes(
            existingBooking.status
        )
    ) {
        throw createError(
            "Only pending or paid bookings can be rejected.",
            400
        );
    }

    /*
     * Atomic conditional transition: two concurrent reject/cancel/expire
     * requests for the same booking must not both pass the status check
     * above and then both trigger a refund. Only the request that actually
     * flips the status here proceeds; the other gets null back.
     */
    const booking =
        await Booking.findOneAndUpdate(
            {
                _id: existingBooking._id,
                status: {
                    $in: eligibleStatuses,
                },
            },
            {
                $set: {
                    status: BOOKING_STATUS.REJECTED,
                    "audit.updatedBy":
                        rejectedBy,
                },
                $push: {
                    statusHistory: {
                        status: BOOKING_STATUS.REJECTED,
                        changedBy: rejectedBy,
                        reason:
                            reason ||
                            "Booking rejected by admin",
                    },
                },
            },
            {
                new: true,
            }
        );

    if (!booking) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    // Not if they're out driving another rental.
    await releaseDriverIfIdle(booking.driver);

    await refreshVehicleReservationStatus(
        booking.vehicle
    );

    await closePendingReschedules(
        booking,
        rejectedBy,
        "The booking was rejected."
    );

    // Nothing this booking still owes may stay payable: cancel any pending
    // payment and close its checkout before anything else.
    await cancelPendingBookingPayments(
        booking._id,
        rejectedBy
    );

    // Rejection is never the customer's fault: refund everything they paid
    // (the full rental total for a pay-in-full booking, not just the
    // reservation fee).
    const refundedPayment =
        await refundPrePickupBooking(
            booking,
            {
                amount:
                    await getVerifiedPrePickupPaymentAmount(
                        booking._id
                    ),
                reason: PAYMENT_REFUND_REASON.OTHERS,
                notes: "Automatic refund on booking rejection.",
            },
            rejectedBy
        );

    const refundedExtensions =
        await refundPrePickupExtensionFees(
            booking,
            {
                notes: "Automatic refund of extension fee on booking rejection.",
            },
            rejectedBy
        );

    const returnedVoucher =
        await releaseBookingVoucher(booking);

    await notifyBookingCustomer(booking, {
        type: "booking",
        title: "Booking Rejected",
        message: `Your booking ${booking.bookingCode} was rejected.${
            reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""
        }${
            refundedPayment
                ? ` A refund of ${formatAmount(
                      refundedPayment.refund.amount
                  )} has been initiated.`
                : ""
        }${extensionRefundNote(refundedExtensions)}${voucherReturnedNote(returnedVoucher)}`,
        variant: "rejected",
        email: statementEmail(booking),
    });

    return populateBooking(
        booking
    );
};

/*
 * `options.waiveFees` refunds everything paid, whoever cancels and however
 * close to pickup — the platform's fault (e.g. the vehicle went under
 * maintenance over the booking). A booking with an unresolved maintenance
 * conflict always cancels this way. `options.customerMessage` replaces the
 * customer's notice (the refund details are appended); `options.resolvedByRole`
 * records who closed the conflict ("customer", "admin" or "system").
 */
const cancelBooking = async (
    bookingId,
    cancelledBy,
    reason = "",
    cancelledByRole = "customer",
    {
        waiveFees: waiveFeesOption = false,
        customerMessage = null,
        resolvedByRole = null,
    } = {}
) => {
    const existingBooking =
        await findBookingById(
            bookingId
        );

    if (
        cancelledByRole !== "admin" &&
        existingBooking.customer.toString() !==
        cancelledBy.toString()
    ) {
        throw createError(
            "You are not authorized to cancel this booking.",
            403
        );
    }

    const hasMaintenanceConflict =
        BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
            existingBooking.maintenanceConflict?.status
        );

    const waiveFees = waiveFeesOption || hasMaintenanceConflict;

    // Who the refund rules treat as cancelling: waived fees refund in full.
    const policyRole = waiveFees ? "admin" : cancelledByRole;

    /*
     * Admins are exempt — they act on the platform's behalf and may cancel
     * without an explanation. Customers must give one when this setting is
     * on (it defaults to true; there's an admin toggle for it).
     */
    if (policyRole !== "admin") {
        const cancellationSettings =
            await Settings.findOne()
                .select(
                    "refundSettings.requireCancellationReason"
                )
                .lean();

        const requireReason =
            cancellationSettings?.refundSettings
                ?.requireCancellationReason ?? true;

        if (
            requireReason &&
            !reason?.trim()
        ) {
            throw createError(
                "A cancellation reason is required.",
                400
            );
        }
    }

    const terminalStatuses = [
        ...BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
        BOOKING_STATUS.COMPLETED,
    ];

    if (
        terminalStatuses.includes(
            existingBooking.status
        )
    ) {
        throw createError(
            "This booking has already ended.",
            400
        );
    }

    const ongoingRental = await Rental.findOne({
        booking: existingBooking._id,
        status: RENTAL_STATUS.ONGOING,
    })
        .select("rentalCode")
        .lean();

    if (ongoingRental) {
        throw createError(
            `This booking has an active rental (${ongoingRental.rentalCode}). The rental must be returned and completed before the booking can be cancelled.`,
            409
        );
    }

    /*
     * Once the start date arrives a customer can no longer cancel an approved
     * booking — not picking it up makes it a no-show instead. A booking
     * approved later than that (e.g. a same-day booking) keeps a cancel
     * window until the no-show grace after approval has run (see
     * getCustomerCancelCutoff); the policy still decides the fee. An admin can
     * always cancel (full refund): it's the way to close out a booking that
     * fell through on the platform's side, now that approved bookings no
     * longer expire. It still hasn't been picked up — an ongoing rental is
     * refused above.
     */
    if (
        policyRole !== "admin" &&
        existingBooking.status ===
            BOOKING_STATUS.APPROVED
    ) {
        const cutoffSettings = await Settings.findOne()
            .select("refundSettings")
            .lean();

        // The longer of the booking's locked no-show grace and today's.
        const cutoff = getCustomerCancelCutoff(
            existingBooking.startDate,
            getBookingNoShowTiming(
                existingBooking,
                resolveRefundSettings(cutoffSettings?.refundSettings)
            ).graceHours,
            getBookingApprovedAt(existingBooking)
        );

        if (!cutoff || new Date() >= cutoff) {
            throw createError(
                "An approved booking cannot be cancelled after the rental period has started. If you can't pick it up, please contact us — a booking that isn't picked up is marked as a no-show.",
                400
            );
        }
    }

    /*
     * Atomic conditional transition: two concurrent reject/cancel/expire
     * requests for the same booking must not both pass the status check
     * above and then both trigger a refund. Only the request that actually
     * flips the status here proceeds; the other gets null back.
     *
     * Only statuses from before pickup qualify — so a pickup that completes
     * between the "no running rental" check above and this update (the
     * booking is then Ongoing) wins, instead of the booking being cancelled
     * and fully refunded while the vehicle is out.
     *
     * And only the exact status read above: the refund below is priced from
     * it (before approval refunds the whole fee; after, the policy tiers
     * apply), and so is the customer's cancel cutoff. An approval landing in
     * between would otherwise be cancelled at the before-approval rate.
     */
    const booking =
        await Booking.findOneAndUpdate(
            {
                _id: existingBooking._id,
                status: {
                    $in: [
                        BOOKING_STATUS.PENDING,
                        BOOKING_STATUS.PAYMENT_RECEIVED,
                        BOOKING_STATUS.APPROVED,
                    ].filter(
                        (status) =>
                            status === existingBooking.status
                    ),
                },
            },
            {
                $set: {
                    status: BOOKING_STATUS.CANCELLED,
                    "audit.updatedBy":
                        cancelledBy,
                },
                $push: {
                    statusHistory: {
                        status: BOOKING_STATUS.CANCELLED,
                        changedBy: cancelledBy,
                        reason:
                            reason ||
                            `Booking cancelled by ${cancelledByRole}`,
                    },
                },
            },
            {
                new: true,
            }
        );

    if (!booking) {
        throw createError(
            "This booking changed while you were cancelling it (for example, it was just approved or paid). Please refresh to see the updated refund, then try again.",
            409
        );
    }

    // Not if they're out driving another rental.
    await releaseDriverIfIdle(booking.driver);

    await refreshVehicleReservationStatus(
        booking.vehicle
    );

    await closePendingExtensions(
        booking,
        cancelledBy,
        "The booking was cancelled."
    );

    // Nothing this booking still owes may stay payable: cancel any pending
    // payment and close its checkout before anything else, so the customer
    // can't finish a checkout they left open and be charged for nothing.
    await cancelPendingBookingPayments(
        booking._id,
        cancelledBy
    );

    /*
     * Refund. `Booking` has no `rental` link, so the rental (if any) is
     * resolved by query. Once a Rental exists this is the only way to reach
     * cancelBooking at all is with a COMPLETED rental (an ONGOING one is
     * blocked above, and a COMPLETED one puts the booking itself in the
     * terminal-status block above) — kept as a defensive fallback. The
     * common case is the pre-pickup one in the `else` branch.
     */
    const existingRental = await Rental.findOne({
        booking: booking._id,
    });

    const refundSettings =
        (await Settings.findOne().select("refundSettings").lean()) ||
        {};

    const autoApproveThreshold =
        Number(refundSettings?.refundSettings?.autoApproveRefundThreshold ?? 0);

    let refundedPayment = null;
    let refundedExtensions = [];
    let refundRecordedOnRental = false;
    let refundPendingApproval = false;
    let outerRefundAmount = 0;
    let outerKeptAmount = 0;
    // Which terms set the refund (lockedTermsService), for the notice.
    let outerPolicy = null;

    if (existingRental) {
        /*
         * Same figure recordRefund validates against: everything paid (the
         * online payments included), less refunds already made, less the
         * reservation fee unless an admin is cancelling. Adding up only
         * `rental.payments` missed every online payment and took the fee off
         * money it was never part of.
         */
        const waiveReservationFee = cancelledByRole === "admin";

        const refundAmount =
            await computeRefundableAmount(
                existingRental,
                RENTAL_REFUND_REASON.CANCELLATION,
                { waiveReservationFee }
            );

        outerKeptAmount = waiveReservationFee
            ? 0
            : (await computeRefundableAmount(
                  existingRental,
                  RENTAL_REFUND_REASON.CANCELLATION,
                  { waiveReservationFee: true }
              )) - refundAmount;

        const requiresApproval =
            Number.isFinite(autoApproveThreshold) &&
            autoApproveThreshold > 0 &&
            refundAmount > autoApproveThreshold;

        // A zero-value refund must not be persisted as a refund record.
        if (refundAmount > 0 && !requiresApproval) {
            await recordRefund(
                existingRental._id,
                {
                    amount: refundAmount,
                    reason: RENTAL_REFUND_REASON.CANCELLATION,
                    description: "Automatic refund on booking cancellation",
                },
                cancelledBy,
                {
                    allowCancellation: true,
                    waiveReservationFee,
                }
            );

            outerRefundAmount = refundAmount;
            refundRecordedOnRental = true;
        } else if (refundAmount > 0 && requiresApproval) {
            outerRefundAmount = refundAmount;
            refundPendingApproval = true;

            try {
                await notifyAdmins({
                    type: "Refund Requires Approval",
                    title: "Refund Requires Approval",
                    message: `Booking ${booking.bookingCode} was cancelled with a refund of ${formatAmount(refundAmount)}, which exceeds the auto-approve threshold of ${formatAmount(autoApproveThreshold)}. Please review and record the refund manually.`,
                    variant: "payment",
                    category: "Refund",
                    metadata: {
                        reference: booking.bookingCode,
                        relatedId: existingRental._id,
                        relatedModel: "Rental",
                    },
                });
            } catch (notificationError) {
                console.error(
                    "Failed to notify admins of refund pending approval:",
                    notificationError
                );
            }
        }
    } else {
        /*
         * Pre-pickup cancellation. An admin cancelling isn't the customer's
         * doing, so it's refunded in full. A customer-initiated cancel always
         * gets back everything paid on top of the reservation fee; how much of
         * the fee itself comes back is the admin-configurable cancellation
         * policy (Settings → Refunds): all of it before an admin approves,
         * then by how many hours remain until pickup, plus a short cooling-off
         * window right after approval. Reads the actual verified Payment
         * amount rather than recomputing an "expected" figure from
         * booking.pricing, since that amount can be either just the
         * reservation fee (+ pickup distance fee) or the full rental total,
         * depending on whether the customer chose to pay in full at booking
         * (see payInFull in createBooking).
         */
        const totalPaid =
            await getVerifiedPrePickupPaymentAmount(
                booking._id
            );

        if (totalPaid > 0) {
            // The better of the booking's locked policy and today's.
            const cancellation = computeBookingCancellationRefund(
                existingBooking,
                refundSettings?.refundSettings,
                {
                    startDate: getCancellationPolicyStartDate(booking),
                    approvedAt: getBookingApprovedAt(existingBooking),
                    isApproved: isBookingApproved(existingBooking),
                    totalPaid,
                    // After a reservation-fee voucher: only what was
                    // charged for the fee can be kept.
                    reservationFee: getUpfrontFees(booking).reservationFee,
                    cancelledByRole: policyRole,
                }
            );

            outerPolicy = cancellation;

            const refundAmount = cancellation.refundAmount;

            outerRefundAmount = refundAmount;
            outerKeptAmount = cancellation.keptAmount;

            const requiresApproval =
                Number.isFinite(autoApproveThreshold) &&
                autoApproveThreshold > 0 &&
                refundAmount > autoApproveThreshold;

            /*
             * When this exceeds the auto-approve threshold, forceManual skips
             * the automatic PayMongo attempt — processBookingRefund flags the
             * payment for manual review and notifies admins itself, so there's
             * no separate notification to send here.
             */
            refundedPayment = await refundPrePickupBooking(
                booking,
                {
                    amount: refundAmount,
                    reason:
                        policyRole === "admin"
                            ? PAYMENT_REFUND_REASON.OTHERS
                            : PAYMENT_REFUND_REASON.REQUESTED_BY_CUSTOMER,
                    notes: hasMaintenanceConflict || waiveFeesOption
                        ? `Full refund on booking cancellation by ${cancelledByRole}: ${
                              isLateReturnCause(existingBooking.maintenanceConflict)
                                  ? "the booking's vehicle wasn't returned in time by its previous renter."
                                  : "the booking's vehicle went under maintenance over its dates."
                          }`
                        : cancelledByRole === "admin"
                          ? "Automatic refund on booking cancellation by admin."
                          : `Automatic refund on booking cancellation by customer (${cancellation.refundPercent}% of the reservation fee refunded under ${
                                cancellation.policySource
                                    ? describePolicySource(cancellation)
                                    : "the cancellation policy"
                            }).`,
                    forceManual: requiresApproval,
                },
                cancelledBy
            );

            /*
             * Report what actually happened to the payment. Normally that is
             * exactly the policy figure above — but if the payment already
             * carried a refund (a late payment recovered a moment ago is
             * refunded in full), that refund stands and the policy's "part of
             * your fee was kept" would be untrue.
             */
            if (refundedPayment?.refund) {
                outerRefundAmount = Number(
                    refundedPayment.refund.amount
                );

                outerKeptAmount = Math.max(
                    0,
                    totalPaid - outerRefundAmount
                );
            }
        }

        /*
         * Extension fees are always refunded in full, whoever cancels and
         * however close to pickup — the cancellation policy governs the
         * reservation fee alone. Runs even when nothing else was paid.
         */
        refundedExtensions =
            await refundPrePickupExtensionFees(
                booking,
                {
                    notes: `Automatic refund of extension fee on booking cancellation by ${cancelledByRole}.`,
                    manualThreshold: autoApproveThreshold,
                },
                cancelledBy
            );
    }

    /*
     * The trip never started (no Rental), so the discount was never redeemed:
     * give the voucher back. Skipped in the defensive rental branch above,
     * where the voucher was used.
     */
    const returnedVoucher = existingRental
        ? ""
        : await releaseBookingVoucher(booking);

    // A maintenance conflict ends with the booking, refunded in full.
    if (hasMaintenanceConflict) {
        await Booking.updateOne(
            {
                _id: booking._id,
                "maintenanceConflict.status": {
                    $in: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
                },
            },
            {
                $set: {
                    "maintenanceConflict.status":
                        BOOKING_MAINTENANCE_CONFLICT_STATUS.REFUNDED,
                    "maintenanceConflict.resolvedAt": new Date(),
                    "maintenanceConflict.resolvedBy": cancelledBy || null,
                    "maintenanceConflict.resolvedByRole":
                        resolvedByRole || cancelledByRole,
                    "maintenanceConflict.resolutionNote":
                        reason ||
                        "Booking cancelled with a full refund.",
                    "maintenanceConflict.refundAmount": roundMoney(
                        outerRefundAmount +
                            refundedExtensions.reduce(
                                (sum, payment) =>
                                    sum +
                                    Number(payment?.refund?.amount || 0),
                                0
                            )
                    ),
                },
            }
        );
    }

    if (cancelledByRole !== "admin" && !hasMaintenanceConflict) {
        try {
            await notifyAdmins({
                type: "booking",
                title: "Booking Cancelled by Customer",
                message: `Booking ${booking.bookingCode} was cancelled by the customer.${reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""}`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of booking cancellation:",
                notificationError
            );
        }
    }

    const cancelledVehicle = await Vehicle.findById(booking.vehicle)
        .select("operator brand model")
        .lean();

    if (cancelledVehicle?.operator) {
        await notifyVehicleOperator(cancelledVehicle.operator, booking, {
            type: "booking",
            title: "Booking Cancelled on Your Vehicle",
            message: `Booking ${booking.bookingCode} for your ${cancelledVehicle.brand} ${cancelledVehicle.model} was cancelled by the ${cancelledByRole}. The vehicle is available again.`,
            variant: "warning",
        });
    }

    if (customerMessage) {
        const refundTotal = roundMoney(
            Number(refundedPayment?.refund?.amount ?? outerRefundAmount) +
                refundedExtensions.reduce(
                    (sum, payment) =>
                        sum + Number(payment?.refund?.amount || 0),
                    0
                )
        );

        await notifyBookingCustomer(booking, {
            type: "booking",
            title: "Booking Cancelled — Full Refund",
            message: `${customerMessage}${
                refundTotal > 0
                    ? ` A full refund of ${formatAmount(
                          refundTotal
                      )} has been started to your original payment method${
                          refundedPayment?.refund?.status ===
                          PAYMENT_REFUND_STATUS.SUCCEEDED
                              ? ""
                              : " and may take a few days to arrive"
                      }.`
                    : ""
            }${voucherReturnedNote(returnedVoucher)}`,
            variant: "warning",
            email: statementEmail(booking),
        });
    } else if (cancelledByRole === "admin") {
        await notifyBookingCustomer(booking, {
            type: "booking",
            title: "Booking Cancelled",
            message: `Your booking ${booking.bookingCode} was cancelled by an administrator.${
                reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""
            }${
                refundedPayment
                    ? ` A refund of ${formatAmount(
                          refundedPayment.refund.amount
                      )} has been initiated.`
                    : ""
            }${extensionRefundNote(refundedExtensions)}${voucherReturnedNote(returnedVoucher)}`,
            variant: "warning",
            email: statementEmail(booking),
        });
    } else {
        /*
         * Customer-initiated cancellation — always confirm it, even when no
         * refund is due. Previously this branch only fired when a refund had
         * actually been initiated, so a customer who kept their reservation
         * fee (the common case) or whose booking was never paid got no
         * cancellation notification at all.
         */
        let refundNote = "";

        if (refundedPayment?.refund) {
            const amountLabel = formatAmount(
                refundedPayment.refund.amount
            );

            if (
                refundedPayment.refund.status ===
                PAYMENT_REFUND_STATUS.SUCCEEDED
            ) {
                refundNote = ` A refund of ${amountLabel} has been sent to your original payment method.`;
            } else if (
                refundedPayment.refund.status ===
                    PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION ||
                refundedPayment.refund.status ===
                    PAYMENT_REFUND_STATUS.FAILED
            ) {
                refundNote = ` A refund of ${amountLabel} is being processed by our team and may take a few days.`;
            } else {
                refundNote = ` A refund of ${amountLabel} is being processed.`;
            }
        } else if (refundRecordedOnRental) {
            refundNote = ` A refund of ${formatAmount(
                outerRefundAmount
            )} has been recorded and will be returned to you.`;
        } else if (refundPendingApproval) {
            refundNote = ` A refund of ${formatAmount(
                outerRefundAmount
            )} is pending admin review.`;
        }

        if (outerKeptAmount > 0) {
            refundNote += ` ${formatAmount(
                outerKeptAmount
            )} of your reservation fee was kept ${
                outerPolicy?.policySource
                    ? `under ${describePolicySourceForCustomer(outerPolicy)}`
                    : "per our cancellation policy"
            }.`;
        }

        refundNote += extensionRefundNote(refundedExtensions);

        refundNote += voucherReturnedNote(returnedVoucher);

        await notifyBookingCustomer(booking, {
            type: "booking",
            title: "Booking Cancelled",
            message: `Your booking ${booking.bookingCode} has been cancelled.${refundNote}`,
            variant: "info",
            email: statementEmail(booking),
        });
    }

    return populateBooking(
        booking
    );
};

/*
 * What cancelling this booking right now would refund, and when that next
 * drops — so the cancel dialog can show the customer the exact figure before
 * they confirm. Uses the same calculation as cancelBooking.
 */
const getBookingCancellationPreview = async (
    bookingId,
    userId,
    userRole
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    if (
        userRole !== "admin" &&
        booking.customer.toString() !== userId.toString()
    ) {
        throw createError(
            "You are not authorized to view this booking.",
            403
        );
    }

    const settings = await Settings.findOne()
        .select("refundSettings")
        .lean();

    const totalPaid =
        await getVerifiedPrePickupPaymentAmount(
            booking._id
        );

    const { reservationFee } = getUpfrontFees(booking);

    const input = {
        startDate: getCancellationPolicyStartDate(booking),
        approvedAt: getBookingApprovedAt(booking),
        isApproved: isBookingApproved(booking),
        totalPaid,
        reservationFee,
        // Hit by maintenance: refunded in full, like an admin cancel.
        cancelledByRole:
            userRole === "admin" ||
            BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
                booking.maintenanceConflict?.status
            )
                ? "admin"
                : "customer",
    };

    const now = new Date();

    // The better of the booking's locked policy and today's.
    const current = computeBookingCancellationRefund(
        booking,
        settings?.refundSettings,
        { ...input, now }
    );

    const next =
        totalPaid > 0 && input.cancelledByRole !== "admin"
            ? getNextRefundChange({
                  ...input,
                  policies: current.policies,
                  now,
              })
            : null;

    return {
        hasPayment: totalPaid > 0,
        approved: input.isApproved,
        maintenanceConflict:
            BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
                booking.maintenanceConflict?.status
            ),
        totalPaid,
        reservationFee,
        refundAmount: current.refundAmount,
        keptAmount: current.keptAmount,
        refundPercent: current.refundPercent,
        rule: current.rule,
        tierHoursBefore: current.tierHoursBefore,
        hoursUntilPickup: current.hoursUntilPickup,
        // The pickup the figures above were measured against: after a
        // reschedule that is the original (earlier) one.
        pickupReferenceAt: getPickupReference(
            input.startDate
        ),
        next,
        // Which terms set the figure: "booking" (its locked terms),
        // "current" (today's, kinder) or null (no locked terms).
        policySource: current.policySource,
        termsVersion: current.termsVersion,
    };
};

const expireBooking = async (
    bookingId,
    expiredBy
) => {
    const existingBooking =
        await findBookingById(
            bookingId
        );

    /*
     * Approved bookings don't expire: one that was never picked up is a
     * no-show (markBookingNoShow), which keeps the fee under the no-show
     * settings. Expiring it would refund everything and bypass that. When the
     * platform is at fault, an admin cancels it instead (full refund).
     */
    if (
        existingBooking.status ===
        BOOKING_STATUS.APPROVED
    ) {
        throw createError(
            "An approved booking that wasn't picked up is marked as a no-show, not expired. To refund it in full (e.g. the problem was on our side), cancel it instead.",
            400
        );
    }

    // Paid-but-unapproved bookings too: once the dates have passed nobody
    // can approve them any more, and the customer is refunded in full below.
    const eligibleStatuses = [
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.PAYMENT_RECEIVED,
    ];

    if (
        !eligibleStatuses.includes(
            existingBooking.status
        )
    ) {
        throw createError(
            "Only bookings that haven't been approved yet can expire.",
            400
        );
    }

    const now =
        new Date();

    if (
        now <
        new Date(
            existingBooking.endDate
        )
    ) {
        throw createError(
            "A booking cannot be expired before its rental period has ended.",
            400
        );
    }

    /*
     * Atomic conditional transition: two concurrent reject/cancel/expire
     * requests for the same booking must not both pass the status check
     * above and then both trigger a refund. Only the request that actually
     * flips the status here proceeds; the other gets null back.
     */
    const booking =
        await Booking.findOneAndUpdate(
            {
                _id: existingBooking._id,
                status: {
                    $in: eligibleStatuses,
                },
            },
            {
                $set: {
                    status: BOOKING_STATUS.EXPIRED,
                    "audit.updatedBy":
                        expiredBy || null,
                },
                $push: {
                    statusHistory: {
                        status: BOOKING_STATUS.EXPIRED,
                        changedBy: expiredBy || null,
                        reason: "Booking expired after rental period ended",
                    },
                },
            },
            {
                new: true,
            }
        );

    if (!booking) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    await closePendingReschedules(
        booking,
        expiredBy || null,
        "The booking expired."
    );

    // Not if they're out driving another rental.
    await releaseDriverIfIdle(booking.driver);

    await refreshVehicleReservationStatus(
        booking.vehicle
    );

    // Nothing this booking still owes may stay payable: cancel any pending
    // payment and close its checkout before anything else.
    await cancelPendingBookingPayments(
        booking._id,
        expiredBy || null
    );

    // The booking was never approved, so any verified payment is refunded
    // in full (including the rest of a pay-in-full booking). No-ops when
    // nothing was ever verified.
    const refundedPayment =
        await refundPrePickupBooking(
            booking,
            {
                amount:
                    await getVerifiedPrePickupPaymentAmount(
                        booking._id
                    ),
                reason: PAYMENT_REFUND_REASON.OTHERS,
                notes: "Automatic refund on booking expiry.",
            },
            expiredBy
        );

    const refundedExtensions =
        await refundPrePickupExtensionFees(
            booking,
            {
                notes: "Automatic refund of extension fee on booking expiry.",
            },
            expiredBy
        );

    const returnedVoucher =
        await releaseBookingVoucher(booking);

    await notifyBookingCustomer(booking, {
        type: "booking",
        title: "Booking Expired",
        message: `Your booking ${booking.bookingCode} has expired. If you still need a vehicle, please submit a new booking.${
            refundedPayment
                ? ` A refund of ${formatAmount(
                      refundedPayment.refund.amount
                  )} has been initiated.`
                : ""
        }${extensionRefundNote(refundedExtensions)}${voucherReturnedNote(returnedVoucher)}`,
        variant: "warning",
        email: statementEmail(booking),
    });

    return populateBooking(
        booking
    );
};

/*
 * The customer never came to collect an Approved booking. What's kept
 * follows Settings → Refunds (see computeNoShowRefund): the reservation fee
 * less the no-show refund %, the pickup distance fee unless switched off;
 * any pay-in-full balance and extension fees are refunded.
 * The voucher counts as used. The kept money is the platform's — no rental
 * exists, so no operator payout is ever scheduled. There is no undo.
 *
 * `auto` is the hourly sweep (end of the start date); otherwise an admin,
 * allowed once the no-show grace period after the pickup time has passed.
 */
const markBookingNoShow = async (
    bookingId,
    markedBy,
    { auto = false, ignorePickupBlocker = false } = {}
) => {
    const existingBooking =
        await findBookingById(
            bookingId
        );

    if (
        existingBooking.status !==
        BOOKING_STATUS.APPROVED
    ) {
        throw createError(
            "Only approved bookings that haven't been picked up can be marked as a no-show.",
            400
        );
    }

    const settings = await Settings.findOne()
        .select("refundSettings")
        .lean();

    const refundSettings = resolveRefundSettings(
        settings?.refundSettings
    );

    const now = new Date();

    // Measured from the later of pickup and approval (see getNoShowReference).
    const approvedAt = getBookingApprovedAt(existingBooking);

    // The longer of the booking's locked no-show grace and today's.
    const noShowTiming = getBookingNoShowTiming(
        existingBooking,
        refundSettings
    );

    const allowedFrom = (auto ? getNoShowAutoAt : getNoShowEligibleAt)(
        existingBooking.startDate,
        noShowTiming.graceHours,
        approvedAt
    );

    if (!allowedFrom || now < allowedFrom) {
        throw createError(
            allowedFrom
                ? `This booking can't be marked as a no-show until ${formatManilaDate(
                      allowedFrom,
                      { withTime: true }
                  )}.`
                : "This booking has no valid pickup date.",
            400
        );
    }

    // Defensive: an Approved booking never has a rental (starting one moves
    // the booking to Ongoing), but a no-show must never follow a pickup.
    const existingRental = await Rental.exists({
        booking: existingBooking._id,
    });

    if (existingRental) {
        throw createError(
            "This booking has already been picked up.",
            409
        );
    }

    /*
     * A no-show keeps the customer's fee, which is only fair if they could
     * have collected the vehicle. When something on our side stood in the
     * way, the admin is stopped and told why (cancelling refunds in full);
     * they can still go ahead once they've confirmed the customer didn't
     * come regardless. The sweep checks this itself and never overrides.
     */
    const pickupBlocker = auto
        ? null
        : await getPickupBlocker(existingBooking);

    if (pickupBlocker && !ignorePickupBlocker) {
        throw createError(
            `This booking may not have been collectable: ${pickupBlocker}. That's on our side, so cancel it instead to refund the customer in full — or confirm that they didn't come anyway.`,
            409,
            { code: "PICKUP_BLOCKED", pickupBlocker }
        );
    }

    /*
     * Atomic conditional transition, as in cancel/reject/expire: only the
     * request that actually flips the status goes on to refund anything —
     * and a pickup that started in the meantime (booking now Ongoing) wins.
     */
    const booking =
        await Booking.findOneAndUpdate(
            {
                _id: existingBooking._id,
                status: BOOKING_STATUS.APPROVED,
            },
            {
                $set: {
                    status: BOOKING_STATUS.NO_SHOW,
                    "audit.updatedBy":
                        markedBy || null,
                },
                $push: {
                    statusHistory: {
                        status: BOOKING_STATUS.NO_SHOW,
                        changedBy: markedBy || null,
                        reason: auto
                            ? "Automatically marked as a no-show: the vehicle was not picked up on the start date."
                            : "Marked as a no-show: the customer did not pick up the vehicle.",
                        notes: pickupBlocker
                            ? `Marked despite a pickup problem on our side (${pickupBlocker}); the admin confirmed the customer didn't come anyway.`
                            : "",
                    },
                },
            },
            {
                new: true,
            }
        );

    if (!booking) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    // Not if they're out driving another rental.
    await releaseDriverIfIdle(booking.driver);

    await refreshVehicleReservationStatus(
        booking.vehicle
    );

    await closePendingExtensions(
        booking,
        markedBy,
        "The vehicle was not picked up (no-show)."
    );

    // Nothing may stay payable on a booking that has ended.
    await cancelPendingBookingPayments(
        booking._id,
        markedBy || null
    );

    const totalPaid =
        await getVerifiedPrePickupPaymentAmount(
            booking._id
        );

    // Only what was actually charged for each fee (after a voucher) is kept.
    const upfrontFees = getUpfrontFees(booking);

    // The better of the booking's locked no-show terms and today's.
    const outcome = computeBookingNoShowRefund(booking, refundSettings, {
        totalPaid,
        reservationFee: upfrontFees.reservationFee,
        pickupDistanceFee: upfrontFees.pickupDistanceFee,
    });

    const policyNote = describePolicySource(outcome);

    const autoApproveThreshold = Number(
        refundSettings.autoApproveRefundThreshold ?? 0
    );

    const refundedPayment =
        outcome.refundAmount > 0
            ? await refundPrePickupBooking(
                  booking,
                  {
                      amount: outcome.refundAmount,
                      reason: PAYMENT_REFUND_REASON.OTHERS,
                      notes: `Refund on no-show: the balance beyond the reservation fee${
                          outcome.distanceFeeKept > 0
                              ? " and pickup distance fee"
                              : ""
                      } (${outcome.refundPercent}% of the reservation fee refunded under ${
                          policyNote || "the no-show policy"
                      }).`,
                      forceManual:
                          Number.isFinite(autoApproveThreshold) &&
                          autoApproveThreshold > 0 &&
                          outcome.refundAmount > autoApproveThreshold,
                  },
                  markedBy || null
              )
            : null;

    const refundedExtensions =
        await refundPrePickupExtensionFees(
            booking,
            {
                notes: "Automatic refund of extension fee on no-show.",
                manualThreshold: autoApproveThreshold,
            },
            markedBy || null
        );

    /*
     * Report what actually happened to the payment (a late payment recovered
     * a moment ago may already carry a full refund). If the refund couldn't
     * even be started, the policy figures stand and the admins are told.
     */
    const refundedAmount = refundedPayment?.refund
        ? Number(refundedPayment.refund.amount)
        : outcome.refundAmount;

    const keptAmount = Math.max(
        0,
        totalPaid - refundedAmount
    );

    const refundNotStarted =
        outcome.refundAmount > 0 && !refundedPayment;

    // What the no-show kept and under which terms, for the booking views.
    const noShowOutcome = {
        refundPercent: outcome.refundPercent,
        keptAmount: roundMoney(keptAmount),
        refundAmount: roundMoney(refundedAmount),
        policySource: outcome.policySource,
        termsVersion: outcome.termsVersion,
    };

    await Booking.updateOne(
        { _id: booking._id },
        { $set: { noShowOutcome } }
    );

    booking.noShowOutcome = noShowOutcome;

    const moneyNote = `${
        keptAmount > 0
            ? ` ${formatAmount(keptAmount)} was kept under ${
                  outcome.policySource
                      ? describePolicySourceForCustomer(outcome)
                      : "our cancellation policy"
              }.`
            : ""
    }${
        refundedAmount > 0
            ? ` A refund of ${formatAmount(
                  refundedAmount
              )} for the rest of your payment is being processed.`
            : ""
    }${extensionRefundNote(refundedExtensions)}`;

    await notifyBookingCustomer(booking, {
        type: "booking",
        title: "Booking Marked as No-Show",
        message: `Your booking was marked as a no-show because the vehicle was not picked up at the booked time (${formatManilaDate(
            booking.startDate,
            { withTime: true }
        )}).${moneyNote} If you still need a vehicle, please make a new booking.`,
        variant: "warning",
        email: statementEmail(booking),
    });

    const vehicle = await Vehicle.findById(booking.vehicle)
        .select("operator brand model")
        .lean();

    if (vehicle?.operator) {
        await notifyVehicleOperator(vehicle.operator, booking, {
            type: "booking",
            title: "Booking No-Show",
            message: `The customer for booking ${booking.bookingCode} did not pick up your ${vehicle.brand} ${vehicle.model}. The booking was marked as a no-show and the vehicle is available again.`,
            variant: "warning",
        });
    }

    try {
        await notifyAdmins({
            type: "booking",
            title: "Booking No-Show",
            message: `Booking ${booking.bookingCode} was ${
                auto
                    ? "automatically marked as a no-show (not picked up on its start date)"
                    : "marked as a no-show"
            }. Kept: ${formatAmount(keptAmount)}; refunded: ${formatAmount(
                refundedAmount
            )}${policyNote ? `, under ${policyNote}` : ""}.${
                refundNotStarted
                    ? ` The refund could not be started automatically — refund ${formatAmount(
                          outcome.refundAmount
                      )} to the customer from the Payments page.`
                    : ""
            }`,
            variant: "warning",
            category: "Booking",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of a no-show:",
            notificationError
        );
    }

    return populateBooking(
        booking
    );
};

/*
 * Why an approved booking couldn't have been released at pickup, on the
 * platform's side — the vehicle out of service or the assigned driver no
 * longer active — as a phrase for the admin notice; null when nothing stood
 * in the way.
 */
/*
 * Whether a vehicle or driver (`filter`) was still out on another rental at
 * `at`: picked up by then and not returned until after it.
 */
const wasOutOnAnotherRentalAt = (filter, bookingId, at) =>
    Rental.exists({
        ...filter,
        booking: { $ne: bookingId },
        "pickup.date": { $lte: at },
        $or: [
            { "return.date": null },
            { "return.date": { $gt: at } },
        ],
    });

const getPickupBlocker = async (booking) => {
    /*
     * The customer asked (in time) to move the booking and nobody answered
     * before pickup — not picking up on the old date isn't on them.
     */
    const reference = getNoShowReference(
        booking.startDate,
        getBookingApprovedAt(booking)
    );

    const unansweredReschedule = (booking.reschedules || []).some(
        (reschedule) =>
            reschedule?.status === BOOKING_RESCHEDULE_STATUS.PENDING &&
            (!reference ||
                !reschedule.requestedAt ||
                new Date(reschedule.requestedAt) <= reference)
    );

    if (unansweredReschedule) {
        return "the customer asked to reschedule it and that request was never answered";
    }

    const vehicle = await Vehicle.findById(booking.vehicle)
        .select("status availability maintenance")
        .lean();

    if (!vehicle) {
        return "its vehicle no longer exists";
    }

    const outOfService = {
        [VEHICLE_STATUS.ARCHIVED]: "its vehicle was archived",
        [VEHICLE_STATUS.EXPIRED_REGISTRATION]:
            "its vehicle's registration has expired",
    }[vehicle.status];

    if (outOfService) {
        return outOfService;
    }

    // Only a window overlapping this booking stood in the way.
    if (
        overlapsMaintenance(
            vehicle,
            getNoShowReference(
                booking.startDate,
                getBookingApprovedAt(booking)
            ) ?? booking.startDate,
            booking.endDate
        )
    ) {
        return "its vehicle is under maintenance";
    }

    if (vehicle.availability?.bookingEnabled === false) {
        return "its vehicle has bookings disabled";
    }

    // `reference` (above): the first moment the customer could collect it.
    if (reference) {
        const availableFrom = vehicle.availability?.availableFrom;

        if (availableFrom && new Date(availableFrom) > reference) {
            return "its vehicle wasn't available yet at the pickup time";
        }

        const end = new Date(booking.endDate);

        const blocked = (vehicle.availability?.blockedDates || []).some(
            (range) =>
                new Date(range.startDate) < end &&
                new Date(range.endDate) > reference
        );

        if (blocked) {
            return "its vehicle has dates blocked during the booking";
        }

        // Pickup is refused until the previous renter brings it back.
        if (
            await wasOutOnAnotherRentalAt(
                { vehicle: booking.vehicle },
                booking._id,
                reference
            )
        ) {
            return "its vehicle wasn't back from the previous rental at the pickup time";
        }
    }

    if (
        booking.driverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
        booking.driver
    ) {
        const driver = await Driver.findById(booking.driver)
            .select("status archive license.expiryDate")
            .lean();

        if (
            !driver ||
            driver.status !== DRIVER_STATUS.ACTIVE ||
            driver.archive?.isArchived
        ) {
            return "its assigned driver is no longer active";
        }

        // Pickup refuses a driver whose license doesn't last the trip.
        if (getDriverLicenseIssue(driver, booking.endDate)) {
            return "its assigned driver's license doesn't cover the trip";
        }

        if (
            reference &&
            (await wasOutOnAnotherRentalAt(
                { driver: booking.driver },
                booking._id,
                reference
            ))
        ) {
            return "its assigned driver was still out on another rental at the pickup time";
        }
    }

    return null;
};

/*
 * Scheduled sweep: marks every Approved booking still not picked up by the
 * end of its start date (Manila) — or, for one approved late, the end of the
 * day it could first be marked — as a no-show. Safe to run repeatedly — a
 * booking already handled (or picked up meanwhile) is skipped with a 409.
 */
export const markNoShowBookings = async () => {
    const now = new Date();

    // Only bookings whose start date has passed can qualify; the exact
    // cutoff is checked per booking below (and again by markBookingNoShow).
    const candidates = await Booking.find({
        status: BOOKING_STATUS.APPROVED,
        startDate: {
            $lt: now,
        },
    })
        .select("_id startDate endDate bookingCode statusHistory reschedules vehicle driver driverOption termsAcceptance")
        .lean();

    if (!candidates.length) {
        return;
    }

    const settings = await Settings.findOne()
        .select("refundSettings")
        .lean();

    const refundSettings = resolveRefundSettings(
        settings?.refundSettings
    );

    for (const candidate of candidates) {
        // Per booking: its locked no-show terms may give it longer.
        const { graceHours, autoMark: noShowAutoMark } =
            getBookingNoShowTiming(candidate, refundSettings);

        const autoAt = getNoShowAutoAt(
            candidate.startDate,
            graceHours,
            getBookingApprovedAt(candidate)
        );

        if (!autoAt || now < autoAt) {
            continue;
        }

        try {
            /*
             * A no-show keeps the customer's fee — fair only if they could
             * have picked the vehicle up. If the vehicle (or the assigned
             * driver) was taken out of service, the booking fell through on
             * our side: leave it for an admin to cancel (full refund).
             */
            const blocker = await getPickupBlocker(candidate);

            if (blocker) {
                const alreadyAlerted = await hasRecentNotification({
                    type: "Booking No-Show Skipped",
                    relatedId: candidate._id,
                });

                if (!alreadyAlerted) {
                    await notifyAdmins({
                        type: "Booking No-Show Skipped",
                        title: "Approved Booking Couldn't Be Picked Up",
                        message: `Booking ${candidate.bookingCode} wasn't picked up, but it wasn't marked as a no-show because ${blocker}. Cancel it to refund the customer in full, or reschedule it.`,
                        variant: "warning",
                        category: "Booking",
                        metadata: {
                            reference: candidate.bookingCode,
                            relatedId: candidate._id,
                            relatedModel: "Booking",
                        },
                    });
                }

                continue;
            }

            /*
             * Settings → Refunds can leave no-shows to the admins: tell them
             * once, at the time the sweep would have marked it.
             */
            if (!noShowAutoMark) {
                const alreadyAlerted = await hasRecentNotification({
                    type: "Booking Not Picked Up",
                    relatedId: candidate._id,
                });

                if (!alreadyAlerted) {
                    await notifyAdmins({
                        type: "Booking Not Picked Up",
                        title: "Approved Booking Not Picked Up",
                        message: `Booking ${candidate.bookingCode} wasn't picked up. ${
                            refundSettings.noShowAutoMark
                                ? "The terms its customer booked under don't mark no-shows automatically"
                                : "Automatic no-show marking is off"
                        }, so mark it as a no-show or cancel it from the Bookings page.`,
                        variant: "warning",
                        category: "Booking",
                        metadata: {
                            reference: candidate.bookingCode,
                            relatedId: candidate._id,
                            relatedModel: "Booking",
                        },
                    });
                }

                continue;
            }

            await markBookingNoShow(candidate._id, null, {
                auto: true,
            });
        } catch (error) {
            if (error.statusCode !== 409) {
                console.error(
                    `Failed to mark booking ${candidate.bookingCode} as a no-show:`,
                    error
                );
            }
        }
    }
};

/*
 * Scheduled sweep: bookings nobody approved (or rejected) before their rental
 * period ended — typically paid ones ("Payment Received") the admins missed
 * despite the approval alerts, and ones outside the unpaid-payment deadline
 * (nothing to pay). They can never be approved now, so they're expired and
 * the customer refunded in full, instead of holding their money indefinitely.
 */
export const expireLapsedUnapprovedBookings = async () => {
    const lapsed = await Booking.find({
        status: {
            $in: [
                BOOKING_STATUS.PENDING,
                BOOKING_STATUS.PAYMENT_RECEIVED,
            ],
        },
        endDate: { $lte: new Date() },
    })
        .select("_id bookingCode status")
        .lean();

    for (const candidate of lapsed) {
        try {
            await expireBooking(candidate._id, null);

            await notifyAdmins({
                type: "booking",
                title: "Unapproved Booking Expired",
                message: `Booking ${candidate.bookingCode} was never approved or rejected before its rental period ended, so it expired automatically${
                    candidate.status === BOOKING_STATUS.PAYMENT_RECEIVED
                        ? " and the customer's payment is being refunded in full"
                        : ""
                }.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    reference: candidate.bookingCode,
                    relatedId: candidate._id,
                    relatedModel: "Booking",
                },
            });
        } catch (error) {
            if (error.statusCode !== 409) {
                console.error(
                    `Failed to expire lapsed booking ${candidate.bookingCode}:`,
                    error
                );
            }
        }
    }
};

/*
 * The reservation-fee amount a pending booking still owes. Bookings whose
 * reservation is free (0) never enter the payment-deadline flow.
 */
const getPayableReservationAmount = (booking) =>
    getUpfrontFees(booking).total;

/*
 * Scheduled sweep: for pending bookings whose reservation fee has not been
 * paid, remind the customer as the payment window closes and auto-release the
 * reservation once it lapses. Best-effort; safe to run repeatedly.
 */
export const expireUnpaidBookings = async () => {
    const now = Date.now();
    const reminderMs =
        BOOKING_RESERVATION_PAYMENT_REMINDER_HOURS * 60 * 60 * 1000;

    const pendingBookings = await Booking.find({
        status: BOOKING_STATUS.PENDING,
    }).select(
        "bookingCode customer vehicle driver pricing voucher createdAt startDate"
    );

    for (const booking of pendingBookings) {
        try {
            if (getPayableReservationAmount(booking) <= 0) {
                continue;
            }

            const hasVerifiedPayment = await Payment.exists({
                booking: booking._id,
                status: PAYMENT_STATUS.VERIFIED,
            });

            if (hasVerifiedPayment) {
                continue;
            }

            const pendingPayment = await Payment.findOne({
                booking: booking._id,
                status: PAYMENT_STATUS.PENDING,
            })
                .select("paymentMethod")
                .lean();

            /*
             * A customer who cancelled their own online payment attempt has
             * nothing pending, yet the reservation fee is still unpaid and
             * they can pay again inside the window (see
             * reviveCancelledReservationPayment). So that booking is subject
             * to the same deadline — otherwise it would sit Pending forever,
             * holding the vehicle.
             */
            const cancelledOnlinePayment = pendingPayment
                ? false
                : Boolean(
                      await Payment.exists({
                          booking: booking._id,
                          paymentType:
                              PAYMENT_TYPE.RESERVATION_FEE,
                          paymentMethod:
                              PAYMENT_METHOD.GCASH,
                          status: PAYMENT_STATUS.CANCELLED,
                      })
                  );

            // No online payment is owed: either the payment record failed to
            // create, or it is Cash on Pickup (settled by an admin at pickup).
            if (
                !cancelledOnlinePayment &&
                (!pendingPayment ||
                    pendingPayment.paymentMethod ===
                        PAYMENT_METHOD.CASH_ON_PICKUP)
            ) {
                continue;
            }

            // 24h after booking, or the pickup time if that's sooner.
            const deadline =
                getReservationPaymentDeadline(booking).getTime();

            if (now >= deadline) {
                /*
                 * Last chance before release: the customer may have paid on
                 * PayMongo but the webhook never landed. Ask PayMongo directly;
                 * if it is paid, verify it and keep the booking.
                 */
                if (
                    pendingPayment?.paymentMethod ===
                    PAYMENT_METHOD.GCASH
                ) {
                    const pendingSession = await Payment.findOne({
                        booking: booking._id,
                        status: PAYMENT_STATUS.PENDING,
                    })
                        .select("paymongo")
                        .lean();

                    const checkoutSessionId =
                        pendingSession?.paymongo?.checkoutSessionId;

                    if (checkoutSessionId) {
                        try {
                            const session =
                                await retrieveCheckoutSession(
                                    checkoutSessionId
                                );

                            if (session.paid) {
                                await verifyPaymentByCheckoutSession(
                                    checkoutSessionId,
                                    session.paymentIntentId || "",
                                    session.payments?.[0]?.id || "",
                                    session.payments?.[0]
                                );

                                continue;
                            }
                        } catch (reconcileError) {
                            console.error(
                                `PayMongo reconcile before expiry failed for booking ${booking._id}:`,
                                reconcileError
                            );
                        }
                    }
                }

                // Atomic flip so a concurrent approval/cancel wins cleanly.
                const expired = await Booking.findOneAndUpdate(
                    {
                        _id: booking._id,
                        status: BOOKING_STATUS.PENDING,
                    },
                    {
                        $set: {
                            status: BOOKING_STATUS.EXPIRED,
                            "audit.updatedBy": null,
                        },
                        $push: {
                            statusHistory: {
                                status: BOOKING_STATUS.EXPIRED,
                                changedBy: null,
                                reason: "Reservation fee not paid within the payment window",
                            },
                        },
                    },
                    { new: true }
                );

                if (!expired) {
                    continue;
                }

                // Cancel the unpaid reservation payment — and close its
                // PayMongo checkout, so it can't be paid after the release —
                // and tell the customer first: these must land even if
                // vehicle housekeeping fails.
                await cancelPendingBookingPayments(
                    booking._id,
                    null
                );

                const returnedVoucher =
                    await releaseBookingVoucher(expired);

                await notifyBookingCustomer(expired, {
                    type: "booking",
                    title: "Booking Released — Payment Not Received",
                    message: `Your booking for ${formatManilaDate(
                        expired.startDate,
                        { withTime: true }
                    )} was released because the reservation fee of ${formatAmount(
                        getPayableReservationAmount(booking)
                    )} wasn't paid in time (within ${BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS} hours of booking, or before the pickup time if that came first). Please submit a new booking if you still need the vehicle.${voucherReturnedNote(returnedVoucher)}`,
                    variant: "warning",
                    email: {
                        actionLabel: "Browse vehicles",
                        actionPath: "/available",
                    },
                });

                try {
                    await releaseDriverIfIdle(expired.driver);

                    await refreshVehicleReservationStatus(expired.vehicle);
                } catch (housekeepingError) {
                    console.error(
                        `Post-expiry housekeeping failed for booking ${booking._id}:`,
                        housekeepingError
                    );
                }

                continue;
            }

            if (deadline - now <= reminderMs) {
                const alreadyReminded = await hasRecentNotification({
                    recipient: booking.customer,
                    type: "Booking Payment Reminder",
                    relatedId: booking._id,
                });

                if (alreadyReminded) {
                    continue;
                }

                // Pickup-based deadlines can be minutes away.
                const minutesLeft = Math.max(
                    1,
                    Math.round((deadline - now) / (60 * 1000))
                );
                const timeLeft =
                    minutesLeft < 60
                        ? `${minutesLeft} minute(s)`
                        : `${Math.round(minutesLeft / 60)} hour(s)`;

                await notifyBookingCustomer(booking, {
                    type: "Booking Payment Reminder",
                    title: "Complete Payment to Keep Your Booking",
                    message: `Booking ${booking.bookingCode} will be released in about ${timeLeft} if the reservation fee of ${formatAmount(
                        getPayableReservationAmount(booking)
                    )} isn't paid. Complete your payment from My Bookings to keep it.`,
                    variant: "warning",
                    email: {
                        actionLabel: "Complete payment",
                        actionPath: `/customer/bookings/${booking._id}`,
                    },
                });
            }
        } catch (error) {
            console.error(
                `Unpaid-booking sweep failed for booking ${booking?._id}:`,
                error
            );
        }
    }
};

/*
 * Scheduled sweep: bookings ready for approval (reservation fee paid, or
 * nothing to pay) that nobody has approved yet. Admins are alerted
 * BOOKING_APPROVAL_ALERT_HOURS before the pickup time, and again once it has
 * passed — each alert once per booking — so a paid customer never turns up
 * to an unapproved booking unnoticed.
 */
export const alertUnapprovedBookings = async () => {
    const now = Date.now();
    const alertWindowMs = BOOKING_APPROVAL_ALERT_HOURS * 60 * 60 * 1000;

    const candidates = await Booking.find({
        status: {
            $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.PAYMENT_RECEIVED],
        },
        // Wide enough for any stored start; the exact pickup is checked below.
        startDate: { $lt: new Date(now + alertWindowMs + 24 * 60 * 60 * 1000) },
    })
        .select("bookingCode status startDate pricing voucher vehicle")
        .populate("vehicle", "brand model plateNumber")
        .lean();

    for (const booking of candidates) {
        try {
            // Still unpaid: the payment deadline handles that one.
            if (
                booking.status === BOOKING_STATUS.PENDING &&
                getPayableReservationAmount(booking) > 0
            ) {
                continue;
            }

            const pickupAt = getPickupReference(booking.startDate);

            if (!pickupAt) {
                continue;
            }

            const pickupMs = pickupAt.getTime();
            const overdue = now >= pickupMs;

            if (!overdue && now < pickupMs - alertWindowMs) {
                continue;
            }

            const type = overdue
                ? "Booking Approval Overdue"
                : "Booking Approval Due Soon";

            if (
                await hasRecentNotification({
                    type,
                    relatedId: booking._id,
                })
            ) {
                continue;
            }

            const vehicleName =
                [booking.vehicle?.brand, booking.vehicle?.model]
                    .filter(Boolean)
                    .join(" ") || "a vehicle";

            const pickupText = formatManilaDate(pickupAt, {
                withTime: true,
            });

            await notifyAdmins({
                type,
                title: overdue
                    ? "Pickup Time Passed — Booking Not Approved"
                    : "Booking Needs Approval Soon",
                message: overdue
                    ? `Booking ${booking.bookingCode} for ${vehicleName} was due for pickup at ${pickupText} but was never approved. The customer is ready to go: approve it now, or reject it to refund them in full.`
                    : `Booking ${booking.bookingCode} for ${vehicleName} picks up at ${pickupText} and is still waiting for approval.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (error) {
            console.error(
                `Unapproved-booking alert failed for booking ${booking?._id}:`,
                error
            );
        }
    }
};

const requestBookingExtension = async (
    bookingId,
    extensionData,
    currentUserId
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    if (
        booking.customer.toString() !==
        currentUserId.toString()
    ) {
        throw createError(
            "You are not authorized to request an extension for this booking.",
            403
        );
    }

    validateExtensionBookingStatus(
        booking
    );

    const activeRental =
        await Rental.findOne({
            booking: booking._id,
        }).select("return.date");

    if (activeRental?.return?.date) {
        throw createError(
            "This vehicle has already been returned, so the booking can no longer be extended.",
            400
        );
    }

    const pendingExtension =
        getPendingExtension(
            booking
        );

    if (pendingExtension) {
        throw createError(
            "This booking already has a pending extension request.",
            409
        );
    }

    // A reschedule would move the end date this extension is priced from,
    // and a booking with an extension can't be rescheduled — one at a time.
    if (getPendingReschedule(booking)) {
        throw createError(
            "This booking has a reschedule request awaiting review. Wait for it to be decided (or cancel it) before asking for an extension.",
            409
        );
    }

    const requestedEndDate =
        validateExtensionEndDate(
            extensionData.requestedEndDate,
            booking.endDate
        );

    await ensureCustomerLicenseForDateChange(booking, requestedEndDate);

    const additionalHours =
        calculateExtensionHours(
            booking.endDate,
            requestedEndDate
        );

    const vehicle =
        await Vehicle.findById(
            booking.vehicle
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    validateVehicleExtensionEligibility(
        vehicle,
        booking.status
    );

    // Extra hours get the booking's discount, or a better one running now.
    const vehicleRate =
        await resolveVehicleRateNow(vehicle, {
            lockedDiscount:
                booking.pricing?.vehicleDiscount,
        });

    const pricing =
        calculateExtensionPricing(
            vehicleRate.dailyRate,
            additionalHours
        );

    // The driver works the extra hours too: their share is charged at the
    // driver rate this booking was priced with, and counted in `amount`.
    const driverCharge = getExtensionDriverCharge(
        booking,
        additionalHours
    );

    pricing.driverHourlyRate = driverCharge.driverHourlyRate;
    pricing.driverAmount = driverCharge.driverAmount;
    pricing.amount =
        Math.round((pricing.amount + driverCharge.driverAmount) * 100) / 100;

    await validateVehicleDateAvailability(
        vehicle,
        booking.endDate,
        requestedEndDate
    );

    await ensureNoBookingConflict(
        vehicle._id,
        booking.endDate,
        requestedEndDate,
        booking._id
    );

    if (
        booking.driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        // The driver works the extra time too, so their license must last.
        await validateDriverSelection(
            booking.driverOption,
            booking.driver,
            {
                allowUnassigned: true,
                validThrough: requestedEndDate,
            }
        );

        await ensureNoDriverBookingConflict(
            booking.driver,
            booking.endDate,
            requestedEndDate,
            booking._id
        );
    }

    /*
     * Conditional push: two requests sent together must not both pass the
     * "no pending request" check above and leave two pending extensions, and
     * the booking must still be open (not cancelled or returned meanwhile).
     */
    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            status: {
                $in: [
                    BOOKING_STATUS.APPROVED,
                    BOOKING_STATUS.ONGOING,
                ],
            },
            endDate: booking.endDate,
            extensions: {
                $not: {
                    $elemMatch: {
                        status: BOOKING_EXTENSION_STATUS.PENDING,
                    },
                },
            },
            reschedules: {
                $not: {
                    $elemMatch: {
                        status: BOOKING_RESCHEDULE_STATUS.PENDING,
                    },
                },
            },
        },
        {
            $push: {
                extensions: {
                    requestedEndDate,
                    previousEndDate: booking.endDate,
                    additionalHours,
                    pricing,
                    status: BOOKING_EXTENSION_STATUS.PENDING,
                    reason: extensionData.reason || "",
                    requestedAt: new Date(),
                    requestedBy: currentUserId,
                },
            },
            $set: {
                "audit.updatedBy": currentUserId,
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This booking was already updated by another request. Please refresh and try again.",
            409
        );
    }

    try {
        await notifyAdmins({
            type: "booking",
            title: "Rental Extension Requested",
            message: `The customer requested to extend booking ${booking.bookingCode} by ${additionalHours} hour(s) (new end date ${formatManilaDate(requestedEndDate, { withTime: true })}). Awaiting review.`,
            variant: "info",
            category: "Booking",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of extension request:",
            notificationError
        );
    }

    return populateBooking(
        updated
    );
};

const approveBookingExtension = async (
    bookingId,
    extensionId,
    approvedBy
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    const originalBooking = booking.toObject();

    const extension =
        findExtensionById(
            booking,
            extensionId
        );

    if (
        extension.status !==
        BOOKING_EXTENSION_STATUS.PENDING
    ) {
        throw createError(
            "Only pending booking extensions can be approved.",
            400
        );
    }

    if (
        ![
            BOOKING_STATUS.APPROVED,
            BOOKING_STATUS.ONGOING,
        ].includes(
            booking.status
        )
    ) {
        throw createError(
            "Only approved or ongoing bookings can have an extension approved.",
            400
        );
    }

    const returnedRental = await Rental.exists({
        booking: booking._id,
        "return.date": { $ne: null },
    });

    if (returnedRental) {
        throw createError(
            "The vehicle has already been returned, so this extension can't be approved. Reject it instead.",
            400
        );
    }

    const vehicle =
        await Vehicle.findById(
            booking.vehicle
        );

    if (!vehicle) {
        throw createError(
            "Vehicle not found.",
            404
        );
    }

    validateVehicleExtensionEligibility(
        vehicle,
        booking.status
    );

    const requestedEndDate =
        validateExtensionEndDate(
            extension.requestedEndDate,
            booking.endDate
        );

    await ensureCustomerLicenseForDateChange(booking, requestedEndDate);

    await validateVehicleDateAvailability(
        vehicle,
        booking.endDate,
        requestedEndDate
    );

    await ensureNoBookingConflict(
        vehicle._id,
        booking.endDate,
        requestedEndDate,
        booking._id
    );

    if (
        booking.driverOption ===
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER
    ) {
        // The driver works the extra time too, so their license must last.
        await validateDriverSelection(
            booking.driverOption,
            booking.driver,
            {
                allowUnassigned: true,
                validThrough: requestedEndDate,
            }
        );

        await ensureNoDriverBookingConflict(
            booking.driver,
            booking.endDate,
            requestedEndDate,
            booking._id
        );
    }

    extension.previousEndDate =
        booking.endDate;

    extension.status =
        BOOKING_EXTENSION_STATUS.APPROVED;

    extension.approvedAt =
        new Date();

    extension.approvedBy =
        approvedBy;

    extension.rejectedAt = null;

    extension.rejectedBy = null;

    extension.rejectionReason = "";

    extension.cancelledAt = null;

    extension.cancelledBy = null;

    extension.cancellationReason =
        "";

    booking.endDate =
        requestedEndDate;

    // Rebuilt from the gross parts, so the voucher discount comes off again.
    // (Each approved extension's amount already includes its driver share.)
    booking.pricing.totalAmount =
        booking.pricing.subtotal +
        booking.pricing.reservationFee +
        (booking.pricing.pickupDistanceFee || 0) +
        (booking.pricing.returnDistanceFee || 0) +
        (booking.pricing.driverFee || 0) -
        Number(booking.voucher?.discountAmount || 0) +
        booking.extensions.reduce(
            (total, approvedExtension) =>
                approvedExtension.status ===
                BOOKING_EXTENSION_STATUS.APPROVED
                    ? total +
                      Number(
                          approvedExtension.pricing
                              ?.amount || 0
                      )
                    : total,
            0
        );

    booking.audit.updatedBy =
        approvedBy;

    const existingExtensionPayment =
        await Payment.findOne({
            booking: booking._id,
            paymentType:
                PAYMENT_TYPE.RESERVATION_FEE,
        })
            .select(
                "amount status paymentMethod"
            )
            .lean();

    const extensionPaymentMethod =
        existingExtensionPayment?.paymentMethod ||
        PAYMENT_METHOD.GCASH;

    await withBookingChangeTransaction(
        originalBooking, { end: requestedEndDate, checkLimit: true },
        async (session) => {
            if (await Rental.exists({ booking: booking._id, "return.date": { $ne: null } }).session(session)) {
                throw createError("The vehicle has already been returned, so this extension can't be approved.", 409);
            }
            /*
             * Claim the request first: two admins approving at once, or the
             * customer cancelling it (or the booking ending) meanwhile, must
             * not end with a second fee or an extension applied to a request
             * that's no longer pending. Booking has no versionKey, so save()
             * alone wouldn't notice.
             */
            const claimed = await Booking.updateOne(
                {
                    _id: booking._id,
                    status: {
                        $in: [
                            BOOKING_STATUS.APPROVED,
                            BOOKING_STATUS.ONGOING,
                        ],
                    },
                    extensions: {
                        $elemMatch: {
                            _id: extension._id,
                            status: BOOKING_EXTENSION_STATUS.PENDING,
                        },
                    },
                },
                {
                    $set: {
                        "extensions.$": extension.toObject(),
                    },
                },
                { session }
            );

            if (!claimed.modifiedCount) {
                throw createError(
                    "This extension request was already updated by another request.",
                    409
                );
            }

            await Booking.updateOne({ _id: booking._id }, { $set: {
                endDate: booking.endDate,
                "pricing.totalAmount": booking.pricing.totalAmount,
                "audit.updatedBy": approvedBy,
            } }, { session });

            if (extension.pricing.amount > 0) {
                await Payment.create(
                    [
                        {
                            booking: booking._id,
                            rental: null,
                            bookingExtension: extension._id,
                            customer: booking.customer,
                            paymentType:
                                PAYMENT_TYPE.EXTENSION_FEE,
                            paymentMethod:
                                extensionPaymentMethod,
                            amount: extension.pricing.amount,
                            status: PAYMENT_STATUS.PENDING,
                            verification: {
                                verifiedBy: null,
                                verifiedAt: null,
                                rejectionReason: "",
                            },
                            processedBy: null,
                            processedAt: null,
                            notes: "",
                            audit: {
                                createdBy: approvedBy,
                                updatedBy: approvedBy,
                            },
                        },
                    ],
                    { session }
                );
            }

            await syncApprovedBookingExtension(
                booking,
                extension,
                approvedBy,
                session
            );
            return booking;
        }
    );

    await notifyBookingCustomer(booking, {
        type: "booking",
        title: "Rental Extension Approved",
        message: `Your extension for booking ${booking.bookingCode} was approved. New end date: ${formatManilaDate(requestedEndDate, { withTime: true })}.${
            extension.pricing?.amount > 0
                ? ` An extension fee of ${formatAmount(extension.pricing.amount)} is now due.`
                : ""
        }`,
        variant: "success",
        email: true,
    });

    return populateBooking(
        booking
    );
};

/*
 * Closes a still-pending extension request (rejected or cancelled) in one
 * conditional write, so it can't overwrite an approval that landed first.
 * `fields` are the extension's new status and its reject/cancel details.
 */
const updatePendingExtension = async (
    bookingId,
    extensionId,
    fields,
    updatedBy
) => {
    const $set = {
        "audit.updatedBy": updatedBy || null,
    };

    for (const [key, value] of Object.entries(fields)) {
        $set[`extensions.$.${key}`] = value;
    }

    const updated = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            extensions: {
                $elemMatch: {
                    _id: extensionId,
                    status: BOOKING_EXTENSION_STATUS.PENDING,
                },
            },
        },
        { $set },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This extension request was already updated by another request.",
            409
        );
    }

    return updated;
};

const rejectBookingExtension = async (
    bookingId,
    extensionId,
    rejectedBy,
    reason = ""
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    const extension =
        findExtensionById(
            booking,
            extensionId
        );

    if (
        extension.status !==
        BOOKING_EXTENSION_STATUS.PENDING
    ) {
        throw createError(
            "Only pending booking extensions can be rejected.",
            400
        );
    }

    // Atomic: an approval (or the customer cancelling) racing this wins
    // cleanly instead of being overwritten.
    const updated = await updatePendingExtension(
        booking._id,
        extension._id,
        {
            status: BOOKING_EXTENSION_STATUS.REJECTED,
            rejectedAt: new Date(),
            rejectedBy,
            rejectionReason: reason || "",
        },
        rejectedBy
    );

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: "Rental Extension Rejected",
        message: `Your extension request for booking ${booking.bookingCode} was rejected.${
            reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""
        } Your original end date stands.`,
        variant: "warning",
        email: true,
    });

    return populateBooking(
        updated
    );
};

const cancelBookingExtension = async (
    bookingId,
    extensionId,
    cancelledBy,
    reason = "",
    cancelledByRole = "customer"
) => {
    const booking =
        await findBookingById(
            bookingId
        );

    if (
        cancelledByRole !== "admin" &&
        booking.customer.toString() !==
        cancelledBy.toString()
    ) {
        throw createError(
            "You are not authorized to cancel this booking extension.",
            403
        );
    }

    const extension =
        findExtensionById(
            booking,
            extensionId
        );

    if (
        extension.status !==
        BOOKING_EXTENSION_STATUS.PENDING
    ) {
        throw createError(
            "Only pending booking extensions can be cancelled.",
            400
        );
    }

    const updated = await updatePendingExtension(
        booking._id,
        extension._id,
        {
            status: BOOKING_EXTENSION_STATUS.CANCELLED,
            cancelledAt: new Date(),
            cancelledBy,
            cancellationReason: reason || "",
        },
        cancelledBy
    );

    if (cancelledByRole === "admin") {
        await notifyBookingCustomer(updated, {
            type: "booking",
            title: "Rental Extension Cancelled",
            message: `Your pending extension request for booking ${booking.bookingCode} was cancelled by an administrator.${
                reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""
            }`,
            variant: "warning",
        });
    }

    return populateBooking(
        updated
    );
};

/* ========================================================================
 * Rescheduling
 *
 * Moving a booking to new dates before pickup - same vehicle, driver option
 * and locations. A customer requests it at least 24 hours before pickup and
 * an admin approves or rejects; an admin can also reschedule directly. One
 * approved reschedule per booking.
 *
 * The booking is repriced at the vehicle's current daily rate (reservation
 * fee, distance fees and any voucher carried over). On approval the
 * difference is settled: extra days become an EXTENSION_FEE payment (paid
 * online like an extension), and if the customer had already paid more than
 * the new total, the overpaid part is refunded from the reservation payment.
 * Cancellation fees keep using the earlier pickup date (see
 * getCancellationPolicyStartDate).
 * ===================================================================== */

const RESCHEDULABLE_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

const roundMoney = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

const getPendingReschedule = (booking) =>
    (booking?.reschedules || []).find(
        (reschedule) =>
            reschedule.status ===
            BOOKING_RESCHEDULE_STATUS.PENDING
    );

const findRescheduleById = (booking, rescheduleId) => {
    const reschedule = booking.reschedules?.id(rescheduleId);

    if (!reschedule) {
        throw createError(
            "Reschedule request not found.",
            404
        );
    }

    return reschedule;
};

/* The latest a customer may still ask, relative to the current pickup. */
const getRescheduleDeadline = (booking) => {
    const pickup =
        getPickupReference(booking.startDate) ||
        new Date(booking.startDate);

    return new Date(
        pickup.getTime() -
            BOOKING_RESCHEDULE_MIN_NOTICE_HOURS * 60 * 60 * 1000
    );
};

/*
 * Whether this booking can be rescheduled at all right now. `role` "admin"
 * skips the customer notice deadline (an admin can override it).
 */
const assertBookingReschedulable = async (booking, role) => {
    if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
        throw createError(
            "Only bookings that haven't been picked up yet can be rescheduled.",
            400
        );
    }

    const rental = await Rental.exists({ booking: booking._id });

    if (rental) {
        throw createError(
            "This booking's rental has already started, so it can't be rescheduled.",
            400
        );
    }

    if (
        getApprovedReschedules(booking).length >=
        BOOKING_RESCHEDULE_MAX_APPROVED
    ) {
        throw createError(
            "This booking has already been rescheduled. To change the dates again, cancel it and book again.",
            400
        );
    }

    const hasExtension = (booking.extensions || []).some((extension) =>
        [
            BOOKING_EXTENSION_STATUS.PENDING,
            BOOKING_EXTENSION_STATUS.APPROVED,
        ].includes(extension.status)
    );

    if (hasExtension) {
        throw createError(
            "A booking with an extension can't be rescheduled.",
            400
        );
    }

    const unpaidReservation = await Payment.exists({
        booking: booking._id,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        status: PAYMENT_STATUS.PENDING,
    });

    if (unpaidReservation) {
        throw createError(
            "Pay the reservation fee before rescheduling this booking.",
            400
        );
    }

    if (role !== "admin" && new Date() > getRescheduleDeadline(booking)) {
        throw createError(
            `Reschedules must be requested at least ${BOOKING_RESCHEDULE_MIN_NOTICE_HOURS} hours before pickup.`,
            400
        );
    }
};

/*
 * The booking's pricing for new dates: the vehicle's current daily rate and
 * the driver's current rate (the same re-pricing rule), with the reservation
 * fee, distance fees and voucher carried over. `vehicleRate` is from
 * resolveVehicleRate (the rate after any vehicle discount).
 */
const buildReschedulePricing = (
    booking,
    vehicleRate,
    start,
    end,
    driverDailyRate = 0
) => {
    const previous = booking.pricing || {};

    const base = applyVehicleDiscountToPricing(
        calculatePricing(
            vehicleRate.dailyRate,
            previous.reservationFee ?? 0,
            start,
            end
        ),
        vehicleRate
    );

    base.pickupDistanceKm = previous.pickupDistanceKm ?? null;
    base.returnDistanceKm = previous.returnDistanceKm ?? null;
    base.pickupDistanceFee = Number(previous.pickupDistanceFee || 0);
    base.returnDistanceFee = Number(previous.returnDistanceFee || 0);
    base.totalAmount =
        base.subtotal +
        base.reservationFee +
        base.pickupDistanceFee +
        base.returnDistanceFee;

    applyDriverFee(base, driverDailyRate);

    if (!booking.voucher?.voucher) {
        return base;
    }

    return calculatePricingWithVoucher(base, {
        _id: booking.voucher.voucher,
        code: booking.voucher.code,
        name: booking.voucher.name,
        type: booking.voucher.type,
        discountMethod: booking.voucher.discountMethod,
        discountValue: booking.voucher.discountValue,
    });
};

/*
 * Validates new dates for this booking and prices them. Doesn't save
 * anything - shared by the preview, the request and the approval (which
 * re-checks, since the vehicle's calendar may have changed meanwhile).
 */
const quoteReschedule = async (booking, startDate, endDate) => {
    const { start, end } = validateBookingDateRange(startDate, endDate);

    if (
        start.getTime() === new Date(booking.startDate).getTime() &&
        end.getTime() === new Date(booking.endDate).getTime()
    ) {
        throw createError(
            "Choose dates or a pickup time different from the current booking.",
            400
        );
    }

    const settings = await getBookingLocationPolicy();
    const bookingHours = settings.bookingSettings?.bookingHours ?? null;
    validatePickupSchedule(start, end, {
        requireFuture: true,
        bookingHours,
        pickupHours: settings.bookingSettings?.pickupHours ?? null,
        earliestPickupMs: getEarliestPickupMs(Date.now(), bookingHours),
    });
    await ensureCustomerLicenseForDateChange(booking, end, settings);

    const vehicle = await Vehicle.findById(booking.vehicle);

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    // Maintenance only blocks its window (validateVehicleDateAvailability).
    if (
        [
            VEHICLE_STATUS.ARCHIVED,
            VEHICLE_STATUS.EXPIRED_REGISTRATION,
        ].includes(vehicle.status) ||
        vehicle.availability?.bookingEnabled === false
    ) {
        throw createError(
            "This vehicle can't take bookings right now, so the booking can't be moved.",
            400
        );
    }

    await validateVehicleDateAvailability(vehicle, start, end);

    await ensureNoBookingConflict(vehicle._id, start, end, booking._id);

    if (
        booking.driverOption === BOOKING_DRIVER_OPTIONS.WITH_DRIVER &&
        booking.driver
    ) {
        await ensureNoDriverBookingConflict(
            booking.driver,
            start,
            end,
            booking._id
        );

        const driver = await Driver.findById(booking.driver)
            .select("license.expiryDate")
            .lean();

        if (getDriverLicenseIssue(driver, end)) {
            throw createError(
                "Your driver's license doesn't cover the new dates, so the booking can't be moved there. Please contact us to arrange another driver.",
                400
            );
        }
    }

    await ensureCustomerBookingLimitNotExceeded(
        booking.customer,
        start,
        end,
        settings.customerBookingSettings?.maxConcurrentBookings,
        booking._id
    );

    const driverDailyRate = await resolveDriverDailyRate({
        driverOption: booking.driverOption,
        driverId: booking.driver,
        settings,
    });

    const pricing = buildReschedulePricing(
        booking,
        await resolveVehicleRateNow(vehicle, {
            lockedDiscount: booking.pricing?.vehicleDiscount,
        }),
        start,
        end,
        driverDailyRate
    );

    const previousTotalAmount = roundMoney(booking.pricing?.totalAmount);
    const totalAmount = roundMoney(pricing.totalAmount);

    return {
        start,
        end,
        vehicle,
        pricing,
        summary: {
            dailyRate: pricing.dailyRate,
            rentalDays: pricing.rentalDays,
            subtotal: roundMoney(pricing.subtotal),
            driverDailyRate: pricing.driverDailyRate,
            driverFee: roundMoney(pricing.driverFee),
            previousTotalAmount,
            totalAmount,
            difference: roundMoney(totalAmount - previousTotalAmount),
        },
    };
};

/*
 * How a price difference would be settled: extra is charged; a lower price
 * refunds only what the customer already paid above the new total (if they
 * only paid the reservation fee, the lower price just lowers what's due at
 * pickup).
 */
const previewRescheduleSettlement = async (booking, summary) => {
    if (await isReservationUnpaid(booking._id)) {
        return { kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE, amount: 0 };
    }
    if (summary.difference > 0) {
        return {
            kind: BOOKING_RESCHEDULE_SETTLEMENT.CHARGE,
            amount: summary.difference,
        };
    }

    if (summary.difference < 0) {
        const paid = await getPrePickupTotalPaid(booking._id);
        const refundable = roundMoney(paid - summary.totalAmount);

        if (refundable > 0) {
            return {
                kind: BOOKING_RESCHEDULE_SETTLEMENT.REFUND,
                amount: refundable,
            };
        }
    }

    return {
        kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
        amount: 0,
    };
};

/* ------------------------------------------------------------------------
 * Changing the driver before pickup. An admin swaps it directly (a reason is
 * required), or a customer asks for a different one and an admin approves or
 * declines. After pickup, rentalService.reassignDriver takes over.
 *
 * The booking keeps the driver price it was quoted: changes are usually on
 * our side, and driver fees are the platform's (never in a partner payout).
 * ---------------------------------------------------------------------- */

const DRIVER_CHANGEABLE_STATUSES = [
    BOOKING_STATUS.PENDING,
    BOOKING_STATUS.PAYMENT_RECEIVED,
    BOOKING_STATUS.APPROVED,
];

const driverFullName = (driver) =>
    [driver?.firstName, driver?.lastName].filter(Boolean).join(" ") ||
    "your driver";

const assertDriverChangeable = async (booking) => {
    if (booking.driverOption !== BOOKING_DRIVER_OPTIONS.WITH_DRIVER) {
        throw createError(
            "This booking is self-drive, so it has no driver to change.",
            400
        );
    }

    if (!DRIVER_CHANGEABLE_STATUSES.includes(booking.status)) {
        throw createError(
            "The driver can only be changed before the vehicle is picked up.",
            400
        );
    }

    if (await Rental.exists({ booking: booking._id })) {
        throw createError(
            "This booking has already been picked up. Reassign the driver from the rental instead.",
            400
        );
    }
};

const getPendingDriverChangeRequest = (booking) =>
    (booking.driverChangeRequests || []).find(
        (request) =>
            request.status === DRIVER_CHANGE_REQUEST_STATUS.PENDING
    ) ?? null;

/*
 * Puts `newDriverId` on the booking after the same checks as approval, in
 * one conditional update (Booking has no versionKey, so a save() could undo
 * a cancellation or pickup that landed meanwhile). With `requestId`, the
 * customer's request is marked approved in the same write.
 */
const applyDriverChange = async (
    bookingId,
    newDriverId,
    { reason = "", changedBy, requestId = null, note = "" }
) => {
    const booking = await findBookingById(bookingId);

    await assertDriverChangeable(booking);

    if (String(booking.driver) === String(newDriverId)) {
        throw createError(
            "That driver is already assigned to this booking.",
            400
        );
    }

    const newDriver = await validateDriverSelection(
        BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
        newDriverId,
        { validThrough: booking.endDate }
    );

    await ensureNoDriverBookingConflict(
        newDriverId,
        booking.startDate,
        booking.endDate,
        booking._id
    );

    const now = new Date();

    const filter = {
        _id: booking._id,
        status: { $in: DRIVER_CHANGEABLE_STATUSES },
        driver: booking.driver ?? null,
    };

    const update = {
        $set: {
            driver: newDriverId,
            "audit.updatedBy": changedBy,
        },
        $push: {
            driverChanges: {
                previousDriver: booking.driver ?? null,
                newDriver: newDriverId,
                reason: String(reason || "").slice(0, 500),
                changedBy,
                changedAt: now,
                requestId,
            },
        },
    };

    if (requestId) {
        filter.driverChangeRequests = {
            $elemMatch: {
                _id: requestId,
                status: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
            },
        };

        Object.assign(update.$set, {
            "driverChangeRequests.$.status":
                DRIVER_CHANGE_REQUEST_STATUS.APPROVED,
            "driverChangeRequests.$.resolvedBy": changedBy,
            "driverChangeRequests.$.resolvedAt": now,
            "driverChangeRequests.$.resolutionNote": String(
                note || ""
            ).slice(0, 500),
            "driverChangeRequests.$.assignedDriver": newDriverId,
        });
    }

    const updated = await withBookingChangeTransaction(booking, { driver: newDriverId },
        (session) => Booking.findOneAndUpdate(filter, update, { new: true, session })
    );

    if (!updated) {
        throw createError(
            "This booking changed while you were working on it. Refresh and try again.",
            409
        );
    }

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: requestId
            ? "Driver Change Approved"
            : "Your Driver Has Changed",
        message: `${
            requestId
                ? "Your request for a different driver was approved. "
                : booking.driver
                  ? "The driver for your booking has changed. "
                  : ""
        }Your driver is now ${driverFullName(newDriver)}. Contact number: ${
            newDriver.phoneNumber || "Not provided"
        }.${note ? ` Note from our team: ${String(note).slice(0, 300)}` : ""}`,
        variant: "info",
    });

    return populateBooking(updated);
};

/* Admin: swap the driver directly. Answers a pending customer request too. */
const changeBookingDriver = async (
    bookingId,
    { driverId, reason = "" },
    adminId
) => {
    const trimmedReason = String(reason || "").trim();

    if (!trimmedReason) {
        throw createError(
            "Please give a reason for changing the driver.",
            400
        );
    }

    const booking = await findBookingById(bookingId);
    const pending = getPendingDriverChangeRequest(booking);

    return applyDriverChange(bookingId, driverId, {
        reason: trimmedReason,
        changedBy: adminId,
        requestId: pending?._id ?? null,
        note: pending ? trimmedReason : "",
    });
};

/* Customer: ask for a different driver (optionally naming one). */
const requestDriverChange = async (
    bookingId,
    { reason = "", preferredDriverId = null },
    customerId
) => {
    const booking = await findBookingById(bookingId);

    if (String(booking.customer) !== String(customerId)) {
        throw createError(
            "You are not authorized to change this booking.",
            403
        );
    }

    await assertDriverChangeable(booking);

    if (!booking.driver) {
        throw createError(
            "Your driver hasn't been assigned yet — we'll assign one before pickup.",
            400
        );
    }

    const pickupAt =
        getPickupReference(booking.startDate) ||
        new Date(booking.startDate);

    if (
        Date.now() >
        pickupAt.getTime() - DRIVER_CHANGE_MIN_NOTICE_HOURS * 60 * 60 * 1000
    ) {
        throw createError(
            `A different driver must be requested at least ${DRIVER_CHANGE_MIN_NOTICE_HOURS} hours before pickup. Please contact us instead.`,
            400
        );
    }

    const trimmedReason = String(reason || "").trim();

    if (!trimmedReason) {
        throw createError(
            "Please tell us why you'd like a different driver.",
            400
        );
    }

    if (getPendingDriverChangeRequest(booking)) {
        throw createError(
            "You already asked for a different driver. We'll get back to you soon.",
            409
        );
    }

    let preferredDriver = null;

    if (preferredDriverId) {
        const settings = await Settings.findOne().lean();

        if (isAdminDriverAssignment(settings)) {
            throw createError(
                "Our team assigns drivers, so you can't pick one — just tell us why you'd like a change.",
                400
            );
        }

        if (String(preferredDriverId) === String(booking.driver)) {
            throw createError(
                "That driver is already assigned to your booking.",
                400
            );
        }

        await validateDriverSelection(
            BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            preferredDriverId,
            { validThrough: booking.endDate }
        );

        await ensureNoDriverBookingConflict(
            preferredDriverId,
            booking.startDate,
            booking.endDate,
            booking._id
        );

        // Your price stays as quoted, so a pricier driver can't be picked.
        const preferredRate = await resolveDriverDailyRate({
            driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
            driverId: preferredDriverId,
            settings,
        });

        if (
            preferredRate >
            (Number(booking.pricing?.driverDailyRate) || 0)
        ) {
            throw createError(
                "That driver costs more per day than your booking's driver rate. Please choose another driver, or leave it to us.",
                400
            );
        }

        preferredDriver = preferredDriverId;
    }

    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            customer: customerId,
            status: { $in: DRIVER_CHANGEABLE_STATUSES },
            "driverChangeRequests.status": {
                $ne: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
            },
        },
        {
            $push: {
                driverChangeRequests: {
                    status: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
                    reason: trimmedReason.slice(0, 500),
                    preferredDriver,
                    requestedBy: customerId,
                    requestedAt: new Date(),
                },
            },
            $set: { "audit.updatedBy": customerId },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This booking changed while you were sending your request. Refresh and try again.",
            409
        );
    }

    try {
        await notifyAdmins({
            type: "booking",
            title: "Different Driver Requested",
            message: `The customer for booking ${updated.bookingCode} asked for a different driver: "${trimmedReason.slice(
                0,
                200
            )}". Awaiting review.`,
            variant: "info",
            category: "Booking",
            metadata: {
                reference: updated.bookingCode,
                relatedId: updated._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of a driver change request:",
            notificationError
        );
    }

    return populateBooking(updated);
};

const findDriverChangeRequest = (booking, requestId) => {
    const request = (booking.driverChangeRequests || []).find(
        (item) => String(item._id) === String(requestId)
    );

    if (!request) {
        throw createError("Driver change request not found.", 404);
    }

    return request;
};

/* Admin: approve with the customer's preferred driver, or another one. */
const approveDriverChangeRequest = async (
    bookingId,
    requestId,
    { driverId = null, note = "" },
    adminId
) => {
    const booking = await findBookingById(bookingId);
    const request = findDriverChangeRequest(booking, requestId);

    if (request.status !== DRIVER_CHANGE_REQUEST_STATUS.PENDING) {
        throw createError(
            "Only pending driver change requests can be approved.",
            400
        );
    }

    const chosen = driverId || request.preferredDriver;

    if (!chosen) {
        throw createError(
            "Choose the driver to assign before approving.",
            400
        );
    }

    return applyDriverChange(bookingId, chosen, {
        reason: `Customer request: ${request.reason}`,
        changedBy: adminId,
        requestId: request._id,
        note,
    });
};

/* Admin: keep the current driver. */
const declineDriverChangeRequest = async (
    bookingId,
    requestId,
    { note = "" },
    adminId
) => {
    const updated = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            driverChangeRequests: {
                $elemMatch: {
                    _id: requestId,
                    status: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
                },
            },
        },
        {
            $set: {
                "driverChangeRequests.$.status":
                    DRIVER_CHANGE_REQUEST_STATUS.DECLINED,
                "driverChangeRequests.$.resolvedBy": adminId,
                "driverChangeRequests.$.resolvedAt": new Date(),
                "driverChangeRequests.$.resolutionNote": String(
                    note || ""
                ).slice(0, 500),
                "audit.updatedBy": adminId,
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "Only pending driver change requests can be declined.",
            400
        );
    }

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: "Driver Change Declined",
        message: `We couldn't change your driver this time, so your current driver stays.${
            note ? ` Note from our team: ${String(note).slice(0, 300)}` : ""
        }`,
        variant: "warning",
    });

    return populateBooking(updated);
};

/* Customer: withdraw their own pending request. */
const cancelDriverChangeRequest = async (
    bookingId,
    requestId,
    customerId
) => {
    const updated = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            customer: customerId,
            driverChangeRequests: {
                $elemMatch: {
                    _id: requestId,
                    status: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
                },
            },
        },
        {
            $set: {
                "driverChangeRequests.$.status":
                    DRIVER_CHANGE_REQUEST_STATUS.CANCELLED,
                "driverChangeRequests.$.resolvedBy": customerId,
                "driverChangeRequests.$.resolvedAt": new Date(),
                "driverChangeRequests.$.resolutionNote":
                    "Withdrawn by the customer.",
                "audit.updatedBy": customerId,
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "Only your pending driver change requests can be withdrawn.",
            400
        );
    }

    return populateBooking(updated);
};

const assertCustomerOwnsBooking = (booking, userId) => {
    if (String(booking.customer) !== String(userId)) {
        throw createError(
            "You are not authorized to reschedule this booking.",
            403
        );
    }
};

// A reschedule can change only the pickup time, so show it.
const describeRange = (start, end) => {
    const format = (value) =>
        new Date(value).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila",
        });

    return `${format(start)} - ${format(end)}`;
};

/* Price + settlement for new dates, without saving (the request form's
   live quote). */
const previewBookingReschedule = async (
    bookingId,
    { startDate, endDate },
    currentUserId,
    role
) => {
    const booking = await findBookingById(bookingId);

    if (role !== "admin") {
        assertCustomerOwnsBooking(booking, currentUserId);
    }

    await assertBookingReschedulable(booking, role);

    const quote = await quoteReschedule(booking, startDate, endDate);
    const settlement = await previewRescheduleSettlement(
        booking,
        quote.summary
    );

    return {
        startDate: quote.start,
        endDate: quote.end,
        ...quote.summary,
        settlement,
        deadline: getRescheduleDeadline(booking),
    };
};

/*
 * Settles a price change to a booking (`change`: a reschedule or a vehicle
 * switch, with its pricing { difference, totalAmount }): extra is charged
 * as a new online payment the customer pays from their booking; a lower
 * price refunds what they already paid above the new total. Never throws:
 * the change itself already stands, and a failure is handed to admins.
 * `kind` is "reschedule" or "vehicleChange"; returns the settlement.
 */
const settlePriceChange = async (
    booking,
    change,
    approvedBy,
    refundThreshold,
    kind
) => {
    const isVehicleChange = kind === "vehicleChange";
    const changeId = isVehicleChange ? change.changeId : change._id;
    const action = isVehicleChange
        ? "moving booking"
        : "rescheduling booking";

    const difference = Number(change.pricing?.difference || 0);
    const newTotal = Number(change.pricing?.totalAmount || 0);

    const settlement = {
        kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
        amount: 0,
        payment: null,
        manual: false,
    };

    try {
        if (difference > 0) {
            const [payment] = await Payment.create([
                {
                    booking: booking._id,
                    rental: null,
                    bookingExtension: changeId,
                    bookingReschedule: isVehicleChange ? null : changeId,
                    bookingVehicleChange: isVehicleChange
                        ? changeId
                        : null,
                    customer: booking.customer,
                    paymentType: PAYMENT_TYPE.EXTENSION_FEE,
                    paymentMethod: PAYMENT_METHOD.GCASH,
                    amount: roundMoney(difference),
                    status: PAYMENT_STATUS.PENDING,
                    verification: {
                        verifiedBy: null,
                        verifiedAt: null,
                        rejectionReason: "",
                    },
                    processedBy: null,
                    processedAt: null,
                    notes: isVehicleChange
                        ? `Price difference for moving booking ${booking.bookingCode} to another vehicle.`
                        : `Price difference for rescheduling booking ${booking.bookingCode}.`,
                    audit: {
                        createdBy: approvedBy,
                        updatedBy: approvedBy,
                    },
                },
            ]);

            settlement.kind = BOOKING_RESCHEDULE_SETTLEMENT.CHARGE;
            settlement.amount = roundMoney(difference);
            settlement.payment = payment._id;
        } else if (difference < 0) {
            const paid = await getPrePickupTotalPaid(
                booking._id
            );
            const refundable = roundMoney(paid - newTotal);

            if (refundable > 0) {
                settlement.kind = BOOKING_RESCHEDULE_SETTLEMENT.REFUND;
                const result = await allocatePriceChangeRefund(booking, refundable, {
                    reason: isVehicleChange ? PAYMENT_REFUND_REASON.OTHERS : PAYMENT_REFUND_REASON.REQUESTED_BY_CUSTOMER,
                    notes: `Refund of the price difference after ${action} ${booking.bookingCode}.`,
                    forceManual: refundThreshold > 0 && refundable > refundThreshold,
                }, approvedBy, settlement);
                settlement.payment = result.payment;
                settlement.allocations = result.allocations;
                settlement.manual = result.manual;
            }
        }
    } catch (settleError) {
        console.error(
            `Failed to settle the price change (${kind}) of booking ${booking._id}:`,
            settleError
        );

        settlement.manual = true;

        try {
            await notifyAdmins({
                type: "booking",
                title: isVehicleChange
                    ? "Vehicle Change Needs Attention"
                    : "Reschedule Needs Attention",
                message: `Booking ${booking.bookingCode} was ${
                    isVehicleChange
                        ? "moved to another vehicle"
                        : "rescheduled"
                }, but settling its price difference failed: ${settleError.message}. Review the booking's payments.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch {
            // Already logged above.
        }
    }

    return settlement;
};

/* Settles an approved reschedule's price difference (see settlePriceChange). */
const settleApprovedReschedule = async (
    booking,
    reschedule,
    approvedBy,
    refundThreshold,
    reservationUnpaid = false
) => {
    const settlement = reservationUnpaid
        ? { kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE, amount: 0, payment: null, manual: false }
        : await settlePriceChange(
              booking,
              reschedule,
              approvedBy,
              refundThreshold,
              "reschedule"
          );

    await Booking.updateOne(
        { _id: booking._id, "reschedules._id": reschedule._id },
        { $set: { "reschedules.$.settlement": settlement } }
    );

    return settlement;
};

const requestBookingReschedule = async (
    bookingId,
    { startDate, endDate, reason = "" },
    currentUserId,
    role
) => {
    if (role === "admin") {
        return adminRescheduleBooking(
            bookingId,
            { startDate, endDate, reason },
            currentUserId
        );
    }

    const booking = await findBookingById(bookingId);

    assertCustomerOwnsBooking(booking, currentUserId);

    await assertBookingReschedulable(booking, role);

    if (getPendingReschedule(booking)) {
        throw createError(
            "This booking already has a reschedule request awaiting review.",
            409
        );
    }

    const quote = await quoteReschedule(booking, startDate, endDate);

    booking.reschedules.push({
        requestedStartDate: quote.start,
        requestedEndDate: quote.end,
        previousStartDate: booking.startDate,
        previousEndDate: booking.endDate,
        pricing: quote.summary,
        status: BOOKING_RESCHEDULE_STATUS.PENDING,
        reason: String(reason || "").slice(0, 500),
        requestedAt: new Date(),
        requestedBy: currentUserId,
    });

    booking.audit.updatedBy = currentUserId;

    await booking.save();

    try {
        await notifyAdmins({
            type: "booking",
            title: "Reschedule Requested",
            message: `The customer asked to move booking ${booking.bookingCode} to ${describeRange(
                quote.start,
                quote.end
            )}${
                quote.summary.difference !== 0
                    ? ` (${quote.summary.difference > 0 ? "+" : "-"}${formatAmount(
                          Math.abs(quote.summary.difference)
                      )})`
                    : ""
            }. Awaiting review.`,
            variant: "info",
            category: "Booking",
            metadata: {
                reference: booking.bookingCode,
                relatedId: booking._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of reschedule request:",
            notificationError
        );
    }

    return populateBooking(booking);
};

const approveBookingReschedule = async (
    bookingId,
    rescheduleId,
    approvedBy
) => {
    const booking = await findBookingById(bookingId);
    const reschedule = findRescheduleById(booking, rescheduleId);

    if (reschedule.status !== BOOKING_RESCHEDULE_STATUS.PENDING) {
        throw createError(
            "Only pending reschedule requests can be approved.",
            400
        );
    }

    await assertBookingReschedulable(booking, "admin");

    // Re-checked and re-priced now: the calendar may have changed since the
    // request was made.
    const quote = await quoteReschedule(
        booking,
        reschedule.requestedStartDate,
        reschedule.requestedEndDate
    );

    const previousStart = booking.startDate;
    const previousEnd = booking.endDate;

    // A percentage voucher's discount moves with the number of days.
    const voucherUpdate = booking.voucher?.voucher
        ? {
              "voucher.discountAmount": roundMoney(
                  Object.entries(quote.pricing.voucher?.discount || {})
                      .filter(([key]) => key.endsWith("Discount"))
                      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
              ),
          }
        : {};

    const reservationUnpaid = await isReservationUnpaid(booking._id);
    const repricedBooking = {
        ...booking.toObject(),
        voucher: booking.voucher ? {
            ...booking.voucher.toObject(),
            discountAmount: voucherUpdate["voucher.discountAmount"] ?? booking.voucher.discountAmount,
        } : null,
    };
    const paymentUpdate = {
        previousTotalAmount: roundMoney(booking.pricing?.totalAmount),
        previousUpfrontAmount: getUpfrontFees(booking).total,
        pricing: quote.pricing,
        updatedBy: approvedBy,
    };
    if (reservationUnpaid) {
        // External checkout expiry runs once, before the retryable transaction.
        await syncReservationPaymentAmount(repricedBooking, { ...paymentUpdate, prepareOnly: true });
    }

    // Atomic: two admins approving at once (or a pickup racing this) can't
    // both apply it. Booking has no versionKey, so save() wouldn't catch it.
    const updated = await withBookingChangeTransaction(
        booking, { start: quote.start, end: quote.end, checkLimit: true },
        async (session) => {
            if (reservationUnpaid) {
                await syncReservationPaymentAmount(repricedBooking, { ...paymentUpdate, session });
            }
            return Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    status: { $in: RESCHEDULABLE_STATUSES },
                    startDate: previousStart,
                    reschedules: {
                        $elemMatch: {
                            _id: reschedule._id,
                            status: BOOKING_RESCHEDULE_STATUS.PENDING,
                        },
                    },
                },
                {
                    $set: {
                        startDate: quote.start,
                        endDate: quote.end,
                        pricing: quote.pricing,
                        ...voucherUpdate,
                        "audit.updatedBy": approvedBy,
                        "reschedules.$.status":
                            BOOKING_RESCHEDULE_STATUS.APPROVED,
                        "reschedules.$.approvedAt": new Date(),
                        "reschedules.$.approvedBy": approvedBy,
                        "reschedules.$.previousStartDate": previousStart,
                        "reschedules.$.previousEndDate": previousEnd,
                        "reschedules.$.pricing": quote.summary,
                    },
                },
                { new: true, session }
            );
        }
    );

    if (!updated) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    const approved = updated.reschedules.id(reschedule._id);

    const refundSettings =
        (await Settings.findOne().select("refundSettings").lean()) || {};

    const settlement = await settleApprovedReschedule(
        updated,
        approved,
        approvedBy,
        Number(
            refundSettings?.refundSettings?.autoApproveRefundThreshold ?? 0
        ),
        reservationUnpaid
    );

    await refreshVehicleReservationStatus(updated.vehicle);

    // Moved clear of the vehicle's maintenance (or late return): the
    // conflict no longer holds.
    if (
        BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
            updated.maintenanceConflict?.status
        )
    ) {
        if (isLateReturnCause(updated.maintenanceConflict)) {
            await reconcileLateReturnConflicts(updated.vehicle);
        } else {
            await reconcileMaintenanceConflicts(updated.vehicle);
        }
    }

    const settlementNote =
        settlement.kind === BOOKING_RESCHEDULE_SETTLEMENT.CHARGE
            ? ` The extra ${formatAmount(settlement.amount)} for the new dates is now due - pay it from your booking.`
            : settlement.kind === BOOKING_RESCHEDULE_SETTLEMENT.REFUND
              ? ` ${formatAmount(settlement.amount)} you overpaid is being refunded.`
              : quote.summary.difference < 0
                ? ` The new dates cost ${formatAmount(Math.abs(quote.summary.difference))} less, taken off what's due at pickup.`
                : "";

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: approved.requestedByAdmin
            ? "Booking Rescheduled"
            : "Reschedule Approved",
        message: `Booking ${updated.bookingCode} now runs ${describeRange(
            quote.start,
            quote.end
        )}.${settlementNote}`,
        variant: "success",
        email: true,
    });

    const vehicle = await Vehicle.findById(updated.vehicle)
        .select("operator brand model")
        .lean();

    await notifyVehicleOperator(vehicle?.operator, updated, {
        type: "booking",
        title: "Booking Rescheduled",
        message: `Booking ${updated.bookingCode} for your ${vehicle?.brand ?? ""} ${
            vehicle?.model ?? ""
        } moved from ${describeRange(previousStart, previousEnd)} to ${describeRange(
            quote.start,
            quote.end
        )}.`,
        variant: "info",
    });

    return populateBooking(await findBookingById(updated._id));
};

const rejectBookingReschedule = async (
    bookingId,
    rescheduleId,
    rejectedBy,
    reason = ""
) => {
    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            reschedules: {
                $elemMatch: {
                    _id: rescheduleId,
                    status: BOOKING_RESCHEDULE_STATUS.PENDING,
                },
            },
        },
        {
            $set: {
                "reschedules.$.status": BOOKING_RESCHEDULE_STATUS.REJECTED,
                "reschedules.$.rejectedAt": new Date(),
                "reschedules.$.rejectedBy": rejectedBy,
                "reschedules.$.rejectionReason": String(reason || "").slice(
                    0,
                    500
                ),
                "audit.updatedBy": rejectedBy,
            },
        },
        { new: true }
    );

    if (!booking) {
        throw createError(
            "Only pending reschedule requests can be rejected.",
            400
        );
    }

    await notifyBookingCustomer(booking, {
        type: "booking",
        title: "Reschedule Rejected",
        message: `Your reschedule request for booking ${booking.bookingCode} was rejected.${
            reason ? ` Reason: ${String(reason).slice(0, 300)}` : ""
        } Your original dates stand.`,
        variant: "warning",
        email: true,
    });

    return populateBooking(booking);
};

const cancelBookingReschedule = async (
    bookingId,
    rescheduleId,
    cancelledBy,
    reason = "",
    role = "customer"
) => {
    const existing = await findBookingById(bookingId);

    if (role !== "admin") {
        assertCustomerOwnsBooking(existing, cancelledBy);
    }

    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            reschedules: {
                $elemMatch: {
                    _id: rescheduleId,
                    status: BOOKING_RESCHEDULE_STATUS.PENDING,
                },
            },
        },
        {
            $set: {
                "reschedules.$.status": BOOKING_RESCHEDULE_STATUS.CANCELLED,
                "reschedules.$.cancelledAt": new Date(),
                "reschedules.$.cancelledBy": cancelledBy,
                "reschedules.$.cancellationReason": String(
                    reason || ""
                ).slice(0, 500),
                "audit.updatedBy": cancelledBy,
            },
        },
        { new: true }
    );

    if (!booking) {
        throw createError(
            "Only pending reschedule requests can be cancelled.",
            400
        );
    }

    return populateBooking(booking);
};

/* An admin moving a booking directly: recorded as a request and approved
   in one go, so it follows exactly the same checks and settlement. */
const adminRescheduleBooking = async (
    bookingId,
    { startDate, endDate, reason = "" },
    adminId
) => {
    const booking = await findBookingById(bookingId);

    await assertBookingReschedulable(booking, "admin");

    if (getPendingReschedule(booking)) {
        throw createError(
            "This booking has a customer reschedule request awaiting review - approve or reject it first.",
            409
        );
    }

    const quote = await quoteReschedule(booking, startDate, endDate);

    booking.reschedules.push({
        requestedStartDate: quote.start,
        requestedEndDate: quote.end,
        previousStartDate: booking.startDate,
        previousEndDate: booking.endDate,
        pricing: quote.summary,
        status: BOOKING_RESCHEDULE_STATUS.PENDING,
        reason: String(reason || "").slice(0, 500),
        requestedAt: new Date(),
        requestedBy: adminId,
        requestedByAdmin: true,
    });

    booking.audit.updatedBy = adminId;

    await booking.save();

    const created = booking.reschedules[booking.reschedules.length - 1];

    try {
        return await approveBookingReschedule(
            booking._id,
            created._id,
            adminId
        );
    } catch (approveError) {
        await cancelBookingReschedule(
            booking._id,
            created._id,
            adminId,
            `Couldn't be applied: ${approveError.message}`,
            "admin"
        ).catch(() => {});

        throw approveError;
    }
};

/*
|--------------------------------------------------------------------------
| Maintenance conflicts
|--------------------------------------------------------------------------
|
| A booking not picked up yet whose vehicle went under maintenance over its
| dates (flagged by vehicleMaintenanceService). An admin sends the customer
| their options; the customer (or an admin on their behalf) either moves to
| another vehicle for the same dates — the price difference charged or
| refunded like a reschedule's — or cancels with a full refund. Unanswered
| by the deadline, it's cancelled and refunded in full automatically.
*/

const HOUR_MS = 60 * 60 * 1000;

const vehicleDisplayName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "vehicle";

const describeMaintenanceEnd = (until) =>
    until
        ? `needs maintenance until ${formatMaintenanceDate(until)}`
        : "is off the road for maintenance";

/*
 * The customer's deadline: BOOKING_MAINTENANCE_CONFLICT_RESPONSE_HOURS from
 * now, but no later than a day before pickup — and never under the minimum
 * notice (capped at the pickup time; after a missed pickup, the minimum).
 */
const getMaintenanceConflictRespondBy = (booking, now = Date.now()) => {
    const pickup = (
        getPickupReference(booking.startDate) || new Date(booking.startDate)
    ).getTime();

    const preferred = Math.min(
        now + BOOKING_MAINTENANCE_CONFLICT_RESPONSE_HOURS * HOUR_MS,
        pickup -
            BOOKING_MAINTENANCE_CONFLICT_RESPONSE_BEFORE_PICKUP_HOURS *
                HOUR_MS
    );

    const minimum =
        now + BOOKING_MAINTENANCE_CONFLICT_MIN_RESPONSE_HOURS * HOUR_MS;

    const floor = pickup > now ? Math.min(minimum, pickup) : minimum;

    return new Date(Math.max(preferred, floor));
};

const assertMaintenanceConflictActor = (booking, userId, role) => {
    if (
        role !== "admin" &&
        String(booking.customer) !== String(userId)
    ) {
        throw createError(
            "You are not authorized to change this booking.",
            403
        );
    }
};

/*
 * The booking must still have an open conflict and not be picked up yet.
 * Customers can only act once an admin has sent them the options.
 */
const assertOpenMaintenanceConflict = async (booking, role) => {
    const conflict = booking.maintenanceConflict;

    if (
        !conflict ||
        !BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES.includes(
            conflict.status
        )
    ) {
        throw createError(
            "This booking has no open vehicle issue — it may already have been resolved. Please refresh.",
            400
        );
    }

    if (
        !RESCHEDULABLE_STATUSES.includes(booking.status) ||
        (await Rental.exists({ booking: booking._id }))
    ) {
        throw createError(
            "This booking can no longer be changed.",
            400
        );
    }

    if (
        role !== "admin" &&
        conflict.status === BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED
    ) {
        throw createError(
            isLateReturnCause(conflict)
                ? "The vehicle may still make it back in time. If it can't, you'll be notified right away with your options. You can cancel now for a full refund if you prefer."
                : "We're still reviewing this booking. You'll be notified when your options are ready.",
            400
        );
    }
};

/*
 * Late return: how long a customer who chooses to wait keeps waiting before
 * the booking is refunded in full — LATE_RETURN_WAIT_MAX_HOURS after pickup,
 * or the booked return if that's sooner, and never before their deadline
 * to choose.
 */
const getLateReturnWaitUntil = (booking) => {
    const pickup = (
        getPickupReference(booking.startDate) || new Date(booking.startDate)
    ).getTime();

    return new Date(
        Math.max(
            Math.min(
                pickup + LATE_RETURN_WAIT_MAX_HOURS * HOUR_MS,
                new Date(booking.endDate).getTime()
            ),
            new Date(
                booking.maintenanceConflict?.respondBy || Date.now()
            ).getTime()
        )
    );
};

/* Why this booking can't move to another vehicle, or null. */
const getVehicleChangeBlocker = (booking) => {
    const hasApprovedExtension = (booking.extensions || []).some(
        (extension) =>
            extension.status === BOOKING_EXTENSION_STATUS.APPROVED
    );

    return hasApprovedExtension
        ? "This booking has an approved extension, so it can't be moved to another vehicle. Choose a full refund instead, or contact us."
        : null;
};

const assertNoPendingVehicleChangePayment = async (bookingId, session = null) => {
    const pending = await Payment.exists({
        booking: bookingId,
        paymentType: PAYMENT_TYPE.EXTENSION_FEE,
        status: PAYMENT_STATUS.PENDING,
    }).session(session);
    if (pending) {
        throw createError("Pay or cancel the outstanding top-up before choosing another vehicle, so its payment matches the booking price.", 409);
    }
};

/*
 * Pricing on another vehicle for the same dates (see buildReschedulePricing).
 * The move is forced by maintenance, so the booking's own discount comes
 * along to the new vehicle; `activeDiscounts` is from getActiveDiscounts.
 */
const quoteVehicleChange = (booking, vehicle, activeDiscounts = []) => {
    const pricing = buildReschedulePricing(
        booking,
        resolveVehicleRate(vehicle, activeDiscounts, {
            lockedDiscount: booking.pricing?.vehicleDiscount,
        }),
        booking.startDate,
        booking.endDate,
        Number(booking.pricing?.driverDailyRate || 0)
    );

    const previousTotalAmount = roundMoney(booking.pricing?.totalAmount);
    const totalAmount = roundMoney(pricing.totalAmount);

    return {
        pricing,
        summary: {
            previousDailyRate: roundMoney(booking.pricing?.dailyRate),
            dailyRate: roundMoney(pricing.dailyRate),
            previousTotalAmount,
            totalAmount,
            difference: roundMoney(totalAmount - previousTotalAmount),
        },
    };
};

/*
 * How a price difference would be settled, given what's been paid. With
 * `coverUpgrades` (a late return), a pricier vehicle costs the customer
 * nothing more: "covered" (preview only — stored as none + coveredAmount).
 */
const VEHICLE_CHANGE_COVERED = "covered";

const previewVehicleChangeSettlement = (
    summary,
    paid,
    reservationUnpaid,
    { coverUpgrades = false } = {}
) => {
    if (coverUpgrades && summary.difference > 0) {
        return {
            kind: VEHICLE_CHANGE_COVERED,
            amount: summary.difference,
        };
    }

    // Nothing paid yet: the new total is simply what's due.
    if (reservationUnpaid) {
        return {
            kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
            amount: 0,
        };
    }

    if (summary.difference > 0) {
        return {
            kind: BOOKING_RESCHEDULE_SETTLEMENT.CHARGE,
            amount: summary.difference,
        };
    }

    const refundable = roundMoney(paid - summary.totalAmount);

    if (summary.difference < 0 && refundable > 0) {
        return {
            kind: BOOKING_RESCHEDULE_SETTLEMENT.REFUND,
            amount: refundable,
        };
    }

    return {
        kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
        amount: 0,
    };
};

const isReservationUnpaid = async (bookingId) => {
    const payment = await Payment.findOne({
        booking: bookingId,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
    }).select("status").lean();
    // A booking created with no upfront fee legitimately has no payment yet.
    return !payment || [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELLED].includes(payment.status);
};

/*
 * Vehicles free for this booking's exact dates and times that the customer
 * may drive (self-drive license rules), each with its price for those dates
 * and the difference from what they booked. Same category first.
 */
const MAX_ALTERNATIVE_VEHICLES = 30;

const findAlternativeVehicles = async (
    booking,
    { paid, reservationUnpaid, coverUpgrades = false }
) => {
    const current = await Vehicle.findById(booking.vehicle)
        .select("category vehicleType")
        .lean();

    // Same kind of vehicle only: a car booking isn't offered a motorcycle
    // (nor is its driver, who may not be licensed for one).
    const candidates = await Vehicle.find({
        _id: { $ne: booking.vehicle },
        status: { $in: BOOKABLE_VEHICLE_STATUSES },
        "availability.bookingEnabled": { $ne: false },
        ...(current?.vehicleType
            ? { vehicleType: current.vehicleType }
            : {}),
    })
        .populate("category", "name")
        .lean();

    if (!candidates.length) {
        return [];
    }

    const booked = await findVehiclesWithBookingConflict(
        candidates.map((vehicle) => vehicle._id),
        booking.startDate,
        booking.endDate
    );

    const selfDrive =
        booking.driverOption === BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER;

    const activeDiscounts = await getActiveDiscounts();

    const alternatives = [];

    for (const vehicle of candidates) {
        if (booked.has(String(vehicle._id))) {
            continue;
        }

        try {
            await validateVehicleDateAvailability(
                vehicle,
                booking.startDate,
                booking.endDate
            );

            if (selfDrive) {
                await ensureCustomerCanDriveVehicle(
                    booking.customer,
                    vehicle
                );
            }
        } catch {
            continue;
        }

        const { summary } = quoteVehicleChange(
            booking,
            vehicle,
            activeDiscounts
        );

        alternatives.push({
            _id: vehicle._id,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            vehicleType: vehicle.vehicleType,
            // Just the cover photo.
            images: [
                (vehicle.images || []).find((image) => image?.isPrimary) ??
                    vehicle.images?.[0],
            ].filter(Boolean),
            category: vehicle.category
                ? { _id: vehicle.category._id, name: vehicle.category.name }
                : null,
            specifications: {
                transmission: vehicle.specifications?.transmission,
                fuelType: vehicle.specifications?.fuelType,
                seatingCapacity: vehicle.specifications?.seatingCapacity,
            },
            sameCategory:
                Boolean(current?.category) &&
                String(vehicle.category?._id ?? vehicle.category) ===
                    String(current.category),
            ...summary,
            // What the customer's total would be (a covered upgrade keeps
            // their current price).
            customerTotalAmount:
                coverUpgrades && summary.difference > 0
                    ? summary.previousTotalAmount
                    : summary.totalAmount,
            settlement: previewVehicleChangeSettlement(
                summary,
                paid,
                reservationUnpaid,
                { coverUpgrades }
            ),
        });
    }

    return alternatives
        .sort(
            (a, b) =>
                Number(b.sameCategory) - Number(a.sameCategory) ||
                Math.abs(a.difference) - Math.abs(b.difference)
        )
        .slice(0, MAX_ALTERNATIVE_VEHICLES);
};

/*
 * Admin: offers the customer another vehicle or a full refund. For a late
 * return (normally sent automatically) this sends them early, with the
 * late-return deadline and the option to wait.
 */
const sendMaintenanceConflictOptions = async (bookingId, adminId) => {
    const booking = await findBookingById(bookingId);

    await assertOpenMaintenanceConflict(booking, "admin");

    if (isLateReturnCause(booking.maintenanceConflict)) {
        if (
            booking.maintenanceConflict.status !==
            BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED
        ) {
            throw createError(
                "The customer already has their options.",
                409
            );
        }

        const sent = await openLateReturnOptions(booking, {
            actorId: adminId,
        });

        if (!sent) {
            throw createError(
                "This booking was already updated by another request.",
                409
            );
        }

        return populateBooking(sent);
    }

    const respondBy = getMaintenanceConflictRespondBy(booking);

    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            status: { $in: RESCHEDULABLE_STATUSES },
            "maintenanceConflict.status": {
                $in: BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES,
            },
        },
        {
            $set: {
                "maintenanceConflict.status":
                    BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
                "maintenanceConflict.optionsSentAt": new Date(),
                "maintenanceConflict.optionsSentBy": adminId,
                "maintenanceConflict.respondBy": respondBy,
                "audit.updatedBy": adminId,
            },
            $push: {
                statusHistory: {
                    status: booking.status,
                    changedBy: adminId,
                    reason: "Maintenance conflict: options sent",
                    notes: `The customer was asked to choose another vehicle or a full refund by ${formatMaintenanceDate(
                        respondBy
                    )}.`,
                },
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This booking was already updated by another request.",
            409
        );
    }

    const vehicle = await Vehicle.findById(updated.vehicle)
        .select("brand model")
        .lean();

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: "Action Needed: Your Vehicle Is Unavailable",
        message: `The ${vehicleDisplayName(
            vehicle
        )} you booked for ${formatMaintenanceDate(
            updated.startDate
        )} ${describeMaintenanceEnd(
            updated.maintenanceConflict.maintenanceUntil
        )}, so it won't be ready for your rental. Open your booking to choose another vehicle for the same dates, or cancel for a full refund. Please choose by ${formatMaintenanceDate(
            respondBy
        )} — after that your booking is cancelled and fully refunded automatically.`,
        variant: "warning",
        email: {
            actionLabel: "Choose an option",
        },
    });

    return populateBooking(updated);
};

/*
 * What the customer can choose: the vehicles they can move to (each priced
 * for their dates) and the full refund amount.
 */
const getMaintenanceConflictOptions = async (bookingId, userId, role) => {
    const booking = await findBookingById(bookingId);

    assertMaintenanceConflictActor(booking, userId, role);

    await assertOpenMaintenanceConflict(booking, role);

    const [paid, reservationUnpaid] = await Promise.all([
        getPrePickupTotalPaid(booking._id),
        isReservationUnpaid(booking._id),
    ]);

    const blocker = getVehicleChangeBlocker(booking);
    const conflict = booking.maintenanceConflict;
    const lateReturn = isLateReturnCause(conflict);

    const alternatives = blocker
        ? []
        : await findAlternativeVehicles(booking, {
              paid,
              reservationUnpaid,
              coverUpgrades: lateReturn,
          });

    return {
        status: conflict.status,
        cause: conflict.cause || BOOKING_VEHICLE_CONFLICT_CAUSE.MAINTENANCE,
        maintenanceMode: conflict.maintenanceMode,
        maintenanceUntil: conflict.maintenanceUntil,
        respondBy: conflict.respondBy,
        // Late return: when the vehicle was due back from the previous
        // rental (never who has it), and the waiting option.
        dueBackAt: lateReturn ? conflict.dueBackAt : null,
        coversUpgrades: lateReturn,
        waitAvailable:
            lateReturn &&
            conflict.status ===
                BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
        waiting:
            lateReturn &&
            conflict.status === BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING,
        waitUntil: lateReturn
            ? conflict.waitUntil || getLateReturnWaitUntil(booking)
            : null,
        startDate: booking.startDate,
        endDate: booking.endDate,
        currentTotalAmount: roundMoney(booking.pricing?.totalAmount),
        reservationUnpaid,
        vehicleChangeAvailable: !blocker,
        vehicleChangeBlockedReason: blocker,
        alternatives,
        refundAmount: roundMoney(paid),
    };
};

/* Moves the booking to another vehicle for the same dates. */
const changeVehicleForMaintenanceConflict = async (
    bookingId,
    vehicleId,
    userId,
    role
) => {
    const booking = await findBookingById(bookingId);

    assertMaintenanceConflictActor(booking, userId, role);

    await assertOpenMaintenanceConflict(booking, role);

    const blocker = getVehicleChangeBlocker(booking);

    if (blocker) {
        throw createError(blocker, 400);
    }

    await assertNoPendingVehicleChangePayment(booking._id);

    if (String(vehicleId) === String(booking.vehicle)) {
        throw createError("Choose a different vehicle.", 400);
    }

    const newVehicle = await Vehicle.findById(vehicleId);

    if (!newVehicle) {
        throw createError("Vehicle not found.", 404);
    }

    validateVehicleBookingEligibility(newVehicle);

    await validateVehicleDateAvailability(
        newVehicle,
        booking.startDate,
        booking.endDate
    );

    await ensureNoBookingConflict(
        newVehicle._id,
        booking.startDate,
        booking.endDate,
        booking._id
    );

    if (booking.driverOption === BOOKING_DRIVER_OPTIONS.WITHOUT_DRIVER) {
        await ensureCustomerCanDriveVehicle(booking.customer, newVehicle);
    }

    const previousVehicle = await Vehicle.findById(booking.vehicle)
        .select("brand model operator vehicleType")
        .lean();

    if (
        previousVehicle?.vehicleType &&
        newVehicle.vehicleType !== previousVehicle.vehicleType
    ) {
        throw createError(
            `Choose another ${previousVehicle.vehicleType.toLowerCase()} — the booking can't change vehicle type.`,
            400
        );
    }

    const { pricing: quotedPricing, summary } = quoteVehicleChange(
        booking,
        newVehicle,
        await getActiveDiscounts()
    );

    /*
     * Late return: not the customer's doing, so a pricier vehicle is a free
     * upgrade — they keep their current price and the platform covers the
     * difference (pricing.platformCoveredAmount, added to the new partner's
     * payout). A cheaper one is repriced and refunded as usual.
     */
    const lateReturn = isLateReturnCause(booking.maintenanceConflict);
    const coveredAmount =
        lateReturn && summary.difference > 0
            ? roundMoney(summary.difference)
            : 0;

    const pricing = coveredAmount
        ? {
              ...(typeof booking.toObject === "function"
                  ? booking.toObject().pricing
                  : booking.pricing),
              platformCoveredAmount: coveredAmount,
          }
        : quotedPricing;

    const reservationUnpaid = await isReservationUnpaid(booking._id);

    // An unpaid reservation (or pay-in-full) payment follows the new price.
    if (reservationUnpaid && !coveredAmount) {
        await syncReservationPaymentAmount(booking, {
            previousTotalAmount: roundMoney(booking.pricing?.totalAmount),
            previousUpfrontAmount: roundMoney(getUpfrontFees(booking).total),
            pricing,
            updatedBy: userId,
            prepareOnly: true,
        });
    }



    // A percentage voucher's discount follows the new rate (a covered
    // upgrade keeps the old price, voucher included).
    const voucherUpdate = booking.voucher?.voucher && !coveredAmount
        ? {
              "voucher.discountAmount": roundMoney(
                  Object.entries(pricing.voucher?.discount || {})
                      .filter(([key]) => key.endsWith("Discount"))
                      .reduce(
                          (sum, [, value]) => sum + (Number(value) || 0),
                          0
                      )
              ),
          }
        : {};

    const changeId = new mongoose.Types.ObjectId();
    const actorRole = role === "admin" ? "admin" : "customer";
    const newName = vehicleDisplayName(newVehicle);
    const oldName = vehicleDisplayName(previousVehicle);

    // Atomic: a cancel, pickup or second choice racing this can't also win.
    const updated = await withBookingChangeTransaction(
        booking, { vehicle: newVehicle._id }, async (session) => {
            await assertNoPendingVehicleChangePayment(booking._id, session);
            if (reservationUnpaid && !coveredAmount) {
                await syncReservationPaymentAmount(booking, {
                    previousTotalAmount: roundMoney(booking.pricing?.totalAmount),
                    previousUpfrontAmount: roundMoney(getUpfrontFees(booking).total),
                    pricing,
                    updatedBy: userId,
                    session,
                });
            }
            await closePendingExtensions(booking, userId, "The booking moved to another vehicle.", session);
            return Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    status: booking.status,
                    vehicle: booking.vehicle,
                    "maintenanceConflict.status": booking.maintenanceConflict.status,
                },
                {
                    $set: {
                        vehicle: newVehicle._id,
                        pricing,
                        ...voucherUpdate,
                        "audit.updatedBy": userId,
                        "maintenanceConflict.status":
                            BOOKING_MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED,
                        "maintenanceConflict.resolvedAt": new Date(),
                        "maintenanceConflict.resolvedBy": userId,
                        "maintenanceConflict.resolvedByRole": actorRole,
                        "maintenanceConflict.resolutionNote": `Moved from the ${oldName} to the ${newName}.${
                            coveredAmount
                                ? ` Free upgrade: the platform covers the ${formatAmount(
                                      coveredAmount
                                  )} difference.`
                                : ""
                        }`,
                        "maintenanceConflict.vehicleChange": {
                            changeId,
                            previousVehicle: booking.vehicle,
                            newVehicle: newVehicle._id,
                            pricing: { ...summary, coveredAmount },
                            settlement: {
                                kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
                                amount: 0,
                                payment: null,
                                manual: false,
                            },
                        },
                    },
                    $push: {
                        vehicleChanges: {
                            changeId,
                            previousVehicle: booking.vehicle,
                            newVehicle: newVehicle._id,
                            changedAt: new Date(),
                            changedBy: userId,
                            previousTotalAmount: summary.previousTotalAmount,
                            // What the customer's booking now totals.
                            totalAmount: coveredAmount
                                ? summary.previousTotalAmount
                                : summary.totalAmount,
                        },
                        statusHistory: {
                            status: booking.status,
                            changedBy: userId,
                            reason: "Moved to another vehicle",
                            notes: `Moved from the ${oldName} to the ${newName} by the ${actorRole} after ${
                                lateReturn ? "a late return" : "a maintenance conflict"
                            } (${
                                coveredAmount
                                    ? `free upgrade — ${formatAmount(
                                          coveredAmount
                                      )} covered by the platform`
                                    : summary.difference === 0
                                      ? "same price"
                                      : `${summary.difference > 0 ? "+" : "-"}${formatAmount(
                                            Math.abs(summary.difference)
                                        )}`
                            }).`,
                        },
                    },
                },
                { new: true, session }
            );
        }
    );

    if (!updated) {
        throw createError(
            "This booking was already updated by another request. Please refresh and try again.",
            409
        );
    }

    let settlement = {
        kind: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
        amount: 0,
        payment: null,
        manual: false,
    };

    // A covered upgrade leaves the customer's price as it was: nothing to
    // charge or refund.
    if (!reservationUnpaid && !coveredAmount) {
        const refundSettings =
            (await Settings.findOne().select("refundSettings").lean()) || {};

        settlement = await settlePriceChange(
            updated,
            { changeId, pricing: summary },
            userId,
            Number(
                refundSettings?.refundSettings?.autoApproveRefundThreshold ??
                    0
            ),
            "vehicleChange"
        );

        await Booking.updateOne(
            { _id: updated._id },
            {
                $set: {
                    "maintenanceConflict.vehicleChange.settlement":
                        settlement,
                    "vehicleChanges.$[change].settlement": {
                        kind: settlement.kind,
                        amount: settlement.amount,
                        allocations: settlement.allocations,
                    },
                },
            },
            { arrayFilters: [{ "change.changeId": changeId }] }
        );
    }

    // The old vehicle no longer holds this booking; the new one does.
    await refreshVehicleReservationStatus(booking.vehicle);

    if (updated.status === BOOKING_STATUS.APPROVED) {
        await Vehicle.updateOne(
            { _id: newVehicle._id, status: VEHICLE_STATUS.AVAILABLE },
            { $set: { status: VEHICLE_STATUS.RESERVED } }
        );
    }

    const settlementNote = coveredAmount
        ? ` It's a free upgrade: the ${newName} normally costs ${formatAmount(
              coveredAmount
          )} more for your dates, but your price stays the same — we cover the difference.`
        : settlement.kind === BOOKING_RESCHEDULE_SETTLEMENT.CHARGE
            ? ` The ${newName} costs ${formatAmount(
                  settlement.amount
              )} more for your dates — please pay the difference from your booking before pickup.`
            : settlement.kind === BOOKING_RESCHEDULE_SETTLEMENT.REFUND
              ? ` It costs less, so ${formatAmount(
                    settlement.amount
                )} you already paid is being refunded.`
              : summary.difference < 0
                ? ` It costs ${formatAmount(
                      Math.abs(summary.difference)
                  )} less, taken off what's due.`
                : summary.difference > 0
                  ? ` Your new total is ${formatAmount(
                        summary.totalAmount
                    )}.`
                  : " The price stays the same.";

    await notifyBookingCustomer(updated, {
        type: "booking",
        title:
            actorRole === "admin"
                ? "We Moved Your Booking to Another Vehicle"
                : "Vehicle Changed",
        message: `Your booking for ${formatMaintenanceDate(
            updated.startDate
        )} is now with the ${newName} instead of the ${oldName}.${settlementNote}`,
        variant: "success",
        email: true,
    });

    if (actorRole === "customer") {
        try {
            await notifyAdmins({
                type: "booking",
                title: "Customer Chose Another Vehicle",
                message: `The customer moved booking ${updated.bookingCode} from the ${oldName} to the ${newName}${
                    lateReturn ? " after a late return" : ""
                }${
                    coveredAmount
                        ? ` (free upgrade — the platform covers ${formatAmount(
                              coveredAmount
                          )}, and the new vehicle's partner is paid its full rate)`
                        : summary.difference !== 0
                          ? ` (${summary.difference > 0 ? "+" : "-"}${formatAmount(
                                Math.abs(summary.difference)
                            )})`
                          : ""
                }.${updated.status === BOOKING_STATUS.APPROVED ? " It stays approved." : ""}`,
                variant: "info",
                category: "Booking",
                metadata: {
                    reference: updated.bookingCode,
                    relatedId: updated._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of a vehicle change:",
                notificationError
            );
        }
    }

    await notifyVehicleOperator(previousVehicle?.operator, updated, {
        type: "booking",
        title: "Booking Moved Off Your Vehicle",
        message: `Booking ${updated.bookingCode} (${describeRange(
            updated.startDate,
            updated.endDate
        )}) moved off your ${oldName} because ${
            lateReturn
                ? "its previous renter didn't return it in time"
                : "it's under maintenance"
        }.`,
        variant: "warning",
    });

    await notifyVehicleOperator(newVehicle.operator, updated, {
        type: "booking",
        title: "New Booking on Your Vehicle",
        message: `Booking ${updated.bookingCode} (${describeRange(
            updated.startDate,
            updated.endDate
        )}) was moved to your ${newName}.`,
        variant: "info",
    });

    return populateBooking(await findBookingById(updated._id));
};

/* Cancels the booking with a full refund (customer's choice or admin's). */
const refundMaintenanceConflict = async (bookingId, userId, role) => {
    const booking = await findBookingById(bookingId);

    assertMaintenanceConflictActor(booking, userId, role);

    await assertOpenMaintenanceConflict(booking, role);

    const vehicle = await Vehicle.findById(booking.vehicle)
        .select("brand model")
        .lean();

    const actorRole = role === "admin" ? "admin" : "customer";
    const lateReturn = isLateReturnCause(booking.maintenanceConflict);
    const why = lateReturn
        ? "the previous renter didn't return the vehicle in time"
        : "the vehicle went under maintenance";

    const result = await cancelBooking(
        booking._id,
        userId,
        actorRole === "admin"
            ? `Cancelled by admin with a full refund: ${why}.`
            : `The customer chose a full refund: ${why}.`,
        actorRole,
        {
            waiveFees: true,
            resolvedByRole: actorRole,
            customerMessage: `Your booking of the ${vehicleDisplayName(
                vehicle
            )} for ${formatMaintenanceDate(
                booking.startDate
            )} has been cancelled because ${
                lateReturn
                    ? "the vehicle wasn't returned in time by its previous renter"
                    : "the vehicle needs maintenance"
            }.`,
        }
    );

    if (actorRole === "customer") {
        try {
            await notifyAdmins({
                type: "booking",
                title: "Customer Chose a Full Refund",
                message: `The customer cancelled booking ${booking.bookingCode} for a full refund instead of moving to another vehicle (the ${vehicleDisplayName(
                    vehicle
                )} ${
                    lateReturn
                        ? "wasn't back from its previous rental in time"
                        : "is under maintenance"
                }).`,
                variant: "info",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of a maintenance refund:",
                notificationError
            );
        }
    }

    return result;
};

/*
 * Late return: the customer keeps the booking and waits for the vehicle.
 * Pickup happens when it's back (the rental re-times to the actual hand-
 * over, full duration kept). Until waitUntil they can still switch or take
 * a full refund; past it with the vehicle still out, full refund.
 */
const waitForLateVehicle = async (bookingId, userId, role) => {
    const booking = await findBookingById(bookingId);

    assertMaintenanceConflictActor(booking, userId, role);

    await assertOpenMaintenanceConflict(booking, role);

    const conflict = booking.maintenanceConflict;

    if (!isLateReturnCause(conflict)) {
        throw createError(
            "Waiting is only offered when the vehicle is running late from its previous rental.",
            400
        );
    }

    if (conflict.status !== BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER) {
        throw createError(
            conflict.status === BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING
                ? "You're already waiting for this vehicle."
                : "Waiting isn't available for this booking yet.",
            400
        );
    }

    const waitUntil = getLateReturnWaitUntil(booking);
    const actorRole = role === "admin" ? "admin" : "customer";

    const updated = await Booking.findOneAndUpdate(
        {
            _id: booking._id,
            status: booking.status,
            "maintenanceConflict.status":
                BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
        },
        {
            $set: {
                "maintenanceConflict.status":
                    BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING,
                "maintenanceConflict.waitingSince": new Date(),
                "maintenanceConflict.waitUntil": waitUntil,
                "audit.updatedBy": userId,
            },
            $push: {
                statusHistory: {
                    status: booking.status,
                    changedBy: userId,
                    reason: "Late return: waiting for the vehicle",
                    notes: `The ${actorRole} chose to wait for the vehicle. If it isn't back by ${formatMaintenanceDate(
                        waitUntil
                    )}, the booking is cancelled and refunded in full.`,
                },
            },
        },
        { new: true }
    );

    if (!updated) {
        throw createError(
            "This booking was already updated by another request. Please refresh and try again.",
            409
        );
    }

    const vehicle = await Vehicle.findById(updated.vehicle)
        .select("brand model plateNumber")
        .lean();

    await notifyBookingCustomer(updated, {
        type: "booking",
        title: "You're Waiting for Your Vehicle",
        message: `${
            actorRole === "admin" ? "We've noted that you'll" : "Thanks — you'll"
        } wait for the ${vehicleDisplayName(
            vehicle
        )}. We'll notify you the moment it's back and ready. Your rental starts when you pick it up, and you still get the full booked duration from then. Changed your mind? You can still switch to another vehicle (no extra cost) or cancel for a full refund from your booking. If it isn't back by ${formatMaintenanceDate(
            waitUntil
        )}, your booking is cancelled and refunded in full automatically.`,
        variant: "info",
        email: true,
    });

    try {
        await notifyAdmins({
            type: "Late Return Conflict",
            title: "Customer Is Waiting for a Late Vehicle",
            message: `${
                actorRole === "admin"
                    ? "An admin set booking"
                    : "The customer of booking"
            } ${updated.bookingCode} ${
                actorRole === "admin" ? "to wait" : "chose to wait"
            } for the ${vehicleDisplayName(vehicle)}${
                vehicle?.plateNumber ? ` (${vehicle.plateNumber})` : ""
            }. It's refunded in full automatically if the vehicle isn't back by ${formatMaintenanceDate(
                waitUntil
            )}. Getting the previous renter to return it is now the priority.`,
            variant: "info",
            category: "Booking",
            metadata: {
                reference: updated.bookingCode,
                relatedId: updated._id,
                relatedModel: "Booking",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins that a customer is waiting:",
            notificationError
        );
    }

    return populateBooking(updated);
};

/*
 * Sweep: customers who didn't choose by their deadline are cancelled and
 * refunded in full; customers nearing it get one reminder; admins are
 * reminded of conflicts nobody has sent options for as pickup nears.
 */
const MAINTENANCE_CONFLICT_CUSTOMER_REMINDER_HOURS = 6;
const MAINTENANCE_CONFLICT_ADMIN_REMINDER_HOURS = 24;

export const processMaintenanceConflicts = async () => {
    const now = new Date();

    // Past the deadline to choose — or, for a customer waiting on a late
    // vehicle, past how long they agreed to wait.
    const overdue = await Booking.find({
        status: { $in: RESCHEDULABLE_STATUSES },
        $or: [
            {
                "maintenanceConflict.status":
                    BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
                "maintenanceConflict.respondBy": { $lte: now },
            },
            {
                "maintenanceConflict.status":
                    BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING,
                "maintenanceConflict.waitUntil": { $lte: now },
            },
        ],
    })
        .select("_id bookingCode vehicle startDate maintenanceConflict")
        .lean();

    for (const booking of overdue) {
        try {
            const lateReturn = isLateReturnCause(booking.maintenanceConflict);
            const waited =
                booking.maintenanceConflict.status ===
                BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING;

            if (lateReturn) {
                // Back after all? Then the booking goes ahead instead.
                await reconcileLateReturnConflicts(booking.vehicle);

                const fresh = await Booking.findById(booking._id)
                    .select("maintenanceConflict.status")
                    .lean();

                if (
                    fresh?.maintenanceConflict?.status !==
                    booking.maintenanceConflict.status
                ) {
                    continue;
                }
            }

            const vehicle = await Vehicle.findById(booking.vehicle)
                .select("brand model")
                .lean();

            const reasonText = lateReturn
                ? waited
                    ? "The vehicle still wasn't back from its previous rental by the end of the wait"
                    : "No option was chosen in time and the vehicle still wasn't back from its previous rental"
                : "No option was chosen in time after a maintenance conflict";

            await cancelBooking(
                booking._id,
                null,
                `${reasonText} — cancelled with a full refund.`,
                "admin",
                {
                    waiveFees: true,
                    resolvedByRole: "system",
                    customerMessage: lateReturn
                        ? waited
                            ? `We're sorry — the ${vehicleDisplayName(
                                  vehicle
                              )} still isn't back from its previous rental, so your booking for ${formatMaintenanceDate(
                                  booking.startDate
                              )} has been cancelled.`
                            : `The ${vehicleDisplayName(
                                  vehicle
                              )} still isn't back from its previous rental and no option was chosen in time, so your booking for ${formatMaintenanceDate(
                                  booking.startDate
                              )} has been cancelled.`
                        : `No option was chosen in time for your booking of the ${vehicleDisplayName(
                              vehicle
                          )} on ${formatMaintenanceDate(
                              booking.startDate
                          )}, so it has been cancelled because the vehicle needs maintenance.`,
                }
            );

            await notifyAdmins({
                type: "booking",
                title: lateReturn
                    ? "Late Return: Booking Auto-Refunded"
                    : "Maintenance Conflict Auto-Refunded",
                message: lateReturn
                    ? `Booking ${booking.bookingCode} was cancelled and refunded in full: ${
                          waited
                              ? "the customer waited, but"
                              : "the customer didn't choose an option, and"
                      } the vehicle still isn't back from its previous rental. Check the late rental's "Late return impact" to review the cost.`
                    : `The customer didn't choose another vehicle or a refund for booking ${booking.bookingCode} in time, so it was cancelled and refunded in full.`,
                variant: "info",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (sweepError) {
            console.error(
                `Failed to auto-refund vehicle conflict on booking ${booking._id}:`,
                sweepError
            );
        }
    }

    // Reminders below are for maintenance: a late return's deadline is
    // hours away and its customer was just told (and is told again on
    // every change).
    const closingSoon = await Booking.find({
        "maintenanceConflict.cause": {
            $ne: BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
        },
        "maintenanceConflict.status":
            BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
        "maintenanceConflict.respondBy": {
            $gt: now,
            $lte: new Date(
                now.getTime() +
                    MAINTENANCE_CONFLICT_CUSTOMER_REMINDER_HOURS * HOUR_MS
            ),
        },
        status: { $in: RESCHEDULABLE_STATUSES },
    })
        .select("_id customer bookingCode startDate maintenanceConflict")
        .lean();

    for (const booking of closingSoon) {
        try {
            if (
                await hasRecentNotification({
                    recipient: booking.customer,
                    type: "Maintenance Conflict Reminder",
                    relatedId: booking._id,
                    since: booking.maintenanceConflict.optionsSentAt,
                })
            ) {
                continue;
            }

            await notifyUser(booking.customer, {
                type: "Maintenance Conflict Reminder",
                title: "Reminder: Choose an Option for Your Booking",
                message: `Your booked vehicle for ${formatMaintenanceDate(
                    booking.startDate
                )} is under maintenance. Choose another vehicle or a full refund by ${formatMaintenanceDate(
                    booking.maintenanceConflict.respondBy
                )}, or your booking will be cancelled and fully refunded automatically.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
                email: {
                    actionLabel: "Choose an option",
                },
            });
        } catch (reminderError) {
            console.error(
                `Failed to remind the customer of booking ${booking._id} about its maintenance conflict:`,
                reminderError
            );
        }
    }

    const unsent = await Booking.find({
        // Late returns send their options automatically.
        "maintenanceConflict.cause": {
            $ne: BOOKING_VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
        },
        "maintenanceConflict.status":
            BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
        status: { $in: RESCHEDULABLE_STATUSES },
        startDate: {
            $lte: new Date(
                now.getTime() +
                    MAINTENANCE_CONFLICT_ADMIN_REMINDER_HOURS * HOUR_MS
            ),
        },
    })
        .select("_id bookingCode startDate")
        .lean();

    for (const booking of unsent) {
        try {
            if (
                await hasRecentNotification({
                    type: "Maintenance Conflict Reminder",
                    relatedId: booking._id,
                    since: new Date(now.getTime() - 12 * HOUR_MS),
                })
            ) {
                continue;
            }

            await notifyAdmins({
                type: "Maintenance Conflict Reminder",
                title: "Maintenance Conflict Needs Action",
                message: `Booking ${booking.bookingCode} (pickup ${formatMaintenanceDate(
                    booking.startDate
                )}) is still on a vehicle under maintenance, and its customer hasn't been sent their options yet. Send them now, or move or refund the booking yourself.`,
                variant: "warning",
                category: "Booking",
                metadata: {
                    reference: booking.bookingCode,
                    relatedId: booking._id,
                    relatedModel: "Booking",
                },
            });
        } catch (reminderError) {
            console.error(
                `Failed to remind admins about maintenance conflict on booking ${booking._id}:`,
                reminderError
            );
        }
    }
};

export {
    ensureCustomerLicenseForDateChange,
    sendMaintenanceConflictOptions,
    getMaintenanceConflictOptions,
    changeVehicleForMaintenanceConflict,
    refundMaintenanceConflict,
    waitForLateVehicle,
    previewBookingReschedule,
    requestBookingReschedule,
    approveBookingReschedule,
    changeBookingDriver,
    requestDriverChange,
    approveDriverChangeRequest,
    declineDriverChangeRequest,
    cancelDriverChangeRequest,
    rejectBookingReschedule,
    cancelBookingReschedule,
    createBooking,
    getBookings,
    getBookingById,
    updateBooking,
    approveBooking,
    rejectBooking,
    cancelBooking,
    getBookingCancellationPreview,
    expireBooking,
    markBookingNoShow,
    requestBookingExtension,
    approveBookingExtension,
    rejectBookingExtension,
    cancelBookingExtension,
    calculateDistanceFees,
    previewBookingLocationFees,
    resolveBookingLocationFees,
    findDefaultServiceLocation,
    ensurePickupPaymentVerified,
};
