import { createRouteWalker } from "./movement.js";
import { createBatteryModel } from "./battery.js";

export const SCENARIOS = {
    MOVING: "moving",
    PARKED: "parked",
    OFFLINE: "offline",
    GPS_LOST: "gps-lost",
};

export const SCENARIO_VALUES = Object.values(SCENARIOS);

/*
 * Produces one telemetry reading per tick for the given scenario. PARKED
 * and GPS_LOST freeze position at the last known-good fix rather than
 * inventing new coordinates - only MOVING advances the route walker.
 * OFFLINE never reaches here (the caller skips sending entirely).
 */
export const createScenarioEngine = (scenario, route) => {
    const walker = createRouteWalker(route);
    const getBatteryLevel = createBatteryModel();

    let lastGoodPosition = walker.currentPosition();
    let lastHeading = null;

    const nextReading = (intervalMs) => {
        const batteryLevel = getBatteryLevel();
        const recordedAt = new Date().toISOString();

        if (scenario === SCENARIOS.PARKED) {
            return {
                latitude: lastGoodPosition.latitude,
                longitude: lastGoodPosition.longitude,
                speed: 0,
                heading: lastHeading,
                ignition: false,
                batteryLevel,
                gpsFix: true,
                recordedAt,
            };
        }

        if (scenario === SCENARIOS.GPS_LOST) {
            return {
                latitude: lastGoodPosition.latitude,
                longitude: lastGoodPosition.longitude,
                speed: null,
                heading: null,
                ignition: true,
                batteryLevel,
                gpsFix: false,
                recordedAt,
            };
        }

        const step = walker.advance(intervalMs);
        lastGoodPosition = {
            latitude: step.latitude,
            longitude: step.longitude,
        };
        lastHeading = step.heading;

        return {
            latitude: step.latitude,
            longitude: step.longitude,
            speed: step.speedKmh,
            heading: step.heading,
            ignition: true,
            batteryLevel,
            gpsFix: true,
            recordedAt,
        };
    };

    return { nextReading };
};
