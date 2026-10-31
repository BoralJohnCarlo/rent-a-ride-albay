import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import ManualRefund from "../models/ManualRefund.js";

import {
    PAYMENT_METHOD,
    PAYMENT_TYPE,
    PAYMENT_STATUS,
    PAYMENT_REFUND_STATUS,
    PAYMENT_REFUND_REASON,
    MANUAL_REFUND_STATUS,
    CASH_RESERVATION_NOT_ALLOWED_MESSAGE,
} from "../constants/paymentConstants.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

import { getReservationPaymentDeadline } from "./cancellationPolicyService.js";

import createError from "../utils/createError.js";
import { normalizeRefundAmount } from "../utils/refundAmount.js";
import { getUpfrontFees } from "../utils/bookingFees.js";

import {
    createCheckoutSession,
    retrieveCheckoutSession,
    expireCheckoutSession,
    createRefund,
    retrieveRefund,
    describePaymongoPayment,
} from "./paymongoService.js";

import {
    notifyAdmins,
    notifyUser,
    hasRecentNotification,
} from "./notificationService.js";

import { refreshRentalsTrackedByPayment, syncBookingRefundAmount } from "./rentalService.js";

import {
    findReceiptForSource,
    receiptEmail,
    syncBookingReceiptsSafely,
} from "./receiptService.js";

import { RECEIPT_SOURCE } from "../models/Receipt.js";

/*
 * The `$set` for how a PayMongo payment was paid (see
 * describePaymongoPayment). Only fields PayMongo actually filled, so a
 * caller without the payment resource never blanks what's already stored.
 */
const paidWithFields = ({ sourceType, providerReference } = {}) => ({
    ...(sourceType ? { "paymongo.sourceType": sourceType } : {}),
    ...(providerReference
        ? { "paymongo.providerReference": providerReference }
        : {}),
});

const formatPaymentAmount = (amount) =>
    Number(amount || 0).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });

/*
 * Keeps `booking.refundAmount` in sync with a payment's refund — but only
 * once it has actually SUCCEEDED, so the customer-facing "Refunded" badge
 * never claims money moved before PayMongo (or an admin) confirmed it did.
 * A refund stuck pending/processing, or one that failed, leaves this field
 * untouched rather than showing a refund that hasn't happened.
 *
 * Once a Rental exists, delegate to rentalService's total so linked
 * payment refunds count once alongside earlier booking and owed refunds.
 */
const syncBookingRefundAmountFromPayment = async (
    payment
) => {
    if (
        payment?.refund?.status !==
        PAYMENT_REFUND_STATUS.SUCCEEDED
    ) {
        return;
    }

    await recomputeBookingRefundAmount(payment.booking);
};

/*
 * `booking.refundAmount` for a booking that never became a rental: every
 * refund that actually went back to the customer — succeeded payment refunds
 * (the reservation fee and any extension fees) plus owed refunds an admin
 * has since paid by hand. Totalled rather than overwritten, so one refund
 * finishing never hides another. Once a Rental exists, rentalService's
 * syncBookingRefundAmount owns this field instead. Best-effort.
 */
const recomputeBookingRefundAmount = async (bookingId) => {
    try {
        const rentalExists = await Rental.exists({
            booking: bookingId,
        });

        if (rentalExists) {
            await syncBookingRefundAmount(bookingId);
            return;
        }

        const [refundedPayments, paidManualRefunds] =
            await Promise.all([
                Payment.find({
                    booking: bookingId,
                    "refund.status":
                        PAYMENT_REFUND_STATUS.SUCCEEDED,
                })
                    .select("refund.amount")
                    .lean(),

                ManualRefund.find({
                    booking: bookingId,
                    status: MANUAL_REFUND_STATUS.PAID,
                })
                    .select("amount")
                    .lean(),
            ]);

        const total =
            refundedPayments.reduce(
                (sum, refunded) =>
                    sum +
                    Number(refunded.refund?.amount || 0),
                0
            ) +
            paidManualRefunds.reduce(
                (sum, refund) =>
                    sum + Number(refund.amount || 0),
                0
            );

        await Booking.findByIdAndUpdate(bookingId, {
            $set: {
                refundAmount:
                    Math.round(total * 100) / 100,
            },
        });
    } catch (error) {
        console.error(
            `Failed to sync refundAmount for booking ${bookingId}:`,
            error
        );
    }
};

/*
 * Best-effort receipt notice to the customer once a payment is verified: the
 * in-app notification plus an email carrying the payment's receipt. A failure
 * here must never fail the verification.
 */
