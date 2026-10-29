import Driver from "../models/Driver.js";
import Settings from "../models/Settings.js";

import {
    BOOKING_DRIVER_OPTIONS,
    BOOKING_EXTENSION_STATUS,
} from "../constants/bookingConstants.js";
import { VEHICLE_TYPES } from "../constants/vehicleConstants.js";

export const DRIVER_PRICING_MODE = Object.freeze({
    GLOBAL: "global",
    INDIVIDUAL: "individual",
});

const toRate = (value) => {
    const rate = Number(value);
    return Number.isFinite(rate) && rate > 0 ? Math.round(rate * 100) / 100 : 0;
};

const roundMoney = (value) =>
    Math.round((Number(value) || 0) * 100) / 100;

/* The admin's driver pricing settings, with safe defaults. */
export const getDriverPricingSettings = (settings) => ({
    mode:
        settings?.driverPricingSettings?.mode ===
        DRIVER_PRICING_MODE.INDIVIDUAL
            ? DRIVER_PRICING_MODE.INDIVIDUAL
            : DRIVER_PRICING_MODE.GLOBAL,
    globalDailyRate: toRate(settings?.driverPricingSettings?.globalDailyRate),
    requireAdminDriverAssignment: Boolean(
        settings?.driverAssignmentSettings?.requireAdminDriverAssignment
    ),
});

/* Settings → Drivers: whether motorcycles can be booked with a driver. */
export const areMotorcycleDriversEnabled = (settings) =>
    settings?.driverAssignmentSettings?.motorcycleDriversEnabled !== false;

/*
 * Whether "With Driver" is offered for this vehicle: always for cars, for
 * motorcycles only while Settings → Drivers allows it.
 */
export const areDriversOfferedForVehicle = (vehicle, settings) =>
    vehicle?.vehicleType !== VEHICLE_TYPES.MOTORCYCLE ||
    areMotorcycleDriversEnabled(settings);

/*
 * What a booking pays per rental day for its driver:
 *  - "Without Driver": nothing.
 *  - global mode: the global rate.
 *  - individual mode: the chosen driver's own rate (the global rate if they
 *    have none). While admins assign drivers the customer can't choose, so
 *    the global rate applies and stays locked when a driver is assigned.
 *
 * `settings` may be passed to avoid a second lookup.
 */
export const resolveDriverDailyRate = async ({
    driverOption,
    driverId = null,
    settings = null,
}) => {
    if (driverOption !== BOOKING_DRIVER_OPTIONS.WITH_DRIVER) {
        return 0;
    }

    const pricing = getDriverPricingSettings(
        settings ?? (await Settings.findOne().lean())
    );

    if (
        pricing.mode !== DRIVER_PRICING_MODE.INDIVIDUAL ||
        pricing.requireAdminDriverAssignment ||
        !driverId
    ) {
        return pricing.globalDailyRate;
    }

    const driver = await Driver.findById(driverId)
        .select("pricing")
        .lean();

    const ownRate = driver?.pricing?.dailyRate;

    return ownRate === null || ownRate === undefined
        ? pricing.globalDailyRate
        : toRate(ownRate);
};

/*
 * Applies a driver daily rate to a booking pricing object (mutates and
 * returns it): driverFee = rate × rental days, added to the total.
 */
export const applyDriverFee = (pricing, driverDailyRate) => {
    const rate = toRate(driverDailyRate);
    const driverFee = roundMoney(rate * (Number(pricing.rentalDays) || 0));

    pricing.driverDailyRate = rate;
    pricing.driverFee = driverFee;
    pricing.totalAmount = roundMoney(
        (Number(pricing.totalAmount) || 0) + driverFee
    );

    return pricing;
};

/* An extension's driver share: the booking's locked rate, per hour. */
export const getExtensionDriverCharge = (booking, additionalHours) => {
    if (booking?.driverOption !== BOOKING_DRIVER_OPTIONS.WITH_DRIVER) {
        return { driverHourlyRate: 0, driverAmount: 0 };
    }

    const driverHourlyRate =
        toRate(booking?.pricing?.driverDailyRate) / 24;

    return {
        driverHourlyRate,
        driverAmount: roundMoney(
            driverHourlyRate * (Number(additionalHours) || 0)
        ),
    };
};

/*
 * Everything a booking charges for its driver: the booked days plus the
 * driver share of approved extensions. That money is the platform's (drivers
 * are Rent-A-Ride Albay's, not the vehicle owner's), so it is left out of a
 * partner's payout.
 */
export const getBookingDriverCharges = (booking) => {
    const extensionDriverCharges = (booking?.extensions || []).reduce(
        (total, extension) =>
            extension?.status === BOOKING_EXTENSION_STATUS.APPROVED
                ? total + (Number(extension.pricing?.driverAmount) || 0)
                : total,
        0
    );

    return roundMoney(
        (Number(booking?.pricing?.driverFee) || 0) + extensionDriverCharges
    );
};
