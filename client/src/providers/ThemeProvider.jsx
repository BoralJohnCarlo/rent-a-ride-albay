import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useState,
} from "react";

import ThemeContext from "../context/ThemeContext";
import { buttonThemeStyle, resolveButtonColors } from "../utils/dashboardButtonTheme";

import SnowfallOverlay from "../components/theme/SnowfallOverlay";

import { fetchPublicSettings } from "../services/settingsService";

import {
    isChristmasAvailable as computeChristmasAvailable,
    normalizeChristmasWindow,
} from "../utils/seasonalTheme";

import {
    DEFAULT_UI_CONFIGURATION,
    UI_STORAGE_KEYS,
    COLOR_THEMES,
    NAVBAR_STYLES,
    CARD_HOVER_MODES,
    CARD_HOVER_COLORS,
    isValidColorTheme,
    isValidNavbarStyle,
    isValidCardHoverMode,
    isValidCardHoverColor,
} from "../config/theme";

const ACTIONS = Object.freeze({
    INITIALIZE: "INITIALIZE",
    RESET: "RESET",
    SET_COLOR_THEME: "SET_COLOR_THEME",
    SET_EXPERIENCE: "SET_EXPERIENCE",
    SET_ACCENT: "SET_ACCENT",
    SET_MOTION: "SET_MOTION",
    SET_DENSITY: "SET_DENSITY",
});

const normalizeConfiguration = (configuration) => {
    const merged = {
        ...DEFAULT_UI_CONFIGURATION,
        ...configuration,
    };

    // A stale or corrupted stored value must never leave the app with an
    // unknown theme.
    if (!isValidColorTheme(merged.colorTheme)) {
        merged.colorTheme =
            DEFAULT_UI_CONFIGURATION.colorTheme;
    }

    return merged;
};

const readCachedSeasonWindow = () => {
    try {
        const cached = localStorage.getItem(
            UI_STORAGE_KEYS.SEASON_WINDOW
        );

        return cached
            ? normalizeChristmasWindow(JSON.parse(cached))
            : normalizeChristmasWindow();
    } catch {
        return normalizeChristmasWindow();
    }
};

const readCachedNavbarStyle = () => {
    try {
        const cached = localStorage.getItem(
            UI_STORAGE_KEYS.NAVBAR_STYLE
        );

        return isValidNavbarStyle(cached)
            ? cached
            : NAVBAR_STYLES.DEFAULT;
    } catch {
        return NAVBAR_STYLES.DEFAULT;
    }
};

/*
 * Last known hero video URL: a string (custom upload), null (the bundled
 * default) or undefined (never fetched on this device — the hero waits for
 * the settings response rather than flashing the default first).
 */
const readCachedHeroVideoUrl = () => {
    try {
        const cached = localStorage.getItem(
            UI_STORAGE_KEYS.HERO_VIDEO
        );

        if (cached === null) {
            return undefined;
        }

        const parsed = JSON.parse(cached);

        return typeof parsed?.url === "string" ? parsed.url : null;
    } catch {
        return undefined;
    }
};

/*
 * Last known hero mode + custom image: { type: "video" | "image", imageUrl }
 * or undefined when never fetched on this device (the hero then waits for
 * the settings instead of flashing the wrong background).
 */
const readCachedHeroMedia = () => {
    try {
        const cached = localStorage.getItem(UI_STORAGE_KEYS.HERO_MEDIA);
        if (cached === null) return undefined;

        const parsed = JSON.parse(cached);

        return {
            type: parsed?.type === "image" ? "image" : "video",
            imageUrl:
                typeof parsed?.imageUrl === "string" ? parsed.imageUrl : null,
        };
    } catch {
        return undefined;
    }
};

/* Featured Fleet glass frame: on unless the admin turned it off. */
const readCachedFeaturedImageFrame = () => {
    try {
        return (
            localStorage.getItem(UI_STORAGE_KEYS.FEATURED_IMAGE_FRAME) !==
            "false"
        );
    } catch {
        return true;
    }
};

const readCachedCardHoverMode = () => {
    try {
        const cached = localStorage.getItem(
            UI_STORAGE_KEYS.CARD_HOVER_MODE
        );

        return isValidCardHoverMode(cached)
            ? cached
            : CARD_HOVER_MODES.NEON;
    } catch {
        return CARD_HOVER_MODES.NEON;
    }
};

