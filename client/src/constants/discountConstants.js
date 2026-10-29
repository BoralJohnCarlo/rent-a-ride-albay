export const DISCOUNT_SCOPE = {
    ALL_VEHICLES: "all_vehicles",
    SPECIFIC_VEHICLES: "specific_vehicles",
};

export const DISCOUNT_SCOPE_LABELS = {
    [DISCOUNT_SCOPE.ALL_VEHICLES]: "All vehicles (site-wide)",
    [DISCOUNT_SCOPE.SPECIFIC_VEHICLES]: "Specific vehicles",
};

export const DISCOUNT_METHOD = {
    PERCENTAGE: "percentage",
    FIXED: "fixed",
};

export const DISCOUNT_METHOD_LABELS = {
    [DISCOUNT_METHOD.PERCENTAGE]: "Percentage off per day",
    [DISCOUNT_METHOD.FIXED]: "Fixed amount off per day",
};

export const DISCOUNT_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
};

export const DISCOUNT_STATUS_LABELS = {
    [DISCOUNT_STATUS.ACTIVE]: "Active",
    [DISCOUNT_STATUS.INACTIVE]: "Inactive",
};

export const DISCOUNT_LABEL_MAX_LENGTH = 24;
