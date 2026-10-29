import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import ManualRefund from "../models/ManualRefund.js";
import Payment from "../models/Payment.js";
import PayoutRequest from "../models/PayoutRequest.js";
import Rental from "../models/Rental.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";

import createError from "../utils/createError.js";
import {
    addDaysToDateKey,
    businessDayStart,
} from "../utils/businessTime.js";
import { isRefundInEffect } from "../utils/refundUtils.js";
import {
    addSummarySheet,
    addTableSheet,
    createWorkbook,
    workbookToBuffer,
} from "../utils/excelExport.js";

import {
    MANUAL_REFUND_STATUS,
    PAYMENT_REFUND_STATUS,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../constants/paymentConstants.js";
import {
    BOOKING_EXTENSION_STATUS,
} from "../constants/bookingConstants.js";
import { RENTAL_PAYMENT_STATUS } from "../constants/rentalConstants.js";
import { PAYOUT_STATUS } from "../constants/payoutConstants.js";
import { WITHDRAWAL_STATUS } from "../constants/withdrawalConstants.js";

/*
 * Admin "Export to Excel": the Bookings list, and the money side (payments,
 * refunds, partner payouts) as one workbook. Row builders are exported on
 * their own so tests can check the figures without parsing a file.
 *
 * Money is gathered from every place it is recorded, by the same rules the
 * Financials page and revenue dashboard use:
 *   - payments: online fees (Payment) + payments an admin recorded on the
 *     rental (Rental.payments, e.g. the balance paid at pickup);
 *   - refunds: rental refunds + refunds on a payment that no rental refund
 *     already tracks (its `gatewayPayment`) + refunds owed by hand.
 */

// Bounded by the JSON body limit (100kb ≈ 3,700 ids), with headroom.
export const MAX_EXPORT_BOOKINGS = 3000;

export const FINANCIAL_SECTIONS = ["payments", "refunds", "payouts"];

/* ---------- formatting helpers ---------- */

const money = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

const sum = (items, pick) =>
    money(items.reduce((total, item) => total + (Number(pick(item)) || 0), 0));

const personName = (person) =>
    [person?.firstName, person?.lastName].filter(Boolean).join(" ") ||
    person?.email ||
    "";

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model, vehicle?.year]
        .filter(Boolean)
        .join(" ");

const locationText = (location) =>
    location?.name || location?.address || "";

const titleCase = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());

// Only the last 4 digits: enough to recognise an account, not to use it.
const maskAccount = (number) => {
    const digits = String(number || "").replace(/\s/g, "");

    return digits.length > 4
        ? `${"•".repeat(Math.min(digits.length - 4, 7))}${digits.slice(-4)}`
        : digits;
};

const PAYMENT_STATUS_LABELS = {
    [PAYMENT_STATUS.PENDING]: "Pending",
    [PAYMENT_STATUS.VERIFIED]: "Verified",
    [PAYMENT_STATUS.REFUNDED]: "Refunded",
    [PAYMENT_STATUS.CANCELLED]: "Cancelled",
};

const PAYMENT_METHOD_LABELS = {
    GCASH: "GCash (online)",
    CASH_ON_PICKUP: "Cash on Pickup",
};

const GATEWAY_REFUND_STATUS_LABELS = {
    [PAYMENT_REFUND_STATUS.PENDING]: "Pending",
    [PAYMENT_REFUND_STATUS.PROCESSING]: "Processing",
    [PAYMENT_REFUND_STATUS.SUCCEEDED]: "Completed",
    [PAYMENT_REFUND_STATUS.FAILED]: "Failed",
    [PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION]: "Needs manual payout",
};

const PAYMENT_REFUND_REASON_LABELS = {
    duplicate: "Duplicate payment",
    fraudulent: "Fraudulent",
    requested_by_customer: "Requested by customer",
    others: "Other",
};

const paymentPurpose = (payment) => {
    if (payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE) {
        return "Reservation fee";
    }

    if (payment.bookingReschedule) {
        return "Reschedule fee";
    }

    if (payment.bookingVehicleChange) {
        return "Vehicle change fee";
    }

    return "Extension fee";
};

const isCollected = (payment) =>
    payment.status === PAYMENT_STATUS.VERIFIED ||
    payment.status === PAYMENT_STATUS.REFUNDED;

// When the money came in — the same date the revenue dashboard uses.
const paymentReceivedAt = (payment) =>
    payment.processedAt ?? payment.createdAt;

const rentalRefundDate = (refund) =>
    refund.createdAt ?? refund.processedAt;

/* ---------- date range ---------- */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/*
 * "YYYY-MM-DD" bounds as Manila calendar days, `to` inclusive. Either may be
 * left out for an open-ended range.
 */
