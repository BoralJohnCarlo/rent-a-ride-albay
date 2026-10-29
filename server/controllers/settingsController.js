import {
    getBookingLocationPolicy,
    updateBookingLocationPolicy,
    resolveThemeSettings,
    resolveOffRoadVehicleSettings,
    resolveRegistrationSettings,
    setHeroVideo,
    setHeroImage,
    NAVBAR_STYLES,
    HERO_MEDIA_TYPES,
    CARD_HOVER_MODES,
    CARD_HOVER_COLORS,
} from "../services/settingsService.js";

import { getCancellationPolicyError } from "../services/cancellationPolicyService.js";
import { buildTermsPolicySnapshot } from "../services/legalDocumentService.js";
import {
    areMotorcycleDriversEnabled,
    getDriverPricingSettings,
} from "../services/driverPricingService.js";
import {
    MAX_NO_SHOW_GRACE_HOURS,
    MIN_TURNAROUND_BUFFER_MINUTES,
    MAX_TURNAROUND_BUFFER_MINUTES,
    TURNAROUND_BUFFER_STEP_MINUTES,
} from "../constants/bookingConstants.js";
import {
    getBookingHoursError,
    getPickupHoursError,
} from "../utils/bookingHours.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

/*
 * Returns an error message when the merged refund settings are invalid,
 * otherwise null. The express-validator chain on this route isn't enforced,
 * so this is the real gate for the refund section.
 */
const getRefundSettingsError = (refundSettings) => {
    if (
        !Number.isInteger(refundSettings.gracePeriodHours) ||
        refundSettings.gracePeriodHours < 0 ||
        refundSettings.gracePeriodHours > 72
    ) {
        return "gracePeriodHours must be a whole number between 0 and 72.";
    }

    if (
        typeof refundSettings.autoApproveRefundThreshold !== "number" ||
        !Number.isFinite(refundSettings.autoApproveRefundThreshold) ||
        refundSettings.autoApproveRefundThreshold < 0
    ) {
        return "autoApproveRefundThreshold must be a non-negative number.";
    }

    if (typeof refundSettings.requireCancellationReason !== "boolean") {
        return "requireCancellationReason must be a boolean.";
    }

    if (
        !Number.isInteger(refundSettings.noShowGraceHours) ||
        refundSettings.noShowGraceHours < 0 ||
        refundSettings.noShowGraceHours > MAX_NO_SHOW_GRACE_HOURS
    ) {
        return `noShowGraceHours must be a whole number between 0 and ${MAX_NO_SHOW_GRACE_HOURS}.`;
    }

    if (
        !Number.isInteger(refundSettings.noShowRefundPercent) ||
        refundSettings.noShowRefundPercent < 0 ||
        refundSettings.noShowRefundPercent > 100
    ) {
        return "noShowRefundPercent must be a whole number between 0 and 100.";
    }

    if (typeof refundSettings.noShowKeepsDistanceFee !== "boolean") {
        return "noShowKeepsDistanceFee must be a boolean.";
    }

    if (typeof refundSettings.noShowAutoMark !== "boolean") {
        return "noShowAutoMark must be a boolean.";
    }

    return getCancellationPolicyError(
        refundSettings.cancellationPolicy
    );
};

/*
 * Returns an error message when the merged Christmas window is invalid,
 * otherwise null. 2024 is used as the reference year so Feb 29 stays a
 * legal day - the window repeats every year, so it can't be pinned to one.
 */
const getChristmasWindowError = (christmas) => {
    if (typeof christmas.enabled !== "boolean") {
        return "themeSettings.christmas.enabled must be a boolean.";
    }

    for (const [monthKey, dayKey] of [
        ["startMonth", "startDay"],
        ["endMonth", "endDay"],
    ]) {
        const month = christmas[monthKey];
        const day = christmas[dayKey];

        if (
            !Number.isInteger(month) ||
            month < 1 ||
            month > 12
        ) {
            return `${monthKey} must be an integer between 1 and 12.`;
        }

        if (
            !Number.isInteger(day) ||
            day < 1 ||
            day > new Date(2024, month, 0).getDate()
        ) {
            return `${dayKey} is not a valid day for the selected month.`;
        }
    }

    return null;
};

