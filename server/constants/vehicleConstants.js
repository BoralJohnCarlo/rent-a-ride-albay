export const VEHICLE_STATUS = {
    AVAILABLE: "Available",
    RESERVED: "Reserved",
    PICKUP_IN_PROGRESS: "PickupInProgress",
    RENTED: "Rented",
    MAINTENANCE: "Maintenance",
    EXPIRED_REGISTRATION: "RegistrationExpired",
    ARCHIVED: "Archived",
};

export const VEHICLE_STATUS_VALUES = Object.values(VEHICLE_STATUS);

/*
 * How long a vehicle under maintenance is out of service (Vehicle.maintenance).
 * It stays listed throughout; only the dates inside the maintenance window
 * can't be booked:
 * - Turnaround: just the standard turnaround buffer after the return.
 * - Extended: a set number of days from the return.
 * - OffRoad: no end date, until an admin puts it back in service.
 * A vehicle in Maintenance status with no recorded mode (set before modes
 * existed) is read as OffRoad.
 */
export const VEHICLE_MAINTENANCE_MODE = {
    TURNAROUND: "Turnaround",
    EXTENDED: "Extended",
    OFF_ROAD: "OffRoad",
};

export const VEHICLE_MAINTENANCE_MODE_VALUES = Object.values(
    VEHICLE_MAINTENANCE_MODE
);

export const MAX_VEHICLE_MAINTENANCE_DAYS = 60;

export const VEHICLE_TYPES = {
    CAR: "Car",
    MOTORCYCLE: "Motorcycle",
};

export const VEHICLE_TYPE_VALUES = Object.values(VEHICLE_TYPES);

export const VEHICLE_CONDITIONS = {
    EXCELLENT: "Excellent",
    GOOD: "Good",
    FAIR: "Fair",
    NEEDS_MAINTENANCE: "Needs Maintenance",
};

export const VEHICLE_OWNERSHIP = {
    COMPANY: "Company",
    CONSIGNED: "Consigned",
};

export const VEHICLE_OWNERSHIP_VALUES = Object.values(
    VEHICLE_OWNERSHIP
);

export const VEHICLE_CONDITION_VALUES = Object.values(VEHICLE_CONDITIONS);

export const TRANSMISSION_TYPES = {
    AUTOMATIC: "Automatic",
    MANUAL: "Manual",
    CVT: "CVT",
};

export const TRANSMISSION_TYPE_VALUES = Object.values(TRANSMISSION_TYPES);

export const FUEL_TYPES = {
    GASOLINE: "Gasoline",
    DIESEL: "Diesel",
    HYBRID: "Hybrid",
    ELECTRIC: "Electric",
};

export const FUEL_TYPE_VALUES = Object.values(FUEL_TYPES);

export const MAX_VEHICLE_IMAGES = 10;
export const MIN_VEHICLE_IMAGES = 1;

export const VEHICLE_CODE_PREFIX = "VH-";

export const SECURITY_DEPOSIT_DEFAULT_ENABLED = false;

export const SECURITY_DEPOSIT_MIN_AMOUNT = 0;