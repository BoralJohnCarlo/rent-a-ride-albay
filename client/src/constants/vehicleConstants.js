export const VEHICLE_STATUS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    PICKUP_IN_PROGRESS: "PickupInProgress",
    RENTED: "Rented",
    MAINTENANCE: "Maintenance",
    EXPIRED_REGISTRATION: "RegistrationExpired",
    ARCHIVED: "Archived",
};

/*
 * Whether a vehicle can take bookings at all. Reserved or out on a rental
 * still counts: other times stay bookable, and the server decides from the
 * actual booked times (plus the turnaround buffer). Under maintenance it
 * stays listed too — only its maintenance window is unbookable (see
 * getVehicleMaintenanceWindow). Mirrors BOOKABLE_VEHICLE_STATUSES in the
 * server's bookingService.
 */
const BOOKABLE_VEHICLE_STATUSES = [
    VEHICLE_STATUS.AVAILABLE,
    VEHICLE_STATUS.RESERVED,
    VEHICLE_STATUS.PICKUP_IN_PROGRESS,
    VEHICLE_STATUS.RENTED,
    VEHICLE_STATUS.MAINTENANCE,
];

/* The `status` filter public listings send to GET /vehicles. */
export const BOOKABLE_VEHICLE_STATUS_FILTER =
    BOOKABLE_VEHICLE_STATUSES.join(",");

export const isVehicleBookable = (vehicle) =>
    BOOKABLE_VEHICLE_STATUSES.includes(vehicle?.status) &&
    vehicle?.availability?.bookingEnabled !== false;

/*
 * How long a vehicle under maintenance is out of service. Mirrors the
 * server's VEHICLE_MAINTENANCE_MODE.
 */
export const VEHICLE_MAINTENANCE_MODE = {
    TURNAROUND: "Turnaround",
    EXTENDED: "Extended",
    OFF_ROAD: "OffRoad",
};

export const MAX_VEHICLE_MAINTENANCE_DAYS = 60;

/*
 * The vehicle's current maintenance window — { mode, start, end (ms,
 * Infinity when off road), until (Date | null) } — or null. Same rules as
 * the server's utils/vehicleMaintenance.js: a window that has ended counts
 * as none, and Maintenance status without a mode is off road.
 */
export const getVehicleMaintenanceWindow = (vehicle, now = Date.now()) => {
    if (!vehicle) {
        return null;
    }

    const maintenance = vehicle.maintenance || {};

    if (maintenance.mode) {
        const end =
            maintenance.mode === VEHICLE_MAINTENANCE_MODE.OFF_ROAD ||
            !maintenance.until
                ? Infinity
                : new Date(maintenance.until).getTime();

        if (end <= now) {
            return null;
        }

        return {
            mode: maintenance.mode,
            start: maintenance.startedAt
                ? new Date(maintenance.startedAt).getTime()
                : 0,
            end,
            until: Number.isFinite(end) ? new Date(end) : null,
        };
    }

    if (vehicle.status === VEHICLE_STATUS.MAINTENANCE) {
        return {
            mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
            start: 0,
            end: Infinity,
            until: null,
        };
    }

    return null;
};

export const overlapsVehicleMaintenance = (vehicle, start, end) => {
    const window = getVehicleMaintenanceWindow(vehicle);

    return Boolean(
        window &&
            new Date(start).getTime() < window.end &&
            new Date(end).getTime() > window.start
    );
};

const formatMaintenanceEnd = (until) =>
    new Date(until).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/*
 * Short customer-facing label, e.g. "Under maintenance until Oct 5, 2:00 PM".
 * With the off-road notice turned off (Settings → Bookings → Off-Road
 * Vehicles) an off-road vehicle only says its dates are blocked.
 */
export const describeVehicleMaintenance = (
    vehicle,
    { showOffRoadNotice = true } = {}
) => {
    const window = getVehicleMaintenanceWindow(vehicle);

    if (!window) {
        return null;
    }

    if (window.until) {
        return `Under maintenance until ${formatMaintenanceEnd(window.until)}`;
    }

    return showOffRoadNotice ? "Temporarily off the road" : "Dates blocked";
};

/* Off road: maintenance with no end date, so nothing can be booked. */
export const isVehicleOffRoad = (vehicle) =>
    getVehicleMaintenanceWindow(vehicle)?.end === Infinity;

/* Admin-facing description of a maintenance mode. */
export const describeMaintenanceMode = (mode, days = null) =>
    mode === VEHICLE_MAINTENANCE_MODE.TURNAROUND
        ? "Standard turnaround"
        : mode === VEHICLE_MAINTENANCE_MODE.EXTENDED
          ? `Extended maintenance${days ? ` (${days} day${days === 1 ? "" : "s"})` : ""}`
          : "Off road (no end date)";

export const VEHICLE_STATUS_VALUES = Object.values(
    VEHICLE_STATUS
);

export const VEHICLE_TYPES = {
    CAR: "Car",
    MOTORCYCLE: "Motorcycle",
};

export const VEHICLE_TYPE_VALUES = Object.values(
    VEHICLE_TYPES
);

export const VEHICLE_CONDITIONS = {
    EXCELLENT: "Excellent",
    GOOD: "Good",
    FAIR: "Fair",
    POOR: "Poor",
};

export const VEHICLE_CONDITION_VALUES = Object.values(
    VEHICLE_CONDITIONS
);

export const TRANSMISSION_TYPES = {
    AUTOMATIC: "Automatic",
    MANUAL: "Manual",
};

export const TRANSMISSION_TYPE_VALUES = Object.values(
    TRANSMISSION_TYPES
);

export const FUEL_TYPES = {
    GASOLINE: "Gasoline",
    DIESEL: "Diesel",
    HYBRID: "Hybrid",
    ELECTRIC: "Electric",
};

export const FUEL_TYPE_VALUES = Object.values(
    FUEL_TYPES
);

// Must match server's OWNERSHIP_TYPE (consignmentConstants.js) — this is
// validated against that enum when a consignment application is submitted.
export const VEHICLE_OWNERSHIP = {
    COMPANY: "Company-Owned",
    CONSIGNMENT: "Consigned",
};

export const VEHICLE_OWNERSHIP_VALUES = Object.values(
    VEHICLE_OWNERSHIP
);

export const VEHICLE_TYPE_OPTIONS = [
    {
        label: "Select Vehicle Type",
        value: "",
    },
    ...VEHICLE_TYPE_VALUES.map((value) => ({
        label: value,
        value,
    })),
];

export const TRANSMISSION_OPTIONS = [
    {
        label: "Select Transmission",
        value: "",
    },
    ...TRANSMISSION_TYPE_VALUES.map((value) => ({
        label: value,
        value,
    })),
];

export const FUEL_TYPE_OPTIONS = [
    {
        label: "Select Fuel Type",
        value: "",
    },
    ...FUEL_TYPE_VALUES.map((value) => ({
        label: value,
        value,
    })),
];