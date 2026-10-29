import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SCENARIO_VALUES } from "./scenarios.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scoped to this folder only - does not touch/override server/.env.
// quiet: true suppresses dotenv's own console "tip" output so simulator
// logs stay clean.
dotenv.config({
    path: path.join(__dirname, ".env.simulator"),
    quiet: true,
});

const parseArgs = (argv) => {
    const args = {};

    for (const raw of argv) {
        const match = raw.match(/^--([^=]+)=(.*)$/);

        if (match) {
            args[match[1]] = match[2];
        }
    }

    return args;
};

export const buildConfig = (
    argv = process.argv.slice(2),
    env = process.env
) => {
    const args = parseArgs(argv);

    const imei = args.imei || env.MOCK_TRACKER_IMEI;
    const deviceKey = args.key || env.MOCK_TRACKER_KEY;
    const vehicleId = args.vehicle || env.MOCK_VEHICLE_ID;
    const apiBaseUrl = (
        args.api ||
        env.MOCK_API_BASE_URL ||
        "http://localhost:5000/api"
    ).replace(/\/$/, "");
    const updateIntervalSeconds = Number(
        args.interval || env.MOCK_UPDATE_INTERVAL || 5
    );
    const scenario = (
        args.scenario ||
        env.MOCK_SCENARIO ||
        "moving"
    ).toLowerCase();
    const label = args.label || env.MOCK_VEHICLE_LABEL || "Mock Vehicle";

    // Optional, fixed-value overrides used only for deterministic alert
    // testing (Milestone 11) - when set, they replace the scenario engine's
    // own computed ignition/battery for every tick instead of it. Undefined
    // when not provided, so normal scenario behavior is unaffected.
    const ignitionOverrideRaw = args.ignition ?? env.MOCK_IGNITION_OVERRIDE;
    const ignitionOverride =
        ignitionOverrideRaw === undefined
            ? undefined
            : String(ignitionOverrideRaw).toLowerCase() === "true";

    const batteryOverrideRaw = args.battery ?? env.MOCK_BATTERY_OVERRIDE;
    const batteryOverride =
        batteryOverrideRaw === undefined
            ? undefined
            : Number(batteryOverrideRaw);

    const missing = [];

    if (!imei) {
        missing.push("MOCK_TRACKER_IMEI (or --imei=...)");
    }

    if (!deviceKey) {
        missing.push("MOCK_TRACKER_KEY (or --key=...)");
    }

    if (!vehicleId) {
        missing.push("MOCK_VEHICLE_ID (or --vehicle=...)");
    }

    if (missing.length) {
        throw new Error(
            "Mock GPS Simulator is missing required configuration:\n" +
                missing.map((m) => `  - ${m}`).join("\n") +
                "\n\nRegister a tracker via POST /api/trackers (admin), " +
                "assign it to a vehicle via PATCH /api/trackers/:id/assign, " +
                "then copy simulators/.env.simulator.example to " +
                "simulators/.env.simulator and fill in the values."
        );
    }

    if (!SCENARIO_VALUES.includes(scenario)) {
        throw new Error(
            `Unknown scenario "${scenario}". Supported: ${SCENARIO_VALUES.join(", ")}`
        );
    }

    if (
        !Number.isFinite(updateIntervalSeconds) ||
        updateIntervalSeconds <= 0
    ) {
        throw new Error(
            "MOCK_UPDATE_INTERVAL must be a positive number of seconds."
        );
    }

    if (
        batteryOverride !== undefined &&
        (!Number.isFinite(batteryOverride) ||
            batteryOverride < 0 ||
            batteryOverride > 100)
    ) {
        throw new Error(
            "--battery= must be a number between 0 and 100."
        );
    }

    return {
        imei,
        deviceKey,
        vehicleId,
        apiBaseUrl,
        updateIntervalMs: updateIntervalSeconds * 1000,
        scenario,
        label,
        ignitionOverride,
        batteryOverride,
    };
};
