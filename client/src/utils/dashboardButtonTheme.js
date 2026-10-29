export const DEFAULT_BUTTON_COLORS = { buttonColor: "#2563eb", buttonHoverColor: "#1d4ed8" };

export const isButtonColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export const resolveButtonColors = (settings) => Object.fromEntries(
    Object.entries(DEFAULT_BUTTON_COLORS).map(([key, fallback]) => [key, isButtonColor(settings?.[key]) ? settings[key] : fallback])
);

// Choose whichever foreground has the higher WCAG contrast for each state.
export const buttonTextColor = (color) => {
    const channels = color.slice(1).match(/../g).map((value) => {
        const channel = parseInt(value, 16) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#000000" : "#ffffff";
};

export const buttonThemeStyle = (settings) => {
    const colors = resolveButtonColors(settings);
    return {
        "--dashboard-button": colors.buttonColor,
        "--dashboard-button-hover": colors.buttonHoverColor,
        "--dashboard-button-text": buttonTextColor(colors.buttonColor),
        "--dashboard-button-hover-text": buttonTextColor(colors.buttonHoverColor),
    };
};