const readCachedCardHoverColor = () => {
    try {
        const cached = localStorage.getItem(
            UI_STORAGE_KEYS.CARD_HOVER_COLOR
        );

        return isValidCardHoverColor(cached)
            ? cached
            : CARD_HOVER_COLORS.YELLOW;
    } catch {
        return CARD_HOVER_COLORS.YELLOW;
    }
};

const themeReducer = (state, action) => {
    switch (action.type) {
        case ACTIONS.INITIALIZE:
            return normalizeConfiguration(
                action.payload
            );

        case ACTIONS.SET_COLOR_THEME:
            if (!isValidColorTheme(action.payload)) {
                return state;
            }

            return {
                ...state,
                colorTheme: action.payload,
            };

        case ACTIONS.SET_EXPERIENCE:
            return {
                ...state,
                experience: action.payload,
            };

        case ACTIONS.SET_ACCENT:
            return {
                ...state,
                accent: action.payload,
            };

        case ACTIONS.SET_MOTION:
            return {
                ...state,
                motion: action.payload,
            };

        case ACTIONS.SET_DENSITY:
            return {
                ...state,
                density: action.payload,
            };

        case ACTIONS.RESET:
            return normalizeConfiguration(
                DEFAULT_UI_CONFIGURATION
            );

        default:
            return state;
    }
};

const getSystemTheme = () => {
    if (
        typeof window === "undefined" ||
        !window.matchMedia
    ) {
        return COLOR_THEMES.LIGHT;
    }

    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches
        ? COLOR_THEMES.DARK
        : COLOR_THEMES.LIGHT;
};

