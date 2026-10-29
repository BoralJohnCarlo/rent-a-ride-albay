import { refundCentavos } from "../utils/refundAmount.js";

// Every PayMongo resource used here (Checkout Sessions, Refunds) lives
// under the v1 API - there is no v2. A prior version of this file pointed
// Checkout Sessions at a nonexistent /v2 base, which 404'd on every GET
// (retrieval/reconciliation) even though POST-to-create happened to still
// go through, silently breaking payment confirmation.
const PAYMONGO_API_URL =
    "https://api.paymongo.com/v1";

const getAuthorizationHeader = () => {
    const secretKey =
        process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
        throw new Error(
            "PAYMONGO_SECRET_KEY is not configured."
        );
    }

    return `Basic ${Buffer.from(
        `${secretKey}:`
    ).toString("base64")}`;
};

const paymongoRequest = async (
    endpoint,
    options = {},
    baseUrl = PAYMONGO_API_URL
) => {
    let response;

    try {
        response = await fetch(
            `${baseUrl}${endpoint}`,
            {
                ...options,

                headers: {
                    Authorization:
                        getAuthorizationHeader(),

                    "Content-Type":
                        "application/json",

                    ...options.headers,
                },
            }
        );
    } catch (networkError) {
        const error = new Error(
            `PayMongo network error: ${networkError.message}`
        );

        error.statusCode = 503;
        error.isNetworkError = true;

        throw error;
    }

    let data;

    try {
        data = await response.json();
    } catch {
        const error = new Error(
            "PayMongo returned an invalid response."
        );

        error.statusCode = 502;

        error.isInvalidResponse = true;

        throw error;
    }

    if (!response.ok) {
        const message =
            data?.errors?.[0]?.detail ||
            data?.errors?.[0]?.code ||
            "PayMongo request failed.";

        const error = new Error(message);

        error.statusCode =
            response.status;

        error.paymongoErrors =
            data?.errors || [];

        throw error;
    }

    return data;
};

const createCheckoutSession = async ({
    amount,
    description,
    referenceNumber,
    successUrl,
    cancelUrl,
    paymentMethodTypes = ["gcash", "qrph"],
    metadata = {},
}) => {
    const normalizedAmount = Number(amount);

    if (
        !Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0
    ) {
        throw new Error(
            "Checkout amount must be greater than zero."
        );
    }

    if (!successUrl) {
        throw new Error(
            "PayMongo success URL is required."
        );
    }

    if (!cancelUrl) {
        throw new Error(
            "PayMongo cancel URL is required."
        );
    }

    const amountInCentavos =
        Math.round(normalizedAmount * 100);

    const response = await paymongoRequest(
        "/checkout_sessions",
        {
            method: "POST",

            body: JSON.stringify({
                data: {
                    attributes: {
                        line_items: [
                            {
                                name:
                                    description ||
                                    "Rent-A-Ride Albay Reservation Fee",

                                amount:
                                    amountInCentavos,

                                currency: "PHP",

                                quantity: 1,
                            },
                        ],

                        payment_method_types:
                            paymentMethodTypes,

                        success_url:
                            successUrl,

                        cancel_url:
                            cancelUrl,

                        reference_number:
                            referenceNumber,

                        metadata,
                    },
                },
            }),
        }
    );

    const checkoutSession =
        response?.data;

    if (!checkoutSession?.id) {
        throw new Error(
            "PayMongo did not return a Checkout Session ID."
        );
    }

    const checkoutUrl =
        checkoutSession?.attributes
            ?.checkout_url;

    if (!checkoutUrl) {
        throw new Error(
            "PayMongo did not return a Checkout URL."
        );
    }

    return {
        id: checkoutSession.id,

        checkoutUrl,

        livemode:
            checkoutSession.attributes
                ?.livemode ?? false,
    };
};

/*
 * Fetches the current state of a PayMongo Checkout Session so the backend can
 * confirm a payment without waiting for the webhook (used by the customer's
 * post-checkout polling and by admin reconciliation).
 */