export const getSettings = async (req, res) => {
    try {
        const settings =
            await getBookingLocationPolicy();

        return successResponse(
            res,
            "Settings retrieved successfully.",
            settings
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * Unauthenticated-safe subset of settings needed by customer-facing pages
 * (registration, profile, the "complete your license info" prompt) that
 * can't call the admin-only GET / above. Only expose flags those pages
 * actually need to decide what to show - never the full settings document.
 */
export const getPublicSettings = async (req, res) => {
    try {
        const settings =
            await getBookingLocationPolicy();

        return successResponse(
            res,
            "Public settings retrieved successfully.",
            {
                enableDistanceFeeCalculation:
                    settings?.enableDistanceFeeCalculation ?? false,
                licenseRestrictionEnabled:
                    settings?.customerBookingSettings
                        ?.licenseRestrictionEnabled ??
                    true,

                /*
                 * Whether registration asks for a proof of billing address,
                 * and whether profiles / the admin booking panel show it.
                 */
                proofOfBillingEnabled: resolveRegistrationSettings(
                    settings?.registrationSettings
                ).proofOfBillingEnabled,

                /*
                 * The booking rules the Terms, Important Reminders, FAQ and
                 * cancel dialogs quote: cancellation tiers, no-shows, late
                 * returns, early-return credit, turnaround buffer, booking
                 * and pickup hours. Customers can't call the admin-only
                 * GET /settings. Each booking stores the same values when
                 * it's made (legalDocumentService), so this is one list.
                 */
                ...buildTermsPolicySnapshot(settings),

                /*
                 * Whether the vehicle pages say a vehicle is off road, or
                 * only that its dates are blocked.
                 */
                offRoadVehicles: resolveOffRoadVehicleSettings(
                    settings?.bookingSettings?.offRoadVehicles
                ),

                /*
                 * So the booking form can quote the driver fee the server
                 * will charge, and knows when admins (not customers) pick
                 * the driver — customers can't read the admin-only
                 * GET /settings, so it never knew before.
                 */
                driverPricing: getDriverPricingSettings(settings),
                requireAdminDriverAssignment: Boolean(
                    settings?.driverAssignmentSettings
                        ?.requireAdminDriverAssignment
                ),

                // Off: motorcycles are self-drive only (no driver option).
                motorcycleDriversEnabled:
                    areMotorcycleDriversEnabled(settings),

                /*
                 * The seasonal window (the client decides on its own whether
                 * today falls inside it) and the public navbar style.
                 */
                themeSettings: resolveThemeSettings(
                    settings?.themeSettings
                ),
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const updateSettings = async (req, res) => {
    try {
        const settingsData = req.body;

        /*
         * Each settings page only sends the section(s) it actually edits, so
         * every one of these checks must be truly optional - present-and-
         * wrong-type is rejected, but a page that never touches
         * allowOnlyDefaultLocation (e.g. Driver Settings) must not be forced
         * to resend it just to satisfy this handler. Mirrors the
         * .optional() semantics already declared in updateSettingsValidator.
         */
        if (
            settingsData &&
            "allowOnlyDefaultLocation" in settingsData &&
            typeof settingsData.allowOnlyDefaultLocation !==
                "boolean"
        ) {
            return errorResponse(
                res,
                "allowOnlyDefaultLocation must be a boolean.",
                400
            );
        }

        if (
            settingsData &&
            "enableDistanceFeeCalculation" in settingsData &&
            typeof settingsData.enableDistanceFeeCalculation !==
                "boolean"
        ) {
            return errorResponse(
                res,
                "enableDistanceFeeCalculation must be a boolean.",
                400
            );
        }

        if (
            settingsData?.customerBookingSettings &&
            "maxConcurrentBookings" in
                settingsData.customerBookingSettings &&
            typeof settingsData.customerBookingSettings.maxConcurrentBookings !==
                "number"
        ) {
            return errorResponse(
                res,
                "maxConcurrentBookings must be a number.",
                400
            );
        }

        if (
            settingsData?.customerBookingSettings &&
            "licenseRestrictionEnabled" in
                settingsData.customerBookingSettings &&
            typeof settingsData.customerBookingSettings.licenseRestrictionEnabled !==
                "boolean"
        ) {
            return errorResponse(
                res,
                "licenseRestrictionEnabled must be a boolean.",
                400
            );
        }

        // Settings → Drivers toggles.
        for (const key of [
            "requireAdminDriverAssignment",
            "motorcycleDriversEnabled",
        ]) {
            if (
                settingsData?.driverAssignmentSettings &&
                key in settingsData.driverAssignmentSettings &&
                typeof settingsData.driverAssignmentSettings[key] !==
                    "boolean"
            ) {
                return errorResponse(
                    res,
                    `${key} must be a boolean.`,
                    400
                );
            }
        }

        /*
         * registrationSettings is written wholesale; it has a single key, so
         * it's rebuilt from just the validated flag.
         */
        if (settingsData?.registrationSettings) {
            const { proofOfBillingEnabled } =
                settingsData.registrationSettings;

            if (typeof proofOfBillingEnabled !== "boolean") {
                return errorResponse(
                    res,
                    "registrationSettings.proofOfBillingEnabled must be a boolean.",
                    400
                );
            }

            settingsData.registrationSettings = { proofOfBillingEnabled };
        }

        if (
            settingsData?.validIdRenewalSettings &&
            "maxUploadsPerYear" in
                settingsData.validIdRenewalSettings &&
            typeof settingsData.validIdRenewalSettings.maxUploadsPerYear !==
                "number"
        ) {
            return errorResponse(
                res,
                "maxUploadsPerYear must be a number.",
                400
            );
        }

        if (
            settingsData?.validIdRenewalSettings &&
            "renewalPeriodYears" in
                settingsData.validIdRenewalSettings &&
            typeof settingsData.validIdRenewalSettings.renewalPeriodYears !==
                "number"
        ) {
            return errorResponse(
                res,
                "renewalPeriodYears must be a number.",
                400
            );
        }

        if (
            settingsData?.vehicleRegistrationRenewalSettings &&
            "maxRenewalsPerPeriod" in
                settingsData.vehicleRegistrationRenewalSettings &&
            typeof settingsData.vehicleRegistrationRenewalSettings
                .maxRenewalsPerPeriod !== "number"
        ) {
            return errorResponse(
                res,
                "maxRenewalsPerPeriod must be a number.",
                400
            );
        }

        if (
            settingsData?.vehicleRegistrationRenewalSettings &&
            "renewalPeriodValue" in
                settingsData.vehicleRegistrationRenewalSettings &&
            typeof settingsData.vehicleRegistrationRenewalSettings
                .renewalPeriodValue !== "number"
        ) {
            return errorResponse(
                res,
                "renewalPeriodValue must be a number.",
                400
            );
        }

        /*
         * Settings → Bookings. The turnaround buffer can never drop below the
         * 2-hour minimum, and moves in half-hour steps.
         */
        if (
            settingsData?.bookingSettings &&
            "turnaroundBufferMinutes" in settingsData.bookingSettings
        ) {
            const buffer =
                settingsData.bookingSettings.turnaroundBufferMinutes;

            if (
                !Number.isInteger(buffer) ||
                buffer < MIN_TURNAROUND_BUFFER_MINUTES ||
                buffer > MAX_TURNAROUND_BUFFER_MINUTES ||
                buffer % TURNAROUND_BUFFER_STEP_MINUTES !== 0
            ) {
                return errorResponse(
                    res,
                    `The turnaround buffer must be between ${MIN_TURNAROUND_BUFFER_MINUTES / 60} and ${MAX_TURNAROUND_BUFFER_MINUTES / 60} hours, in ${TURNAROUND_BUFFER_STEP_MINUTES}-minute steps.`,
                    400
                );
            }
        }

        /*
         * bookingSettings is written wholesale too: merge what was sent over
         * the stored values, so saving the buffer keeps the booking hours and
         * vice versa.
         */
        if (settingsData?.bookingSettings) {
            const current = (await getBookingLocationPolicy())
                .bookingSettings;

            const bookingHours = {
                ...current.bookingHours,
                ...(settingsData.bookingSettings.bookingHours ?? {}),
            };

            const bookingHoursError =
                getBookingHoursError(bookingHours);

            if (bookingHoursError) {
                return errorResponse(res, bookingHoursError, 400);
            }

            const pickupHours = {
                ...current.pickupHours,
                ...(settingsData.bookingSettings.pickupHours ?? {}),
            };

            const pickupHoursError = getPickupHoursError(pickupHours);

            if (pickupHoursError) {
                return errorResponse(res, pickupHoursError, 400);
            }

            const offRoadVehicles = {
                ...current.offRoadVehicles,
                ...(settingsData.bookingSettings.offRoadVehicles ?? {}),
            };

            if (
                typeof offRoadVehicles.showInListings !== "boolean" ||
                typeof offRoadVehicles.showNotice !== "boolean"
            ) {
                return errorResponse(
                    res,
                    "offRoadVehicles.showInListings and offRoadVehicles.showNotice must be booleans.",
                    400
                );
            }

            const earlyPickup = {
                ...current.earlyPickup,
                ...(settingsData.bookingSettings.earlyPickup ?? {}),
            };

            if (typeof earlyPickup.allowAnytime !== "boolean") {
                return errorResponse(
                    res,
                    "earlyPickup.allowAnytime must be a boolean.",
                    400
                );
            }

            settingsData.bookingSettings = {
                turnaroundBufferMinutes:
                    settingsData.bookingSettings
                        .turnaroundBufferMinutes ??
                    current.turnaroundBufferMinutes,
                bookingHours: {
                    enabled: bookingHours.enabled,
                    openTime: bookingHours.openTime,
                    closeTime: bookingHours.closeTime,
                },
                pickupHours: {
                    earliestTime: pickupHours.earliestTime,
                    latestTime: pickupHours.latestTime,
                },
                offRoadVehicles: {
                    showInListings: offRoadVehicles.showInListings,
                    showNotice: offRoadVehicles.showNotice,
                },
                earlyPickup: {
                    allowAnytime: earlyPickup.allowAnytime,
                },
            };
        }

        /*
         * themeSettings is written wholesale, so merge whatever was sent over
         * the stored values and write the complete section back - otherwise
         * saving just the navbar style would wipe the Christmas window (and
         * vice versa). The Christmas window is validated as a whole (a day
         * is only legal relative to its month), which also keeps a partial
         * update - e.g. just `enabled` - from wiping the dates.
         */
        if (settingsData?.themeSettings) {
            const current = resolveThemeSettings(
                (await getBookingLocationPolicy()).themeSettings
            );

            const christmas = {
                ...current.christmas,
                ...(settingsData.themeSettings.christmas ?? {}),
            };

            const buttonColors = {};
            for (const key of ["buttonColor", "buttonHoverColor"]) {
                const value = settingsData.themeSettings[key] === undefined ? current[key] : settingsData.themeSettings[key];
                if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
                    return errorResponse(res, `${key} must be a six-digit hex color (for example #2563eb).`, 400);
                }
                buttonColors[key] = value.toLowerCase();
            }

            const christmasError =
                getChristmasWindowError(christmas);

            if (christmasError) {
                return errorResponse(res, christmasError, 400);
            }

            const navbarStyle =
                settingsData.themeSettings.navbarStyle ??
                current.navbarStyle;

            if (!NAVBAR_STYLES.includes(navbarStyle)) {
                return errorResponse(
                    res,
                    `navbarStyle must be one of: ${NAVBAR_STYLES.join(", ")}.`,
                    400
                );
            }

            /* The hero video only changes through its own upload / reset
               endpoints, so a settings save always keeps the stored one. */
            const featuredImageFrame =
                settingsData.themeSettings.featuredImageFrame ??
                current.featuredImageFrame;

            if (typeof featuredImageFrame !== "boolean") {
                return errorResponse(
                    res,
                    "featuredImageFrame must be true or false.",
                    400
                );
            }

            const cardHoverMode =
                settingsData.themeSettings.cardHoverMode ??
                current.cardHoverMode;

            if (!CARD_HOVER_MODES.includes(cardHoverMode)) {
                return errorResponse(
                    res,
                    `cardHoverMode must be one of: ${CARD_HOVER_MODES.join(", ")}.`,
                    400
                );
            }

            const cardHoverColor =
                settingsData.themeSettings.cardHoverColor ??
                current.cardHoverColor;

            if (!CARD_HOVER_COLORS.includes(cardHoverColor)) {
                return errorResponse(
                    res,
                    `cardHoverColor must be one of: ${CARD_HOVER_COLORS.join(", ")}.`,
                    400
                );
            }

            const heroMediaType =
                settingsData.themeSettings.heroMediaType ??
                current.heroMediaType;

            if (!HERO_MEDIA_TYPES.includes(heroMediaType)) {
                return errorResponse(
                    res,
                    `heroMediaType must be one of: ${HERO_MEDIA_TYPES.join(", ")}.`,
                    400
                );
            }

            /* The hero video and image only change through their own
               upload / reset endpoints; a settings save keeps them. */
            settingsData.themeSettings = {
                ...buttonColors,
                christmas,
                navbarStyle,
                featuredImageFrame,
                cardHoverMode,
                cardHoverColor,
                heroMediaType,
                heroImage: current.heroImage,
                heroVideo: current.heroVideo,
            };
        }

        /*
         * Nested objects are written wholesale, so a page that sends only
         * part of refundSettings would silently drop the rest (including the
         * whole cancellation policy). Merge over the stored, fully-resolved
         * values first, validate the result, and write the complete section.
         */
        if (settingsData?.refundSettings) {
            const current = await getBookingLocationPolicy();

            const refundSettings = {
                ...current.refundSettings,
                ...settingsData.refundSettings,
                cancellationPolicy: {
                    ...current.refundSettings.cancellationPolicy,
                    ...(settingsData.refundSettings
                        .cancellationPolicy ?? {}),
                },
            };

            const refundError =
                getRefundSettingsError(refundSettings);

            if (refundError) {
                return errorResponse(res, refundError, 400);
            }

            settingsData.refundSettings = refundSettings;
        }

        const settings =
            await updateBookingLocationPolicy(
                settingsData || {
                    allowOnlyDefaultLocation: false,
                    enableDistanceFeeCalculation: false,
                }
            );

        return successResponse(
            res,
            "Settings updated successfully.",
            settings
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/* POST /settings/hero-video — the upload middleware has already stored the
   file on Cloudinary and put it on req.heroVideo. */
export const uploadHeroVideoCtrl = async (req, res) => {
    try {
        const themeSettings = await setHeroVideo(req.heroVideo);

        return successResponse(
            res,
            "Hero video updated.",
            { themeSettings }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/* DELETE /settings/hero-video — back to the bundled default video. */
export const resetHeroVideoCtrl = async (req, res) => {
    try {
        const themeSettings = await setHeroVideo(null);

        return successResponse(
            res,
            "Hero video reset to the default.",
            { themeSettings }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

/* POST /settings/hero-image — the upload middleware already stored the
   file on Cloudinary and put it on req.heroImage. */
export const uploadHeroImageCtrl = async (req, res) => {
    try {
        const themeSettings = await setHeroImage(req.heroImage);

        return successResponse(res, "Hero image updated.", {
            themeSettings,
        });
    } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 500);
    }
};

/* DELETE /settings/hero-image — back to the bundled default image. */
export const resetHeroImageCtrl = async (req, res) => {
    try {
        const themeSettings = await setHeroImage(null);

        return successResponse(res, "Hero image reset to the default.", {
            themeSettings,
        });
    } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 500);
    }
};