export const parseDateRange = ({ from, to } = {}) => {
    for (const [label, value] of [
        ["from", from],
        ["to", to],
    ]) {
        if (value && !DATE_KEY.test(value)) {
            throw createError(
                `"${label}" must be a date in YYYY-MM-DD format.`,
                400
            );
        }
    }

    if (from && to && from > to) {
        throw createError(
            "The start date must be on or before the end date.",
            400
        );
    }

    return {
        from: from || null,
        to: to || null,
        start: from ? businessDayStart(from) : null,
        end: to ? businessDayStart(addDaysToDateKey(to, 1)) : null,
    };
};

const inRange = (value, range) => {
    if (!range.start && !range.end) {
        return true;
    }

    if (!value) {
        return false;
    }

    const time = new Date(value).getTime();

    return (
        (!range.start || time >= range.start.getTime()) &&
        (!range.end || time < range.end.getTime())
    );
};

/*
 * Ids of payments whose refund a rental refund entry tracks: that money is
 * already counted through Rental.refunds, so the payment-level copy of it is
 * left out (see onlineRevenueService.js).
 */
const getRentalTrackedPaymentIds = async () => {
    // $elemMatch, not "refunds.gatewayPayment": { $ne: null } - on an array
    // that skips any rental with even one refund lacking a gatewayPayment.
    const ids = await Rental.distinct("refunds.gatewayPayment", {
        refunds: { $elemMatch: { gatewayPayment: { $ne: null } } },
    });

    return new Set(ids.filter(Boolean).map(String));
};

/* ---------- bookings ---------- */

export const BOOKING_COLUMNS = [
    { header: "Booking code", key: "bookingCode", width: 18 },
    { header: "Booked on", key: "createdAt", type: "datetime", width: 20 },
    { header: "Status", key: "status", width: 16 },
    { header: "Customer", key: "customerName", width: 24 },
    { header: "Customer email", key: "customerEmail", width: 28 },
    { header: "Customer phone", key: "customerPhone", width: 16 },
    { header: "Vehicle", key: "vehicle", width: 24 },
    { header: "Plate no.", key: "plateNumber", width: 12 },
    { header: "Partner (owner)", key: "partner", width: 22 },
    { header: "Driver option", key: "driverOption", width: 15 },
    { header: "Driver", key: "driver", width: 20 },
    { header: "Pickup date & time", key: "startDate", type: "datetime", width: 20 },
    { header: "Return date & time", key: "endDate", type: "datetime", width: 20 },
    { header: "Actually returned", key: "returnedAt", type: "datetime", width: 20 },
    { header: "Rental days", key: "rentalDays", type: "number", width: 11 },
    { header: "Pickup location", key: "pickupLocation", width: 30 },
    { header: "Return location", key: "returnLocation", width: 30 },
    { header: "Daily rate", key: "dailyRate", type: "money", width: 13 },
    { header: "Vehicle discount", key: "vehicleDiscount", width: 18 },
    { header: "Rental subtotal", key: "subtotal", type: "money", width: 15 },
    { header: "Driver fee", key: "driverFee", type: "money", width: 13 },
    { header: "Pickup distance fee", key: "pickupDistanceFee", type: "money", width: 14 },
    { header: "Return distance fee", key: "returnDistanceFee", type: "money", width: 14 },
    { header: "Reservation fee", key: "reservationFee", type: "money", width: 14 },
    { header: "Voucher", key: "voucherCode", width: 14 },
    { header: "Voucher discount", key: "voucherDiscount", type: "money", width: 14 },
    { header: "Extension charges", key: "extensionCharges", type: "money", width: 14 },
    { header: "Booking total", key: "totalAmount", type: "money", width: 15 },
    { header: "Reservation payment", key: "reservationPaymentStatus", width: 16 },
    { header: "Paid online", key: "paidOnline", type: "money", width: 14 },
    { header: "Paid to admin (recorded)", key: "paidRecorded", type: "money", width: 15 },
    { header: "Rental code", key: "rentalCode", width: 16 },
    { header: "Late charges", key: "lateCharges", type: "money", width: 13 },
    { header: "Damage charges", key: "damageCharges", type: "money", width: 13 },
    { header: "Other charges", key: "otherCharges", type: "money", width: 13 },
    { header: "Final amount (rental)", key: "finalAmount", type: "money", width: 15 },
    { header: "Balance due", key: "balance", type: "money", width: 13 },
    { header: "Refunded / owed back", key: "refunded", type: "money", width: 15 },
    { header: "Security deposit", key: "depositStatus", width: 16 },
    { header: "Deposit held", key: "depositHeld", type: "money", width: 13 },
    { header: "Deposit deducted", key: "depositDeducted", type: "money", width: 14 },
    { header: "Cancel / reject reason", key: "endReason", width: 34 },
    { header: "Customer notes", key: "customerNotes", width: 34 },
];

const BOOKING_TOTALS = [
    "subtotal",
    "driverFee",
    "pickupDistanceFee",
    "returnDistanceFee",
    "reservationFee",
    "voucherDiscount",
    "extensionCharges",
    "totalAmount",
    "paidOnline",
    "paidRecorded",
    "lateCharges",
    "damageCharges",
    "otherCharges",
    "finalAmount",
    "balance",
    "refunded",
    "depositHeld",
    "depositDeducted",
];