const retrieveCheckoutSession = async (
    checkoutSessionId
) => {
    if (!checkoutSessionId) {
        throw new Error(
            "A PayMongo Checkout Session ID is required."
        );
    }

    const response = await paymongoRequest(
        `/checkout_sessions/${encodeURIComponent(
            checkoutSessionId
        )}`,
        {
            method: "GET",
        }
    );

    const attributes =
        response?.data?.attributes ?? {};

    const paymentIntent =
        attributes.payment_intent;

    const paymentIntentId =
        typeof paymentIntent === "string"
            ? paymentIntent
            : paymentIntent?.id || "";

    const paymentIntentStatus =
        typeof paymentIntent === "object"
            ? paymentIntent?.attributes?.status ||
              ""
            : "";

    const payments = Array.isArray(
        attributes.payments
    )
        ? attributes.payments
        : [];

    const hasPaidPayment = payments.some(
        (payment) =>
            payment?.attributes?.status ===
            "paid"
    );

    const paid =
        hasPaidPayment ||
        paymentIntentStatus === "succeeded";

    return {
        id:
            response?.data?.id ||
            checkoutSessionId,
        paid,
        status: attributes.status || "",
        paymentIntentId,
        payments,
    };
};

/*
 * Closes a Checkout Session so it can no longer be paid. PayMongo answers 400
 * when the session is already expired, already paid, or has a payment in
 * progress — callers treat any failure here as "couldn't close it" and check
 * whether it was actually paid (see closeCheckoutSession in paymentService).
 */
const expireCheckoutSession = async (
    checkoutSessionId
) => {
    if (!checkoutSessionId) {
        throw new Error(
            "A PayMongo Checkout Session ID is required."
        );
    }

    const response = await paymongoRequest(
        `/checkout_sessions/${encodeURIComponent(
            checkoutSessionId
        )}/expire`,
        {
            method: "POST",
        }
    );

    return {
        id:
            response?.data?.id ||
            checkoutSessionId,
        status:
            response?.data?.attributes?.status ||
            "",
    };
};

/*
 * Creates a PayMongo Refund against a Payment resource (NOT a Payment
 * Intent, NOT a Checkout Session — a different, "pay_..." prefixed ID). A
 * refund is not necessarily instant: PayMongo returns pending/processing/
 * succeeded/failed, and a webhook (or a later `retrieveRefund` poll) is
 * needed to learn the final outcome for anything other than `succeeded`.
 */
const createRefund = async ({
    paymentId,
    amount,
    reason,
    notes = "",
    metadata = {},
}) => {
    const amountInCentavos = refundCentavos(amount);
    const normalizedAmount = amountInCentavos / 100;

    if (!paymentId) {
        throw new Error(
            "A PayMongo Payment ID is required to create a refund."
        );
    }

    if (
        !Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0
    ) {
        throw new Error(
            "Refund amount must be greater than zero."
        );
    }

    const response = await paymongoRequest(
        "/refunds",
        {
            method: "POST",

            body: JSON.stringify({
                data: {
                    attributes: {
                        amount: amountInCentavos,
                        payment_id: paymentId,
                        reason,
                        notes: notes.slice(0, 255),
                        metadata,
                    },
                },
            }),
        }
    );

    const refund = response?.data;

    if (!refund?.id) {
        throw new Error(
            "PayMongo did not return a Refund ID."
        );
    }

    return {
        id: refund.id,
        status: refund.attributes?.status || "",
        amount: normalizedAmount,
    };
};

/*
 * Fetches the current state of a PayMongo Refund — used to reconcile a
 * pending/processing refund when the webhook doesn't land.
 */
const retrieveRefund = async (refundId) => {
    if (!refundId) {
        throw new Error(
            "A PayMongo Refund ID is required."
        );
    }

    const response = await paymongoRequest(
        `/refunds/${encodeURIComponent(refundId)}`,
        {
            method: "GET",
        }
    );

    return {
        id: response?.data?.id || refundId,
        status:
            response?.data?.attributes?.status || "",
    };
};

/*
 * What a PayMongo Payment resource (an entry of a checkout session's
 * `payments[]`) says about how it was paid: its source type ("gcash", ...)
 * and the provider's own reference, when PayMongo has one. Tolerates a
 * missing or partial resource.
 */
const describePaymongoPayment = (resource) => {
    const attributes = resource?.attributes || {};
    const source = attributes.source || {};

    const providerReference =
        attributes.external_reference_number ||
        source.provider_id ||
        source.provider?.id ||
        "";

    return {
        sourceType: String(source.type || "").trim(),
        providerReference: String(providerReference).trim(),
    };
};

export {
    describePaymongoPayment,
    paymongoRequest,
    createCheckoutSession,
    retrieveCheckoutSession,
    expireCheckoutSession,
    createRefund,
    retrieveRefund,
};
