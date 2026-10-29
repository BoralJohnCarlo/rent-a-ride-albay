import {
    VEHICLE_MAINTENANCE_MODE,
    MAX_VEHICLE_MAINTENANCE_DAYS,
} from "../constants/vehicleConstants";

/* The plan MaintenancePlanFields edits: { mode, days, reason }. */
export const EMPTY_MAINTENANCE_PLAN = {
    mode: VEHICLE_MAINTENANCE_MODE.TURNAROUND,
    days: "",
    reason: "",
};

/* Error text for an incomplete plan, or "" when it can be submitted. */
export const validateMaintenancePlan = (plan) => {
    if (!plan?.mode) {
        return "Choose a maintenance type.";
    }

    if (plan.mode === VEHICLE_MAINTENANCE_MODE.EXTENDED) {
        const days = Number(plan.days);

        if (
            !Number.isInteger(days) ||
            days < 1 ||
            days > MAX_VEHICLE_MAINTENANCE_DAYS
        ) {
            return `Enter between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days of maintenance.`;
        }
    }

    return "";
};

/* The plan as the API takes it. */
export const toMaintenancePayload = (plan) => ({
    mode: plan.mode,
    days:
        plan.mode === VEHICLE_MAINTENANCE_MODE.EXTENDED
            ? Number(plan.days)
            : null,
    reason: plan.reason?.trim() ?? "",
});
