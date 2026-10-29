import {
    DEFAULT_ROUTE,
    distanceMeters,
    bearingDegrees,
    interpolate,
} from "./route.js";

const BASE_SPEED_KMH = 30;
const SPEED_JITTER_KMH = 6;
const MIN_SPEED_KMH = 5;

/*
 * Walks a closed loop of route points, interpolating position between the
 * current leg's endpoints instead of teleporting. Speed/heading are derived
 * from the leg actually being traversed.
 */
export const createRouteWalker = (route = DEFAULT_ROUTE) => {
    if (!Array.isArray(route) || route.length < 2) {
        throw new Error("Route must contain at least two points.");
    }

    let legIndex = 0;
    let legProgressMeters = 0;

    const currentLeg = () => {
        const from = route[legIndex];
        const to = route[(legIndex + 1) % route.length];
        return { from, to, legLengthMeters: distanceMeters(from, to) };
    };

    const advance = (intervalMs) => {
        const speedKmh = Math.max(
            MIN_SPEED_KMH,
            BASE_SPEED_KMH + (Math.random() * 2 - 1) * SPEED_JITTER_KMH
        );
        const stepMeters = speedKmh * (intervalMs / 3_600_000) * 1000;

        let { from, to, legLengthMeters } = currentLeg();
        legProgressMeters += stepMeters;

        while (legLengthMeters > 0 && legProgressMeters >= legLengthMeters) {
            legProgressMeters -= legLengthMeters;
            legIndex = (legIndex + 1) % route.length;
            ({ from, to, legLengthMeters } = currentLeg());
        }

        const fraction =
            legLengthMeters === 0 ? 0 : legProgressMeters / legLengthMeters;
        const position = interpolate(from, to, fraction);
        const heading = Math.round(bearingDegrees(from, to));

        return {
            latitude: position.latitude,
            longitude: position.longitude,
            heading,
            speedKmh: Math.round(speedKmh * 10) / 10,
        };
    };

    const currentPosition = () => {
        const { from, to, legLengthMeters } = currentLeg();
        const fraction =
            legLengthMeters === 0 ? 0 : legProgressMeters / legLengthMeters;

        return interpolate(from, to, fraction);
    };

    return { advance, currentPosition };
};
