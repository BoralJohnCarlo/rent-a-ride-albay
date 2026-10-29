/*
 * Explore Albay destinations are admin-managed (Settings → Destinations,
 * served by /api/destinations). Only the fixed lists the UI needs live here;
 * keep the keys in sync with server/constants/destinationConstants.js.
 */

export const DESTINATION_CATEGORIES = [
    { key: "nature", label: "Nature" },
    { key: "heritage", label: "Heritage" },
    { key: "viewpoints", label: "Viewpoints" },
    { key: "beaches", label: "Beaches" },
];

/* Vehicle.vehicleType values — the "Find a ride" filter on /available. */
export const RIDE_TYPES = [
    { value: "Car", label: "Car" },
    { value: "Motorcycle", label: "Motorcycle" },
];

export const HERO_WIDGET_LIMIT = 3;
