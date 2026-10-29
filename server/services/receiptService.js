import Booking from "../models/Booking.js";
import ManualRefund from "../models/ManualRefund.js";
import Payment from "../models/Payment.js";
import Receipt, {
    RECEIPT_KIND,
    RECEIPT_NUMBER_PREFIX,
    RECEIPT_SOURCE,
} from "../models/Receipt.js";
import Rental from "../models/Rental.js";
import { nextSequence } from "../models/Sequence.js";

import {
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
    BOOKING_EXTENSION_STATUS,
} from "../constants/bookingConstants.js";
import {
    MANUAL_REFUND_STATUS,
    PAYMENT_METHOD,
    PAYMENT_REFUND_STATUS,
    PAYMENT_STATUS,
    PAYMENT_TYPE,
} from "../constants/paymentConstants.js";
import { RENTAL_PAYMENT_STATUS } from "../constants/rentalConstants.js";

import createError from "../utils/createError.js";
import {
    formatEmailDateTime,
    formatPeso,
} from "../utils/emailTemplates.js";
import { isRefundInEffect } from "../utils/refundUtils.js";

/*
 * Acknowledgement receipts and booking statements.
 *
 * Receipts are issued from what the ledger already records — Payments,
 * Rental.payments, refunds — rather than at each place money moves: the
 * payment and refund paths call `syncBookingReceipts` when something settles,
 * and viewing a statement syncs too, so a receipt is never missing because
 * one code path forgot to issue it. Issuing is idempotent (one receipt per
 * source, enforced by a unique index).
 */

const NUMBER_PADDING = 6;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const sameId = (a, b) => Boolean(a && b) && String(a) === String(b);

const personName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ");

const vehicleNameOf = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

/* ------------------------------------------------------------------ */
/* What each kind of money movement reads as on a receipt              */
/* ------------------------------------------------------------------ */

const describePayment = (payment, booking) => {
    if (payment.paymentType === PAYMENT_TYPE.RESERVATION_FEE) {
        return Number(booking?.pricing?.pickupDistanceFee) > 0
            ? "Reservation fee and pickup distance fee"
            : "Reservation fee";
    }

    if (payment.bookingReschedule) {
        return "Reschedule price difference";
    }

    if (payment.bookingVehicleChange) {
        return "Vehicle change price difference";
    }

    return "Rental extension fee";
};

/* PayMongo payment `source.type` values, as customers know them. */
const PAYMONGO_SOURCE_LABELS = {
    gcash: "GCash",
    paymaya: "Maya",
    grab_pay: "GrabPay",
    card: "Card",
    qrph: "QR Ph",
    dob: "Online banking",
    dob_ubp: "Online banking (UnionBank)",
    brankas_bdo: "Online banking (BDO)",
    brankas_landbank: "Online banking (Landbank)",
    brankas_metrobank: "Online banking (Metrobank)",
    billease: "BillEase",
    shopee_pay: "ShopeePay",
};

const sourceLabel = (sourceType) =>
    PAYMONGO_SOURCE_LABELS[sourceType] ||
    String(sourceType)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const paymentMethodLabel = (payment) => {
    if (payment.paymentMethod === PAYMENT_METHOD.CASH_ON_PICKUP) {
        return "Cash";
    }

    if (payment.paymongo?.sourceType) {
        return `${sourceLabel(payment.paymongo.sourceType)} via PayMongo`;
    }

    return payment.paymongo?.checkoutSessionId || payment.paymongo?.chargeId
        ? "Online payment (PayMongo)"
        : "GCash";
};

const paymentDescriptionForRefund = (payment, booking) =>
    `Refund — ${describePayment(payment, booking).toLowerCase()}`;

/*
 * Every receipt a booking's records call for, as issue specs. Pure: reads the
 * already-loaded records, writes nothing.
 */
