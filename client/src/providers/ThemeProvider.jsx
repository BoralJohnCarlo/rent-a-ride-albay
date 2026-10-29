import {
    useEffect,
    useMemo,
    useReducer,
    useState,
} from "react";

import ThemeContext from "../context/ThemeContext";

import {
    DEFAULT_UI_CONFIGURATION,
    UI_STORAGE_KEYS,
    COLOR_THEMES,
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

const normalizeConfiguration = (configuration) => ({
    ...DEFAULT_UI_CONFIGURATION,
    ...configuration,
});

const themeReducer = (state, action) => {
    switch (action.type) {
        case ACTIONS.INITIALIZE:
            return normalizeConfiguration(
                action.payload
            );

        case ACTIONS.SET_COLOR_THEME:
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

        const applyTheme = () => {
            const resolvedTheme =
                state.colorTheme === COLOR_THEMES.SYSTEM
                    ? getSystemTheme()
                    : state.colorTheme;

            root.dataset.theme = resolvedTheme;
        };

        applyTheme();

        if (
            state.colorTheme !==
                COLOR_THEMES.SYSTEM ||
            !window.matchMedia
        ) {
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
    }, [state.colorTheme]);

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

    const value = useMemo(
        () => ({
            configuration: state,

            setColorTheme: (payload) =>
                dispatch({
                    type: ACTIONS.SET_COLOR_THEME,
                    payload,
                }),

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
        [state]
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeProvider;