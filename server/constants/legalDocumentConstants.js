/*
 * Admin-editable legal documents (Settings → Terms & Policies). Each type is
 * versioned: admins edit a draft and publish it as the next numbered
 * version, and a published version never changes afterwards.
 */
export const LEGAL_DOCUMENT_TYPES = Object.freeze({
    // Accepted at booking and registration (customer and partner).
    BOOKING_TERMS: "booking-terms",
    // Accepted in the partner's New Consignment wizard.
    PARTNER_TERMS: "partner-terms",
    // The public /terms page; display only, nobody accepts it.
    TERMS_OF_SERVICE: "terms-of-service",
});

export const LEGAL_DOCUMENT_TYPE_VALUES = Object.values(LEGAL_DOCUMENT_TYPES);

export const LEGAL_DOCUMENT_STATUS = Object.freeze({
    DRAFT: "draft",
    PUBLISHED: "published",
});

/*
 * Live blocks: booking-rule sentences the client builds from the admin's
 * current settings (client utils/termsLiveBlocks.js). Admins place them in
 * a section but can't reword them, so the terms can't contradict what the
 * system enforces. Only the booking terms use them.
 */
export const LEGAL_LIVE_BLOCKS = Object.freeze([
    "pickupTimeRules",
    "turnaroundBuffer",
    "rentalPeriodRules",
    "cancellationPolicy",
    "noShowTiming",
    "cancellationProcess",
    "rescheduling",
    "payment",
    "lateReturn",
    "extensions",
    "lateReturnEffects",
    "earlyReturnCredit",
    "depositRules",
    "fuelRules",
    "licenseRules",
    "authorizedDriverRule",
    "motorcycleAreaRule",
]);

// Section icons, by name (the client maps them to icon components).
export const LEGAL_SECTION_ICONS = Object.freeze([
    "",
    "alert",
    "calendar",
    "car",
    "check",
    "clock",
    "file-check",
    "file-text",
    "fuel",
    "gavel",
    "gift",
    "id-card",
    "lock",
    "map-pin",
    "megaphone",
    "shield",
    "users",
    "wallet",
]);

// "" = always shown.
export const LEGAL_SECTION_CONDITIONS = Object.freeze([
    "",
    // Hidden while Settings → Early Return credit is turned off.
    "earlyReturnEnabled",
]);

/*
 * A customer accepts the version they were shown. If the admin publishes a
 * newer one meanwhile, the one they saw is still accepted for this long
 * after the newer one went live; past that they must review it again.
 */
export const LEGAL_ACCEPTANCE_GRACE_MINUTES = 60;

/*
 * Why an acceptance was refused because a newer version is in force. Each
 * contains "were updated while you were", which the client spots to reload
 * the terms and untick the checkbox (client TERMS_OUTDATED_HINT).
 */
export const TERMS_OUTDATED_MESSAGE =
    "The Terms & Conditions were updated while you were booking. Please review the new version and accept it again.";

export const REGISTRATION_TERMS_OUTDATED_MESSAGE =
    "The Terms & Conditions were updated while you were registering. Please review the new version and accept it again.";

export const PARTNER_TERMS_OUTDATED_MESSAGE =
    "The Partner/Consignment Terms were updated while you were filling in this application. Please review the new version and accept it again.";

export const LEGAL_LIMITS = Object.freeze({
    titleLength: 160,
    introLength: 1500,
    noticeTitleLength: 160,
    noticeBodyLength: 1500,
    highlights: 6,
    highlightLength: 80,
    sections: 60,
    sectionTitleLength: 160,
    items: 40,
    itemLength: 3000,
    acceptanceLength: 1000,
    changeNoteLength: 500,
});
