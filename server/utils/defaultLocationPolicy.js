import createError from "./createError.js";

export const SERVICE_LOCATION_POLICY_RESOURCE = "service-location-policy";

export const requiresDefaultLocation = (settings) =>
    settings?.allowOnlyDefaultLocation === true || settings?.enableDistanceFeeCalculation === true;

export const assertDefaultLocationPolicy = (settings, location) => {
    if (!requiresDefaultLocation(settings)) return;
    if (!location?.enabled || !location?.isDefault) {
        throw createError("Select an enabled default service location before enabling this booking policy. Keep a default location while default-only booking or distance pricing is enabled.", 400);
    }
    if (settings.enableDistanceFeeCalculation && (
        location.latitude == null || location.longitude == null ||
        !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude)) ||
        Math.abs(Number(location.latitude)) > 90 || Math.abs(Number(location.longitude)) > 180
    )) {
        throw createError("The default service location needs valid map coordinates while distance pricing is enabled.", 400);
    }
};
