import createError from "../utils/createError.js";

import Settings from "../models/Settings.js";
import { deleteImage, deleteVideo } from "../utils/cloudinary.js";

import { resolveCancellationPolicy } from "./cancellationPolicyService.js";
import {
    getEarliestPickupMs,
    resolveBookingHours,
    resolvePickupHours,
} from "../utils/bookingHours.js";
import {
    DEFAULT_NO_SHOW_GRACE_HOURS,
    DEFAULT_TURNAROUND_BUFFER_MINUTES,
    MIN_TURNAROUND_BUFFER_MINUTES,
    MAX_TURNAROUND_BUFFER_MINUTES,
} from "../constants/bookingConstants.js";

/*
 * Settings → Bookings, complete and in range whatever the stored document
 * holds (lean reads skip schema defaults; older documents lack the key).
 */
export const resolveBookingSettings = (bookingSettings) => {
    const buffer = Number(bookingSettings?.turnaroundBufferMinutes);

    return {
        turnaroundBufferMinutes: Number.isFinite(buffer)
            ? Math.min(
                  MAX_TURNAROUND_BUFFER_MINUTES,
                  Math.max(MIN_TURNAROUND_BUFFER_MINUTES, buffer)
              )
            : DEFAULT_TURNAROUND_BUFFER_MINUTES,
        bookingHours: resolveBookingHours(bookingSettings?.bookingHours),
        pickupHours: resolvePickupHours(bookingSettings?.pickupHours),
        offRoadVehicles: resolveOffRoadVehicleSettings(
            bookingSettings?.offRoadVehicles
        ),
        earlyPickup: resolveEarlyPickupSettings(
            bookingSettings?.earlyPickup
        ),
    };
};

/* Settings → Bookings → Early Pickup; off unless an admin turned it on. */
export const resolveEarlyPickupSettings = (earlyPickup) => ({
    allowAnytime: earlyPickup?.allowAnytime === true,
});

/* Whether admins may release a vehicle before the usual early-pickup window. */
export const isEarlyPickupOverrideEnabled = async () =>
    (await getBookingSettings()).earlyPickup.allowAnytime;

/* Settings → Bookings → Off-Road Vehicles; both on unless turned off. */
export const resolveOffRoadVehicleSettings = (offRoadVehicles) => ({
    showInListings: offRoadVehicles?.showInListings !== false,
    showNotice: offRoadVehicles?.showNotice !== false,
});

/* Settings → Bookings → Off-Road Vehicles, resolved. */
export const getOffRoadVehicleSettings = async () =>
    (await getBookingSettings()).offRoadVehicles;

/* Settings → Bookings, resolved (see resolveBookingSettings). */
export const getBookingSettings = async () => {
    const settings = await Settings.findOne()
        .select("bookingSettings")
        .lean();

    return resolveBookingSettings(settings?.bookingSettings);
};

/*
 * Settings → Registration. Proof of billing is on unless an admin turned it
 * off (older documents lack the key; lean reads skip schema defaults).
 */
export const resolveRegistrationSettings = (registrationSettings) => ({
    proofOfBillingEnabled:
        registrationSettings?.proofOfBillingEnabled !== false,
});

/* Whether registration currently asks for a proof of billing address. */
export const isProofOfBillingEnabled = async () => {
    const settings = await Settings.findOne()
        .select("registrationSettings")
        .lean();

    return resolveRegistrationSettings(settings?.registrationSettings)
        .proofOfBillingEnabled;
};

/* The configured booking hours (see utils/bookingHours.js). */
export const getBookingHours = async () =>
    (await getBookingSettings()).bookingHours;

/* The configured pickup window (see utils/bookingHours.js). */
export const getPickupHours = async () =>
    (await getBookingSettings()).pickupHours;

/*
 * The earliest pickup a booking made right now may have: the minimum notice,
 * counted only during booking hours when those are enabled.
 */
export const getEarliestBookingPickupMs = async (nowMs = Date.now()) =>
    getEarliestPickupMs(nowMs, await getBookingHours());

/* The turnaround buffer in ms, for the booking conflict checks. */
export const getTurnaroundBufferMs = async () => {
    const settings = await Settings.findOne()
        .select("bookingSettings")
        .lean();

    return (
        resolveBookingSettings(settings?.bookingSettings)
            .turnaroundBufferMinutes *
        60 *
        1000
    );
};

export const DEFAULT_THEME_SETTINGS = {
    christmas: {
        enabled: true,
        startMonth: 9,
        startDay: 1,
        endMonth: 1,
        endDay: 1,
    },
    navbarStyle: "default",
    buttonColor: "#2563eb",
    buttonHoverColor: "#1d4ed8",
    featuredImageFrame: true,
    cardHoverMode: "neon",
    cardHoverColor: "yellow",
    heroMediaType: "video",
    // url: null → the hero uses the image bundled with the client.
    heroImage: {
        url: null,
        publicId: null,
        originalName: null,
        uploadedAt: null,
    },
    // url: null → the hero uses the video bundled with the client.
    heroVideo: {
        url: null,
        publicId: null,
        originalName: null,
        uploadedAt: null,
    },
};