const notifyPaymentCustomer = async (payment, booking) => {
    if (!payment?.customer) {
        return;
    }

    const isExtension =
        payment.paymentType === PAYMENT_TYPE.EXTENSION_FEE;

    // The same fee type also collects a reschedule's extra days and a
    // vehicle change's price difference.
    const isReschedule = Boolean(payment.bookingReschedule);
    const isVehicleChange = Boolean(payment.bookingVehicleChange);

    const receipt = await findReceiptForSource(payment.booking, {
        model: RECEIPT_SOURCE.PAYMENT,
        id: payment._id,
    });

    try {
        await notifyUser(payment.customer, {
            type: "payment",
            title: isReschedule
                ? "Reschedule Payment Confirmed"
                : isVehicleChange
                  ? "Vehicle Change Payment Confirmed"
                  : isExtension
                  ? "Extension Payment Confirmed"
                  : "Payment Confirmed",
            message: `Your payment of ${formatPaymentAmount(payment.amount)} for booking ${
                booking?.bookingCode || "your booking"
            } has been confirmed.${
                isExtension ? "" : " Your booking is now awaiting approval."
            }`,
            variant: "payment",
            category: "Payment",
            metadata: {
                reference: booking?.bookingCode,
                relatedId: payment.booking,
                relatedModel: "Booking",
            },
            email: receiptEmail(receipt, {
                subject: "Payment received",
            }),
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of payment confirmation:",
            notificationError
        );
    }
};

const findBookingForCustomer = async (
    bookingId,
    customerId
) => {
    const booking = await Booking.findById(
        bookingId
    );

    if (!booking) {
        throw createError(
            "Booking not found.",
            404
        );
    }

    if (
        booking.customer.toString() !==
        customerId.toString()
    ) {
        throw createError(
            "You are not authorized to access this booking.",
            403
        );
    }

    return booking;
};

const findPaymentById = async (
    paymentId
) => {
    const payment =
        await Payment.findById(
            paymentId
        )
            .populate(
                "booking",
                "bookingCode customer vehicle startDate endDate pricing status"
            )
            .populate(
                "customer",
                "firstName lastName email phoneNumber"
            )
            .populate(
                "rental",
                "rentalCode status"
            )
            .populate(
                "verification.verifiedBy",
                "firstName lastName email"
            )
            .populate(
                "audit.createdBy",
                "firstName lastName email"
            )
            .populate(
                "audit.updatedBy",
                "firstName lastName email"
            );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    return payment;
};

const validateReservationFee = (
    booking
) => {
    const reservationFee = Number(
        booking.pricing?.reservationFee || 0
    );

    const pickupDistanceFee = Number(
        booking.pricing?.pickupDistanceFee || 0
    );

    if (
        !Number.isFinite(
            reservationFee
        ) ||
        reservationFee < 0
    ) {
        throw createError(
            "Invalid reservation fee.",
            400
        );
    }

    if (
        !Number.isFinite(
            pickupDistanceFee
        ) ||
        pickupDistanceFee < 0
    ) {
        throw createError(
            "Invalid pickup distance fee.",
            400
        );
    }

    // After a reservation-fee or pickup-fee voucher.
    const totalInitial =
        getUpfrontFees(booking).total;

    if (totalInitial <= 0) {
        throw createError(
            "This booking does not require an initial payment.",
            400
        );
    }

    return totalInitial;
};

const validatePaymentMethod = (
    paymentMethod
) => {
    if (
        !Object.values(
            PAYMENT_METHOD
        ).includes(paymentMethod)
    ) {
        throw createError(
            "Invalid payment method.",
            400
        );
    }
};

const validateBookingForPayment = (
    booking
) => {
    const invalidStatuses = [
        ...BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
        BOOKING_STATUS.COMPLETED,
    ];

    if (
        invalidStatuses.includes(
            booking.status
        )
    ) {
        throw createError(
            "This booking is no longer eligible for payment.",
            400
        );
    }
};

const getExistingReservationPayment =
    async (bookingId) => {
        return Payment.findOne({
            booking: bookingId,
            paymentType:
                PAYMENT_TYPE.RESERVATION_FEE,
        });
    };

/*
 * A customer who cancelled their own reservation payment attempt can pay
 * again — as long as the booking is still open and, while it is Pending,
 * still inside its payment window (after which the unpaid-booking sweep
 * releases it). A booking only ever has ONE reservation payment (unique
 * index), so "pay again" means reopening that payment, not creating another.
 *
 * The earlier checkout must be provably closed first: reopening while it could
 * still be paid would let one payment be settled twice, or leave money paid
 * on a session no longer linked to the payment. If closing it reveals it was
 * in fact paid, that payment is recovered instead and returned as-is (the
 * caller sees it is no longer CANCELLED).
 *
 * Throws with a message the customer can act on when it isn't possible.
 */
const reviveCancelledReservationPayment = async (
    payment,
    customerId
) => {
    if (Number(payment.amount) <= 0) {
        throw createError("This booking does not require an initial payment.", 400);
    }
    if (
        payment.paymentType !==
        PAYMENT_TYPE.RESERVATION_FEE
    ) {
        throw createError(
            "This payment has been cancelled.",
            400
        );
    }

    const booking = await Booking.findById(
        payment.booking
    );

    if (!booking) {
        throw createError(
            "Associated booking not found.",
            404
        );
    }

    validateBookingForPayment(booking);

    if (booking.status === BOOKING_STATUS.PENDING) {
        // 24h after booking, or the pickup time if that's sooner.
        const deadline =
            getReservationPaymentDeadline(booking).getTime();

        if (Date.now() >= deadline) {
            throw createError(
                "The payment window for this booking has closed.",
                409
            );
        }
    }

    let current = payment;

    if (
        current.paymongo?.checkoutSessionId &&
        !current.paymongo?.checkoutExpiredAt
    ) {
        await closeCheckoutSession(current);

        current = await Payment.findById(
            payment._id
        );

        // Recovered as paid (or changed by someone else) in the meantime.
        if (
            current.status !==
            PAYMENT_STATUS.CANCELLED
        ) {
            return current;
        }

        if (!current.paymongo?.checkoutExpiredAt) {
            throw createError(
                "Your previous payment attempt is still being processed. Please try again in a few minutes.",
                409
            );
        }
    }

    const revived =
        await Payment.findOneAndUpdate(
            {
                _id: current._id,
                status: PAYMENT_STATUS.CANCELLED,
            },
            {
                $set: {
                    status: PAYMENT_STATUS.PENDING,
                    "paymongo.checkoutExpiredAt": null,
                    notes: "Restarted by the customer after cancelling an earlier payment attempt.",
                    "audit.updatedBy": customerId,
                },
                // The old session is closed; a new one is created when the
                // customer opens checkout. (Unset rather than "" — the
                // session-id index is unique, and "" would collide.)
                $unset: {
                    "paymongo.checkoutSessionId": "",
                },
            },
            { new: true }
        );

    // Lost a race with another request — hand back whatever it is now.
    return (
        revived ||
        (await Payment.findById(current._id))
    );
};

const createPayment = async (
    bookingId,
    customerId,
    paymentMethod
) => {
    const booking =
        await findBookingForCustomer(
            bookingId,
            customerId
        );

    validateBookingForPayment(
        booking
    );

    validatePaymentMethod(
        paymentMethod
    );

    const initialPaymentAmount =
        validateReservationFee(
            booking
        );

    if (initialPaymentAmount <= 0) {
        throw createError(
            "This booking does not require an initial payment.",
            400
        );
    }

    const existingPayment =
        await getExistingReservationPayment(
            booking._id
        );

    if (existingPayment) {
        if (
            existingPayment.status ===
            PAYMENT_STATUS.VERIFIED
        ) {
            throw createError(
                "The reservation fee has already been verified for this booking.",
                409
            );
        }

        if (
            existingPayment.status ===
            PAYMENT_STATUS.CANCELLED
        ) {
            // Pay again with the same method: reopen that payment. (Changing
            // method or amount would mean a different payment, which a
            // booking can't have a second of.)
            if (
                existingPayment.paymentMethod !==
                paymentMethod
            ) {
                throw createError(
                    "The existing reservation payment has been cancelled.",
                    409
                );
            }

            const revived =
                await reviveCancelledReservationPayment(
                    existingPayment,
                    customerId
                );

            if (
                revived.status ===
                PAYMENT_STATUS.VERIFIED
            ) {
                throw createError(
                    "The reservation fee has already been verified for this booking.",
                    409
                );
            }

            return findPaymentById(
                revived._id
            );
        }

        if (
            existingPayment.paymentMethod !==
            paymentMethod
        ) {
            throw createError(
                "A reservation payment already exists for this booking.",
                409
            );
        }

        return findPaymentById(
            existingPayment._id
        );
    }

    // New reservation payments are online only — see createBooking.
    if (
        paymentMethod ===
        PAYMENT_METHOD.CASH_ON_PICKUP
    ) {
        throw createError(
            CASH_RESERVATION_NOT_ALLOWED_MESSAGE,
            400
        );
    }

    const payment =
        await Payment.create({
            booking: booking._id,
            rental: null,
            customer: booking.customer,
            paymentType:
                PAYMENT_TYPE.RESERVATION_FEE,
            paymentMethod,
            amount: initialPaymentAmount,
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
                createdBy: customerId,
                updatedBy: customerId,
            },
        });

    return findPaymentById(
        payment._id
    );
};

const createPaymongoCheckout = async (
    paymentId,
    customerId,
    clientBaseUrl,
    options = {}
) => {
    const { force = false } = options;

    let payment =
        await Payment.findById(
            paymentId
        );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (
        payment.customer.toString() !==
        customerId.toString()
    ) {
        throw createError(
            "You are not authorized to create checkout for this payment.",
            403
        );
    }

    if (
        ![
            PAYMENT_TYPE.RESERVATION_FEE,
            PAYMENT_TYPE.EXTENSION_FEE,
        ].includes(payment.paymentType)
    ) {
        throw createError(
            "Only booking and extension fee payments can use PayMongo Checkout.",
            400
        );
    }

    if (
        payment.paymentMethod !==
        PAYMENT_METHOD.GCASH
    ) {
        throw createError(
            "PayMongo Checkout is currently available for GCash payments only.",
            400
        );
    }

    if (
        payment.status ===
        PAYMENT_STATUS.VERIFIED
    ) {
        throw createError(
            "This payment has already been verified.",
            409
        );
    }

    /*
     * The customer cancelled their own payment attempt and is now paying
     * again: reopen it (only possible for a reservation payment on a booking
     * still inside its window — anything else keeps failing as before).
     */
    if (
        payment.status ===
        PAYMENT_STATUS.CANCELLED
    ) {
        payment =
            await reviveCancelledReservationPayment(
                payment,
                customerId
            );

        if (
            payment.status ===
            PAYMENT_STATUS.VERIFIED
        ) {
            throw createError(
                "This payment has already been verified.",
                409
            );
        }

        if (
            payment.status !==
            PAYMENT_STATUS.PENDING
        ) {
            throw createError(
                "This payment has been cancelled.",
                400
            );
        }
    }

    const booking =
        await Booking.findById(
            payment.booking
        );

    if (!booking) {
        throw createError(
            "Associated booking not found.",
            404
        );
    }

    validateBookingForPayment(
        booking
    );

    if (
        !Number.isFinite(
            Number(payment.amount)
        ) ||
        Number(payment.amount) <= 0
    ) {
        throw createError(
            "Invalid payment amount.",
            400
        );
    }

    /*
     * If a checkout session already exists,
     * do not create another one.
     *
     * We will later add a proper PayMongo
     * session retrieval/reuse mechanism.
     */
    const existingSessionId =
        payment.paymongo
            ?.checkoutSessionId;

    if (
        existingSessionId &&
        !force
    ) {
        throw createError(
            "A PayMongo Checkout Session has already been created for this payment.",
            409
        );
    }

    if (!clientBaseUrl) {
        throw createError(
            "Client base URL is required.",
            500
        );
    }

    /*
     * Starting over with a fresh checkout (`force`) replaces the stored
     * session id below — so the OLD checkout must be closed first. Left open
     * it stays payable, and a payment made on it would arrive for a session no
     * longer linked to this payment: money we could not match up. If closing
     * it shows the customer had in fact already paid, that is recovered
     * instead; if it is mid-payment and can't be closed, wait.
     */
    if (existingSessionId) {
        await closeCheckoutSession(payment);

        const refreshed =
            await Payment.findById(
                payment._id
            );

        if (
            refreshed.status ===
            PAYMENT_STATUS.VERIFIED
        ) {
            throw createError(
                "This payment has already been verified.",
                409
            );
        }

        if (
            !refreshed.paymongo
                ?.checkoutExpiredAt
        ) {
            throw createError(
                "Your previous payment attempt is still being processed. Please wait a moment and try again.",
                409
            );
        }

        payment = refreshed;
    }

    const checkout =
        await createCheckoutSession({
            amount: payment.amount,

            // Shown to the customer on PayMongo's page: no internal code.
            description:
                "Rent-A-Ride Albay Reservation Fee",

            // Internal reconciliation reference only.
            referenceNumber:
                booking.bookingCode,

            successUrl:
                `${clientBaseUrl}/customer/payment/success?paymentId=${payment._id}`,

            cancelUrl:
                `${clientBaseUrl}/customer/payment/cancel?paymentId=${payment._id}`,

            paymentMethodTypes: [
                "gcash",
                "qrph",
            ],

            metadata: {
                paymentId:
                    payment._id.toString(),

                bookingId:
                    booking._id.toString(),

                bookingCode:
                    booking.bookingCode,
            },
        });

    // The provider request can outlast an edit that reprices or cancels this
    // payment. Never attach or return a checkout created for the stale amount.
    const attached = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            status: PAYMENT_STATUS.PENDING,
            amount: payment.amount,
            updatedAt: payment.updatedAt,
        },
        {
            $set: {
                paymongo: {
                    checkoutSessionId: checkout.id,
                    paymentId: payment.paymongo?.paymentId || "",
                },
                "audit.updatedBy": customerId,
            },
        },
        { new: true }
    );
    if (!attached) {
        await expireCheckoutSession(checkout.id).catch((error) => {
            console.error("Failed to close superseded checkout:", checkout.id, error.message);
        });
        throw createError("This payment changed while checkout was opening. Please reload and try again.", 409);
    }

    return {
        payment:
            await findPaymentById(
                payment._id
            ),

        checkoutUrl:
            checkout.checkoutUrl,

        checkoutSessionId:
            checkout.id,
    };
};

