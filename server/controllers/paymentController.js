import { validationResult } from "express-validator";

import {
    createPayment,
    createPaymongoCheckout,
    verifyPayment,
    cancelPayment,
    verifyPaymentByCheckoutSession,
    reconcilePaymentWithPaymongo,
    reportPaymentFailure,
    getPaymentById,
    getPayments,
    completeManualRefund,
    sendHeldRefund,
    syncRefundStatus,
    reconcileRefund,
} from "../services/paymentService.js";

import crypto from "crypto";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

import {
    PAYMENT_STATUS,
} from "../constants/paymentConstants.js";

import Payment from "../models/Payment.js";

const handleValidationErrors = (
    req,
    res
) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        errorResponse(
            res,
            "Validation failed.",
            400,
            errors.array()
        );

        return true;
    }

    return false;
};

export const create = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const payment =
            await createPayment(
                req.body.bookingId,
                req.user._id,
                req.body.paymentMethod
            );

        return successResponse(
            res,
            "Payment created successfully.",
            payment,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const createCheckout = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const { force } = req.body;

        const clientBaseUrl =
            process.env.CLIENT_URL;

        if (!clientBaseUrl) {
            return errorResponse(
                res,
                "CLIENT_URL is not configured.",
                500
            );
        }

        const result =
            await createPaymongoCheckout(
                req.params.paymentId,
                req.user._id,
                clientBaseUrl,
                {
                    force: Boolean(force),
                }
            );

        return successResponse(
            res,
            "PayMongo Checkout Session created successfully.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const verify = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const { force } = req.body;

        const payment =
            await verifyPayment(
                req.params.paymentId,
                req.user._id,
                {
                    force: Boolean(force),
                }
            );

        return successResponse(
            res,
            "Payment verified successfully.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancel = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const payment =
            await cancelPayment(
                req.params.paymentId,
                req.user._id
            );

        return successResponse(
            res,
            "Payment cancelled successfully.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const reconcile = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const result =
            await reconcilePaymentWithPaymongo(
                req.params.paymentId,
                req.user
            );

        const message = result.paid
            ? result.reconciled
                ? "Payment confirmed with PayMongo."
                : "This payment has already been verified."
            : "This payment has not been completed yet.";

        return successResponse(
            res,
            message,
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const reportFailure = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const result =
            await reportPaymentFailure(
                req.params.paymentId,
                req.user._id
            );

        return successResponse(
            res,
            "Payment failure recorded.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getById = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const payment =
            await getPaymentById(
                req.params.paymentId,
                req.user
            );

        return successResponse(
            res,
            "Payment retrieved successfully.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAll = async (
    req,
    res
) => {
    try {
        const filters = {
            bookingId:
                req.query.bookingId,

            status:
                req.query.status,

            paymentMethod:
                req.query.paymentMethod,

            paymentType:
                req.query.paymentType,
        };

        const payments =
            await getPayments(
                req.user,
                filters
            );

        return successResponse(
            res,
            "Payments retrieved successfully.",
            payments
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

const isRefundEvent = (eventType) =>
    typeof eventType === "string" &&
    (eventType.startsWith("refund.") ||
        eventType === "payment.refunded" ||
        eventType === "payment.refund.updated");

/*
 * PayMongo has used more than one shape for refund events: a `refund.*` event
 * carries the Refund itself (`ref_…` with its own `status`), while the older
 * `payment.refunded` / `payment.refund.updated` events carry the Payment with
 * its `refunds[]` inside. Normalise both to a list of { refundId, status }.
 * When a payload has no status of its own, fall back to what the event name
 * says (`refund.succeeded` / `refund.failed`). A Payment (`pay_…`) is never
 * treated as a refund — that mistake would look up a refund by a payment id.
 */
const extractRefundOutcomes = (
    eventType,
    eventData
) => {
    const statusFromEventName =
        eventType.endsWith(".succeeded")
            ? "succeeded"
            : eventType.endsWith(".failed")
                ? "failed"
                : "";

    const embeddedRefunds = Array.isArray(
        eventData?.attributes?.refunds
    )
        ? eventData.attributes.refunds
        : null;

    return (embeddedRefunds ?? [eventData])
        .filter(
            (resource) =>
                resource?.id &&
                !String(resource.id).startsWith("pay_")
        )
        .map((resource) => ({
            refundId: resource.id,
            status:
                resource.attributes?.status ||
                statusFromEventName,
        }))
        .filter((outcome) => outcome.status);
};

const verifyWebhookSignature = (
    payload,
    signature,
    webhookSecret,
    maxAgeSeconds = 300
) => {
    if (!webhookSecret) {
        if (
            process.env.NODE_ENV ===
            "production"
        ) {
            console.error(
                "[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET is not configured. Rejecting webhook in production."
            );

            return false;
        }

        console.warn(
            "[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET is not configured. Skipping signature verification (non-production only)."
        );

        return true;
    }

    if (!signature) {
        return false;
    }

    const parts = signature
        .split(",")
        .reduce((acc, part) => {
            const [key, value] = part.split("=");

            acc[key.trim()] =
                value?.trim();

            return acc;
        }, {});

    const timestamp = parts.t;

    /*
     * PayMongo's Paymongo-Signature header is `t=<ts>,te=<test-sig>,li=<live-sig>`.
     * The webhook secret is mode-specific, so the matching signature is `te` in
     * test mode and `li` in live mode — check both. `v1` is Stripe's key name,
     * kept only as a fallback for older tooling.
     */
    const candidateSignatures = [
        parts.te,
        parts.li,
        parts.v1,
    ].filter(Boolean);

    if (
        !timestamp ||
        candidateSignatures.length === 0
    ) {
        return false;
    }

    const timestampMs =
        Number(timestamp) * 1000;

    if (!Number.isFinite(timestampMs)) {
        return false;
    }

    const now = Date.now();

    /*
     * Advisory only. PayMongo retries a failed webhook for up to ~3 days and
     * may keep the original timestamp, so a stale timestamp must not reject a
     * retry. The HMAC below is the real forgery gate, and the paid-event
     * handler is idempotent, so replay of a genuine event is harmless.
     */
    if (
        Math.abs(now - timestampMs) >
        maxAgeSeconds * 1000
    ) {
        console.warn(
            `[PayMongo Webhook] Signature timestamp is ${Math.round(
                Math.abs(now - timestampMs) / 1000
            )}s old (tolerance ${maxAgeSeconds}s) — likely a retry; verifying signature anyway.`
        );
    }

    const signedPayload = `${timestamp}.${payload}`;

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(signedPayload)
        .digest("hex");

    const expectedBuffer = Buffer.from(
        expectedSignature,
        "utf-8"
    );

    return candidateSignatures.some(
        (candidate) => {
            const candidateBuffer =
                Buffer.from(
                    candidate,
                    "utf-8"
                );

            if (
                candidateBuffer.length !==
                expectedBuffer.length
            ) {
                return false;
            }

            return crypto.timingSafeEqual(
                candidateBuffer,
                expectedBuffer
            );
        }
    );
};

export const handleWebhook = async (
    req,
    res
) => {
    try {
        const webhookSecret =
            process.env
                .PAYMONGO_WEBHOOK_SECRET;

        const signature =
            req.headers[
                "paymongo-signature"
            ];

        /*
         * A global express.json() runs before this route, so req.body is
         * already the parsed object. req.rawBody (captured by express.json's
         * verify hook) holds the exact bytes PayMongo signed; fall back to the
         * route-level express.raw() Buffer, then to a re-serialized body.
         */
        const rawBody = Buffer.isBuffer(
            req.rawBody
        )
            ? req.rawBody.toString("utf-8")
            : Buffer.isBuffer(req.body)
                ? req.body.toString("utf-8")
                : typeof req.body ===
                        "string"
                    ? req.body
                    : JSON.stringify(
                        req.body ?? {}
                    );

        if (
            !verifyWebhookSignature(
                rawBody,
                signature,
                webhookSecret
            )
        ) {
            return errorResponse(
                res,
                "Invalid webhook signature.",
                401
            );
        }

        let body;

        try {
            body = JSON.parse(rawBody);
        } catch {
            return errorResponse(
                res,
                "Invalid webhook payload.",
                400
            );
        }

        const eventType =
            body?.data?.attributes
                ?.type;

        const eventData =
            body?.data?.attributes
                ?.data;

        if (
            eventType ===
            "checkout_session.payment.paid"
        ) {
            const checkoutSessionId =
                eventData?.id;

            const paymentIntentId =
                eventData?.attributes
                    ?.payment_intent
                    ?.id;

            const chargeId =
                eventData?.attributes
                    ?.payments?.[0]
                    ?.id;

            if (!checkoutSessionId) {
                return errorResponse(
                    res,
                    "Missing checkout session ID in webhook payload.",
                    400
                );
            }

            const existingPayment =
                await Payment.findOne({
                    "paymongo.checkoutSessionId":
                        checkoutSessionId,
                }).select(
                    "status paymongo"
                );

            if (!existingPayment) {
                // Session we never created (e.g. the PayMongo test route) —
                // acknowledge so PayMongo stops retrying.
                return successResponse(
                    res,
                    "No matching payment for this checkout session; ignored.",
                    { checkoutSessionId }
                );
            }

            const wasAlreadyVerified =
                existingPayment.status ===
                    PAYMENT_STATUS.VERIFIED;

            const payment =
                await verifyPaymentByCheckoutSession(
                    checkoutSessionId,
                    paymentIntentId ||
                        "",
                    chargeId || "",
                    eventData?.attributes
                        ?.payments?.[0]
                );

            /*
             * A payment that arrives for a booking (or payment) that was
             * already closed is recorded and refunded rather than verified,
             * so it comes back carrying a refund it didn't have a moment ago.
             * Say so — and answer 200 either way, so PayMongo stops retrying.
             */
            return successResponse(
                res,
                wasAlreadyVerified
                    ? "Payment was already verified."
                    : payment?.refund
                        ? "Payment arrived after its booking closed; refunded automatically."
                        : "Payment verified via webhook.",
                payment
            );
        }

        if (isRefundEvent(eventType)) {
            const outcomes = extractRefundOutcomes(
                eventType,
                eventData
            );

            if (outcomes.length === 0) {
                return successResponse(
                    res,
                    "Refund webhook missing refund ID or status; ignored.",
                    { eventType }
                );
            }

            let synced = 0;

            for (const outcome of outcomes) {
                const payment = await syncRefundStatus(
                    outcome.refundId,
                    outcome.status
                );

                if (payment) {
                    synced += 1;
                }
            }

            return successResponse(
                res,
                synced > 0
                    ? "Refund status synced via webhook."
                    : "No matching refund for this webhook; ignored.",
                { eventType, synced }
            );
        }

        return successResponse(
            res,
            "Webhook received.",
            { eventType }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * Admin fallback for a refund stuck in pending/processing if the PayMongo
 * webhook never lands — polls PayMongo directly and applies the same sync
 * the webhook would have.
 */
export const reconcileRefundStatus = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const payment = await reconcileRefund(
            req.params.paymentId
        );

        return successResponse(
            res,
            "Refund status reconciled with PayMongo.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * Admin releases a held refund (over the auto-approve threshold, or an
 * earlier automatic attempt failed) by sending it through PayMongo.
 */
export const sendRefund = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const payment = await sendHeldRefund(
            req.params.paymentId,
            req.user._id
        );

        return successResponse(
            res,
            payment.refund?.status === "succeeded"
                ? "Refund sent and confirmed by PayMongo."
                : "Refund submitted to PayMongo. It will show as completed once PayMongo confirms it.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * Admin closes out a refund that needed manual action (no PayMongo charge
 * to refund automatically, or a failed automatic attempt) after settling it
 * outside the app.
 */
export const completeRefund = async (
    req,
    res
) => {
    try {
        if (
            handleValidationErrors(
                req,
                res
            )
        ) {
            return;
        }

        const {
            succeeded,
            notes,
        } = req.body;

        const payment =
            await completeManualRefund(
                req.params.paymentId,
                {
                    succeeded: succeeded !== false,
                    notes: notes || "",
                },
                req.user._id
            );

        return successResponse(
            res,
            "Refund marked as completed.",
            payment
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};