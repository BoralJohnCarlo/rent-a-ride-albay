/*
 * Small illustrative development route around Legazpi City, Albay - the
 * app's home service area (matches LocationPicker.jsx's default map
 * center). Coordinates are approximate, not exact landmark pins. Edit
 * freely - the simulator loops back to the first point after the last one.
 */
export const DEFAULT_ROUTE = [
    { label: "Rent-A-Ride Albay Hub", latitude: 13.1391, longitude: 123.7438 },
    { label: "Legazpi City Hall", latitude: 13.1428, longitude: 123.7369 },
    { label: "Albay Astrodome", latitude: 13.1517, longitude: 123.7273 },
    { label: "LCC Mall Legazpi", latitude: 13.1462, longitude: 123.7355 },
    { label: "Ayala Malls Legazpi", latitude: 13.1408, longitude: 123.742 },
];

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

export const distanceMeters = (a, b) => {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
};

export const bearingDegrees = (a, b) => {
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);
    const dLng = toRadians(b.longitude - a.longitude);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

export const interpolate = (a, b, fraction) => ({
    latitude: a.latitude + (b.latitude - a.latitude) * fraction,
    longitude: a.longitude + (b.longitude - a.longitude) * fraction,
});
