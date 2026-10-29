import { useEffect, useState } from "react";

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

const fetchPublicSettingsShared = () => {
    const now = Date.now();

    if (!sharedFetch || now - sharedFetchAt > SHARED_FETCH_TTL_MS) {
        sharedFetchAt = now;
        sharedFetch = fetchPublicSettings().catch((error) => {
            // Don't keep a failure around for the next caller.
            sharedFetch = null;
            throw error;
        });
    }

    return sharedFetch;
};
import {
    DEFAULT_NO_SHOW_GRACE_HOURS,
    DEFAULT_TURNAROUND_BUFFER_MINUTES,
} from "../../constants/bookingStatus";

const DEFAULTS = {
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
 * Until the request finishes (or if it fails) the values are the same
 * defaults the server uses, so behaviour degrades to what it always was;
 * `ready` says whether the real values have arrived. `policy` stays null
 * until then so callers quoting numbers can hold back rather than show
 * defaults that might not match.
 */
const usePublicRefundSettings = () => {
    const [state, setState] = useState({
        ...DEFAULTS,
        policy: null,
        ready: false,
    });

    useEffect(() => {
        let active = true;

        fetchPublicSettingsShared()
            .then((response) => {
                const data = response?.data;

                if (!active || !data) {
                    return;
                }

                setState(normalizePublicSettings(data));
            })
            .catch(() => {
                /* keep the defaults */
            });

        return () => {
            active = false;
        };
    }, []);

    return state;
};

export default usePublicRefundSettings;
