export const CARD_LAYOUT_TRANSITION = {
    type: "spring",
    stiffness: 340,
    damping: 30,
    mass: 0.8,
};

export const CARD_HOVER_TRANSITION = {
    duration: 0.28,
    ease: "easeOut",
};

export const CARD_FADE_UP = {
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
        y: 12,
    },
    transition: {
        duration: 0.25,
        ease: "easeOut",
    },
};

export const STAGGER_CONTAINER = {
    animate: {
        transition: {
            staggerChildren: 0.05,
        },
    },
};

export const STAGGER_ITEM = {
    initial: {
        opacity: 0,
        y: 8,
    },
    animate: {
        opacity: 1,
        y: 0,
    },
    transition: {
        duration: 0.22,
        ease: "easeOut",
    },
};

export const COLLAPSE_TRANSITION = {
    duration: 0.28,
    ease: "easeInOut",
};