const vehicleDiscountText = (discount) => {
    if (!discount) {
        return "";
    }

    return discount.label || discount.name || "Discount";
};

// The reason recorded when the booking moved into its current status.
const statusReason = (booking) => {
    const entry = [...(booking.statusHistory || [])]
        .reverse()
        .find((item) => item.status === booking.status);

    return entry?.reason || entry?.notes || "";
};

/*
 * One row per booking, in the order of `bookingIds` (the admin's filtered
 * and sorted list). Ids that no longer exist are skipped.
 */
export const getBookingExportRows = async (bookingIds = []) => {
    const ids = [...new Set(bookingIds.map(String))];

    if (ids.length === 0) {
        return [];
    }

    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    const [bookings, rentals, payments, manualRefunds] = await Promise.all([
        Booking.find({ _id: { $in: objectIds } })
            .populate("customer", "firstName lastName email phoneNumber")
            .populate({
                path: "vehicle",
                select: "brand model year plateNumber operator",
                populate: {
                    path: "operator",
                    select: "firstName lastName email",
                },
            })
            .populate("driver", "firstName lastName")
            .lean(),

        Rental.find({ booking: { $in: objectIds } })
            .select(
                "booking rentalCode status financial payments refunds securityDeposit return.date"
            )
            .lean(),

        Payment.find({ booking: { $in: objectIds } })
            .select("booking paymentType status amount refund")
            .lean(),

        ManualRefund.find({ booking: { $in: objectIds } })
            .select("booking amount status")
            .lean(),
    ]);

    const byBooking = (items) => {
        const map = new Map();

        for (const item of items) {
            const key = String(item.booking);
            map.set(key, [...(map.get(key) ?? []), item]);
        }

        return map;
    };

    const rentalByBooking = new Map(
        rentals.map((rental) => [String(rental.booking), rental])
    );
    const paymentsByBooking = byBooking(payments);
    const manualByBooking = byBooking(manualRefunds);
    const bookingById = new Map(
        bookings.map((booking) => [String(booking._id), booking])
    );

    return ids
        .map((id) => bookingById.get(id))
        .filter(Boolean)
        .map((booking) => {
            const key = String(booking._id);
            const rental = rentalByBooking.get(key) ?? null;
            const bookingPayments = paymentsByBooking.get(key) ?? [];
            const pricing = booking.pricing ?? {};
            const financial = rental?.financial ?? {};
            const deposit = rental?.securityDeposit ?? null;

            const reservation = bookingPayments.find(
                (payment) =>
                    payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE
            );

            const trackedByRental = new Set(
                (rental?.refunds ?? [])
                    .filter((refund) => refund.gatewayPayment)
                    .map((refund) => String(refund.gatewayPayment))
            );

            const refunded = money(
                sum(
                    (rental?.refunds ?? []).filter(isRefundInEffect),
                    (refund) => refund.amount
                ) +
                    sum(
                        bookingPayments.filter(
                            (payment) =>
                                payment.refund &&
                                payment.refund.status !==
                                    PAYMENT_REFUND_STATUS.FAILED &&
                                !trackedByRental.has(String(payment._id))
                        ),
                        (payment) => payment.refund.amount
                    ) +
                    sum(
                        (manualByBooking.get(key) ?? []).filter(
                            (refund) =>
                                refund.status !==
                                MANUAL_REFUND_STATUS.NOT_PAID
                        ),
                        (refund) => refund.amount
                    )
            );

            return {
                bookingCode: booking.bookingCode,
                createdAt: booking.createdAt,
                status: booking.status,
                customerName: personName(booking.customer),
                customerEmail: booking.customer?.email ?? "",
                customerPhone: booking.customer?.phoneNumber ?? "",
                vehicle: vehicleName(booking.vehicle),
                plateNumber: booking.vehicle?.plateNumber ?? "",
                partner: personName(booking.vehicle?.operator),
                driverOption: booking.driverOption,
                driver: personName(booking.driver),
                startDate: booking.startDate,
                endDate: booking.endDate,
                returnedAt: rental?.return?.date ?? null,
                rentalDays: pricing.rentalDays,
                pickupLocation: locationText(booking.pickupLocation),
                returnLocation: locationText(booking.returnLocation),
                dailyRate: pricing.dailyRate,
                vehicleDiscount: vehicleDiscountText(pricing.vehicleDiscount),
                subtotal: pricing.subtotal,
                driverFee: pricing.driverFee ?? 0,
                pickupDistanceFee: pricing.pickupDistanceFee ?? 0,
                returnDistanceFee: pricing.returnDistanceFee ?? 0,
                reservationFee: pricing.reservationFee,
                voucherCode: booking.voucher?.code ?? "",
                voucherDiscount: booking.voucher?.discountAmount ?? 0,
                extensionCharges: sum(
                    (booking.extensions ?? []).filter(
                        (extension) =>
                            extension.status ===
                            BOOKING_EXTENSION_STATUS.APPROVED
                    ),
                    (extension) => extension.pricing?.amount
                ),
                totalAmount: pricing.totalAmount,
                reservationPaymentStatus: reservation
                    ? PAYMENT_STATUS_LABELS[reservation.status] ??
                      reservation.status
                    : "No payment",
                paidOnline: sum(
                    bookingPayments.filter(isCollected),
                    (payment) => payment.amount
                ),
                paidRecorded: sum(
                    (rental?.payments ?? []).filter(
                        (payment) =>
                            payment.status === RENTAL_PAYMENT_STATUS.VERIFIED
                    ),
                    (payment) => payment.amount
                ),
                rentalCode: rental?.rentalCode ?? "",
                lateCharges: rental ? financial.lateCharges ?? 0 : null,
                damageCharges: rental ? financial.damageCharges ?? 0 : null,
                otherCharges: rental ? financial.otherCharges ?? 0 : null,
                finalAmount: rental ? financial.finalAmount ?? 0 : null,
                balance: rental ? financial.balance ?? 0 : null,
                refunded,
                depositStatus: deposit?.required ? deposit.status ?? "" : "",
                depositHeld: deposit?.required ? deposit.amountHeld ?? 0 : null,
                depositDeducted: deposit?.required
                    ? deposit.amountDeducted ?? 0
                    : null,
                endReason: statusReason(booking),
                customerNotes: booking.customerNotes ?? "",
            };
        });
};

