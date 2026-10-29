/*
 * Client for AIKA's cloud app API (the API behind the AIKA mobile app).
 *
 * Verified against the live service on 2026-10-01 (see
 * scripts/aikaProbe.js): GET getapp.aspx returns the service address
 * (http://app.aika168.com:8088/openapiv3.asmx); operations are form POSTs to
 * `<address>/<Operation>`, and every reply is JSON inside an XML <string>
 * element. Login returns AIKA's internal numeric deviceID (NOT the label
 * 9176761220, which is `deviceInfo.sn`) plus a `key2018` session key that
 * every later call needs.
 *
 * This API is unofficial/undocumented and plain HTTP: the password and
 * session key cross the network unencrypted, so use a password unique to
 * the AIKA device. Nothing here ever logs, returns or throws a secret -
 * errors carry only the operation name, HTTP status or AIKA `state` code.
 *
 * Configuration (server/.env, never the frontend):
 *   AIKA_LOGIN_NAME     device ID used to log in on en.aika168.com
 *   AIKA_PASSWORD       that device's AIKA password
 *   AIKA_APP_KEY        app key the AIKA app sends with Login
 *   AIKA_LOGIN_TYPE     1 = device login (verified), default 1
 *   AIKA_DISCOVERY_URL  default http://www.aika168.com/getapp.aspx
 *   AIKA_API_URL        optional - skips discovery when set
 *   AIKA_REQUEST_TIMEOUT_MS  default 15000
 */

const DEFAULT_DISCOVERY_URL = "http://www.aika168.com/getapp.aspx";
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

// AIKA's own success code in every reply's `state` field.
const AIKA_STATE_OK = "0";

export const REQUIRED_AIKA_ENV = [
    "AIKA_LOGIN_NAME",
    "AIKA_PASSWORD",
    "AIKA_APP_KEY",
];

export class AikaApiError extends Error {
    constructor(message) {
        super(message);
        this.name = "AikaApiError";
    }
}

export const readAikaConfig = (env = process.env) => ({
    discoveryUrl: env.AIKA_DISCOVERY_URL || DEFAULT_DISCOVERY_URL,
    apiUrl: env.AIKA_API_URL || "",
    loginName: env.AIKA_LOGIN_NAME || "",
    password: env.AIKA_PASSWORD || "",
    appKey: env.AIKA_APP_KEY || "",
    loginType: env.AIKA_LOGIN_TYPE || "1",
    requestTimeoutMs:
        Number(env.AIKA_REQUEST_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS,
});

export const getMissingAikaEnv = (env = process.env) =>
    REQUIRED_AIKA_ENV.filter((name) => !env[name]);

const decodeXmlEntities = (text) =>
    text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, "&");

// ASMX replies are `<string xmlns="...">{json}</string>`. The body is never
// included in an error, since a reply can echo the session key.
export const parseAsmxJson = (xml, operation) => {
    const match = String(xml).match(/<string[^>]*>([\s\S]*)<\/string>/);

    if (!match) {
        throw new AikaApiError(`AIKA ${operation}: unexpected response shape.`);
    }

    const inner = decodeXmlEntities(match[1]).trim();

    if (!inner) {
        return {};
    }

    try {
        return JSON.parse(inner);
    } catch {
        throw new AikaApiError(`AIKA ${operation}: response is not JSON.`);
    }
};

// Network failures keep their low-level code (e.g. UND_ERR_CONNECT_TIMEOUT)
// - AIKA's port 8088 was observed to time out intermittently.
const describeNetworkError = (error) =>
    error.cause?.code || error.name || "network error";

