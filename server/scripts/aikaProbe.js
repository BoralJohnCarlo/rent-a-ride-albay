/*
 * Read-only AIKA cloud API probe - development diagnostic only.
 *
 * Logs in to AIKA's app API as the tracker account in server/.env (via the
 * same aikaClient the poller uses) and prints the raw GetTracking /
 * GetDeviceStatus replies field by field with JS types, so the AIKA ->
 * telemetry mapping can be checked against real data.
 *
 * It calls only Login, GetTracking and GetDeviceStatus. It never connects
 * to MongoDB, never sends device commands and never changes AIKA settings.
 * The password, app key and session key are redacted from all output.
 *
 * Usage (from server/):  node scripts/aikaProbe.js
 * Configuration: see services/aika/aikaClient.js.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import {
    createAikaClient,
    getMissingAikaEnv,
    readAikaConfig,
} from "../services/aika/aikaClient.js";
import { mapAikaTracking, resolveAikaLastContact } from "../services/aika/aikaPoller.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const REDACTED = "<redacted>";
const SENSITIVE_KEYS = /^(key|key2018|pass|password|token)$/i;

const redactObject = (value) => {
    if (Array.isArray(value)) {
        return value.map(redactObject);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, inner]) => [
                key,
                SENSITIVE_KEYS.test(key) ? REDACTED : redactObject(inner),
            ])
        );
    }

    return value;
};

const describeType = (value) => {
    if (value === null) return "null";
    if (Array.isArray(value)) return `array(${value.length})`;
    return typeof value;
};

// Flags values that look like timestamps so their format can be checked.
const DATE_LIKE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}[ T]\d{1,2}:\d{2}(:\d{2})?/;

const printFields = (title, data) => {
    const safe = redactObject(data);

    console.log(`\n=== ${title}: fields ===`);
    console.table(
        Object.entries(safe).map(([key, value]) => ({
            field: key,
            type: describeType(value),
            value:
                value && typeof value === "object"
                    ? JSON.stringify(value).slice(0, 80)
                    : value,
            timestamp:
                typeof value === "string" && DATE_LIKE.test(value) ? "yes" : "",
        }))
    );

    console.log(`\n=== ${title}: raw (redacted) ===`);
    console.log(JSON.stringify(safe, null, 2));
};

const main = async () => {
    const missing = getMissingAikaEnv();

    if (missing.length > 0) {
        console.error(`Missing required env in server/.env: ${missing.join(", ")}`);
        process.exitCode = 1;
        return;
    }

    const client = createAikaClient(readAikaConfig());

    console.log(`Server time (UTC):   ${new Date().toISOString()}`);
    console.log(`AIKA API:            ${await client.discover()}`);

    printFields("Login", await client.login());

    const tracking = await client.getTracking();
    printFields("GetTracking", tracking);
    printFields("GetDeviceStatus", await client.getDeviceStatus());

    // What the poller would hand to trackingService for this reply.
    console.log("\n=== Poller mapping (not written anywhere) ===");
    console.log({
        reading: mapAikaTracking(tracking),
        lastContact: resolveAikaLastContact(tracking),
    });
};

main().catch((error) => {
    // aikaClient errors never contain secrets.
    console.error(`\nProbe failed: ${error.message}`);
    process.exitCode = 1;
});