const verifyPayment = async (
    paymentId,
    adminId,
    options = {}
) => {
    const { force = false } = options;

    const payment =
        await Payment.findById(
            paymentId
        );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (
        payment.status ===
        PAYMENT_STATUS.VERIFIED
    ) {
        throw createError(
            "This payment has already been verified.",
            409
        );
    }

    if (
        payment.status ===
        PAYMENT_STATUS.CANCELLED
    ) {
        throw createError(
            "Cancelled payments cannot be verified.",
            400
        );
    }

    const booking =
        await Booking.findById(
            payment.booking
        );

    if (!booking) {
        throw createError(
            "Associated booking not found.",
            404
        );
    }

    validateBookingForPayment(
        booking
    );

    const hasCheckoutSession =
        Boolean(
            payment.paymongo
                ?.checkoutSessionId
        );

    if (
        payment.paymentMethod ===
        PAYMENT_METHOD.GCASH
    ) {
        if (
            hasCheckoutSession &&
            force &&
            payment.status ===
                PAYMENT_STATUS.PENDING
        ) {
            payment.status =
                PAYMENT_STATUS.VERIFIED;
        } else {
            throw createError(
                "Only PayMongo payments with a checkout session can be force verified.",
                400
            );
        }
    } else if (
        payment.paymentMethod ===
        PAYMENT_METHOD.CASH_ON_PICKUP
    ) {
        if (
            payment.status !==
            PAYMENT_STATUS.PENDING
        ) {
            throw createError(
                "Only pending Cash on Pickup payments can be verified.",
                400
            );
        }

        payment.status =
            PAYMENT_STATUS.VERIFIED;
    } else {
        throw createError(
            "Unsupported payment method.",
            400
        );
    }

    payment.verification = {
        verifiedBy: adminId,
        verifiedAt: new Date(),
        rejectionReason: "",
    };

    payment.processedBy =
        adminId;

    payment.processedAt =
        new Date();

    payment.audit.updatedBy =
        adminId;

    await payment.save();

    /*
     * A manually verified reservation payment (e.g. Cash on Pickup, or a
     * force-verified GCash payment) must move the booking out of Pending the
     * same way the PayMongo checkout-session path does, so lists and the
     * unpaid-booking sweep see it as paid.
     */
    if (
        payment.paymentType ===
            PAYMENT_TYPE.RESERVATION_FEE &&
        payment.status === PAYMENT_STATUS.VERIFIED
    ) {
        const bookingPaid =
            await Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    status: BOOKING_STATUS.PENDING,
                },
                {
                    $set: {
                        status: BOOKING_STATUS.PAYMENT_RECEIVED,
                    },
                },
                { new: true }
            );

        if (bookingPaid) {
            try {
                await notifyAdmins({
                    type: "payment",
                    title: "Booking Payment Received",
                    message: `Payment of ${formatPaymentAmount(
                        payment.amount
                    )} was recorded for booking ${
                        bookingPaid.bookingCode
                    }. The booking is now awaiting approval.`,
                    variant: "payment",
                    category: "Payment",
                    metadata: {
                        reference: bookingPaid.bookingCode,
                        relatedId: bookingPaid._id,
                        relatedModel: "Booking",
                    },
                });
            } catch (notificationError) {
                console.error(
                    "Failed to notify admins of booking payment:",
                    notificationError
                );
            }
        }
    }

    await notifyPaymentCustomer(payment, booking);

    return findPaymentById(
        payment._id
    );
};

/*
 * `paymongoPayment` is the PayMongo Payment resource itself (the checkout
 * session's `payments[0]`), when the caller has it: its method and provider
 * reference are kept for the receipt. Optional — nothing depends on it.
 */
const verifyPaymentByCheckoutSession = async (
    checkoutSessionId,
    paymongoPaymentId,
    chargeId = "",
    paymongoPayment = null
) => {
    const paidWith = describePaymongoPayment(paymongoPayment);

    const payment = await Payment.findOne({
        "paymongo.checkoutSessionId":
            checkoutSessionId,
    });

    if (!payment) {
        throw createError(
            "Payment not found for this checkout session.",
            404
        );
    }

    if (
        payment.status ===
        PAYMENT_STATUS.VERIFIED
    ) {
        return findPaymentById(
            payment._id
        );
    }

    const booking =
        await Booking.findById(
            payment.booking
        );

    if (!booking) {
        throw createError(
            "Associated booking not found.",
            404
        );
    }

    /*
     * Only ever reached once PayMongo says the checkout was paid (the paid
     * webhook, or a reconcile that saw `paid`). Only a booking that ended
     * WITHOUT the trip happening makes that money unhonourable — refund it
     * rather than rejecting the call, which left the customer charged with
     * nothing recorded and PayMongo retrying the webhook to no effect.
     *
     * A COMPLETED booking is different: an extension fee paid after the
     * rental finished is money genuinely owed for days already used, so it is
     * recorded normally below.
     */
    const closedStatuses = BOOKING_ENDED_WITHOUT_TRIP_STATUSES;

    if (
        closedStatuses.includes(
            booking.status
        )
    ) {
        return refundLatePayment(payment, {
            paymongoPaymentId,
            chargeId,
            paidWith,
            closedBecause:
                booking.status === BOOKING_STATUS.NO_SHOW
                    ? "the booking was marked as a no-show"
                    : `the booking was ${booking.status.toLowerCase()}`,
        });
    }

    /*
     * A payment the customer cancelled themselves that is then paid on the
     * checkout they left open, while the booking is STILL open: they clearly
     * meant to pay, and a cancelled reservation payment blocks starting
     * another for the same booking — refunding it would just strand them.
     * So accept it, and say so on the record.
     */
    const revivesCancelledPayment =
        payment.status ===
        PAYMENT_STATUS.CANCELLED;

    /*
     * Atomic flip: the webhook and the customer's client-side reconcile can
     * arrive at nearly the same moment. Only the call that actually moves the
     * payment out of a non-final state proceeds to send notifications; the
     * other one falls through to the idempotent read below.
     */
    const verifiedPayment =
        await Payment.findOneAndUpdate(
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
                    ...(revivesCancelledPayment
                        ? {
                              notes: "Paid on a checkout left open after the payment attempt was cancelled; the booking was still open, so it was accepted.",
                          }
                        : {}),
                    status: PAYMENT_STATUS.VERIFIED,
                    "paymongo.paymentId":
                        paymongoPaymentId ||
                        payment.paymongo
                            ?.paymentId ||
                        "",
                    "paymongo.chargeId":
                        chargeId ||
                        payment.paymongo
                            ?.chargeId ||
                        "",
                    ...paidWithFields(paidWith),
                    verification: {
                        verifiedBy: null,
                        verifiedAt: new Date(),
                        rejectionReason: "",
                    },
                    processedBy: null,
                    processedAt: new Date(),
                    "audit.updatedBy": null,
                },
            },
            { new: true }
        );

    if (!verifiedPayment) {
        // Another path already verified this payment.
        return findPaymentById(payment._id);
    }

    const bookingPaid =
        await Booking.findOneAndUpdate(
            {
                _id: booking._id,
                status: BOOKING_STATUS.PENDING,
            },
            {
                $set: {
                    status: BOOKING_STATUS.PAYMENT_RECEIVED,
                },
            },
            { new: true }
        );

    if (bookingPaid) {
        try {
            await notifyAdmins({
                type: "payment",
                title: "Booking Payment Received",
                message: `Payment of ${Number(verifiedPayment.amount).toLocaleString("en-PH", { style: "currency", currency: "PHP" })} was received for booking ${bookingPaid.bookingCode}. The booking is now awaiting approval.`,
                variant: "payment",
                category: "Payment",
                metadata: {
                    reference: bookingPaid.bookingCode,
                    relatedId: bookingPaid._id,
                    relatedModel: "Booking",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of booking payment:",
                notificationError
            );
        }
    }

    await notifyPaymentCustomer(
        verifiedPayment,
        bookingPaid || booking
    );

    return findPaymentById(
        verifiedPayment._id
    );
};

/*
 * Confirms a PayMongo payment by asking PayMongo directly for the checkout
 * session state, instead of waiting for the webhook. Safe to call repeatedly
 * (idempotent) and usable by the paying customer or an admin.
 *
 * Returns { payment, paid, reconciled } where `reconciled` is true only when
 * this call is what flipped the payment to VERIFIED.
 */
const reconcilePaymentWithPaymongo = async (
    paymentId,
    currentUser
) => {
    const payment =
        await Payment.findById(paymentId);

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    const isOwner =
        payment.customer.toString() ===
        currentUser._id.toString();

    const isAdmin =
        currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
        throw createError(
            "You are not authorized to access this payment.",
            403
        );
    }

    if (
        payment.status ===
        PAYMENT_STATUS.VERIFIED
    ) {
        return {
            payment: await findPaymentById(
                payment._id
            ),
            paid: true,
            reconciled: false,
        };
    }

    const checkoutSessionId =
        payment.paymongo?.checkoutSessionId;

    if (
        payment.status ===
        PAYMENT_STATUS.CANCELLED
    ) {
        /*
         * A cancelled payment can still have been paid on a checkout that was
         * left open. Ask PayMongo before dismissing it: if the customer did
         * pay, deal with it now instead of waiting on the webhook — refunded
         * if its booking has closed, accepted if the booking is still open.
         */
        if (
            payment.paymentMethod ===
                PAYMENT_METHOD.GCASH &&
            checkoutSessionId
        ) {
            const cancelledSession =
                await retrieveCheckoutSession(
                    checkoutSessionId
                );

            if (cancelledSession.paid) {
                return {
                    payment:
                        await verifyPaymentByCheckoutSession(
                            checkoutSessionId,
                            cancelledSession.paymentIntentId ||
                                "",
                            cancelledSession
                                .payments?.[0]
                                ?.id || "",
                            cancelledSession.payments?.[0]
                        ),
                    paid: true,
                    reconciled: true,
                };
            }
        }

        throw createError(
            "This payment has been cancelled.",
            400
        );
    }

    if (
        payment.paymentMethod !==
            PAYMENT_METHOD.GCASH ||
        !checkoutSessionId
    ) {
        throw createError(
            "This payment has no PayMongo checkout session to reconcile.",
            400
        );
    }

    const session =
        await retrieveCheckoutSession(
            checkoutSessionId
        );

    if (!session.paid) {
        return {
            payment: await findPaymentById(
                payment._id
            ),
            paid: false,
            reconciled: false,
        };
    }

    const verifiedPayment =
        await verifyPaymentByCheckoutSession(
            checkoutSessionId,
            session.paymentIntentId || "",
            session.payments?.[0]?.id || "",
            session.payments?.[0]
        );

    return {
        payment: verifiedPayment,
        paid: true,
        reconciled: true,
    };
};