export const buildBookingsWorkbook = async (bookingIds) => {
    const rows = await getBookingExportRows(bookingIds);
    const workbook = createWorkbook();

    addTableSheet(workbook, {
        name: "Bookings",
        columns: BOOKING_COLUMNS,
        rows,
        totals: BOOKING_TOTALS,
    });

    return { buffer: await workbookToBuffer(workbook), rowCount: rows.length };
};

/* ---------- payments ---------- */

export const PAYMENT_COLUMNS = [
    { header: "Date received", key: "date", type: "datetime", width: 20 },
    { header: "Recorded as", key: "source", width: 18 },
    { header: "Payment for", key: "purpose", width: 18 },
    { header: "Booking code", key: "bookingCode", width: 18 },
    { header: "Rental code", key: "rentalCode", width: 16 },
    { header: "Customer", key: "customerName", width: 24 },
    { header: "Customer email", key: "customerEmail", width: 28 },
    { header: "Method", key: "method", width: 16 },
    { header: "Paid with", key: "paidWith", width: 12 },
    { header: "Amount", key: "amount", type: "money", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Collected", key: "collected", type: "money", width: 14 },
    { header: "Verified on", key: "verifiedAt", type: "datetime", width: 20 },
    { header: "Verified by", key: "verifiedBy", width: 20 },
    { header: "Reference", key: "reference", width: 30 },
    { header: "Refund status", key: "refundStatus", width: 18 },
    { header: "Refund amount", key: "refundAmount", type: "money", width: 14 },
    { header: "Notes", key: "notes", width: 34 },
];

export const getPaymentExportRows = async (range) => {
    const [onlinePayments, rentals] = await Promise.all([
        Payment.find(
            range.end ? { createdAt: { $lt: range.end } } : {}
        )
            .populate("booking", "bookingCode")
            .populate("rental", "rentalCode")
            .populate("customer", "firstName lastName email")
            .populate("verification.verifiedBy", "firstName lastName")
            .lean(),

        Rental.find({ "payments.0": { $exists: true } })
            .select("rentalCode booking customer payments")
            .populate("booking", "bookingCode")
            .populate("customer", "firstName lastName email")
            .populate("payments.verifiedBy", "firstName lastName")
            .lean(),
    ]);

    const online = onlinePayments
        .filter((payment) => inRange(paymentReceivedAt(payment), range))
        .map((payment) => ({
            date: paymentReceivedAt(payment),
            source: "Online / booking fee",
            purpose: paymentPurpose(payment),
            bookingCode: payment.booking?.bookingCode ?? "",
            rentalCode: payment.rental?.rentalCode ?? "",
            customerName: personName(payment.customer),
            customerEmail: payment.customer?.email ?? "",
            method:
                PAYMENT_METHOD_LABELS[payment.paymentMethod] ??
                titleCase(payment.paymentMethod),
            paidWith: titleCase(payment.paymongo?.sourceType),
            amount: payment.amount,
            status:
                PAYMENT_STATUS_LABELS[payment.status] ?? payment.status,
            collected: isCollected(payment) ? payment.amount : 0,
            verifiedAt:
                payment.verification?.verifiedAt ??
                (isCollected(payment) ? payment.processedAt : null),
            verifiedBy: personName(payment.verification?.verifiedBy),
            reference:
                payment.paymongo?.providerReference ||
                payment.paymongo?.paymentId ||
                payment.paymongo?.chargeId ||
                "",
            refundStatus: payment.refund
                ? GATEWAY_REFUND_STATUS_LABELS[payment.refund.status] ??
                  payment.refund.status
                : "",
            refundAmount: payment.refund?.amount ?? null,
            notes: payment.notes ?? "",
        }));

    const recorded = rentals.flatMap((rental) =>
        (rental.payments ?? [])
            .filter((payment) => inRange(payment.paymentDate, range))
            .map((payment) => ({
                date: payment.paymentDate,
                source: "Recorded by admin",
                purpose: payment.type,
                bookingCode: rental.booking?.bookingCode ?? "",
                rentalCode: rental.rentalCode,
                customerName: personName(rental.customer),
                customerEmail: rental.customer?.email ?? "",
                method: payment.paymentMethod,
                paidWith: "",
                amount: payment.amount,
                status: payment.status,
                collected:
                    payment.status === RENTAL_PAYMENT_STATUS.VERIFIED
                        ? payment.amount
                        : 0,
                verifiedAt: payment.verifiedAt ?? null,
                verifiedBy: personName(payment.verifiedBy),
                reference: payment.reference ?? "",
                refundStatus: "",
                refundAmount: null,
                notes: [payment.notes, payment.rejectionReason]
                    .filter(Boolean)
                    .join(" — "),
            }))
    );

    return [...online, ...recorded].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );
};

