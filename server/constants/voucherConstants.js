export const VOUCHER_TYPE = {
    RESERVATION_FEE:
        "reservation_fee",
    PICKUP_FEE: "pickup_fee",
    VEHICLE_PRICE:
        "vehicle_price",
    TOTAL: "total",
};

export const VOUCHER_TYPE_VALUES =
    Object.values(VOUCHER_TYPE);

export const VOUCHER_TYPE_LABELS = {
    [VOUCHER_TYPE.RESERVATION_FEE]:
        "Reservation Fee",
    [VOUCHER_TYPE.PICKUP_FEE]:
        "Pickup Fee",
    [VOUCHER_TYPE.VEHICLE_PRICE]:
        "Vehicle Price Per Day",
    [VOUCHER_TYPE.TOTAL]: "Total",
};

export const VOUCHER_DISCOUNT_METHOD = {
    PERCENTAGE: "percentage",
    FIXED: "fixed",
};

export const VOUCHER_DISCOUNT_METHOD_VALUES =
    Object.values(
        VOUCHER_DISCOUNT_METHOD
    );

export const VOUCHER_DISCOUNT_METHOD_LABELS = {
    [VOUCHER_DISCOUNT_METHOD.PERCENTAGE]:
        "Percentage",
    [VOUCHER_DISCOUNT_METHOD.FIXED]:
        "Fixed Amount",
};

export const VOUCHER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
};

export const VOUCHER_STATUS_VALUES =
    Object.values(VOUCHER_STATUS);

export const VOUCHER_STATUS_LABELS = {
    [VOUCHER_STATUS.ACTIVE]: "Active",
    [VOUCHER_STATUS.INACTIVE]: "Inactive",
};

export const VOUCHER_ASSIGNMENT_TYPE = {
    ALL_CUSTOMERS:
        "all_customers",
    SPECIFIC_USERS:
        "specific_users",
};

export const VOUCHER_ASSIGNMENT_TYPE_VALUES =
    Object.values(
        VOUCHER_ASSIGNMENT_TYPE
    );

export const VOUCHER_ASSIGNMENT_TYPE_LABELS = {
    [VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS]:
        "All Customers",
    [VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS]:
        "Specific Users",
};

export const VOUCHER_CODE_LENGTH = 8;