export const createAikaClient = (
    config = readAikaConfig(),
    { fetchImpl = fetch } = {}
) => {
    let apiUrl = config.apiUrl ? config.apiUrl.replace(/\/+$/, "") : "";
    let session = null;

    const fetchText = async (url, options, label) => {
        let response;

        try {
            response = await fetchImpl(url, {
                ...options,
                signal: AbortSignal.timeout(config.requestTimeoutMs),
            });
        } catch (error) {
            throw new AikaApiError(
                `AIKA ${label}: request failed (${describeNetworkError(error)}).`
            );
        }

        if (!response.ok) {
            throw new AikaApiError(
                `AIKA ${label}: HTTP ${response.status}.`
            );
        }

        return response.text();
    };

    const discover = async () => {
        if (apiUrl) {
            return apiUrl;
        }

        const address = (
            await fetchText(config.discoveryUrl, {}, "discovery")
        ).trim();

        if (!/^https?:\/\/\S+$/.test(address)) {
            throw new AikaApiError(
                "AIKA discovery: returned an unexpected address."
            );
        }

        apiUrl = address.replace(/\/+$/, "");

        return apiUrl;
    };

    const callOperation = async (operation, params) => {
        const baseUrl = await discover();

        const xml = await fetchText(
            `${baseUrl}/${operation}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(
                    Object.entries(params).map(([k, v]) => [
                        k,
                        String(v ?? ""),
                    ])
                ).toString(),
            },
            operation
        );

        return parseAsmxJson(xml, operation);
    };

    /*
     * Returns the raw Login reply (so the probe can show it) and caches the
     * session: AIKA device ID, model, serial and session key. The session
     * key stays inside this closure.
     */
    const login = async () => {
        session = null;

        const reply = await callOperation("Login", {
            Name: config.loginName,
            Pass: config.password,
            LoginType: config.loginType,
            Key: config.appKey,
        });

        const deviceInfo = reply?.deviceInfo;

        if (reply?.state !== AIKA_STATE_OK || !deviceInfo?.key2018) {
            throw new AikaApiError(
                `AIKA Login: rejected (state ${reply?.state ?? "missing"}).`
            );
        }

        session = {
            deviceId: String(deviceInfo.deviceID),
            model: String(deviceInfo.model ?? "0"),
            serial: String(deviceInfo.sn || config.loginName),
            deviceName: deviceInfo.deviceName || "",
            key: deviceInfo.key2018,
        };

        return reply;
    };

    const ensureSession = async () => {
        if (!session) {
            await login();
        }

        return session;
    };

    /*
     * Calls a session-scoped operation. A non-OK `state` most likely means
     * the session key expired (AIKA doesn't document it), so it logs in
     * again once and retries before giving up.
     */
    const callWithSession = async (operation, buildParams) => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const current = await ensureSession();
            const reply = await callOperation(
                operation,
                buildParams(current)
            );

            if (reply?.state === AIKA_STATE_OK) {
                return reply;
            }

            session = null;

            if (attempt === 1) {
                throw new AikaApiError(
                    `AIKA ${operation}: rejected (state ${reply?.state ?? "missing"}).`
                );
            }
        }

        return null; // unreachable
    };

    const getTracking = () =>
        callWithSession("GetTracking", (current) => ({
            DeviceID: current.deviceId,
            Model: current.model,
            // Verified to have no effect - positionTime is always UTC.
            TimeZones: "0:00",
            MapType: "Google",
            Language: "en",
            Key: current.key,
        }));

    const getDeviceStatus = () =>
        callWithSession("GetDeviceStatus", (current) => ({
            DeviceID: current.deviceId,
            TimeZones: "0:00",
            Language: "en",
            FilterWarn: "",
            Key: current.key,
        }));

    // Public session info only - never the key.
    const getSessionInfo = () =>
        session
            ? {
                  deviceId: session.deviceId,
                  model: session.model,
                  serial: session.serial,
                  deviceName: session.deviceName,
              }
            : null;

    return {
        discover,
        login,
        ensureSession: async () => {
            await ensureSession();
            return getSessionInfo();
        },
        getTracking,
        getDeviceStatus,
        getSessionInfo,
    };
};