/* ---------- refunds ---------- */

export const REFUND_COLUMNS = [
    { header: "Date", key: "date", type: "datetime", width: 20 },
    { header: "Refund type", key: "type", width: 26 },
    { header: "Booking code", key: "bookingCode", width: 18 },
    { header: "Rental code", key: "rentalCode", width: 16 },
    { header: "Customer", key: "customerName", width: 24 },
    { header: "Customer email", key: "customerEmail", width: 28 },
    { header: "Reason", key: "reason", width: 26 },
    { header: "Details", key: "details", width: 40 },
    { header: "Amount", key: "amount", type: "money", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Paid out", key: "payoutStatus", width: 20 },
    { header: "Refunded", key: "refunded", type: "money", width: 14 },
    { header: "Completed on", key: "completedAt", type: "datetime", width: 20 },
    { header: "Reference", key: "reference", width: 26 },
];

export const getRefundExportRows = async (range) => {
    const [rentals, paymentsWithRefund, manualRefunds, trackedIds] =
        await Promise.all([
            Rental.find({ "refunds.0": { $exists: true } })
                .select("rentalCode booking customer refunds")
                .populate("booking", "bookingCode")
                .populate("customer", "firstName lastName email")
                .lean(),

            Payment.find({
                refund: { $ne: null },
                paymentType: {
                    $in: [
                        PAYMENT_TYPE.RESERVATION_FEE,
                        PAYMENT_TYPE.EXTENSION_FEE,
                    ],
                },
            })
                .populate("booking", "bookingCode")
                .populate("rental", "rentalCode")
                .populate("customer", "firstName lastName email")
                .lean(),

            ManualRefund.find({})
                .populate("booking", "bookingCode")
                .populate("customer", "firstName lastName email")
                .lean(),

            getRentalTrackedPaymentIds(),
        ]);

    const rentalRefunds = rentals.flatMap((rental) =>
        (rental.refunds ?? [])
            .filter((refund) => inRange(rentalRefundDate(refund), range))
            .map((refund) => {
                // Legacy refunds have no status and read as Approved.
                const status = refund.status || "Approved";

                const payoutStatus =
                    refund.settledAt
                        ? "Settled by hand"
                        : refund.gatewayStatus &&
                            refund.gatewayStatus !== "not_applicable"
                          ? GATEWAY_REFUND_STATUS_LABELS[
                                refund.gatewayStatus
                            ] ?? refund.gatewayStatus
                          : "";

                return {
                    date: rentalRefundDate(refund),
                    type: "Rental refund",
                    bookingCode: rental.booking?.bookingCode ?? "",
                    rentalCode: rental.rentalCode,
                    customerName: personName(rental.customer),
                    customerEmail: rental.customer?.email ?? "",
                    reason: refund.reason,
                    details: [refund.description, refund.settlementNote]
                        .filter(Boolean)
                        .join(" — "),
                    amount: refund.amount,
                    status,
                    payoutStatus,
                    refunded: isRefundInEffect(refund) ? refund.amount : 0,
                    completedAt: refund.settledAt ?? refund.processedAt ?? null,
                    reference:
                        refund.gatewayRefundId || refund.reference || "",
                };
            })
    );

    const paymentRefunds = paymentsWithRefund
        .filter(
            (payment) =>
                !trackedIds.has(String(payment._id)) &&
                inRange(payment.refund.initiatedAt, range)
        )
        .map((payment) => {
            const { refund } = payment;
            const statusLabel =
                GATEWAY_REFUND_STATUS_LABELS[refund.status] ??
                refund.status;

            return {
                date: refund.initiatedAt,
                type:
                    payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE
                        ? "Booking fee refund"
                        : `${paymentPurpose(payment)} refund`,
                bookingCode: payment.booking?.bookingCode ?? "",
                rentalCode: payment.rental?.rentalCode ?? "",
                customerName: personName(payment.customer),
                customerEmail: payment.customer?.email ?? "",
                reason:
                    PAYMENT_REFUND_REASON_LABELS[refund.reason] ??
                    titleCase(refund.reason),
                details: [refund.notes, refund.failureReason]
                    .filter(Boolean)
                    .join(" — "),
                amount: refund.amount,
                status: statusLabel,
                payoutStatus:
                    refund.method === "automatic"
                        ? "Through PayMongo"
                        : "Paid by hand",
                refunded:
                    refund.status === PAYMENT_REFUND_STATUS.FAILED
                        ? 0
                        : refund.amount,
                completedAt: refund.completedAt ?? null,
                reference: refund.refundId ?? "",
            };
        });

    const owedRefunds = manualRefunds
        .filter((refund) => inRange(refund.createdAt, range))
        .map((refund) => ({
            date: refund.createdAt,
            type: "Owed refund (paid by hand)",
            bookingCode: refund.booking?.bookingCode ?? "",
            rentalCode: "",
            customerName: personName(refund.customer),
            customerEmail: refund.customer?.email ?? "",
            reason: refund.reason,
            details: refund.settlementNote ?? "",
            amount: refund.amount,
            status: refund.status,
            payoutStatus: "Paid by hand",
            refunded:
                refund.status === MANUAL_REFUND_STATUS.NOT_PAID
                    ? 0
                    : refund.amount,
            completedAt: refund.settledAt ?? null,
            reference: "",
        }));

    return [...rentalRefunds, ...paymentRefunds, ...owedRefunds].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );
};