export const NAVBAR_STYLES = ["default", "pill"];

export const HERO_MEDIA_TYPES = ["video", "image"];

export const CARD_HOVER_MODES = ["neon", "spotlight"];

export const CARD_HOVER_COLORS = [
    "yellow",
    "blue",
    "purple",
    "green",
    "red",
    "white",
];

/* An uploaded hero asset, or the "use the bundled default" shape. */
const resolveHeroAsset = (asset, fallback) =>
    asset?.url
        ? {
              url: asset.url,
              publicId: asset.publicId ?? null,
              originalName: asset.originalName ?? null,
              uploadedAt: asset.uploadedAt ?? null,
          }
        : { ...fallback };

/*
 * Lean documents skip schema defaults and documents saved before this
 * feature don't have the key at all, so fill any gap from the defaults.
 */
export const resolveThemeSettings = (themeSettings) => ({
    buttonColor: /^#[0-9a-f]{6}$/i.test(themeSettings?.buttonColor) ? themeSettings.buttonColor : DEFAULT_THEME_SETTINGS.buttonColor,
    buttonHoverColor: /^#[0-9a-f]{6}$/i.test(themeSettings?.buttonHoverColor) ? themeSettings.buttonHoverColor : DEFAULT_THEME_SETTINGS.buttonHoverColor,
    christmas: {
        ...DEFAULT_THEME_SETTINGS.christmas,
        ...(themeSettings?.christmas ?? {}),
    },
    navbarStyle: NAVBAR_STYLES.includes(themeSettings?.navbarStyle)
        ? themeSettings.navbarStyle
        : DEFAULT_THEME_SETTINGS.navbarStyle,
    featuredImageFrame:
        typeof themeSettings?.featuredImageFrame === "boolean"
            ? themeSettings.featuredImageFrame
            : DEFAULT_THEME_SETTINGS.featuredImageFrame,
    cardHoverMode: CARD_HOVER_MODES.includes(themeSettings?.cardHoverMode)
        ? themeSettings.cardHoverMode
        : DEFAULT_THEME_SETTINGS.cardHoverMode,
    cardHoverColor: CARD_HOVER_COLORS.includes(themeSettings?.cardHoverColor)
        ? themeSettings.cardHoverColor
        : DEFAULT_THEME_SETTINGS.cardHoverColor,
    heroMediaType: HERO_MEDIA_TYPES.includes(themeSettings?.heroMediaType)
        ? themeSettings.heroMediaType
        : DEFAULT_THEME_SETTINGS.heroMediaType,
    heroImage: resolveHeroAsset(
        themeSettings?.heroImage,
        DEFAULT_THEME_SETTINGS.heroImage
    ),
    heroVideo: resolveHeroAsset(
        themeSettings?.heroVideo,
        DEFAULT_THEME_SETTINGS.heroVideo
    ),
});

/*
 * Swap the home hero's background video (`video` = an uploaded Cloudinary
 * asset, or null to go back to the bundled default). The replaced asset is
 * deleted afterwards, best-effort: a failed cleanup only leaves an orphaned
 * file, never a broken hero.
 */
const setHeroAsset = async (field, asset, deleteAsset) => {
    const existing = await Settings.findOne({})
        .select(`themeSettings.${field}`)
        .lean();

    const previousPublicId =
        existing?.themeSettings?.[field]?.publicId ?? null;

    const next = asset
        ? {
              url: asset.url,
              publicId: asset.publicId,
              originalName: asset.originalName ?? null,
              uploadedAt: new Date(),
          }
        : { ...DEFAULT_THEME_SETTINGS[field] };

    const updated = await Settings.findOneAndUpdate(
        {},
        { $set: { [`themeSettings.${field}`]: next } },
        { returnDocument: "after", upsert: true, runValidators: true }
    ).lean();

    if (previousPublicId && previousPublicId !== next.publicId) {
        deleteAsset(previousPublicId).catch((error) =>
            console.error(`Failed to delete previous ${field}:`, error)
        );
    }

    return resolveThemeSettings(updated?.themeSettings);
};

export const setHeroVideo = (video) =>
    setHeroAsset("heroVideo", video, deleteVideo);

/* Hero still image — same rules as the video (null → bundled default). */
export const setHeroImage = (image) =>
    setHeroAsset("heroImage", image, deleteImage);

/*
 * Same idea as resolveThemeSettings: lean documents skip schema defaults and
 * older documents lack the newer keys, so every reader gets a complete object.
 */