export const collectReceiptSpecs = ({
    booking,
    payments = [],
    rental = null,
    manualRefunds = [],
}) => {
    const specs = [];

    for (const payment of payments) {
        const received =
            payment.status === PAYMENT_STATUS.VERIFIED ||
            payment.status === PAYMENT_STATUS.REFUNDED;

        if (received && Number(payment.amount) > 0) {
            specs.push({
                kind: RECEIPT_KIND.PAYMENT,
                source: {
                    model: RECEIPT_SOURCE.PAYMENT,
                    id: payment._id,
                    subId: null,
                },
                description: describePayment(payment, booking),
                amount: round2(payment.amount),
                method: paymentMethodLabel(payment),
                reference:
                    payment.paymongo?.chargeId ||
                    payment.paymongo?.paymentId ||
                    "",
                providerReference:
                    payment.paymongo?.providerReference || "",
                transactionDate:
                    payment.verification?.verifiedAt ||
                    payment.processedAt ||
                    payment.updatedAt ||
                    payment.createdAt,
            });
        }

        const refund = payment.refund;

        if (
            refund?.status === PAYMENT_REFUND_STATUS.SUCCEEDED &&
            Number(refund.amount) > 0
        ) {
            specs.push({
                kind: RECEIPT_KIND.REFUND,
                source: {
                    model: RECEIPT_SOURCE.PAYMENT_REFUND,
                    id: payment._id,
                    subId: null,
                },
                description: paymentDescriptionForRefund(payment, booking),
                amount: round2(refund.amount),
                method:
                    refund.method === "automatic"
                        ? "Returned to the original payment method (PayMongo)"
                        : "Paid back outside the app",
                reference: refund.refundId || "",
                transactionDate:
                    refund.completedAt ||
                    refund.initiatedAt ||
                    payment.updatedAt,
            });
        }
    }

    for (const entry of rental?.payments || []) {
        if (
            entry.status === RENTAL_PAYMENT_STATUS.VERIFIED &&
            Number(entry.amount) > 0
        ) {
            specs.push({
                kind: RECEIPT_KIND.PAYMENT,
                source: {
                    model: RECEIPT_SOURCE.RENTAL_PAYMENT,
                    id: rental._id,
                    subId: entry._id,
                },
                description: `Rental payment (${String(
                    entry.type || "payment"
                ).toLowerCase()})`,
                amount: round2(entry.amount),
                method: entry.paymentMethod || "",
                reference: entry.reference || "",
                transactionDate:
                    entry.verifiedAt || entry.paymentDate || rental.updatedAt,
            });
        }
    }

    for (const entry of rental?.refunds || []) {
        // Refunds a Payment carries are receipted from that Payment.
        if (entry.gatewayPayment || !isRefundInEffect(entry)) {
            continue;
        }

        const settled =
            Boolean(entry.settledAt) ||
            entry.gatewayStatus === PAYMENT_REFUND_STATUS.SUCCEEDED ||
            // Recorded by an admin before refunds went through a gateway.
            entry.gatewayStatus === "not_applicable";

        if (!settled || !(Number(entry.amount) > 0)) {
            continue;
        }

        specs.push({
            kind: RECEIPT_KIND.REFUND,
            source: {
                model: RECEIPT_SOURCE.RENTAL_REFUND,
                id: rental._id,
                subId: entry._id,
            },
            description: `Refund — ${String(
                entry.reason || "rental"
            ).toLowerCase()}`,
            amount: round2(entry.amount),
            method: "Paid back outside the app",
            reference: entry.reference || "",
            transactionDate:
                entry.settledAt ||
                entry.processedAt ||
                entry.updatedAt ||
                entry.createdAt,
        });
    }

    for (const manualRefund of manualRefunds) {
        if (
            manualRefund.status !== MANUAL_REFUND_STATUS.PAID ||
            !(Number(manualRefund.amount) > 0)
        ) {
            continue;
        }

        specs.push({
            kind: RECEIPT_KIND.REFUND,
            source: {
                model: RECEIPT_SOURCE.MANUAL_REFUND,
                id: manualRefund._id,
                subId: null,
            },
            description: "Refund for this booking",
            amount: round2(manualRefund.amount),
            method: "Paid back outside the app",
            reference: "",
            transactionDate:
                manualRefund.settledAt || manualRefund.updatedAt,
        });
    }

    return specs.sort(
        (a, b) =>
            new Date(a.transactionDate).getTime() -
            new Date(b.transactionDate).getTime()
    );
};