/* ---------- partner payouts & withdrawals ---------- */

export const PAYOUT_COLUMNS = [
    { header: "Payout code", key: "payoutCode", width: 18 },
    { header: "Created on", key: "createdAt", type: "datetime", width: 20 },
    { header: "Partner", key: "partner", width: 22 },
    { header: "Partner email", key: "partnerEmail", width: 28 },
    { header: "Booking code", key: "bookingCode", width: 18 },
    { header: "Vehicle", key: "vehicle", width: 24 },
    { header: "Plate no.", key: "plateNumber", width: 12 },
    { header: "Booking amount", key: "bookingAmount", type: "money", width: 15 },
    { header: "Refund deduction", key: "refundDeduction", type: "money", width: 15 },
    { header: "Platform commission", key: "platformCommission", type: "money", width: 15 },
    { header: "Partner earnings", key: "partnerEarnings", type: "money", width: 15 },
    { header: "Status", key: "status", width: 12 },
    { header: "Release date", key: "releaseAt", type: "datetime", width: 20 },
    { header: "Paid on", key: "paidAt", type: "datetime", width: 20 },
    { header: "Paid via", key: "paidVia", width: 20 },
    { header: "Note", key: "note", width: 34 },
];

export const WITHDRAWAL_COLUMNS = [
    { header: "Withdrawal code", key: "withdrawalCode", width: 18 },
    { header: "Requested on", key: "createdAt", type: "datetime", width: 20 },
    { header: "Partner", key: "partner", width: 22 },
    { header: "Partner email", key: "partnerEmail", width: 28 },
    { header: "Amount", key: "amount", type: "money", width: 14 },
    { header: "GCash number", key: "gcashNumber", width: 16 },
    { header: "Account name", key: "accountName", width: 22 },
    { header: "Status", key: "status", width: 12 },
    { header: "Completed on", key: "completedAt", type: "datetime", width: 20 },
    { header: "Failure reason", key: "failureReason", width: 30 },
];

// One row per booking in a payout (an automatic payout has exactly one).
export const getPayoutExportRows = async (range) => {
    const payouts = await PayoutRequest.find(
        range.end ? { createdAt: { $lt: range.end } } : {}
    )
        .populate("operator", "firstName lastName email")
        .populate("items.booking", "bookingCode")
        .populate("items.vehicle", "brand model year plateNumber")
        .sort({ createdAt: -1 })
        .lean();

    return payouts
        .filter((payout) => inRange(payout.createdAt, range))
        .flatMap((payout) =>
            (payout.items ?? []).map((item) => ({
                payoutCode: payout.payoutCode,
                createdAt: payout.createdAt,
                partner: personName(payout.operator),
                partnerEmail: payout.operator?.email ?? "",
                bookingCode: item.booking?.bookingCode ?? "",
                vehicle: vehicleName(item.vehicle),
                plateNumber: item.vehicle?.plateNumber ?? "",
                bookingAmount: item.bookingAmount,
                refundDeduction: item.refundDeduction ?? 0,
                platformCommission: item.platformCommission,
                partnerEarnings: item.operatorEarnings,
                status: titleCase(payout.status),
                releaseAt: payout.scheduledReleaseAt ?? null,
                paidAt: payout.paidAt ?? null,
                paidVia: payout.paidVia ?? "",
                note: [
                    payout.rejectionReason,
                    payout.cancellationReason,
                    payout.notes,
                ]
                    .filter(Boolean)
                    .join(" — "),
            }))
        );
};

