import {
    SURFACE_TOKENS,
    TEXT_TOKENS,
    BORDER_TOKENS,
    BRAND_TOKENS,
    FEEDBACK_TOKENS,
} from "./designTokens";

export const COLOR_THEMES = Object.freeze({
    SYSTEM: "system",
    LIGHT: "light",
    DARK: "dark",
    // Seasonal, opt-in. Only selectable while the admin-configured window
    // is active (see ThemeProvider / utils/seasonalTheme).
    CHRISTMAS: "christmas",
});

// Mirrors the server default in models/Settings.js: every year, Sep 1
// through Jan 1 (inclusive).
export const DEFAULT_CHRISTMAS_WINDOW = Object.freeze({
    enabled: true,
    startMonth: 9,
    startDay: 1,
    endMonth: 1,
    endDay: 1,
});

// Admin-chosen look of the public/customer navbar (Settings -> Themes &
// Display). Mirrors themeSettings.navbarStyle in models/Settings.js.
export const NAVBAR_STYLES = Object.freeze({
    DEFAULT: "default",
    PILL: "pill",
});

export const isValidNavbarStyle = (value) =>
    Object.values(NAVBAR_STYLES).includes(value);

/*
 * Customer-side vehicle card hover effect (Settings -> Themes & Display).
 * Mirrors themeSettings.cardHoverMode / .cardHoverColor in models/Settings.js.
 * Dark mode only - see styles/vehicle-hover.css.
 */
export const CARD_HOVER_MODES = Object.freeze({
    NEON: "neon",
    SPOTLIGHT: "spotlight",
});

export const CARD_HOVER_COLORS = Object.freeze({
    YELLOW: "yellow",
    BLUE: "blue",
    PURPLE: "purple",
    GREEN: "green",
    RED: "red",
    WHITE: "white",
});

export const isValidCardHoverMode = (value) =>
    Object.values(CARD_HOVER_MODES).includes(value);

export const isValidCardHoverColor = (value) =>
    Object.values(CARD_HOVER_COLORS).includes(value);

export const EXPERIENCES = Object.freeze({
    CLASSIC: "classic",
    CINEMATIC: "cinematic",
    IMMERSIVE: "immersive",
});

export const ACCENTS = Object.freeze({
    BLUE: "blue",
    GREEN: "green",
    GOLD: "gold",
    TEAL: "teal",
});

export const MOTION_MODES = Object.freeze({
    NORMAL: "normal",
    REDUCED: "reduced",
});

export const DENSITY_MODES = Object.freeze({
    COMFORTABLE: "comfortable",
    COMPACT: "compact",
});

export const COLOR_THEME_VALUES = Object.freeze(
    Object.values(COLOR_THEMES)
);

export const EXPERIENCE_VALUES = Object.freeze(
    Object.values(EXPERIENCES)
);

export const ACCENT_VALUES = Object.freeze(
    Object.values(ACCENTS)
);

export const MOTION_MODE_VALUES = Object.freeze(
    Object.values(MOTION_MODES)
);

export const DENSITY_MODE_VALUES = Object.freeze(
    Object.values(DENSITY_MODES)
);

export const LIGHT_THEME = Object.freeze({
    surfaces: {
        [SURFACE_TOKENS.BACKGROUND]: "white",
        [SURFACE_TOKENS.SURFACE]: "gray-50",
        [SURFACE_TOKENS.SURFACE_ELEVATED]: "white",
        [SURFACE_TOKENS.CARD]: "white",
        [SURFACE_TOKENS.OVERLAY]: "white/80",
    },

    text: {
        [TEXT_TOKENS.PRIMARY]: "gray-900",
        [TEXT_TOKENS.SECONDARY]: "gray-700",
        [TEXT_TOKENS.MUTED]: "gray-500",
        [TEXT_TOKENS.INVERSE]: "white",
        [TEXT_TOKENS.DISABLED]: "gray-400",
        [TEXT_TOKENS.LINK]: "primary",
    },

    borders: {
        [BORDER_TOKENS.DEFAULT]: "gray-200",
        [BORDER_TOKENS.SUBTLE]: "gray-100",
        [BORDER_TOKENS.STRONG]: "gray-300",
        [BORDER_TOKENS.FOCUS]: "primary",
    },

    brand: {
        [BRAND_TOKENS.PRIMARY]: "primary",
        [BRAND_TOKENS.SECONDARY]: "secondary",
        [BRAND_TOKENS.ACCENT]: "accent",
    },

    feedback: {
        [FEEDBACK_TOKENS.SUCCESS]: "success",
        [FEEDBACK_TOKENS.WARNING]: "warning",
        [FEEDBACK_TOKENS.DANGER]: "danger",
        [FEEDBACK_TOKENS.INFO]: "info",
    },
});

