import {
    SURFACE_TOKENS,
    TEXT_TOKENS,
    BORDER_TOKENS,
    BRAND_TOKENS,
    FEEDBACK_TOKENS,
} from "./designTokens";

export const COLOR_THEMES = Object.freeze({
    SYSTEM: "system",
    DARK: "dark",
});

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