const cancelPayment = async (
    paymentId,
    userId
) => {
    const payment =
        await Payment.findById(
            paymentId
        );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (
        payment.customer.toString() !==
        userId.toString()
    ) {
        throw createError(
            "You are not authorized to cancel this payment.",
            403
        );
    }

    if (
        [
            PAYMENT_STATUS.VERIFIED,
            PAYMENT_STATUS.CANCELLED,
        ].includes(payment.status)
    ) {
        throw createError(
            "This payment cannot be cancelled.",
            400
        );
    }

    payment.status =
        PAYMENT_STATUS.CANCELLED;

    payment.audit.updatedBy =
        userId;

    await payment.save();

    // Close the checkout too, or it could still be completed afterwards.
    await closeCheckoutSession(payment);

    return findPaymentById(
        payment._id
    );
};

const getPaymentById = async (
    paymentId,
    currentUser
) => {
    const payment =
        await findPaymentById(
            paymentId
        );

    if (
        currentUser.role !== "admin" &&
        payment.customer._id.toString() !==
            currentUser._id.toString()
    ) {
        throw createError(
            "You are not authorized to access this payment.",
            403
        );
    }

    return payment;
};

/*
 * Called by the client when a customer is bounced back from the PayMongo
 * checkout without a completed payment. Records a one-time "payment didn't go
 * through" notice; never changes the payment (it stays PENDING for a retry).
 */
const reportPaymentFailure = async (paymentId, customerId) => {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
        throw createError("Payment not found.", 404);
    }

    if (payment.customer.toString() !== customerId.toString()) {
        throw createError(
            "You are not authorized to access this payment.",
            403
        );
    }

    // Already resolved (paid or cancelled) — nothing to warn about.
    if (payment.status !== PAYMENT_STATUS.PENDING) {
        return { reported: false, status: payment.status };
    }

    // Only online (PayMongo) payments have a checkout that can bounce back;
    // Cash on Pickup is settled by an admin at handover.
    if (payment.paymentMethod !== PAYMENT_METHOD.GCASH) {
        return { reported: false, status: payment.status };
    }

    const alreadyNotified = await hasRecentNotification({
        recipient: customerId,
        type: "Payment Failed",
        relatedId: payment.booking,
        since: new Date(Date.now() - 60 * 60 * 1000),
    });

    if (alreadyNotified) {
        return { reported: false, status: payment.status };
    }

    const booking = await Booking.findById(payment.booking).select(
        "bookingCode"
    );

    await notifyUser(customerId, {
        type: "Payment Failed",
        title: "Payment Not Completed",
        message: `Your payment of ${formatPaymentAmount(payment.amount)} for booking ${
            booking?.bookingCode || "your booking"
        } didn't go through. You can try again from My Bookings.`,
        variant: "warning",
        category: "Payment",
        metadata: {
            reference: booking?.bookingCode,
            relatedId: payment.booking,
            relatedModel: "Booking",
        },
    });

    return { reported: true, status: payment.status };
};

const getPayments = async (
    currentUser,
    filters = {}
) => {
    const query = {};

    if (
        currentUser.role !== "admin"
    ) {
        query.customer =
            currentUser._id;
    }

    if (filters.bookingId) {
        query.booking =
            filters.bookingId;
    }

    if (filters.status) {
        query.status =
            filters.status;
    }

    if (filters.paymentMethod) {
        query.paymentMethod =
            filters.paymentMethod;
    }

    if (filters.paymentType) {
        query.paymentType =
            filters.paymentType;
    }

    return Payment.find(query)
        .populate(
            "booking",
            "bookingCode customer vehicle startDate endDate pricing status"
        )
        .populate(
            "customer",
            "firstName lastName email phoneNumber"
        )
        .populate(
            "rental",
            "rentalCode status"
        )
        .populate(
            "verification.verifiedBy",
            "firstName lastName email"
        )
        .sort({
            createdAt: -1,
        });
};

/*
 * Records a refund that has succeeded on the payment itself. The payment only
 * becomes REFUNDED when the refund returns the whole charge: a partial refund
 * (e.g. a cancellation that keeps part of the reservation fee) leaves it
 * VERIFIED, because the business still holds that money and the rest of the
 * system — the rental balance, pickup gating — keys off VERIFIED.
 */
const applySucceededRefund = (payment) => {
    if (
        Number(payment.refund?.amount || 0) >=
        Number(payment.amount || 0)
    ) {
        payment.status =
            PAYMENT_STATUS.REFUNDED;
    }
};

const notifyAdminsSafely = async (
    data,
    failureLabel
) => {
    try {
        await notifyAdmins(data);
    } catch (notificationError) {
        console.error(
            failureLabel,
            notificationError
        );
    }
};

/*
 * Tells the customer a refund on `payment` has gone through — in-app and by
 * email, with its refund acknowledgement attached. Best-effort.
 */
