/**
 * Calculates the straight-line geographic distance between two points
 * using the Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in decimal degrees
 * @param {number} lon1 - Longitude of point 1 in decimal degrees
 * @param {number} lat2 - Latitude of point 2 in decimal degrees
 * @param {number} lon2 - Longitude of point 2 in decimal degrees
 * @returns {number | null} Distance in kilometers, or null if inputs are invalid
 */
export const calculateDistanceKm = (
    lat1,
    lon1,
    lat2,
    lon2
) => {
    if (
        lat1 == null ||
        lon1 == null ||
        lat2 == null ||
        lon2 == null
    ) {
        return null;
    }

    const latitude1 = Number(lat1);
    const longitude1 = Number(lon1);
    const latitude2 = Number(lat2);
    const longitude2 = Number(lon2);

    if (
        !Number.isFinite(latitude1) ||
        !Number.isFinite(longitude1) ||
        !Number.isFinite(latitude2) ||
        !Number.isFinite(longitude2)
    ) {
        return null;
    }

    const toRadians = (degrees) =>
        (degrees * Math.PI) / 180;

    const earthRadiusKm = 6371;

    const deltaLat =
        toRadians(latitude2 - latitude1);
    const deltaLon =
        toRadians(longitude2 - longitude1);

    const sinDeltaLat = Math.sin(
        deltaLat / 2
    );
    const sinDeltaLon = Math.sin(
        deltaLon / 2
    );

    const a =
        sinDeltaLat * sinDeltaLat +
        Math.cos(toRadians(latitude1)) *
            Math.cos(toRadians(latitude2)) *
            sinDeltaLon *
            sinDeltaLon;

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    const distance =
        earthRadiusKm * c;

    return Math.round(distance * 10) / 10;
};
