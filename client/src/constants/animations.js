// ======================================================
// Generic Springs
// ======================================================

export const DEFAULT_SPRING = {
    type: "spring",
    stiffness: 300,
    damping: 28,
};

export const FAST_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 34,
};

export const SLOW_SPRING = {
    type: "spring",
    stiffness: 240,
    damping: 26,
};

// ======================================================
// Sidebar
// ======================================================

export const SIDEBAR_SPRING = {
    type: "spring",
    stiffness: 280,
    damping: 24,
};

export const SIDEBAR_ITEM_SPRING = {
    type: "spring",
    stiffness: 350,
    damping: 22,
};

export const SIDEBAR_ICON_SPRING = {
    type: "spring",
    stiffness: 450,
    damping: 18,
};

export const ACTIVE_PILL_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 34,
};

export const BUTTON_SPRING = {
    type: "spring",
    stiffness: 450,
    damping: 24,
};

// ======================================================
// Logo
// ======================================================

export const LOGO_LAYOUT_SPRING = {
    type: "spring",
    stiffness: 350,
    damping: 26,
};

export const LOGO_ICON_SPRING = {
    type: "spring",
    stiffness: 400,
    damping: 18,
};

export const LABEL_TRANSITION = {
    duration: 0.2,
};

export const LOGO_TEXT_TRANSITION = {
    duration: 0.22,
};

export const LOGO_TITLE_TRANSITION = {
    delay: 0.05,
};

export const LOGO_SUBTITLE_TRANSITION = {
    delay: 0.1,
};

// ======================================================
// Tooltip
// ======================================================

export const TOOLTIP_TRANSITION = {
    duration: 0.16,
};

export const TOOLTIP_ANIMATION = {
    initial: (side) => ({
        opacity: 0,
        scale: 0.96,
        x: side === "right" ? -6 : 0,
    }),
    animate: {
        opacity: 1,
        scale: 1,
        x: 0,
    },
    exit: (side) => ({
        opacity: 0,
        scale: 0.96,
        x: side === "right" ? -6 : 0,
    }),
};

// ======================================================
// Layout
// ======================================================

export const LAYOUT_TRANSITION = {
    layout: {
        type: "spring",
        stiffness: 260,
        damping: 28,
    },
};

// ======================================================
// Page
// ======================================================

export const PAGE_VARIANTS = {
    initial: {
        opacity: 0,
        y: 12,
    },
    animate: {
        opacity: 1,
        y: 0,
    },
    exit: {
        opacity: 0,
        y: -8,
    },
};

export const PAGE_TRANSITION = {
    type: "spring",
    stiffness: 280,
    damping: 28,
};

// ======================================================
// Generic Motion Variants
// ======================================================

export const FADE_LEFT = {
    initial: {
        opacity: 0,
        x: -12,
    },
    animate: {
        opacity: 1,
        x: 0,
    },
    exit: {
        opacity: 0,
        x: -12,
    },
};

export const SCALE_IN = {
    initial: {
        opacity: 0,
        scale: 0.96,
    },
    animate: {
        opacity: 1,
        scale: 1,
    },
    exit: {
        opacity: 0,
        scale: 0.96,
    },
};