const sourceQuery = (source) => ({
    "source.model": source.model,
    "source.id": source.id,
    "source.subId": source.subId ?? null,
});

const formatReceiptNumber = (kind, number) =>
    `${RECEIPT_NUMBER_PREFIX[kind]}-${String(number).padStart(
        NUMBER_PADDING,
        "0"
    )}`;

/*
 * Issues the receipt for one money movement, or returns the one already
 * issued. Two callers racing on the same source both end up with the same
 * receipt (the unique index turns the loser's insert into a re-read); the
 * loser's sequence number is simply skipped.
 */
const issueReceipt = async (spec, context) => {
    const existing = await Receipt.findOne(sourceQuery(spec.source)).lean();

    if (existing) {
        return { receipt: existing, created: false };
    }

    const number = await nextSequence(`receipt-${spec.kind}`);

    try {
        const receipt = await Receipt.create({
            ...spec,
            receiptNumber: formatReceiptNumber(spec.kind, number),
            customer: context.customerId,
            booking: context.bookingId,
            rental: context.rentalId || null,
            snapshot: context.snapshot,
        });

        return { receipt: receipt.toObject(), created: true };
    } catch (error) {
        if (error?.code === 11000) {
            const issued = await Receipt.findOne(
                sourceQuery(spec.source)
            ).lean();

            if (issued) {
                return { receipt: issued, created: false };
            }
        }

        throw error;
    }
};

const loadBookingLedger = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate("customer", "firstName lastName email phoneNumber")
        .populate("vehicle", "brand model plateNumber")
        .lean();

    if (!booking) {
        throw createError("Booking not found.", 404);
    }

    const [payments, rental, manualRefunds] = await Promise.all([
        Payment.find({ booking: booking._id }).lean(),
        Rental.findOne({ booking: booking._id }).lean(),
        ManualRefund.find({ booking: booking._id }).lean(),
    ]);

    return { booking, payments, rental, manualRefunds };
};

/*
 * Issues every receipt the booking's records call for that doesn't exist yet,
 * then returns all of the booking's receipts (oldest first) and the ones this
 * call created. A failure on one receipt never stops the rest.
 */
export const syncBookingReceipts = async (bookingId, ledger = null) => {
    const records = ledger || (await loadBookingLedger(bookingId));
    const { booking, rental } = records;

    const context = {
        bookingId: booking._id,
        customerId: booking.customer?._id || booking.customer,
        rentalId: rental?._id || null,
        snapshot: {
            customerName: personName(booking.customer),
            customerEmail: booking.customer?.email || "",
            customerPhone: booking.customer?.phoneNumber || "",
            vehicleName: vehicleNameOf(booking.vehicle),
            plateNumber: booking.vehicle?.plateNumber || "",
            startDate:
                rental?.bookingPeriod?.actualStartDate || booking.startDate,
            endDate: rental?.actualEndDate || booking.endDate,
        },
    };

    const created = [];

    for (const spec of collectReceiptSpecs(records)) {
        try {
            const result = await issueReceipt(spec, context);

            if (result.created) {
                created.push(result.receipt);
            }
        } catch (error) {
            console.error(
                `Failed to issue a ${spec.kind} receipt for ${spec.source.model} ${spec.source.id} (booking ${booking._id}):`,
                error
            );
        }
    }

    const receipts = await Receipt.find({ booking: booking._id })
        .sort({ transactionDate: 1, receiptNumber: 1 })
        .lean();

    return { receipts, created };
};

/*
 * Best-effort version for the payment/refund paths: issues what's due and
 * never throws, so a receipt problem can't undo the payment that caused it.
 * Returns the receipts it created.
 */
export const syncBookingReceiptsSafely = async (bookingId) => {
    if (!bookingId) {
        return [];
    }

    try {
        return (await syncBookingReceipts(bookingId)).created;
    } catch (error) {
        console.error(
            `Failed to sync receipts for booking ${bookingId}:`,
            error
        );

        return [];
    }
};

/*
 * The receipt for one source, issuing the booking's receipts first. Null
 * (never a throw) when it can't be had — callers are notifying about money
 * that has already moved.
 */