export const resolveRefundSettings = (refundSettings) => ({
    gracePeriodHours:
        typeof refundSettings?.gracePeriodHours === "number"
            ? refundSettings.gracePeriodHours
            : 24,
    autoApproveRefundThreshold:
        typeof refundSettings?.autoApproveRefundThreshold === "number"
            ? refundSettings.autoApproveRefundThreshold
            : 500,
    requireCancellationReason:
        typeof refundSettings?.requireCancellationReason === "boolean"
            ? refundSettings.requireCancellationReason
            : true,
    noShowGraceHours:
        typeof refundSettings?.noShowGraceHours === "number"
            ? refundSettings.noShowGraceHours
            : DEFAULT_NO_SHOW_GRACE_HOURS,
    noShowRefundPercent:
        typeof refundSettings?.noShowRefundPercent === "number"
            ? refundSettings.noShowRefundPercent
            : 0,
    noShowKeepsDistanceFee:
        refundSettings?.noShowKeepsDistanceFee !== false,
    noShowAutoMark: refundSettings?.noShowAutoMark !== false,
    cancellationPolicy: resolveCancellationPolicy(
        refundSettings?.cancellationPolicy
    ),
});

export const getBookingLocationPolicy =
    async () => {
        const settings =
            await Settings.findOne()
                .lean();

        if (!settings) {
            return {
                allowOnlyDefaultLocation: false,
                enableDistanceFeeCalculation: false,
                penaltySettings: {
                    gracePeriodMinutes: 0,
                    chargingUnit: "Hour",
                    rateType: "derived",
                    customRate: 0,
                    rateMultiplier: 1,
                    maximumCap: 0,
                    autoApply: true,
                },
                driverAssignmentSettings: {
                    requireAdminDriverAssignment: false,
                    motorcycleDriversEnabled: true,
                },
                driverPricingSettings: {
                    mode: "global",
                    globalDailyRate: 0,
                },
                customerBookingSettings: {
                    maxConcurrentBookings: 0,
                    licenseRestrictionEnabled: true,
                },
                validIdRenewalSettings: {
                    maxUploadsPerYear: 1,
                    renewalPeriodYears: 1,
                },
                vehicleRegistrationRenewalSettings: {
                    maxRenewalsPerPeriod: 1,
                    renewalPeriodValue: 1,
                    renewalPeriodUnit: "Year",
                    maxAttempts: 3,
                },
                vehicleRegistrationExpirationSettings: {
                    enabled: false,
                    firstReminderDays: 30,
                    secondReminderDays: 7,
                    thirdReminderDays: 1,
                    notifyOnExpired: false,
                },
                refundSettings: resolveRefundSettings(),
                bookingSettings: resolveBookingSettings(),
                themeSettings: resolveThemeSettings(),
                registrationSettings: resolveRegistrationSettings(),
            };
        }

        const {
            bookingLocationPolicy,
            allowOnlyDefaultLocation,
            enableDistanceFeeCalculation,
            penaltySettings,
            ...rest
        } = settings;

        return {
            ...rest,
            allowOnlyDefaultLocation:
                bookingLocationPolicy?.allowOnlyDefaultLocation ??
                allowOnlyDefaultLocation ??
                false,
            enableDistanceFeeCalculation:
                enableDistanceFeeCalculation ?? false,
            penaltySettings: penaltySettings ?? {
                gracePeriodMinutes: 0,
                chargingUnit: "Hour",
                rateType: "derived",
                customRate: 0,
                rateMultiplier: 1,
                maximumCap: 0,
                autoApply: true,
            },
            customerBookingSettings: settings.customerBookingSettings ?? {
                maxConcurrentBookings: 0,
                licenseRestrictionEnabled: true,
            },
            validIdRenewalSettings: settings.validIdRenewalSettings ?? {
                maxUploadsPerYear: 1,
                renewalPeriodYears: 1,
                maxAttempts: 3,
            },
            validIdExpirationSettings: settings.validIdExpirationSettings ?? {
                enabled: false,
                firstReminderDays: 30,
                secondReminderDays: 7,
                thirdReminderDays: 1,
                notifyOnExpired: false,
            },
            vehicleRegistrationRenewalSettings:
                settings.vehicleRegistrationRenewalSettings ?? {
                    maxRenewalsPerPeriod: 1,
                    renewalPeriodValue: 1,
                    renewalPeriodUnit: "Year",
                    maxAttempts: 3,
                },
            vehicleRegistrationExpirationSettings:
                settings.vehicleRegistrationExpirationSettings ?? {
                    enabled: false,
                    firstReminderDays: 30,
                    secondReminderDays: 7,
                    thirdReminderDays: 1,
                    notifyOnExpired: false,
                },
            refundSettings: resolveRefundSettings(
                settings.refundSettings
            ),
            bookingSettings: resolveBookingSettings(
                settings.bookingSettings
            ),
            themeSettings: resolveThemeSettings(
                settings.themeSettings
            ),
            registrationSettings: resolveRegistrationSettings(
                settings.registrationSettings
            ),
        };
    };

export const updateBookingLocationPolicy =
    async (policyData) => {
        const settings =
            await Settings.findOneAndUpdate(
                {},
                {
                    ...policyData,
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                }
            )
                .lean();

        return settings;
    };