const ThemeProvider = ({ children }) => {
    const [state, dispatch] = useReducer(
        themeReducer,
        DEFAULT_UI_CONFIGURATION
    );

    const [initialized, setInitialized] =
        useState(false);

    const [seasonWindow, setSeasonWindow] =
        useState(readCachedSeasonWindow);

    const [navbarStyle, setNavbarStyle] =
        useState(readCachedNavbarStyle);

    const [heroVideoUrl, setHeroVideoUrl] =
        useState(readCachedHeroVideoUrl);

    const [showFeaturedImageFrame, setShowFeaturedImageFrame] =
        useState(readCachedFeaturedImageFrame);

    const [cardHoverMode, setCardHoverMode] =
        useState(readCachedCardHoverMode);

    const [cardHoverColor, setCardHoverColor] =
        useState(readCachedCardHoverColor);

    const [heroMedia, setHeroMedia] = useState(readCachedHeroMedia);
    const [buttonColors, setButtonColors] = useState(() => {
        try {
            return resolveButtonColors(JSON.parse(localStorage.getItem("rent-a-ride-dashboard-buttons")));
        } catch {
            return resolveButtonColors();
        }
    });

    useEffect(() => {
        for (const [key, value] of Object.entries(buttonThemeStyle(buttonColors))) {
            document.documentElement.style.setProperty(key, value);
        }
    }, [buttonColors]);

    // Pulls every admin-controlled theme setting (Christmas window + navbar
    // style) from the public settings endpoint.
    const refreshSeasonConfig = useCallback(async () => {
        try {
            const response = await fetchPublicSettings();

            const themeSettings = response?.data?.themeSettings;
            if (themeSettings) {
                const nextButtonColors = resolveButtonColors(themeSettings);
                setButtonColors(nextButtonColors);
                try {
                    localStorage.setItem("rent-a-ride-dashboard-buttons", JSON.stringify(nextButtonColors));
                } catch { /* The saved server setting still applies when storage is unavailable. */ }
            }

            if (!themeSettings) {
                setHeroVideoUrl((current) =>
                    current === undefined ? null : current
                );
                setHeroMedia((current) =>
                    current ?? { type: "video", imageUrl: null }
                );

                return;
            }

            const nextHeroMedia = {
                type:
                    themeSettings.heroMediaType === "image"
                        ? "image"
                        : "video",
                imageUrl: themeSettings.heroImage?.url || null,
            };

            setHeroMedia(nextHeroMedia);

            localStorage.setItem(
                UI_STORAGE_KEYS.HERO_MEDIA,
                JSON.stringify(nextHeroMedia)
            );

            const nextFeaturedImageFrame =
                themeSettings.featuredImageFrame !== false;

            setShowFeaturedImageFrame(nextFeaturedImageFrame);

            localStorage.setItem(
                UI_STORAGE_KEYS.FEATURED_IMAGE_FRAME,
                String(nextFeaturedImageFrame)
            );

            const nextHeroVideoUrl =
                themeSettings.heroVideo?.url || null;

            setHeroVideoUrl(nextHeroVideoUrl);

            localStorage.setItem(
                UI_STORAGE_KEYS.HERO_VIDEO,
                JSON.stringify({ url: nextHeroVideoUrl })
            );

            if (themeSettings.christmas) {
                const next = normalizeChristmasWindow(
                    themeSettings.christmas
                );

                setSeasonWindow(next);

                localStorage.setItem(
                    UI_STORAGE_KEYS.SEASON_WINDOW,
                    JSON.stringify(next)
                );
            }

            const nextNavbarStyle = isValidNavbarStyle(
                themeSettings.navbarStyle
            )
                ? themeSettings.navbarStyle
                : NAVBAR_STYLES.DEFAULT;

            setNavbarStyle(nextNavbarStyle);

            localStorage.setItem(
                UI_STORAGE_KEYS.NAVBAR_STYLE,
                nextNavbarStyle
            );

            const nextCardHoverMode = isValidCardHoverMode(
                themeSettings.cardHoverMode
            )
                ? themeSettings.cardHoverMode
                : CARD_HOVER_MODES.NEON;

            setCardHoverMode(nextCardHoverMode);

            localStorage.setItem(
                UI_STORAGE_KEYS.CARD_HOVER_MODE,
                nextCardHoverMode
            );

            const nextCardHoverColor = isValidCardHoverColor(
                themeSettings.cardHoverColor
            )
                ? themeSettings.cardHoverColor
                : CARD_HOVER_COLORS.YELLOW;

            setCardHoverColor(nextCardHoverColor);

            localStorage.setItem(
                UI_STORAGE_KEYS.CARD_HOVER_COLOR,
                nextCardHoverColor
            );
        } catch {
            // Keep the cached/default window - the theme is decorative and
            // must never get in the way of the app loading. An unknown hero
            // video falls back to the default instead of staying blank.
            setHeroVideoUrl((current) =>
                current === undefined ? null : current
            );
            setHeroMedia((current) =>
                current ?? { type: "video", imageUrl: null }
            );
        }
    }, []);

    useEffect(() => {
        void refreshSeasonConfig();
        const refreshOnFocus = () => { void refreshSeasonConfig(); };
        window.addEventListener("focus", refreshOnFocus);
        return () => window.removeEventListener("focus", refreshOnFocus);
    }, [refreshSeasonConfig]);

    const christmasAvailable = useMemo(
        () => computeChristmasAvailable(seasonWindow),
        [seasonWindow]
    );

    // A stored "christmas" choice quietly acts as "system" while the
    // window is closed. The stored value itself is left alone so it
    // applies again next season without the user re-picking it.
    const effectiveColorTheme =
        state.colorTheme === COLOR_THEMES.CHRISTMAS &&
        !christmasAvailable
            ? COLOR_THEMES.SYSTEM
            : state.colorTheme;

    useEffect(() => {
        const stored = localStorage.getItem(
            UI_STORAGE_KEYS.CONFIGURATION
        );

        if (stored) {
            try {
                dispatch({
                    type: ACTIONS.INITIALIZE,
                    payload: JSON.parse(stored),
                });
            } catch {
                localStorage.removeItem(
                    UI_STORAGE_KEYS.CONFIGURATION
                );
            }
        }

        setInitialized(true);
    }, []);

    useEffect(() => {
        if (!initialized) {
            return;
        }

        localStorage.setItem(
            UI_STORAGE_KEYS.CONFIGURATION,
            JSON.stringify(state)
        );
    }, [state, initialized]);

    useEffect(() => {
        const root = document.documentElement;

        // Christmas is a layer over the OS light/dark mode, not a palette of
        // its own, so it resolves data-theme exactly like "system" does and
        // every existing `dark:` style keeps working underneath it.
        const followsSystem =
            effectiveColorTheme === COLOR_THEMES.SYSTEM ||
            effectiveColorTheme === COLOR_THEMES.CHRISTMAS;

        const applyTheme = () => {
            root.dataset.theme = followsSystem
                ? getSystemTheme()
                : effectiveColorTheme;
        };

        applyTheme();

        if (
            effectiveColorTheme ===
            COLOR_THEMES.CHRISTMAS
        ) {
            root.dataset.season = "christmas";
        } else {
            delete root.dataset.season;
        }

        if (!followsSystem || !window.matchMedia) {
            return;
        }

        const mediaQuery = window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

        const handleSystemThemeChange = () => {
            applyTheme();
        };

        mediaQuery.addEventListener(
            "change",
            handleSystemThemeChange
        );

        return () => {
            mediaQuery.removeEventListener(
                "change",
                handleSystemThemeChange
            );
        };
    }, [effectiveColorTheme]);

    useEffect(() => {
        const root = document.documentElement;

        root.dataset.experience =
            state.experience;

        root.dataset.accent =
            state.accent;

        root.dataset.motion =
            state.motion;

        root.dataset.density =
            state.density;
    }, [
        state.experience,
        state.accent,
        state.motion,
        state.density,
    ]);

    // Customer-side vehicle card hover effect (styles/vehicle-hover.css
    // reads these off the root alongside data-theme).
    useEffect(() => {
        const root = document.documentElement;

        root.dataset.hoverMode = cardHoverMode;
        root.dataset.hoverColor = cardHoverColor;
    }, [cardHoverMode, cardHoverColor]);

    const value = useMemo(
        () => ({
            // Consumers see the *effective* colorTheme, so a lapsed
            // "christmas" choice reads as "system" everywhere at once.
            configuration: {
                ...state,
                colorTheme: effectiveColorTheme,
            },

            isChristmasAvailable: christmasAvailable,

            navbarStyle,

            isPillNavbar: navbarStyle === NAVBAR_STYLES.PILL,

            // Custom hero video URL, null for the default, undefined while
            // not yet known on this device.
            heroVideoUrl,

            // Featured Fleet: glass frame around the vehicle photo.
            showFeaturedImageFrame,

            // Customer-side vehicle card hover effect: "neon" | "spotlight",
            // tinted by cardHoverColor.
            cardHoverMode,
            cardHoverColor,

            // Home hero background: "video" | "image" (undefined while not
            // yet known on this device), and the custom image URL (null →
            // bundled default image).
            heroMediaType: heroMedia?.type,
            heroImageUrl: heroMedia?.imageUrl ?? null,

            refreshSeasonConfig,

            setColorTheme: (payload) => {
                if (
                    payload === COLOR_THEMES.CHRISTMAS &&
                    !christmasAvailable
                ) {
                    return;
                }

                dispatch({
                    type: ACTIONS.SET_COLOR_THEME,
                    payload,
                });
            },

            setExperience: (payload) =>
                dispatch({
                    type: ACTIONS.SET_EXPERIENCE,
                    payload,
                }),

            setAccent: (payload) =>
                dispatch({
                    type: ACTIONS.SET_ACCENT,
                    payload,
                }),

            setMotion: (payload) =>
                dispatch({
                    type: ACTIONS.SET_MOTION,
                    payload,
                }),

            setDensity: (payload) =>
                dispatch({
                    type: ACTIONS.SET_DENSITY,
                    payload,
                }),

            resetConfiguration: () =>
                dispatch({
                    type: ACTIONS.RESET,
                }),
        }),
        [
            state,
            effectiveColorTheme,
            christmasAvailable,
            navbarStyle,
            heroVideoUrl,
            showFeaturedImageFrame,
            cardHoverMode,
            cardHoverColor,
            heroMedia,
            refreshSeasonConfig,
        ]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}

            {effectiveColorTheme ===
                COLOR_THEMES.CHRISTMAS && (
                <SnowfallOverlay />
            )}
        </ThemeContext.Provider>
    );
};

export default ThemeProvider;
