export class TelemetryRequestError extends Error {
    constructor(kind, message, details = null) {
        super(message);
        this.name = "TelemetryRequestError";
        this.kind = kind; // network | auth | validation | tracker-state | not-found | server | malformed-response
        this.details = details;
    }
}

const buildHeaders = (config) => ({
    "Content-Type": "application/json",
    "x-tracker-imei": config.imei,
    "x-tracker-key": config.deviceKey,
});

const classifyStatus = (status) => {
    if (status === 401 || status === 403) {
        return "auth";
    }

    if (status === 400) {
        return "validation";
    }

    if (status === 409) {
        return "tracker-state";
    }

    if (status === 404) {
        return "not-found";
    }

    return "server";
};

/*
 * Sends one telemetry reading through the real, unmodified Milestone 1
 * ingestion endpoint - this file must never bypass /api/telemetry/ingest.
 */
export const sendTelemetry = async (config, reading) => {
    const url = `${config.apiBaseUrl}/telemetry/ingest`;

    let response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: buildHeaders(config),
            body: JSON.stringify(reading),
        });
    } catch (networkError) {
        throw new TelemetryRequestError(
            "network",
            `Could not reach the API at ${url}: ${networkError.message}`
        );
    }

    let body = null;
    try {
        body = await response.json();
    } catch (parseError) {
        throw new TelemetryRequestError(
            "malformed-response",
            `API returned a non-JSON response (status ${response.status}).`
        );
    }

    if (!response.ok) {
        throw new TelemetryRequestError(
            classifyStatus(response.status),
            body?.message ||
                `API request failed with status ${response.status}.`,
            body?.errors || null
        );
    }

    return body;
};
