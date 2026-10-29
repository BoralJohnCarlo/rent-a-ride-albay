import {
    Monitor,
    Moon,
    Snowflake,
    Sun,
} from "lucide-react";

import { COLOR_THEMES } from "./theme";

const SYSTEM_OPTION = Object.freeze({
    value: COLOR_THEMES.SYSTEM,
    label: "System",
    icon: Monitor,
});

const LIGHT_OPTION = Object.freeze({
    value: COLOR_THEMES.LIGHT,
    label: "Light",
    icon: Sun,
});

const DARK_OPTION = Object.freeze({
    value: COLOR_THEMES.DARK,
    label: "Dark",
    icon: Moon,
});

const CHRISTMAS_OPTION = Object.freeze({
    value: COLOR_THEMES.CHRISTMAS,
    label: "Christmas",
    icon: Snowflake,
});

const ALL_OPTIONS = [
    SYSTEM_OPTION,
    LIGHT_OPTION,
    DARK_OPTION,
    CHRISTMAS_OPTION,
];

/*
 * Single source for every theme picker. The desktop user menu has always
 * offered System/Dark only, while the mobile menus also offer Light, so
 * `includeLight` keeps that difference. Christmas is only offered while its
 * seasonal window is active.
 */
export const getThemeOptions = ({
    christmasAvailable = false,
    includeLight = false,
} = {}) => [
    SYSTEM_OPTION,
    ...(includeLight ? [LIGHT_OPTION] : []),
    DARK_OPTION,
    ...(christmasAvailable ? [CHRISTMAS_OPTION] : []),
];

export const getThemeLabel = (colorTheme) =>
    ALL_OPTIONS.find((option) => option.value === colorTheme)
        ?.label ?? SYSTEM_OPTION.label;