export const getWithdrawalExportRows = async (range) => {
    const withdrawals = await WithdrawalRequest.find(
        range.end ? { createdAt: { $lt: range.end } } : {}
    )
        .populate("operator", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

    return withdrawals
        .filter((withdrawal) => inRange(withdrawal.createdAt, range))
        .map((withdrawal) => ({
            withdrawalCode: withdrawal.withdrawalCode,
            createdAt: withdrawal.createdAt,
            partner: personName(withdrawal.operator),
            partnerEmail: withdrawal.operator?.email ?? "",
            amount: withdrawal.amount,
            gcashNumber: maskAccount(withdrawal.gcashNumber),
            accountName: withdrawal.accountName,
            status: titleCase(withdrawal.status),
            completedAt: withdrawal.completedAt ?? null,
            failureReason: withdrawal.failureReason ?? "",
        }));
};

/* ---------- financial workbook ---------- */

const statusIs = (status) => (row) =>
    row.status === titleCase(status);

/*
 * The figures on the Summary sheet, from the same rows the other sheets
 * list, so the two always agree.
 */
export const summarizeFinancials = ({
    payments = null,
    refunds = null,
    payouts = null,
    withdrawals = null,
}) => {
    const summary = {};

    if (payments) {
        const onlineRows = payments.filter(
            (row) => row.source !== "Recorded by admin"
        );
        const recordedRows = payments.filter(
            (row) => row.source === "Recorded by admin"
        );

        summary.payments = {
            collectedOnline: sum(onlineRows, (row) => row.collected),
            collectedRecorded: sum(recordedRows, (row) => row.collected),
            pending: sum(
                payments.filter((row) => row.status === "Pending"),
                (row) => row.amount
            ),
        };
        summary.payments.totalCollected = money(
            summary.payments.collectedOnline +
                summary.payments.collectedRecorded
        );
    }

    if (refunds) {
        const byType = (match) =>
            sum(refunds.filter(match), (row) => row.refunded);

        const pendingRequests = refunds.filter(
            (row) => row.type === "Rental refund" && row.status === "Pending"
        );

        summary.refunds = {
            rentalRefunds: byType((row) => row.type === "Rental refund"),
            paymentRefunds: byType(
                (row) =>
                    row.type !== "Rental refund" &&
                    !row.type.startsWith("Owed refund")
            ),
            owedRefunds: byType((row) => row.type.startsWith("Owed refund")),
            pendingRequestCount: pendingRequests.length,
            pendingRequestAmount: sum(pendingRequests, (row) => row.amount),
        };
        summary.refunds.totalRefunded = money(
            summary.refunds.rentalRefunds +
                summary.refunds.paymentRefunds +
                summary.refunds.owedRefunds
        );
    }

    if (payouts) {
        const live = payouts.filter(
            (row) =>
                row.status !== titleCase(PAYOUT_STATUS.CANCELLED) &&
                row.status !== titleCase(PAYOUT_STATUS.REJECTED)
        );

        summary.payouts = {
            paid: sum(
                payouts.filter(statusIs(PAYOUT_STATUS.PAID)),
                (row) => row.partnerEarnings
            ),
            notYetReleased: sum(
                payouts.filter(
                    (row) =>
                        statusIs(PAYOUT_STATUS.SCHEDULED)(row) ||
                        statusIs(PAYOUT_STATUS.PENDING)(row) ||
                        statusIs(PAYOUT_STATUS.APPROVED)(row)
                ),
                (row) => row.partnerEarnings
            ),
            commission: sum(live, (row) => row.platformCommission),
            cancelled: sum(
                payouts.filter((row) => !live.includes(row)),
                (row) => row.partnerEarnings
            ),
        };
    }

    if (withdrawals) {
        summary.withdrawals = {
            completed: sum(
                withdrawals.filter(statusIs(WITHDRAWAL_STATUS.COMPLETED)),
                (row) => row.amount
            ),
            inProgress: sum(
                withdrawals.filter(
                    (row) =>
                        statusIs(WITHDRAWAL_STATUS.PENDING)(row) ||
                        statusIs(WITHDRAWAL_STATUS.PROCESSING)(row)
                ),
                (row) => row.amount
            ),
        };
    }

    return summary;
};

const formatDateKey = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });

const describeRange = (range) => {
    if (range.from && range.to) {
        return `${formatDateKey(range.from)} – ${formatDateKey(range.to)}`;
    }

    if (range.from) {
        return `From ${formatDateKey(range.from)}`;
    }

    if (range.to) {
        return `Up to ${formatDateKey(range.to)}`;
    }

    return "All time";
};

export const parseFinancialSections = (value) => {
    const requested = String(value || FINANCIAL_SECTIONS.join(","))
        .split(",")
        .map((section) => section.trim().toLowerCase())
        .filter(Boolean);

    const sections = FINANCIAL_SECTIONS.filter((section) =>
        requested.includes(section)
    );

    if (sections.length === 0) {
        throw createError(
            "Choose at least one of: payments, refunds, payouts.",
            400
        );
    }

    return sections;
};