export const findReceiptForSource = async (bookingId, source) => {
    await syncBookingReceiptsSafely(bookingId);

    try {
        return await Receipt.findOne(sourceQuery(source)).lean();
    } catch (error) {
        console.error(
            `Failed to look up the receipt for ${source.model} ${source.id}:`,
            error
        );

        return null;
    }
};

/*
 * What a receipt shows in place of a transaction ID it doesn't have, so a
 * missing one reads as expected (cash) rather than as an error.
 */
export const missingTransactionIdText = (receipt) => {
    if (receipt.method === "Cash") {
        return "None — paid in cash";
    }

    if (/outside the app/i.test(receipt.method || "")) {
        return receipt.kind === RECEIPT_KIND.REFUND
            ? "None — refunded outside the app"
            : "None — paid outside the app";
    }

    return "Not recorded";
};

export const transactionIdText = (receipt) =>
    receipt.reference || missingTransactionIdText(receipt);

/* "GCash reference no." for a "GCash via PayMongo" payment, and so on. */
export const providerReferenceLabel = (receipt) => {
    const provider = String(receipt.method || "").split(" via ")[0];

    return provider && provider !== receipt.method
        ? `${provider} reference no.`
        : "Provider reference no.";
};

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

const ACKNOWLEDGEMENT_NOTE =
    "This is an acknowledgement receipt for your records, not a BIR official receipt.";

/*
 * The `email` option (see notificationService) for a notice that carries a
 * receipt: its details as a table and a button to the printable copy.
 * Without a receipt (issuing failed) the email still goes out, pointing at
 * `fallbackPath`.
 */
export const receiptEmail = (
    receipt,
    { subject, footnote = [], fallbackPath = null } = {}
) => {
    if (!receipt) {
        return {
            subject,
            ...(fallbackPath ? { actionPath: fallbackPath } : {}),
            footnote: [].concat(footnote),
        };
    }

    const isRefund = receipt.kind === RECEIPT_KIND.REFUND;
    const snapshot = receipt.snapshot || {};

    return {
        subject: `${subject} — ${receipt.receiptNumber}`,
        rows: [
            [isRefund ? "Refund No." : "Receipt No.", receipt.receiptNumber],
            ["Date", formatEmailDateTime(receipt.transactionDate)],
            ["For", receipt.description],
            [
                "Vehicle",
                snapshot.plateNumber
                    ? `${snapshot.vehicleName} (${snapshot.plateNumber})`
                    : snapshot.vehicleName || "—",
            ],
            ["Method", receipt.method || "—"],
            ["Transaction ID", transactionIdText(receipt)],
            ...(receipt.providerReference
                ? [[providerReferenceLabel(receipt), receipt.providerReference]]
                : []),
            [
                isRefund ? "Amount Refunded" : "Amount Paid",
                formatPeso(receipt.amount),
            ],
        ],
        actionLabel: isRefund
            ? "View refund acknowledgement"
            : "View receipt",
        actionPath: `/documents/receipts/${receipt._id}`,
        footnote: [...[].concat(footnote), ACKNOWLEDGEMENT_NOTE],
    };
};

/* ------------------------------------------------------------------ */
/* Access                                                              */
/* ------------------------------------------------------------------ */

/* The display text the pages need, so client and emails word it the same. */
const withTransactionLabels = (receipt) => ({
    ...receipt,
    transactionIdText: transactionIdText(receipt),
    providerReferenceLabel: receipt.providerReference
        ? providerReferenceLabel(receipt)
        : "",
});

const assertCanView = (user, customerId) => {
    if (user?.role === "admin") {
        return;
    }

    if (user?.role === "customer" && sameId(user._id, customerId)) {
        return;
    }

    throw createError(
        "You are not authorized to view this document.",
        403
    );
};

export const getReceiptById = async (receiptId, user) => {
    const receipt = await Receipt.findById(receiptId).lean();

    if (!receipt) {
        throw createError("Receipt not found.", 404);
    }

    assertCanView(user, receipt.customer);

    return withTransactionLabels(receipt);
};

/* ------------------------------------------------------------------ */
/* Booking statement                                                   */
/* ------------------------------------------------------------------ */

const line = (label, amount, note = "") => ({
    label,
    amount: round2(amount),
    ...(note ? { note } : {}),
});

