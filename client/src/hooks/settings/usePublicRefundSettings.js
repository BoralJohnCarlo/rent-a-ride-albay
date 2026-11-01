import { useCallback, useEffect, useState } from "react";

import { fetchPublicSettings } from "../../services/settingsService";

import { resolveCancellationPolicy } from "../../utils/cancellationPolicy";
import {
    DEFAULT_BOOKING_HOURS,
    DEFAULT_PICKUP_HOURS,
} from "../../utils/pickupTime";

/*
 * Several components on one page (booking form, reminders, terms, calendars)
 * read these settings together: share one request between hooks mounting
 * within a short window instead of fetching once per component.
 */
const SHARED_FETCH_TTL_MS = 30 * 1000;

let sharedFetch = null;
let sharedFetchAt = 0;

const fetchPublicSettingsShared = (force = false) => {
    const now = Date.now();

    if (force || !sharedFetch || now - sharedFetchAt > SHARED_FETCH_TTL_MS) {
        sharedFetchAt = now;
        const request = fetchPublicSettings().catch((error) => {
            // Don't keep a failure around for the next caller.
            if (sharedFetch === request) sharedFetch = null;
            throw error;
        });
        sharedFetch = request;
    }

    return sharedFetch;
};
import {
    DEFAULT_NO_SHOW_GRACE_HOURS,
    DEFAULT_TURNAROUND_BUFFER_MINUTES,
} from "../../constants/bookingStatus";

const DEFAULTS = {
    allowOnlyDefaultLocation: false,
    enableDistanceFeeCalculation: false,
    requireCancellationReason: true,
    refundRequestWindowHours: 24,
    noShowGraceHours: DEFAULT_NO_SHOW_GRACE_HOURS,
    // Settings → Refunds → No-shows: what a no-show gets back, and whether
    // it's marked automatically at the end of the day.
    noShowPolicy: {
        refundPercent: 0,
        keepsDistanceFee: true,
        autoMark: true,
    },
    turnaroundBufferMinutes: DEFAULT_TURNAROUND_BUFFER_MINUTES,
    bookingHours: DEFAULT_BOOKING_HOURS,
    pickupHours: DEFAULT_PICKUP_HOURS,
    latePenalty: null,
    earlyReturn: null,
    // Free drivers, customer picks — what bookings did before these existed.
    driverPricing: { mode: "global", globalDailyRate: 0 },
    requireAdminDriverAssignment: false,
    // Settings → Drivers: off = motorcycles are self-drive only.
    motorcycleDriversEnabled: true,
    // Settings → Customers: self-drive needs a license covering the vehicle.
    licenseRestrictionEnabled: true,
    // Settings → Bookings → Off-Road Vehicles.
    offRoadVehicles: { showInListings: true, showNotice: true },
};

/*
 * The public settings response as the values screens use. Also reads a
 * booking's stored policy snapshot (Booking.termsAcceptance.policySnapshot,
 * the same fields), so the terms a customer accepted read exactly as they
 * did when they booked.
 */
