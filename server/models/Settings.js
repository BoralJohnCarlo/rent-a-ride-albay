import mongoose from "mongoose";

import {
    DEFAULT_TURNAROUND_BUFFER_MINUTES,
    MIN_TURNAROUND_BUFFER_MINUTES,
    MAX_TURNAROUND_BUFFER_MINUTES,
    DEFAULT_BOOKING_HOURS,
    DEFAULT_PICKUP_HOURS,
} from "../constants/bookingConstants.js";

const settingsSchema = new mongoose.Schema(
    {
        allowOnlyDefaultLocation: {
            type: Boolean,
            default: false,
        },
        enableDistanceFeeCalculation: {
            type: Boolean,
            default: false,
        },

        penaltySettings: {
            gracePeriodMinutes: {
                type: Number,
                default: 0,
                min: 0,
            },

            chargingUnit: {
                type: String,
                enum: ["Hour", "Day"],
                default: "Hour",
            },

            rateType: {
                type: String,
                enum: ["derived", "custom", "multiplier"],
                default: "derived",
            },

            customRate: {
                type: Number,
                default: 0,
                min: 0,
            },

            rateMultiplier: {
                type: Number,
                default: 1,
                min: 0,
            },

            maximumCap: {
                type: Number,
                default: 0,
                min: 0,
            },

            autoApply: {
                type: Boolean,
                default: true,
            },
        },

        refundSettings: {
            gracePeriodHours: {
                type: Number,
                default: 24,
                min: 0,
                max: 72,
            },

            autoApproveRefundThreshold: {
                type: Number,
                default: 500,
                min: 0,
            },

            requireCancellationReason: {
                type: Boolean,
                default: true,
            },

            // Hours after the booked pickup time before an admin can mark
            // an Approved booking as a no-show.
            noShowGraceHours: {
                type: Number,
                default: 4,
                min: 0,
                max: 16,
            },

            // How much of the reservation fee a no-show gets back (0–100).
            noShowRefundPercent: {
                type: Number,
                default: 0,
                min: 0,
                max: 100,
            },

            // Whether a no-show keeps the pickup distance fee (else refunded).
            noShowKeepsDistanceFee: {
                type: Boolean,
                default: true,
            },

            // Off: the hourly sweep never marks no-shows — admins do, and
            // are alerted once when a booking reaches the automatic cutoff.
            noShowAutoMark: {
                type: Boolean,
                default: true,
            },

            /*
             * How much of the reservation fee a customer gets back when they
             * cancel before pickup (anything paid on top of the fee is always
             * refunded; admin-initiated cancellations always refund in full).
             * Documents saved before this existed simply lack the key — read
             * it through resolveCancellationPolicy, never directly.
             */
            cancellationPolicy: {
                // Before an admin approves the booking nothing has been
                // committed to the customer, so the fee is refunded in full.
                fullRefundBeforeApproval: {
                    type: Boolean,
                    default: true,
                },

                // Cooling-off after approval: a full refund within this many
                // hours of approval, as long as pickup is still at least
                // approvalGraceMinLeadHours away. 0 disables it.
                approvalGraceHours: {
                    type: Number,
                    default: 12,
                    min: 0,
                    max: 168,
                },

                approvalGraceMinLeadHours: {
                    type: Number,
                    default: 24,
                    min: 0,
                    max: 720,
                },

                // Cancelling at least `hoursBefore` hours before pickup
                // refunds `refundPercent`% of the reservation fee; below the
                // smallest tier nothing is refunded.
                tiers: {
                    type: [
                        new mongoose.Schema(
                            {
                                hoursBefore: {
                                    type: Number,
                                    required: true,
                                    min: 1,
                                    max: 720,
                                },
                                refundPercent: {
                                    type: Number,
                                    required: true,
                                    min: 0,
                                    max: 100,
                                },
                            },
                            { _id: false }
                        ),
                    ],
                    default: () => [
                        { hoursBefore: 48, refundPercent: 100 },
                        { hoursBefore: 24, refundPercent: 50 },
                    ],
                },
            },
        },

        earlyReturnSettings: {
            enabled: {
                type: Boolean,
                default: true,
            },

            autoApprove: {
                type: Boolean,
                default: false,
            },

            voucherValidityMonths: {
                type: Number,
                default: 12,
                min: 6,
                max: 12,
            },

            minUnusedDaysToQualify: {
                type: Number,
                default: 1,
                min: 1,
            },
        },

        commissionSettings: {
            /*
             * No platform-wide mode anymore — this rate is always the
             * default/fallback commission. Whether a specific vehicle
             * uses it or its own individually-negotiated rate is decided
             * per-vehicle at consignment approval time (see
             * approveConsignment), not by a global switch here.
             */
            platformCommissionRate: {
                type: Number,
                default: 10,
                min: 0,
                max: 100,
            },
            payoutCurrency: {
                type: String,
                default: "PHP",
                trim: true,
            },
            payoutHoldHours: {
                type: Number,
                default: 24,
                min: 0,
            },
        },

        /*
         * Settings → Bookings. Read through resolveBookingSettings: lean
         * documents skip these defaults and older documents lack the key.
         */
        bookingSettings: {
            // Minimum gap between a vehicle's (or driver's) due-back time
            // and its next pickup, for cleaning and inspection.
            turnaroundBufferMinutes: {
                type: Number,
                default: DEFAULT_TURNAROUND_BUFFER_MINUTES,
                min: MIN_TURNAROUND_BUFFER_MINUTES,
                max: MAX_TURNAROUND_BUFFER_MINUTES,
            },

            // When staff approve bookings; the minimum notice for a new
            // booking only counts inside them (see utils/bookingHours.js).
            bookingHours: {
                enabled: {
                    type: Boolean,
                    default: DEFAULT_BOOKING_HOURS.enabled,
                },
                openTime: {
                    type: String,
                    default: DEFAULT_BOOKING_HOURS.openTime,
                },
                closeTime: {
                    type: String,
                    default: DEFAULT_BOOKING_HOURS.closeTime,
                },
            },

            // First and last pickup time customers can choose ("HH:mm"
            // Manila, 30-minute steps; see utils/bookingHours.js).
            pickupHours: {
                earliestTime: {
                    type: String,
                    default: DEFAULT_PICKUP_HOURS.earliestTime,
                },
                latestTime: {
                    type: String,
                    default: DEFAULT_PICKUP_HOURS.latestTime,
                },
            },

            /*
             * How customers see a vehicle that's off road (maintenance with
             * no end date; see utils/vehicleMaintenance.js). The defaults
             * are what customers saw before these settings existed.
             */
            offRoadVehicles: {
                // Off: left out of the public listings entirely.
                showInListings: {
                    type: Boolean,
                    default: true,
                },
                // Off: no "temporarily off the road" notice - customers only
                // see that its dates are blocked.
                showNotice: {
                    type: Boolean,
                    default: true,
                },
            },

            /*
             * Lets an admin release a vehicle earlier than the usual window
             * (BOOKING_EARLY_PICKUP_MAX_HOURS before the booked pickup), for
             * testing or a genuine early hand-over. Each such pickup still
             * has to be confirmed as early, and is refused if the moved-up
             * rental would touch anything else (see createRental).
             */
            earlyPickup: {
                allowAnytime: {
                    type: Boolean,
                    default: false,
                },
            },
        },

        driverAssignmentSettings: {
            requireAdminDriverAssignment: {
                type: Boolean,
                default: false,
            },

            /*
             * Off: motorcycles are self-drive only — the booking form offers
             * no driver for them and the server refuses "With Driver".
             * Bookings already made with a driver are kept. A missing value
             * (older settings, or a page that saved this section without
             * it) counts as on.
             */
            motorcycleDriversEnabled: {
                type: Boolean,
                default: true,
            },
        },

        /*
         * What a "With Driver" booking pays for the driver, per rental day,
         * on top of the vehicle. "global": every driver costs
         * `globalDailyRate`. "individual": each driver's own
         * `Driver.pricing.dailyRate` (falling back to the global rate when a
         * driver has none, and always the global rate while admins assign
         * drivers, since the customer can't know who they'll get). The
         * default (global, 0) is the free driver bookings had before.
         */
        driverPricingSettings: {
            mode: {
                type: String,
                enum: ["global", "individual"],
                default: "global",
            },
            globalDailyRate: {
                type: Number,
                default: 0,
                min: 0,
            },
        },

        customerBookingSettings: {
            /*
             * 0 means "no limit" - a customer may hold as many overlapping
             * bookings as they like, matching current (pre-feature) behavior
             * until an admin opts into a cap.
             */
            maxConcurrentBookings: {
                type: Number,
                default: 0,
                min: 0,
            },

            /*
             * When false, customers are no longer required to declare what
             * they can drive (licenseCodes) or their transmission
             * capability at registration, and booking creation skips the
             * drivability gate entirely. Defaults to true so a fresh
             * deployment matches the always-on behavior this setting is
             * replacing.
             */
            licenseRestrictionEnabled: {
                type: Boolean,
                default: true,
            },
        },

        registrationSettings: {
            /*
             * Whether customer and partner registration asks for (and
             * requires) a proof of billing address image. Turning it off
             * only hides the field - existing images are kept, and nothing
             * else (booking included) ever depends on having one.
             */
            proofOfBillingEnabled: {
                type: Boolean,
                default: true,
            },
        },

        validIdRenewalSettings: {
            maxUploadsPerYear: {
                type: Number,
                default: 1,
                min: 1,
            },
            renewalPeriodYears: {
                type: Number,
                default: 1,
                min: 1,
                max: 5,
            },
            maxAttempts: {
                type: Number,
                default: 3,
                min: 1,
            },
        },

        validIdExpirationSettings: {
            enabled: {
                type: Boolean,
                default: false,
            },
            firstReminderDays: {
                type: Number,
                default: 30,
                min: 1,
                max: 365,
            },
            secondReminderDays: {
                type: Number,
                default: 7,
                min: 1,
                max: 365,
            },
            thirdReminderDays: {
                type: Number,
                default: 1,
                min: 1,
                max: 365,
            },
            notifyOnExpired: {
                type: Boolean,
                default: false,
            },
        },

        vehicleRegistrationRenewalSettings: {
            maxRenewalsPerPeriod: {
                type: Number,
                default: 1,
                min: 1,
            },
            renewalPeriodValue: {
                type: Number,
                default: 1,
                min: 1,
            },
            renewalPeriodUnit: {
                type: String,
                enum: ["Month", "Year"],
                default: "Year",
            },
            maxAttempts: {
                type: Number,
                default: 3,
                min: 1,
            },
        },

        vehicleRegistrationExpirationSettings: {
            enabled: {
                type: Boolean,
                default: false,
            },
            firstReminderDays: {
                type: Number,
                default: 30,
                min: 1,
                max: 365,
            },
            secondReminderDays: {
                type: Number,
                default: 7,
                min: 1,
                max: 365,
            },
            thirdReminderDays: {
                type: Number,
                default: 1,
                min: 1,
                max: 365,
            },
            notifyOnExpired: {
                type: Boolean,
                default: false,
            },
        },

        themeSettings: {
            /*
             * Seasonal window for the opt-in Christmas theme. Month/day
             * only (no year) - the window repeats every year, and one that
             * ends before it starts (default Sep 1 -> Jan 1) wraps the new
             * year. Both ends are inclusive.
             */
            christmas: {
                enabled: {
                    type: Boolean,
                    default: true,
                },
                startMonth: {
                    type: Number,
                    default: 9,
                    min: 1,
                    max: 12,
                },
                startDay: {
                    type: Number,
                    default: 1,
                    min: 1,
                    max: 31,
                },
                endMonth: {
                    type: Number,
                    default: 1,
                    min: 1,
                    max: 12,
                },
                endDay: {
                    type: Number,
                    default: 1,
                    min: 1,
                    max: 31,
                },
            },

            /*
             * Look of the public/customer navbar. "default" is the original
             * full-width bar; "pill" is a floating rounded capsule. Kept as
             * a string (not a boolean) so more styles can be added later.
             */
            navbarStyle: {
                type: String,
                enum: ["default", "pill"],
                default: "default",
            },
            buttonColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: "#2563eb" },
            buttonHoverColor: { type: String, match: /^#[0-9a-f]{6}$/i, default: "#1d4ed8" },

            /*
             * Home page Featured Fleet: show the glass frame around the
             * vehicle photo. On → frame shown, the faint model-name
             * watermark behind it hidden. Off → frame invisible (its space
             * kept) and the watermark shown instead.
             */
            featuredImageFrame: {
                type: Boolean,
                default: true,
            },

            /*
             * Customer-side vehicle card hover effect, dark mode only.
             * "neon" travels a thin light around the card's edge; "spotlight"
             * is a glow that follows the cursor. `cardHoverColor` tints
             * whichever mode is active.
             */
            cardHoverMode: {
                type: String,
                enum: ["neon", "spotlight"],
                default: "neon",
            },
            cardHoverColor: {
                type: String,
                enum: ["yellow", "blue", "purple", "green", "red", "white"],
                default: "yellow",
            },

            /*
             * Background video of the public/customer home hero. `url: null`
             * means the bundled default video. Only ever written by the
             * upload / reset endpoints (never from the generic settings
             * PUT), so it always points at an asset we uploaded.
             */
            /*
             * What the home hero shows behind its content: the background
             * video, or a still image. Each has its own upload + bundled
             * default, kept even while the other one is in use.
             */
            heroMediaType: {
                type: String,
                enum: ["video", "image"],
                default: "video",
            },

            /* Same shape and rules as heroVideo (url: null → bundled default). */
            heroImage: {
                url: {
                    type: String,
                    default: null,
                },
                publicId: {
                    type: String,
                    default: null,
                },
                originalName: {
                    type: String,
                    default: null,
                },
                uploadedAt: {
                    type: Date,
                    default: null,
                },
            },

            heroVideo: {
                url: {
                    type: String,
                    default: null,
                },
                publicId: {
                    type: String,
                    default: null,
                },
                originalName: {
                    type: String,
                    default: null,
                },
                uploadedAt: {
                    type: Date,
                    default: null,
                },
            },
        },

        /*
         * One-time starter-content markers. Once set, the defaults are never
         * inserted again — so an admin who deletes them all gets an empty
         * list, not the defaults back.
         */
        seededContent: {
            destinations: {
                type: Boolean,
                default: false,
            },
        },
    },
    {
        timestamps: true,
    }
);

const Settings = mongoose.model(
    "Settings",
    settingsSchema
);

export default Settings;