const sumLines = (lines) =>
    round2(lines.reduce((total, item) => total + item.amount, 0));

const dayCount = (days) =>
    `${days} day${Number(days) === 1 ? "" : "s"}`;

/* Charges for a booking that hasn't been picked up: its booked price. */
const bookedChargeLines = (booking) => {
    const pricing = booking.pricing || {};
    const lines = [];

    const rateNote = pricing.rentalDays
        ? `${dayCount(pricing.rentalDays)} × ₱${round2(
              pricing.dailyRate
          ).toLocaleString("en-PH", { minimumFractionDigits: 2 })}${
              pricing.vehicleDiscount?.amountPerDay > 0
                  ? ` (${
                        pricing.vehicleDiscount.label ||
                        pricing.vehicleDiscount.name ||
                        "discounted"
                    })`
                  : ""
          }`
        : "";

    lines.push(line("Vehicle rental", pricing.subtotal, rateNote));

    if (Number(pricing.driverFee) > 0) {
        lines.push(
            line(
                "Driver fee",
                pricing.driverFee,
                pricing.rentalDays ? dayCount(pricing.rentalDays) : ""
            )
        );
    }

    lines.push(line("Reservation fee", pricing.reservationFee));

    if (Number(pricing.pickupDistanceFee) > 0) {
        lines.push(line("Pickup distance fee", pricing.pickupDistanceFee));
    }

    if (Number(pricing.returnDistanceFee) > 0) {
        lines.push(line("Return distance fee", pricing.returnDistanceFee));
    }

    const extensionTotal = (booking.extensions || [])
        .filter(
            (extension) =>
                extension.status === BOOKING_EXTENSION_STATUS.APPROVED
        )
        .reduce(
            (total, extension) =>
                total + Number(extension.pricing?.amount || 0),
            0
        );

    if (extensionTotal > 0) {
        lines.push(line("Approved extensions", extensionTotal));
    }

    if (Number(booking.voucher?.discountAmount) > 0) {
        lines.push(
            line(
                "Voucher discount",
                -Number(booking.voucher.discountAmount),
                booking.voucher.code || ""
            )
        );
    }

    // Whatever the parts don't explain (older pricing, manual edits), so the
    // lines always add up to the booked total.
    const difference = round2(
        Number(pricing.totalAmount || 0) - sumLines(lines)
    );

    if (Math.abs(difference) >= 0.01) {
        lines.push(line("Other adjustments", difference));
    }

    return lines;
};

/* Charges for a booking that became a rental: the rental's own figures. */
const rentalChargeLines = (rental) => {
    const financial = rental.financial || {};
    const lines = [line("Vehicle rental", financial.baseRentalCharge)];

    const optional = [
        ["Driver fee", financial.driverFee],
        ["Reservation fee", financial.reservationFee],
        ["Pickup distance fee", financial.pickupDistanceFee],
        ["Return distance fee", financial.returnDistanceFee],
        ["Extensions", financial.extensionCharges],
        ["Late return charges", financial.lateCharges],
        ["Damage charges", financial.damageCharges],
        ["Other charges", financial.otherCharges],
    ];

    for (const [label, amount] of optional) {
        if (Number(amount) > 0 || label === "Reservation fee") {
            lines.push(line(label, amount));
        }
    }

    if (Number(financial.discounts) > 0) {
        lines.push(line("Discounts", -Number(financial.discounts)));
    }

    if (Number(financial.adjustments) > 0) {
        lines.push(line("Adjustments", -Number(financial.adjustments)));
    }

    return lines;
};