export const buildFinancialWorkbook = async ({
    sections,
    range,
    generatedBy = "",
}) => {
    const include = new Set(sections);

    const [payments, refunds, payouts, withdrawals] = await Promise.all([
        include.has("payments") ? getPaymentExportRows(range) : null,
        include.has("refunds") ? getRefundExportRows(range) : null,
        include.has("payouts") ? getPayoutExportRows(range) : null,
        include.has("payouts") ? getWithdrawalExportRows(range) : null,
    ]);

    const summary = summarizeFinancials({
        payments,
        refunds,
        payouts,
        withdrawals,
    });

    const lines = [
        { label: "Period", value: describeRange(range) },
        {
            label: "Generated",
            value: new Date(),
            type: "datetime",
        },
        ...(generatedBy ? [{ label: "Generated by", value: generatedBy }] : []),
    ];

    if (summary.payments) {
        lines.push(
            { section: "Payments" },
            {
                label: "Collected online / booking fees",
                value: summary.payments.collectedOnline,
                type: "money",
                note: "Verified + refunded booking payments (the Financials page's \"Collected\").",
            },
            {
                label: "Collected and recorded by admin",
                value: summary.payments.collectedRecorded,
                type: "money",
                note: "Verified payments recorded on rentals, e.g. the balance paid at pickup.",
            },
            {
                label: "Total collected",
                value: summary.payments.totalCollected,
                type: "money",
                bold: true,
            },
            {
                label: "Still awaiting payment / verification",
                value: summary.payments.pending,
                type: "money",
                note: "Not counted as collected.",
            }
        );
    }

    if (summary.refunds) {
        lines.push(
            { section: "Refunds" },
            {
                label: "Rental refunds",
                value: summary.refunds.rentalRefunds,
                type: "money",
                note: "Approved refunds whose payout did not fail.",
            },
            {
                label: "Booking / extension fee refunds",
                value: summary.refunds.paymentRefunds,
                type: "money",
                note: "Refunds on a payment (e.g. cancelled before pickup), except failed ones.",
            },
            {
                label: "Owed refunds paid by hand",
                value: summary.refunds.owedRefunds,
                type: "money",
                note: "Owed or Paid; ones marked Not Paid are excluded.",
            },
            {
                label: "Total refunded",
                value: summary.refunds.totalRefunded,
                type: "money",
                bold: true,
            },
            {
                label: "Refund requests awaiting a decision",
                value: summary.refunds.pendingRequestAmount,
                type: "money",
                note: `${summary.refunds.pendingRequestCount} request(s) — not counted as refunded.`,
            }
        );
    }

    if (summary.payments && summary.refunds) {
        lines.push(
            { section: "Net" },
            {
                label: "Total collected less total refunded",
                value: money(
                    summary.payments.totalCollected -
                        summary.refunds.totalRefunded
                ),
                type: "money",
                bold: true,
            }
        );
    }

    if (summary.payouts) {
        lines.push(
            { section: "Partner payouts" },
            {
                label: "Paid to partner wallets",
                value: summary.payouts.paid,
                type: "money",
            },
            {
                label: "Scheduled / not yet released",
                value: summary.payouts.notYetReleased,
                type: "money",
            },
            {
                label: "Platform commission",
                value: summary.payouts.commission,
                type: "money",
                note: "On payouts that were not cancelled or rejected.",
            },
            {
                label: "Cancelled or rejected payouts",
                value: summary.payouts.cancelled,
                type: "money",
                note: "Not paid out.",
            }
        );
    }

    if (summary.withdrawals) {
        lines.push(
            { section: "Partner withdrawals (wallet → GCash)" },
            {
                label: "Withdrawn",
                value: summary.withdrawals.completed,
                type: "money",
            },
            {
                label: "Pending / processing",
                value: summary.withdrawals.inProgress,
                type: "money",
            }
        );
    }

    const workbook = createWorkbook();

    addSummarySheet(workbook, {
        name: "Summary",
        title: "Rent-A-Ride Albay — Financial report",
        lines,
    });

    if (payments) {
        addTableSheet(workbook, {
            name: "Payments",
            columns: PAYMENT_COLUMNS,
            rows: payments,
            totals: ["collected"],
        });
    }

    if (refunds) {
        addTableSheet(workbook, {
            name: "Refunds",
            columns: REFUND_COLUMNS,
            rows: refunds,
            totals: ["refunded"],
        });
    }

    if (payouts) {
        addTableSheet(workbook, {
            name: "Partner payouts",
            columns: PAYOUT_COLUMNS,
            rows: payouts,
            totals: [
                "bookingAmount",
                "refundDeduction",
                "platformCommission",
                "partnerEarnings",
            ],
        });

        addTableSheet(workbook, {
            name: "Partner withdrawals",
            columns: WITHDRAWAL_COLUMNS,
            rows: withdrawals,
            totals: ["amount"],
        });
    }

    return { buffer: await workbookToBuffer(workbook), summary };
};