const notifyCustomerRefundSent = async (payment) => {
    if (!payment?.customer) {
        return;
    }

    const receipt = await findReceiptForSource(payment.booking, {
        model: RECEIPT_SOURCE.PAYMENT_REFUND,
        id: payment._id,
    });

    try {
        await notifyUser(payment.customer, {
            type: "Refund Processed",
            title: "Refund Processed",
            message: `Your refund of ${formatPaymentAmount(
                payment.refund?.amount
            )} has been processed.`,
            variant: "success",
            category: "Refund",
            metadata: {
                relatedId: payment._id,
                relatedModel: "Payment",
            },
            email: receiptEmail(receipt, {
                subject: "Refund processed",
                footnote:
                    payment.refund?.method === "automatic"
                        ? "Refunds to GCash, cards and other online methods can take a few banking days to show up on your side."
                        : [],
                fallbackPath: `/customer/bookings/${payment.booking}`,
            }),
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of a processed refund:",
            notificationError
        );
    }
};

/*
 * Mirrors a payment refund's outcome onto the Rental.refunds entry whose
 * settlement it tracks. That entry captured only a snapshot of the gateway
 * status at approval time, so without this the admin's Refunds tab would
 * keep showing "requires manual settlement" (or "pending") after the money
 * has actually moved. Best-effort — the payment itself is already saved.
 */
const mirrorRentalRefundStatus = async (
    payment,
    status
) => {
    try {
        await Rental.updateMany(
            {
                "refunds.gatewayPayment":
                    payment._id,
            },
            {
                $set: {
                    "refunds.$[entry].gatewayStatus":
                        status,
                },
            },
            {
                arrayFilters: [
                    {
                        "entry.gatewayPayment":
                            payment._id,
                    },
                ],
            }
        );
    } catch (mirrorError) {
        console.error(
            `Failed to sync rental refund gateway status for payment ${payment._id}:`,
            mirrorError
        );
    }
};

/*
 * Sends a refund for `payment` through PayMongo and records the outcome on
 * `payment.refund`. Never throws: a gateway error is recorded as a refund
 * that needs manual action (with the reason) and admins are told, so a
 * failure can never block the booking/rental transition that triggered it.
 *
 * The gateway call and the bookkeeping are deliberately separate: once
 * PayMongo has accepted the refund, a problem saving it must NOT be recorded
 * as "the automatic refund failed" — that would send an admin off to refund
 * the customer a second time.
 *
 * When that happens `payment.$locals.unrecordedRefundId` carries the PayMongo
 * refund id, so a caller that keeps its own record of the refund (the rental
 * refunds do) can tell "PayMongo has it" from "PayMongo turned it down".
 */
const issueGatewayRefund = async (
    payment,
    {
        amount,
        reason,
        notes,
        initiatedBy,
        updatedBy = initiatedBy,
        metadata = null,
    }
) => {
    let refund;

    try {
        refund = await createRefund({
            paymentId:
                payment.paymongo.chargeId,
            amount,
            reason,
            notes,
            metadata: metadata || {
                bookingId: String(
                    payment.booking
                ),
            },
        });
    } catch (refundError) {
        console.error(
            `PayMongo refund failed for payment ${payment._id}:`,
            refundError.message
        );

        payment.refund = {
            amount,
            reason,
            notes,
            status: PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
            method: "manual",
            initiatedBy,
            initiatedAt: new Date(),
            completedAt: null,
            completedBy: null,
            failureReason:
                refundError.message ||
                "PayMongo refund request failed.",
        };

        payment.audit.updatedBy = updatedBy;

        await payment.save();

        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Automatic Refund Failed",
                message: `A refund of ${formatPaymentAmount(
                    amount
                )} for payment ${payment._id} could not be processed automatically (${
                    refundError.message ||
                    "unknown error"
                }). Open the payment to retry it through PayMongo, or refund the customer manually and confirm it.`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of a failed refund:"
        );

        return payment;
    }

    const gatewayStatus =
        refund.status ||
        PAYMENT_REFUND_STATUS.PENDING;

    const succeeded =
        gatewayStatus ===
        PAYMENT_REFUND_STATUS.SUCCEEDED;

    /*
     * PayMongo's "failed" is not a dead end here: the customer is still owed
     * the money, so it becomes a refund needing manual action instead of a
     * final state nobody can act on.
     */
    const failedAtGateway =
        gatewayStatus ===
        PAYMENT_REFUND_STATUS.FAILED;

    try {
        payment.refund = {
            refundId: refund.id,
            amount,
            reason,
            notes,
            status: failedAtGateway
                ? PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
                : gatewayStatus,
            method: failedAtGateway
                ? "manual"
                : "automatic",
            initiatedBy,
            initiatedAt: new Date(),
            completedAt: succeeded
                ? new Date()
                : null,
            completedBy: null,
            failureReason: failedAtGateway
                ? "PayMongo reported the refund as failed."
                : "",
        };

        if (succeeded) {
            applySucceededRefund(payment);
        }

        payment.audit.updatedBy = updatedBy;

        await payment.save();

        await syncBookingRefundAmountFromPayment(
            payment
        );
    } catch (persistError) {
        console.error(
            `PayMongo refund ${refund.id} was created for payment ${payment._id} but could not be saved:`,
            persistError
        );

        payment.$locals.unrecordedRefundId =
            refund.id;

        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Refund Sent But Not Recorded",
                message: `PayMongo accepted a refund of ${formatPaymentAmount(
                    amount
                )} (${refund.id}) for payment ${payment._id}, but it could not be recorded in the system. Do NOT refund the customer again — record it on the payment manually.`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of an unrecorded refund:"
        );

        return payment;
    }

    if (succeeded) {
        // The flow that asked for the refund tells the customer; this only
        // issues its acknowledgement.
        await syncBookingReceiptsSafely(payment.booking);

        await notifyAdminsSafely(
            {
                type: "Refund Sent",
                title: "Refund Sent",
                message: `An automatic refund of ${formatPaymentAmount(
                    amount
                )} for payment ${payment._id} succeeded.`,
                variant: "success",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of a successful refund:"
        );
    } else if (failedAtGateway) {
        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Automatic Refund Failed",
                message: `A refund of ${formatPaymentAmount(
                    amount
                )} for payment ${payment._id} was reported as failed by PayMongo. Open the payment to retry it through PayMongo, or refund the customer manually and confirm it.`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of a failed refund:"
        );
    }

    return payment;
};

/*
 * Refunds a VERIFIED payment, capped at whatever was actually paid. When the
 * payment has a captured PayMongo
 * charge (`paymongo.chargeId`), a real refund is created through PayMongo —
 * its outcome may not be final yet (pending/processing), and is brought to
 * a final state by the webhook or `reconcileRefund` below. When there is no
 * gateway charge to refund (Cash on Pickup, or a payment force-verified
 * without a completed checkout), or when the caller passes `forceManual`
 * (a refund large enough to require admin review — see the auto-approve
 * threshold in bookingService.js), the refund is flagged for an admin to
 * either release through PayMongo (`sendHeldRefund`) or settle outside the
 * app and close out via `completeManualRefund` — this function never marks
 * money as refunded on its own in that case.
 *
 * A payment carries a single refund record, so a payment that already has
 * one is returned as-is rather than being refunded a second time.
 *
 * Returns null when there is nothing to refund (payment not verified, or a
 * non-positive amount).
 */
const refundPayment = async (
    payment,
    {
        amount,
        reason = PAYMENT_REFUND_REASON.REQUESTED_BY_CUSTOMER,
        notes = "",
        forceManual = false,
    },
    initiatedBy = null
) => {
    if (
        !payment ||
        payment.status !== PAYMENT_STATUS.VERIFIED
    ) {
        return null;
    }

    // Checked before the amount so a caller that computed "nothing to refund"
    // still learns about a refund that already exists on this payment.
    if (payment.refund) {
        return payment;
    }

    const requestedAmount = Number(amount);

    if (
        !Number.isFinite(requestedAmount) ||
        requestedAmount <= 0
    ) {
        return null;
    }

    // Never attempt to refund more than was actually paid.
    const cappedAmount = Math.min(
        requestedAmount,
        Number(payment.amount)
    );

    if (cappedAmount <= 0) {
        return null;
    }
    const refundAmount = normalizeRefundAmount(cappedAmount);

    const chargeId = payment.paymongo?.chargeId;
    const manual = !chargeId || forceManual;

    /*
     * The payment carries ONE refund record, so reserve it with a conditional
     * update before anything is sent. The check above ran on a copy loaded
     * earlier: two flows ending the same booking at once (a cancellation and
     * a reschedule settling, say) would both pass it and both reach PayMongo.
     * Whoever loses gets the payment back as it now stands. Until PayMongo
     * answers, the claimed record reads "pending" (same claim-first pattern
     * as sendHeldRefund and the rental refunds).
     */
    const claimed = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            status: PAYMENT_STATUS.VERIFIED,
            refund: null,
        },
        {
            $set: {
                refund: {
                    amount: refundAmount,
                    reason,
                    notes,
                    status: manual
                        ? PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
                        : PAYMENT_REFUND_STATUS.PENDING,
                    method: manual ? "manual" : "automatic",
                    initiatedBy,
                    initiatedAt: new Date(),
                    completedAt: null,
                    completedBy: null,
                    failureReason: "",
                },
                "audit.updatedBy": initiatedBy,
            },
        },
        { new: true }
    );

    if (!claimed) {
        return Payment.findById(payment._id);
    }

    if (manual) {
        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Manual Refund Needed",
                message: forceManual
                    ? `Payment ${payment._id} needs a refund of ${formatPaymentAmount(
                          refundAmount
                      )} — it exceeds the auto-approve refund threshold and requires admin review. Open the payment and choose "Send via PayMongo" to release it, or refund the customer manually and confirm it.`
                    : `Payment ${payment._id} needs a manual refund of ${formatPaymentAmount(
                          refundAmount
                      )} — it has no PayMongo charge to refund automatically (e.g. Cash on Pickup).`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of a manual refund requirement:"
        );

        return claimed;
    }

    return issueGatewayRefund(claimed, {
        amount: refundAmount,
        reason,
        notes,
        initiatedBy,
    });
};