/* Refunds promised but not paid out yet, so the statement doesn't hide them. */
const pendingRefundsOf = ({ payments, rental, manualRefunds }) => {
    const pending = [];

    const openPaymentStatuses = [
        PAYMENT_REFUND_STATUS.PENDING,
        PAYMENT_REFUND_STATUS.PROCESSING,
        PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
    ];

    for (const payment of payments) {
        if (openPaymentStatuses.includes(payment.refund?.status)) {
            pending.push({
                description: "Refund being processed",
                amount: round2(payment.refund.amount),
            });
        }
    }

    for (const entry of rental?.refunds || []) {
        if (
            !entry.gatewayPayment &&
            isRefundInEffect(entry) &&
            !entry.settledAt &&
            entry.gatewayStatus ===
                PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
        ) {
            pending.push({
                description: "Refund being processed",
                amount: round2(entry.amount),
            });
        }
    }

    for (const manualRefund of manualRefunds) {
        if (manualRefund.status === MANUAL_REFUND_STATUS.OWED) {
            pending.push({
                description: "Refund being processed",
                amount: round2(manualRefund.amount),
            });
        }
    }

    return pending;
};

const toReceiptLine = (receipt) => ({
    id: receipt._id,
    receiptNumber: receipt.receiptNumber,
    kind: receipt.kind,
    date: receipt.transactionDate,
    description: receipt.description,
    method: receipt.method,
    transactionId: receipt.reference || "",
    transactionIdText: transactionIdText(receipt),
    providerReference: receipt.providerReference || "",
    providerReferenceLabel: receipt.providerReference
        ? providerReferenceLabel(receipt)
        : "",
    amount: round2(receipt.amount),
});

/*
 * A booking's full money picture: what it charges, every payment and refund
 * (each with its receipt), refunds still on their way, and what's left to pay.
 * Admins and the booking's own customer only.
 */
export const getBookingStatement = async (bookingId, user) => {
    const ledger = await loadBookingLedger(bookingId);
    const { booking, rental } = ledger;

    assertCanView(user, booking.customer?._id || booking.customer);

    const { receipts } = await syncBookingReceipts(bookingId, ledger);

    const payments = receipts
        .filter((receipt) => receipt.kind === RECEIPT_KIND.PAYMENT)
        .map(toReceiptLine);

    const refunds = receipts
        .filter((receipt) => receipt.kind === RECEIPT_KIND.REFUND)
        .map(toReceiptLine);

    const pendingRefunds = pendingRefundsOf(ledger);

    const endedWithoutTrip =
        !rental &&
        BOOKING_ENDED_WITHOUT_TRIP_STATUSES.includes(booking.status);

    const charges = endedWithoutTrip
        ? []
        : rental
          ? rentalChargeLines(rental)
          : bookedChargeLines(booking);

    const totalCharges = sumLines(charges);
    const totalPaid = sumLines(payments);
    const totalRefunded = sumLines(refunds);
    const totalPendingRefunds = sumLines(pendingRefunds);
    const netPaid = round2(totalPaid - totalRefunded);

    let balanceDue = 0;

    if (rental) {
        // The rental keeps its own running balance (it also counts any
        // security deposit applied); it's the figure the counter works from.
        balanceDue = round2(rental.financial?.balance || 0);
    } else if (!endedWithoutTrip) {
        balanceDue = round2(Math.max(0, totalCharges - netPaid));
    }

    // For a booking that ended before pickup: what the cancellation policy
    // kept once every refund (sent or still on its way) is counted.
    const retained = endedWithoutTrip
        ? round2(Math.max(0, netPaid - totalPendingRefunds))
        : 0;

    return {
        generatedAt: new Date(),
        booking: {
            id: booking._id,
            status: booking.status,
            startDate:
                rental?.bookingPeriod?.actualStartDate || booking.startDate,
            endDate: rental?.actualEndDate || booking.endDate,
            returnedAt: rental?.return?.date || null,
            pickupLocation: booking.pickupLocation?.address || "",
            returnLocation: booking.returnLocation?.address || "",
            driverOption: booking.driverOption || "",
            createdAt: booking.createdAt,
        },
        customer: {
            name: personName(booking.customer),
            email: booking.customer?.email || "",
            phone: booking.customer?.phoneNumber || "",
        },
        vehicle: {
            name: vehicleNameOf(booking.vehicle),
            plateNumber: booking.vehicle?.plateNumber || "",
        },
        endedWithoutTrip,
        charges,
        payments,
        refunds,
        pendingRefunds,
        totals: {
            charges: totalCharges,
            paid: totalPaid,
            refunded: totalRefunded,
            pendingRefunds: totalPendingRefunds,
            netPaid,
            balanceDue,
            retained,
        },
    };
};
