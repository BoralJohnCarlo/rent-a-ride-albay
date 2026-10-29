/*
 * Mock GPS Tracker Simulator (development only).
 *
 * Behaves like an external physical tracker: it only ever talks to the real
 * POST /api/telemetry/ingest endpoint over HTTP, using the same
 * x-tracker-imei / x-tracker-key headers a real device would use. It never
 * imports server models/services/controllers directly and is not mounted
 * into server.js or routes/index.js - it is not part of the production app.
 *
 * Usage:
 *   npm run tracker:simulate
 *   npm run tracker:simulate -- --scenario=parked
 *   npm run tracker:simulate -- --scenario=gps-lost --interval=3
 *
 * Configuration comes from simulators/.env.simulator (copy from
 * .env.simulator.example) and/or CLI flags (--imei=, --key=, --vehicle=,
 * --api=, --interval=, --scenario=, --label=), which take precedence.
 *
 * Two additional optional flags exist purely for deterministic alert testing
 * (Milestone 11) - they override the scenario engine's own ignition/battery
 * for every tick, leaving position/speed/gpsFix untouched:
 *   --ignition=true|false
 *   --battery=<0-100>
 */

import { buildConfig } from "./config.js";
import { DEFAULT_ROUTE } from "./route.js";
import { SCENARIOS, createScenarioEngine } from "./scenarios.js";
import { sendTelemetry, TelemetryRequestError } from "./telemetryClient.js";
import {
    printBanner,
    printSent,
    printOffline,
    printError,
} from "./logger.js";

/*
 * Runs one simulated tracker/vehicle end to end. Deliberately a pure
 * function of `config` (no module-level state), so simulating several
 * vehicles at once later is just calling this once per config rather than a
 * structural change.
 */
export const runSimulator = (config, route = DEFAULT_ROUTE) => {
    printBanner(config);

    const engine = createScenarioEngine(config.scenario, route);
    let stopped = false;

    const tick = async () => {
        if (stopped) {
            return;
        }

        if (config.scenario === SCENARIOS.OFFLINE) {
            printOffline(config);
            return;
        }

        const reading = engine.nextReading(config.updateIntervalMs);

        if (config.ignitionOverride !== undefined) {
            reading.ignition = config.ignitionOverride;
        }

        if (config.batteryOverride !== undefined) {
            reading.batteryLevel = config.batteryOverride;
        }

        try {
            await sendTelemetry(config, reading);
            printSent(config, reading);
        } catch (error) {
            if (error instanceof TelemetryRequestError) {
                printError(config, error);
            } else {
                printError(config, {
                    kind: "unexpected",
                    message: error.message,
                });
            }
        }
    };

    const timer = setInterval(tick, config.updateIntervalMs);
    tick();

    return () => {
        stopped = true;
        clearInterval(timer);
    };
};

let config;

try {
    config = buildConfig();
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const stopSimulator = runSimulator(config);

const shutdown = () => {
    stopSimulator();
    console.log("\nMock GPS Simulator stopped.");
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