/*
 * Refunds the VERIFIED reservation-fee payment for a booking — see
 * refundPayment for how the refund is issued. Returns null when there is
 * nothing to refund (no verified reservation payment, or a non-positive
 * amount).
 */
const processBookingRefund = async (
    bookingId,
    options,
    initiatedBy = null
) => {
    const payment = await Payment.findOne({
        booking: bookingId,
        paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        status: PAYMENT_STATUS.VERIFIED,
    });

    if (!payment) {
        return null;
    }

    return refundPayment(
        payment,
        options,
        initiatedBy
    );
};

/*
 * Refunds every VERIFIED extension-fee payment on a booking that ended before
 * pickup (cancelled, rejected, expired). An extension only bought extra days
 * on a rental that will now never happen, so — unlike the reservation fee,
 * which the cancellation policy may keep part of — it is always refunded in
 * full. `manualThreshold` mirrors the auto-approve setting: an individual
 * refund above it is held for an admin to release (0 = never hold).
 *
 * One payment failing never stops the rest. Returns the payments that now
 * carry a refund.
 */
const refundBookingExtensionFees = async (
    bookingId,
    {
        reason = PAYMENT_REFUND_REASON.OTHERS,
        notes = "",
        manualThreshold = 0,
    } = {},
    initiatedBy = null
) => {
    const extensionPayments =
        await Payment.find({
            booking: bookingId,
            paymentType:
                PAYMENT_TYPE.EXTENSION_FEE,
            status: PAYMENT_STATUS.VERIFIED,
        });

    const refunded = [];

    for (const payment of extensionPayments) {
        try {
            const result = await refundPayment(
                payment,
                {
                    amount: payment.amount,
                    reason,
                    notes,
                    forceManual:
                        manualThreshold > 0 &&
                        Number(payment.amount) >
                            manualThreshold,
                },
                initiatedBy
            );

            if (result?.refund) {
                refunded.push(result);
            }
        } catch (refundError) {
            console.error(
                `Failed to refund extension fee payment ${payment._id}:`,
                refundError
            );
        }
    }

    return refunded;
};

/*
 * Money arrived for a payment the system can no longer honour — the booking
 * was already cancelled, rejected or released, or the payment itself had been
 * cancelled. Quietly keeping it would take a customer's money for nothing, and
 * the old behaviour (reject the webhook) left it neither recorded nor
 * refunded. So the payment is recorded as received (the money really was
 * captured) and immediately refunded in full; the customer and admins are told.
 *
 * Safe to call repeatedly: only the call that actually moves the payment out
 * of PENDING/CANCELLED goes on to refund it.
 */
const refundLatePayment = async (
    payment,
    {
        paymongoPaymentId = "",
        chargeId = "",
        paidWith = {},
        closedBecause,
    }
) => {
    const claimed =
        await Payment.findOneAndUpdate(
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
                    status: PAYMENT_STATUS.VERIFIED,
                    "paymongo.paymentId":
                        paymongoPaymentId ||
                        payment.paymongo
                            ?.paymentId ||
                        "",
                    "paymongo.chargeId":
                        chargeId ||
                        payment.paymongo
                            ?.chargeId ||
                        "",
                    ...paidWithFields(paidWith),
                    verification: {
                        verifiedBy: null,
                        verifiedAt: new Date(),
                        rejectionReason: "",
                    },
                    processedBy: null,
                    processedAt: new Date(),
                    notes: `Received after ${closedBecause}; refunded automatically.`,
                    "audit.updatedBy": null,
                },
            },
            { new: true }
        );

    if (!claimed) {
        // Another path already dealt with it.
        return findPaymentById(payment._id);
    }

    const booking = await Booking.findById(
        claimed.booking
    ).select("bookingCode");

    const bookingLabel =
        booking?.bookingCode || "your booking";

    try {
        await refundPayment(
            claimed,
            {
                amount: claimed.amount,
                reason: PAYMENT_REFUND_REASON.OTHERS,
                notes: `Automatic refund: payment received after ${closedBecause}.`,
            },
            null
        );
    } catch (refundError) {
        console.error(
            `Failed to refund late payment ${claimed._id}:`,
            refundError
        );

        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Late Payment Needs a Refund",
                message: `A payment of ${formatPaymentAmount(
                    claimed.amount
                )} (${claimed._id}) arrived for booking ${bookingLabel} after ${closedBecause}, but it could not be refunded automatically (${
                    refundError.message ||
                    "unknown error"
                }). Refund the customer manually.`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: claimed._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of an unrefunded late payment:"
        );
    }

    try {
        await notifyUser(claimed.customer, {
            type: "Payment Refunded",
            title: "Payment Refunded",
            message: `We received your payment of ${formatPaymentAmount(
                claimed.amount
            )} for booking ${bookingLabel} after ${closedBecause}, so it is being refunded in full to your original payment method.`,
            variant: "warning",
            category: "Refund",
            metadata: {
                reference: booking?.bookingCode,
                relatedId: claimed.booking,
                relatedModel: "Booking",
            },
            email: true,
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of a refunded late payment:",
            notificationError
        );
    }

    await notifyAdminsSafely(
        {
            type: "Late Payment Refunded",
            title: "Payment Received for a Closed Booking",
            message: `A payment of ${formatPaymentAmount(
                claimed.amount
            )} arrived for booking ${bookingLabel} after ${closedBecause}. It is being refunded to the customer automatically.`,
            variant: "payment",
            category: "Refund",
            metadata: {
                relatedId: claimed._id,
                relatedModel: "Payment",
            },
        },
        "Failed to notify admins of a refunded late payment:"
    );

    return findPaymentById(claimed._id);
};

/*
 * Records that PayMongo has confirmed a payment's checkout can no longer be
 * paid, so the closed-checkout sweep can stop checking on it. Best-effort.
 */
const markCheckoutClosed = async (payment) => {
    try {
        await Payment.updateOne(
            { _id: payment._id },
            {
                $set: {
                    "paymongo.checkoutExpiredAt":
                        new Date(),
                },
            }
        );
    } catch (markError) {
        console.error(
            `Failed to record that payment ${payment._id}'s checkout is closed:`,
            markError
        );
    }
};

/*
 * Closes a payment's PayMongo checkout so it can't be paid any more. When
 * PayMongo refuses (the session is already expired, already paid, or has a
 * payment in flight), find out whether it was in fact paid a moment ago: if so
 * the payment is recovered right away — recorded and refunded — rather than
 * left to whenever the webhook turns up. A payment merely in flight is
 * caught by the webhook, which now refunds it too. Best-effort; never throws.
 */
const closeCheckoutSession = async (
    payment
) => {
    const checkoutSessionId =
        payment.paymongo?.checkoutSessionId;

    if (
        payment.paymentMethod !==
            PAYMENT_METHOD.GCASH ||
        !checkoutSessionId
    ) {
        return;
    }

    try {
        await expireCheckoutSession(
            checkoutSessionId
        );

        await markCheckoutClosed(payment);

        return;
    } catch {
        // Couldn't close it — see whether it was paid.
    }

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
        } else if (session.status === "expired") {
            // Already expired on PayMongo's side — nothing left to watch.
            await markCheckoutClosed(payment);
        }
    } catch (lookupError) {
        console.error(
            `Failed to check checkout session ${checkoutSessionId} after closing payment ${payment._id}:`,
            lookupError
        );
    }
};

/*
 * When a booking ends (cancelled, rejected, expired, released) nothing it
 * still owes should stay payable. Cancels every PENDING payment on it and
 * closes the PayMongo checkout behind each one — until now only the
 * unpaid-booking sweep did, so a customer could finish a checkout they'd left
 * open after the booking was already gone and be charged for nothing.
 *
 * The payment is flipped to CANCELLED first, so any money that does still
 * arrive is treated as a late payment and refunded (see refundLatePayment),
 * never quietly kept. Best-effort per payment; never throws.
 */
const cancelPendingBookingPayments = async (
    bookingId,
    actorId = null
) => {
    let pendingPayments = [];

    try {
        pendingPayments = await Payment.find({
            booking: bookingId,
            status: PAYMENT_STATUS.PENDING,
        });
    } catch (lookupError) {
        console.error(
            `Failed to look up pending payments for booking ${bookingId}:`,
            lookupError
        );

        return;
    }

    for (const payment of pendingPayments) {
        try {
            const cancelled =
                await Payment.findOneAndUpdate(
                    {
                        _id: payment._id,
                        status:
                            PAYMENT_STATUS.PENDING,
                    },
                    {
                        $set: {
                            status:
                                PAYMENT_STATUS.CANCELLED,
                            "audit.updatedBy":
                                actorId,
                        },
                    },
                    { new: true }
                );

            // Paid or cancelled by someone else in the meantime.
            if (!cancelled) {
                continue;
            }

            await closeCheckoutSession(
                cancelled
            );
        } catch (cancelError) {
            console.error(
                `Failed to cancel pending payment ${payment._id}:`,
                cancelError
            );
        }
    }
};