export const normalizePublicSettings = (data = {}) => ({
    allowOnlyDefaultLocation: data.allowOnlyDefaultLocation === true,
    enableDistanceFeeCalculation:
        typeof data.enableDistanceFeeCalculation === "boolean"
            ? data.enableDistanceFeeCalculation
            : DEFAULTS.enableDistanceFeeCalculation,
    requireCancellationReason:
        typeof data.requireCancellationReason ===
        "boolean"
            ? data.requireCancellationReason
            : DEFAULTS.requireCancellationReason,
    refundRequestWindowHours: Number.isFinite(
        data.refundRequestWindowHours
    )
        ? data.refundRequestWindowHours
        : DEFAULTS.refundRequestWindowHours,
    noShowGraceHours: Number.isFinite(
        data.noShowGraceHours
    )
        ? data.noShowGraceHours
        : DEFAULTS.noShowGraceHours,
    noShowPolicy: {
        refundPercent: Number.isFinite(
            data.noShowRefundPercent
        )
            ? data.noShowRefundPercent
            : 0,
        keepsDistanceFee:
            data.noShowKeepsDistanceFee !== false,
        autoMark: data.noShowAutoMark !== false,
    },
    turnaroundBufferMinutes: Number.isFinite(
        data.turnaroundBufferMinutes
    )
        ? data.turnaroundBufferMinutes
        : DEFAULTS.turnaroundBufferMinutes,
    bookingHours:
        typeof data.bookingHours?.enabled === "boolean"
            ? data.bookingHours
            : DEFAULTS.bookingHours,
    pickupHours: data.pickupHours?.earliestTime
        ? data.pickupHours
        : DEFAULTS.pickupHours,
    latePenalty:
        data.latePenalty ??
        DEFAULTS.latePenalty,
    earlyReturn:
        data.earlyReturn ??
        DEFAULTS.earlyReturn,
    driverPricing:
        data.driverPricing ??
        DEFAULTS.driverPricing,
    requireAdminDriverAssignment:
        typeof data.requireAdminDriverAssignment ===
        "boolean"
            ? data.requireAdminDriverAssignment
            : DEFAULTS.requireAdminDriverAssignment,
    motorcycleDriversEnabled:
        data.motorcycleDriversEnabled !== false,
    licenseRestrictionEnabled:
        data.licenseRestrictionEnabled !== false,
    offRoadVehicles: {
        showInListings:
            data.offRoadVehicles?.showInListings !== false,
        showNotice:
            data.offRoadVehicles?.showNotice !== false,
    },
    policy: data.cancellationPolicy
        ? resolveCancellationPolicy(
              data.cancellationPolicy
          )
        : null,
    ready: true,
});

/*
 * The refund-related settings customer screens act on, from the public
 * settings endpoint. Customers can't call the admin-only GET /settings — it
 * answers 403 — so screens that asked for it silently ran on built-in
 * defaults instead of whatever the admin configured.
 *
 * Defaults support non-booking informational screens. Booking callers must
 * wait for `ready` before quoting or submitting prices. Failed requests expose
 * an error and an explicit retry rather than silently treating defaults as live.
 */
const usePublicRefundSettings = () => {
    const [state, setState] = useState({
        ...DEFAULTS,
        policy: null,
        ready: false,
        error: null,
    });
    const [retryKey, setRetryKey] = useState(0);
    const retry = useCallback(() => setRetryKey((key) => key + 1), []);

    useEffect(() => {
        let active = true;
        setState((previous) => ({ ...previous, ready: false, error: null }));

        fetchPublicSettingsShared(retryKey > 0)
            .then((response) => {
                const data = response?.data;

                if (!active) return;
                if (!data || typeof data !== "object" || Array.isArray(data) ||
                    !["global", "individual"].includes(data.driverPricing?.mode) ||
                    !Number.isFinite(data.driverPricing?.globalDailyRate) ||
                    data.driverPricing.globalDailyRate < 0 ||
                    !["allowOnlyDefaultLocation", "enableDistanceFeeCalculation", "licenseRestrictionEnabled",
                        "requireAdminDriverAssignment", "motorcycleDriversEnabled"]
                        .every((key) => typeof data[key] === "boolean") ||
                    typeof data.bookingHours?.enabled !== "boolean" ||
                    typeof data.pickupHours?.earliestTime !== "string" ||
                    typeof data.pickupHours?.latestTime !== "string") {
                    throw new Error("Incomplete booking settings.");
                }

                setState({ ...normalizePublicSettings(data), error: null });
            })
            .catch(() => {
                if (active) setState((previous) => ({
                    ...previous, ready: false,
                    error: "Unable to load booking settings. Please try again.",
                }));
            });

        return () => {
            active = false;
        };
    }, [retryKey]);

    return { ...state, retry };
};

export default usePublicRefundSettings;
