const XENDIT_API_URL = "https://api.xendit.co";

const getAuthorizationHeader = () => {
    const secretKey = process.env.XENDIT_SECRET_KEY;

    if (!secretKey) {
        throw new Error(
            "XENDIT_SECRET_KEY is not configured."
        );
    }

    return `Basic ${Buffer.from(
        `${secretKey}:`
    ).toString("base64")}`;
};

const xenditRequest = async (
    endpoint,
    options = {}
) => {
    let response;

    try {
        response = await fetch(
            `${XENDIT_API_URL}${endpoint}`,
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
            `Xendit network error: ${networkError.message}`
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
            "Xendit returned an invalid response."
        );

        error.statusCode = 502;
        error.isInvalidResponse = true;

        throw error;
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error_code ||
            "Xendit request failed.";

        const error = new Error(message);

        error.statusCode = response.status;
        error.xenditErrors = data;

        throw error;
    }

    return data;
};

/*
 * Creates a Xendit Payout (v2) to a Philippines GCash account.
 * `referenceId` doubles as the Idempotency-key so retrying the same
 * withdrawal (e.g. after a network blip) never creates a duplicate payout.
 */
export const createGCashPayout = async ({
    referenceId,
    amount,
    accountHolderName,
    gcashNumber,
    description,
}) => {
    return await xenditRequest("/v2/payouts", {
        method: "POST",

        headers: {
            "Idempotency-key": referenceId,
        },

        body: JSON.stringify({
            reference_id: referenceId,
            channel_code: "PH_GCASH",
            channel_properties: {
                account_holder_name:
                    accountHolderName,
                account_number: gcashNumber,
            },
            amount,
            currency: "PHP",
            description,
            type: "DIRECT_DISBURSEMENT",
        }),
    });
};

export const verifyPayoutWebhookToken = (
    headerToken
) => {
    const expected =
        process.env.XENDIT_WEBHOOK_TOKEN;

    if (!expected || !headerToken) {
        return false;
    }

    return headerToken === expected;
};