const CLOSED_CHECKOUT_SWEEP_WINDOW_MS =
    7 * 24 * 60 * 60 * 1000;

const CLOSED_CHECKOUT_SWEEP_BATCH = 100;

/*
 * Scheduled safety net for the two ways a customer's money could still slip
 * through: the webhook for a paid checkout never arriving, or a checkout that
 * could not be closed when its payment was cancelled.
 *
 * Looks at online payments touched in the last week whose checkout PayMongo
 * hasn't confirmed as closed:
 *   - CANCELLED: try to close the checkout again; if it turns out to have been
 *     paid, it is recovered (recorded and refunded) right here.
 *   - PENDING on a booking that has since ended: an older payment from before
 *     pending payments were closed with their booking — cancel it and close
 *     its checkout now. A PENDING payment on a live booking is left alone; it
 *     is genuinely awaiting payment.
 *
 * Only payments not yet marked closed are revisited, so PayMongo is called at
 * most a few times per payment, not on every run. Best-effort: one payment's
 * failure never stops the rest.
 */
const reconcileClosedCheckouts = async () => {
    let candidates = [];

    try {
        const since = new Date(
            Date.now() -
                CLOSED_CHECKOUT_SWEEP_WINDOW_MS
        );

        const findWithStatus = (status) =>
            Payment.find({
                paymentMethod:
                    PAYMENT_METHOD.GCASH,
                "paymongo.checkoutSessionId": {
                    $nin: ["", null],
                },
                "paymongo.checkoutExpiredAt": null,
                status,
                updatedAt: { $gte: since },
            })
                .sort({ updatedAt: -1 })
                .limit(
                    CLOSED_CHECKOUT_SWEEP_BATCH
                );

        // Two separately-capped queries: cancelled payments need a PayMongo
        // call, pending ones only a cheap booking check, and plenty of the
        // latter (live bookings awaiting payment) must not crowd out the
        // former.
        const [cancelled, pending] =
            await Promise.all([
                findWithStatus(
                    PAYMENT_STATUS.CANCELLED
                ),
                findWithStatus(
                    PAYMENT_STATUS.PENDING
                ),
            ]);

        candidates = [...cancelled, ...pending];
    } catch (lookupError) {
        console.error(
            "Closed-checkout sweep could not look up payments:",
            lookupError
        );

        return;
    }

    for (const payment of candidates) {
        try {
            if (
                payment.status ===
                PAYMENT_STATUS.PENDING
            ) {
                const booking =
                    await Booking.findById(
                        payment.booking
                    ).select("status");

                if (
                    booking &&
                    BOOKING_ENDED_WITHOUT_TRIP_STATUSES.includes(booking.status)
                ) {
                    await cancelPendingBookingPayments(
                        payment.booking,
                        null
                    );
                }

                continue;
            }

            await closeCheckoutSession(
                payment
            );
        } catch (sweepError) {
            console.error(
                `Closed-checkout sweep failed for payment ${payment._id}:`,
                sweepError
            );
        }
    }
};

/*
 * Admin releases a refund that was held for review (it exceeded the
 * auto-approve threshold, or an earlier automatic attempt failed) by sending
 * it through PayMongo now — the same automatic refund `processBookingRefund`
 * would have made. Only possible when the payment has a real PayMongo charge;
 * otherwise it has to be settled outside the app.
 *
 * The refund is claimed atomically (flipped to "pending") before PayMongo is
 * called, so two admins clicking at once — or a double click — can't both
 * send it: a partial refund can legitimately be issued more than once
 * against the same charge, so PayMongo itself would not stop the second.
 */
const sendHeldRefund = async (
    paymentId,
    adminId
) => {
    const payment = await Payment.findById(
        paymentId
    );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (!payment.refund) {
        throw createError(
            "This payment has no refund to send.",
            400
        );
    }

    if (
        payment.refund.status !==
        PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
    ) {
        throw createError(
            "Only a refund that needs manual action can be sent through PayMongo.",
            400
        );
    }

    if (!payment.paymongo?.chargeId) {
        throw createError(
            "This payment has no PayMongo charge to refund automatically. Settle it outside the app, then mark it as completed.",
            400
        );
    }

    const claimed =
        await Payment.findOneAndUpdate(
            {
                _id: payment._id,
                "refund.status":
                    PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION,
            },
            {
                $set: {
                    "refund.status":
                        PAYMENT_REFUND_STATUS.PENDING,
                    "audit.updatedBy": adminId,
                },
            },
            {
                new: true,
            }
        );

    if (!claimed) {
        throw createError(
            "This refund was already updated by another request.",
            409
        );
    }

    const result = await issueGatewayRefund(
        claimed,
        {
            amount: claimed.refund.amount,
            reason: claimed.refund.reason,
            notes: [
                claimed.refund.notes,
                "Approved and sent by an admin.",
            ]
                .filter(Boolean)
                .join(" | ")
                .slice(0, 255),
            initiatedBy:
                claimed.refund.initiatedBy,
            updatedBy: adminId,
        }
    );

    // A rental refund tracked by this payment showed "requires manual
    // action" until now; bring its snapshot in line with the new state.
    await mirrorRentalRefundStatus(
        result,
        result.refund?.status
    );

    // The attempt itself is recorded on the payment either way; tell the
    // admin plainly when PayMongo did not take it.
    if (
        result.refund?.status ===
            PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
    ) {
        throw createError(
            `PayMongo could not process this refund: ${
                result.refund.failureReason ||
                "unknown error"
            }`,
            502
        );
    }

    // Still pending at PayMongo: the webhook/reconcile tells the customer.
    if (
        result.refund?.status ===
        PAYMENT_REFUND_STATUS.SUCCEEDED
    ) {
        await notifyCustomerRefundSent(result);
    }

    return result;
};

/*
 * Admin closes out a refund that needed manual action (Cash on Pickup, a
 * failed automatic attempt, or a refund stuck in pending/processing) after
 * settling it outside the app — or marks it failed if it couldn't be done.
 */
