import {
    AlertCircle,
    CalendarClock,
    Car,
    CheckCircle2,
    Clock,
    FileCheck2,
    FileText,
    Fuel,
    Gavel,
    Gift,
    IdCard,
    Lock,
    MapPin,
    Megaphone,
    ShieldCheck,
    Users,
    WalletCards,
} from "lucide-react";

/* Mirrors server constants/legalDocumentConstants.js. */
export const LEGAL_DOCUMENT_TYPES = Object.freeze({
    BOOKING_TERMS: "booking-terms",
    PARTNER_TERMS: "partner-terms",
    TERMS_OF_SERVICE: "terms-of-service",
});

/*
 * Every "this version is too old to accept" message from the server
 * contains this, so screens can reload the terms and untick the box.
 */
export const TERMS_OUTDATED_HINT = "were updated while you were";

export const isTermsOutdatedError = (message) =>
    typeof message === "string" && message.includes(TERMS_OUTDATED_HINT);

// Section icons by the name stored on the document ("" = none).
export const LEGAL_SECTION_ICONS = Object.freeze({
    alert: { label: "Warning", icon: AlertCircle },
    calendar: { label: "Calendar", icon: CalendarClock },
    car: { label: "Car", icon: Car },
    check: { label: "Check", icon: CheckCircle2 },
    clock: { label: "Clock", icon: Clock },
    "file-check": { label: "Document", icon: FileCheck2 },
    "file-text": { label: "Text", icon: FileText },
    fuel: { label: "Fuel", icon: Fuel },
    gavel: { label: "Gavel", icon: Gavel },
    gift: { label: "Gift", icon: Gift },
    "id-card": { label: "ID card", icon: IdCard },
    lock: { label: "Lock", icon: Lock },
    "map-pin": { label: "Map pin", icon: MapPin },
    megaphone: { label: "Megaphone", icon: Megaphone },
    shield: { label: "Shield", icon: ShieldCheck },
    users: { label: "People", icon: Users },
    wallet: { label: "Wallet", icon: WalletCards },
});

export const getLegalSectionIcon = (name, fallback = FileText) =>
    LEGAL_SECTION_ICONS[name]?.icon ?? fallback;

export const LEGAL_SECTION_CONDITIONS = Object.freeze({
    earlyReturnEnabled: "Only while Early Return Credit is turned on",
});

/*
 * What each document's editor offers, and what the page that shows it
 * renders. Only the booking terms use live blocks, highlights and
 * conditions; the Terms of Service has nothing to accept.
 */
export const LEGAL_DOCUMENT_CONFIG = Object.freeze({
    [LEGAL_DOCUMENT_TYPES.BOOKING_TERMS]: {
        label: "Booking Terms & Conditions",
        shortLabel: "Booking T&C",
        description:
            "Accepted by customers when they book, and by customers and partners when they register. Each booking keeps the version its customer accepted.",
        liveBlocks: true,
        highlights: true,
        conditions: true,
        icons: true,
        acceptance: true,
        intro: true,
        noticeTitle: true,
    },
    [LEGAL_DOCUMENT_TYPES.PARTNER_TERMS]: {
        label: "Partner/Consignment Terms",
        shortLabel: "Partner Terms",
        description:
            "Accepted by partners when they submit a vehicle for consignment. Each application keeps the version that was accepted.",
        liveBlocks: false,
        highlights: false,
        conditions: false,
        icons: true,
        acceptance: true,
        intro: false,
        noticeTitle: false,
    },
    [LEGAL_DOCUMENT_TYPES.TERMS_OF_SERVICE]: {
        label: "Terms of Service",
        shortLabel: "Terms of Service",
        description:
            "The general platform terms on the public Terms page (/terms). Nobody ticks a box for these.",
        liveBlocks: false,
        highlights: false,
        conditions: false,
        icons: false,
        acceptance: false,
        intro: true,
        noticeTitle: true,
    },
});
