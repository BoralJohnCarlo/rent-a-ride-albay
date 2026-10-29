/*
 * Vehicle discounts: automatic price cuts on a vehicle's daily rate for a
 * window of days (e.g. "Holiday Sale", "Summer Deal"). Unlike vouchers there
 * is no code to enter — every customer booking during the window gets it, and
 * the vehicle cards show it.
 */
export const DISCOUNT_SCOPE = {
    ALL_VEHICLES: "all_vehicles",
    SPECIFIC_VEHICLES: "specific_vehicles",
};

export const DISCOUNT_SCOPE_VALUES =
    Object.values(DISCOUNT_SCOPE);

export const DISCOUNT_METHOD = {
    PERCENTAGE: "percentage",
    FIXED: "fixed",
};

export const DISCOUNT_METHOD_VALUES =
    Object.values(DISCOUNT_METHOD);

export const DISCOUNT_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
};

export const DISCOUNT_STATUS_VALUES =
    Object.values(DISCOUNT_STATUS);

// The short text on the vehicle-card badge.
export const DISCOUNT_LABEL_MAX_LENGTH = 24;