const completeManualRefund = async (
    paymentId,
    {
        succeeded = true,
        notes = "",
    },
    adminId
) => {
    let payment = await Payment.findById(
        paymentId
    );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (!payment.refund) {
        throw createError(
            "This payment has no refund to complete.",
            400
        );
    }

    const isFinal = (status) =>
        status === PAYMENT_REFUND_STATUS.SUCCEEDED ||
        status === PAYMENT_REFUND_STATUS.FAILED;

    if (isFinal(payment.refund.status)) {
        throw createError(
            "This refund has already reached a final state.",
            400
        );
    }

    /*
     * A refund PayMongo is still working on can't be closed by hand: marked
     * "not completed" and then paid by PayMongo, the money would have left
     * while the system says it didn't (a final state is never moved by the
     * webhook). Ask PayMongo first and leave it open when its status cannot
     * be confirmed. A lookup failure does not mean the refund failed.
     */
    const inFlightAtGateway =
        payment.refund.refundId &&
        [
            PAYMENT_REFUND_STATUS.PENDING,
            PAYMENT_REFUND_STATUS.PROCESSING,
        ].includes(payment.refund.status);

    if (inFlightAtGateway) {
        let gatewayStatus = null;

        try {
            const gatewayRefund = await retrieveRefund(
                payment.refund.refundId
            );

            gatewayStatus = gatewayRefund.status;

            await syncRefundStatus(
                gatewayRefund.id,
                gatewayRefund.status
            );
        } catch (lookupError) {
            console.error(
                `Couldn't check refund ${payment.refund.refundId} with PayMongo before closing it by hand:`,
                lookupError
            );
            throw createError(
                "The refund's status could not be confirmed with PayMongo. Try checking again later before settling it manually.",
                409
            );
        }

        if (
            gatewayStatus === PAYMENT_REFUND_STATUS.PENDING ||
            gatewayStatus === PAYMENT_REFUND_STATUS.PROCESSING
        ) {
            throw createError(
                "PayMongo is still processing this refund, so it can't be closed by hand yet. Use \"Check with PayMongo\" later.",
                409
            );
        }

        if (gatewayStatus === PAYMENT_REFUND_STATUS.SUCCEEDED) {
            throw createError(
                "PayMongo reports this refund as sent. Its status has been updated — there's nothing left to settle.",
                409
            );
        }

        if (gatewayStatus !== PAYMENT_REFUND_STATUS.FAILED) {
            throw createError(
                "PayMongo has not confirmed that this refund failed. Check its status again before settling it manually.",
                409
            );
        }

        // PayMongo failed it: now "requires manual action", settle as usual.
        payment = (await Payment.findById(payment._id)) || payment;
        if (payment.refund?.status !== PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION) {
            throw createError(
                "This refund was updated while its gateway status was being checked. Refresh before trying again.",
                409
            );
        }
    }

    const expectedStatus = payment.refund.status;

    const nextStatus = succeeded
        ? PAYMENT_REFUND_STATUS.SUCCEEDED
        : PAYMENT_REFUND_STATUS.FAILED;

    const mergedNotes = notes
        ? [payment.refund.notes, notes]
              .filter(Boolean)
              .join(" | ")
              .slice(0, 255)
        : payment.refund.notes;

    const fullyRefunded =
        succeeded &&
        Number(payment.refund.amount || 0) >=
            Number(payment.amount || 0);

    // Conditional: a webhook or a second admin settling the same refund at
    // once must not overwrite each other's outcome.
    const settled = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            "refund.status": expectedStatus,
        },
        {
            $set: {
                "refund.status": nextStatus,
                "refund.completedAt": new Date(),
                "refund.completedBy": adminId,
                "refund.notes": mergedNotes,
                "audit.updatedBy": adminId,
                ...(fullyRefunded
                    ? { status: PAYMENT_STATUS.REFUNDED }
                    : {}),
            },
        },
        { new: true }
    );

    if (!settled) {
        throw createError(
            "This refund was just updated by another request. Refresh and check its status.",
            409
        );
    }

    payment = settled;

    await mirrorRentalRefundStatus(
        payment,
        payment.refund.status
    );

    if (!succeeded) {
        // The rental refund this payment tracked never paid anything, so it
        // stops counting toward the rental's totals.
        try {
            await refreshRentalsTrackedByPayment(
                payment._id,
                adminId
            );
        } catch (refreshError) {
            console.error(
                `Failed to recompute rental totals after refund on payment ${payment._id} was marked not completed:`,
                refreshError
            );
        }
    }

    await syncBookingRefundAmountFromPayment(
        payment
    );

    if (succeeded) {
        await notifyCustomerRefundSent(payment);

        return payment;
    }

    try {
        await notifyUser(payment.customer, {
            type: "Refund Failed",
            title: "Refund Could Not Be Completed",
            message: `We were unable to process your refund of ${formatPaymentAmount(
                payment.refund.amount
            )}. Please contact support.`,
            variant: "warning",
            category: "Refund",
            metadata: {
                relatedId: payment._id,
                relatedModel: "Payment",
            },
            email: {
                actionLabel: "Contact support",
                actionPath: "/customer/customer-service",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify customer of refund completion:",
            notificationError
        );
    }

    return payment;
};

/*
 * Brings an automatic refund's status up to date from PayMongo — called by
 * the webhook and available for a manual reconcile poll if the webhook
 * doesn't land (also swept on a schedule, see reconcilePendingRefunds).
 *
 * Webhooks are retried and can arrive out of order, so a settled refund never
 * moves again and an in-flight status never steps backwards. PayMongo's
 * "failed" becomes "requires_manual_action": the customer is still owed the
 * money, and the admin needs to be able to retry or settle it — a refund
 * frozen as a final "failed" offered them no way to do either.
 */
const syncRefundStatus = async (
    refundId,
    paymongoStatus
) => {
    if (!refundId || !paymongoStatus) {
        return null;
    }

    let payment = await Payment.findOne({
        "refund.refundId": refundId,
    });

    if (!payment?.refund) {
        return null;
    }

    const current = payment.refund.status;

    if (
        current ===
            PAYMENT_REFUND_STATUS.SUCCEEDED ||
        current ===
            PAYMENT_REFUND_STATUS.FAILED
    ) {
        return payment;
    }

    const failedAtGateway =
        paymongoStatus ===
        PAYMENT_REFUND_STATUS.FAILED;

    const next = failedAtGateway
        ? PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION
        : paymongoStatus;

    if (current === next) {
        return payment;
    }

    // An admin is already dealing with it; only a success can override that.
    if (
        current ===
            PAYMENT_REFUND_STATUS.REQUIRES_MANUAL_ACTION &&
        next !== PAYMENT_REFUND_STATUS.SUCCEEDED
    ) {
        return payment;
    }

    if (
        current ===
            PAYMENT_REFUND_STATUS.PROCESSING &&
        next === PAYMENT_REFUND_STATUS.PENDING
    ) {
        return payment;
    }

    const succeeded =
        next ===
        PAYMENT_REFUND_STATUS.SUCCEEDED;

    const fullyRefunded =
        succeeded &&
        Number(payment.refund.amount || 0) >=
            Number(payment.amount || 0);

    /*
     * Conditional on the status just read: a duplicate webhook, the
     * reconcile sweep and an admin settling it by hand can all arrive at
     * once, and a plain save() (Payment has no optimistic concurrency) would
     * let the last one overwrite a state another had already moved it to.
     */
    const updated = await Payment.findOneAndUpdate(
        {
            _id: payment._id,
            "refund.refundId": refundId,
            "refund.status": current,
        },
        {
            $set: {
                "refund.status": next,
                ...(succeeded
                    ? {
                          "refund.completedAt": new Date(),
                          "refund.failureReason": "",
                      }
                    : {}),
                ...(failedAtGateway
                    ? {
                          "refund.method": "manual",
                          "refund.failureReason":
                              "PayMongo reported the refund as failed.",
                      }
                    : {}),
                ...(fullyRefunded
                    ? { status: PAYMENT_STATUS.REFUNDED }
                    : {}),
            },
        },
        { new: true }
    );

    if (!updated) {
        // Someone else moved it first; report it as it now stands.
        return Payment.findById(payment._id);
    }

    payment = updated;

    await mirrorRentalRefundStatus(
        payment,
        next
    );

    await syncBookingRefundAmountFromPayment(
        payment
    );

    if (succeeded) {
        await notifyCustomerRefundSent(payment);

        await notifyAdminsSafely(
            {
                type: "Refund Sent",
                title: "Refund Sent",
                message: `An automatic refund of ${formatPaymentAmount(
                    payment.refund.amount
                )} for payment ${payment._id} succeeded.`,
                variant: "success",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of refund status change:"
        );
    } else if (failedAtGateway) {
        /*
         * Admins only — the customer isn't told a refund "failed" while it
         * can still be retried or settled by hand. If it is ultimately
         * abandoned, completeManualRefund(succeeded: false) tells them.
         */
        await notifyAdminsSafely(
            {
                type: "Refund Requires Manual Action",
                title: "Automatic Refund Failed",
                message: `An automatic refund of ${formatPaymentAmount(
                    payment.refund.amount
                )} for payment ${payment._id} failed at PayMongo. Open the payment to retry it through PayMongo, or refund the customer manually and confirm it.`,
                variant: "payment",
                category: "Refund",
                metadata: {
                    relatedId: payment._id,
                    relatedModel: "Payment",
                },
            },
            "Failed to notify admins of refund status change:"
        );
    }

    return payment;
};

/*
 * Polls PayMongo directly for a refund's current status — the manual
 * fallback for `syncRefundStatus` when the webhook never arrives.
 */
const reconcileRefund = async (paymentId) => {
    const payment = await Payment.findById(
        paymentId
    );

    if (!payment) {
        throw createError(
            "Payment not found.",
            404
        );
    }

    if (!payment.refund?.refundId) {
        throw createError(
            "This payment has no automatic refund to reconcile.",
            400
        );
    }

    const refund = await retrieveRefund(
        payment.refund.refundId
    );

    return syncRefundStatus(
        refund.id,
        refund.status
    );
};

/*
 * Scheduled sweep: bring any automatic refund still pending/processing at
 * PayMongo to its final state when the webhook never arrived. Best-effort —
 * one payment's failure is logged and never stops the rest of the sweep.
 */
const reconcilePendingRefunds = async () => {
    const stuckPayments = await Payment.find({
        "refund.method": "automatic",
        "refund.status": {
            $in: [
                PAYMENT_REFUND_STATUS.PENDING,
                PAYMENT_REFUND_STATUS.PROCESSING,
            ],
        },
        "refund.refundId": {
            $nin: ["", null],
        },
    }).select("_id refund");

    for (const payment of stuckPayments) {
        try {
            const refund = await retrieveRefund(
                payment.refund.refundId
            );

            await syncRefundStatus(
                refund.id,
                refund.status
            );
        } catch (error) {
            console.error(
                `Refund reconcile sweep failed for payment ${payment._id}:`,
                error
            );
        }
    }
};

export {
    createPayment,
    createPaymongoCheckout,
    verifyPayment,
    cancelPayment,
    verifyPaymentByCheckoutSession,
    reconcilePaymentWithPaymongo,
    reportPaymentFailure,
    getPaymentById,
    getPayments,
    processBookingRefund,
    refundBookingExtensionFees,
    cancelPendingBookingPayments,
    closeCheckoutSession,
    recomputeBookingRefundAmount,
    reconcileClosedCheckouts,
    sendHeldRefund,
    completeManualRefund,
    syncRefundStatus,
    reconcileRefund,
    reconcilePendingRefunds,
    applySucceededRefund,
    issueGatewayRefund,
};