export const DARK_THEME = Object.freeze({
    surfaces: {
        [SURFACE_TOKENS.BACKGROUND]: "gray-950",
        [SURFACE_TOKENS.SURFACE]: "gray-900",
        [SURFACE_TOKENS.SURFACE_ELEVATED]: "gray-800",
        [SURFACE_TOKENS.CARD]: "gray-900",
        [SURFACE_TOKENS.OVERLAY]: "black/70",
    },

    text: {
        [TEXT_TOKENS.PRIMARY]: "white",
        [TEXT_TOKENS.SECONDARY]: "gray-300",
        [TEXT_TOKENS.MUTED]: "gray-400",
        [TEXT_TOKENS.INVERSE]: "gray-950",
        [TEXT_TOKENS.DISABLED]: "gray-600",
        [TEXT_TOKENS.LINK]: "primary",
    },

    borders: {
        [BORDER_TOKENS.DEFAULT]: "gray-700",
        [BORDER_TOKENS.SUBTLE]: "gray-800",
        [BORDER_TOKENS.STRONG]: "gray-600",
        [BORDER_TOKENS.FOCUS]: "primary",
    },

    brand: {
        [BRAND_TOKENS.PRIMARY]: "primary",
        [BRAND_TOKENS.SECONDARY]: "secondary",
        [BRAND_TOKENS.ACCENT]: "accent",
    },

    feedback: {
        [FEEDBACK_TOKENS.SUCCESS]: "success",
        [FEEDBACK_TOKENS.WARNING]: "warning",
        [FEEDBACK_TOKENS.DANGER]: "danger",
        [FEEDBACK_TOKENS.INFO]: "info",
    },
});

export const DEFAULT_UI_CONFIGURATION = Object.freeze({
    colorTheme: COLOR_THEMES.SYSTEM,
    experience: EXPERIENCES.CLASSIC,
    accent: ACCENTS.BLUE,
    motion: MOTION_MODES.NORMAL,
    density: DENSITY_MODES.COMFORTABLE,
});

export const UI_STORAGE_KEYS = Object.freeze({
    CONFIGURATION: "rent-a-ride-ui",
    // Last Christmas window fetched from the server, kept so the theme can
    // apply on the first paint instead of after the network round trip.
    SEASON_WINDOW: "rent-a-ride-season-window",
    // Same idea for the navbar style, so the pill doesn't flash in late.
    NAVBAR_STYLE: "rent-a-ride-navbar-style",
    // And the hero background video, so a custom one doesn't start as the
    // default and then swap.
    HERO_VIDEO: "rent-a-ride-hero-video",
    // Hero mode (video | image) + custom image URL, for the first paint.
    HERO_MEDIA: "rent-a-ride-hero-media",
    // Featured Fleet image frame on/off, so it's right on the first paint.
    FEATURED_IMAGE_FRAME: "rent-a-ride-featured-image-frame",
    // Vehicle card hover effect (mode + colour), so it's right first paint.
    CARD_HOVER_MODE: "rent-a-ride-card-hover-mode",
    CARD_HOVER_COLOR: "rent-a-ride-card-hover-color",
});

export const isValidColorTheme = (value) =>
    COLOR_THEME_VALUES.includes(value);

export const isValidExperience = (value) =>
    EXPERIENCE_VALUES.includes(value);

export const isValidAccent = (value) =>
    ACCENT_VALUES.includes(value);

export const isValidMotionMode = (value) =>
    MOTION_MODE_VALUES.includes(value);

export const isValidDensityMode = (value) =>
    DENSITY_MODE_VALUES.includes(value);