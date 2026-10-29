import {
    useEffect,
    useMemo,
    useState,
} from "react";

import { CarFront, MousePointerClick, PanelTop, Snowflake } from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";
import HeroBackgroundSettings from "../../../components/admin/HeroBackgroundSettings";

import useSettings from "../../../hooks/settings/useSettings";
import useTheme from "../../../hooks/theme/useTheme";
import useToast from "../../../hooks/toast/useToast";

import {
    MONTH_OPTIONS,
    formatMonthDay,
    getDaysInMonth,
    isChristmasAvailable,
    isValidMonthDay,
    normalizeChristmasWindow,
} from "../../../utils/seasonalTheme";

import { trackCardSpotlight } from "../../../utils/spotlightHover";
import { DEFAULT_BUTTON_COLORS, resolveButtonColors, buttonThemeStyle } from "../../../utils/dashboardButtonTheme";

import {
    NAVBAR_STYLES,
    CARD_HOVER_MODES,
    CARD_HOVER_COLORS,
    isValidNavbarStyle,
    isValidCardHoverMode,
    isValidCardHoverColor,
} from "../../../config/theme";

const resolveNavbarStyle = (value) =>
    isValidNavbarStyle(value) ? value : NAVBAR_STYLES.DEFAULT;

const resolveCardHoverMode = (value) =>
    isValidCardHoverMode(value) ? value : CARD_HOVER_MODES.NEON;

const resolveCardHoverColor = (value) =>
    isValidCardHoverColor(value) ? value : CARD_HOVER_COLORS.YELLOW;

const HOVER_MODE_OPTIONS = [
    { value: CARD_HOVER_MODES.NEON, label: "Neon edge sweep" },
    { value: CARD_HOVER_MODES.SPOTLIGHT, label: "Spotlight (follows cursor)" },
];

const HOVER_COLOR_OPTIONS = [
    { value: CARD_HOVER_COLORS.YELLOW, label: "Yellow" },
    { value: CARD_HOVER_COLORS.BLUE, label: "Blue" },
    { value: CARD_HOVER_COLORS.PURPLE, label: "Purple" },
    { value: CARD_HOVER_COLORS.GREEN, label: "Green" },
    { value: CARD_HOVER_COLORS.RED, label: "Red" },
    { value: CARD_HOVER_COLORS.WHITE, label: "White" },
];

// Mini vehicle card the admin can actually hover, forcing dark mode + the
// currently-picked (unsaved) mode/colour locally so it previews correctly
// whatever the admin's own dashboard theme is.
const CardHoverPreview = ({ mode, color }) => (
    <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Preview — hover the card
        </p>

        <div
            data-theme="dark"
            data-hover-mode={mode}
            data-hover-color={color}
            className="flex h-32 items-center justify-center rounded-xl bg-gray-950 p-6"
        >
            <div
                onMouseMove={trackCardSpotlight}
                className="vehicle-hover-fx flex h-full w-48 flex-col justify-between rounded-2xl border border-gray-700 bg-gray-800 p-3 shadow-sm transition-all duration-300"
            >
                <div className="flex h-12 items-center justify-center rounded-lg bg-gray-700/60">
                    <CarFront
                        size={22}
                        strokeWidth={1.5}
                        className="text-gray-400"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white">
                        Toyota Vios
                    </span>

                    <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                        ₱1,500
                    </span>
                </div>
            </div>
        </div>
    </div>
);

const PREVIEW_CAPSULE =
    "flex h-8 items-center rounded-full bg-white/90 shadow-md ring-1 ring-gray-200/80 dark:bg-gray-900/90 dark:ring-gray-700/80";

// Miniature of the public page header so the admin can see what the toggle
// does before saving.
const NavbarPreview = ({ isPill }) => {
    const links = (
        <div className="flex items-center gap-1">
            <span
                className={`px-2 py-0.5 text-[10px] font-semibold text-gray-900 dark:text-white ${
                    isPill
                        ? "rounded-full bg-yellow-100 dark:bg-yellow-500/15"
                        : "border-b-2 border-yellow-500"
                }`}
            >
                Home
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                Vehicles
            </span>
            <span className="hidden px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 sm:inline">
                About
            </span>
        </div>
    );

    return (
        <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Preview
            </p>

            <div
                aria-hidden="true"
                className="h-28 overflow-hidden rounded-xl bg-linear-to-br from-slate-200 to-slate-300 dark:from-gray-800 dark:to-gray-950"
            >
                {isPill ? (
                    // Logo, links and user menu each float on their own.
                    <div className="mt-3 flex items-center justify-between gap-2 px-3">
                        <span className={`${PREVIEW_CAPSULE} px-3 text-[11px] font-extrabold tracking-tight text-gray-900 dark:text-white`}>
                            Rent-A-Ride
                        </span>

                        <span className={`${PREVIEW_CAPSULE} px-1`}>
                            {links}
                        </span>

                        <span className="h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-gray-200/80 dark:bg-gray-900 dark:ring-gray-700/80" />
                    </div>
                ) : (
                    <div className="flex h-10 w-full items-center justify-between bg-white/90 px-4 shadow-sm dark:bg-gray-900/90">
                        <span className="text-[11px] font-extrabold tracking-tight text-gray-900 dark:text-white">
                            Rent-A-Ride
                        </span>

                        {links}

                        <span className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-700" />
                    </div>
                )}
            </div>
        </div>
    );
};

// Miniature of the Featured Fleet stage: the glass frame with its corner
// brackets (on), or no frame and the faint model-name watermark (off).
const FeaturedFramePreview = ({ showFrame }) => (
    <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Preview
        </p>

        <div
            aria-hidden="true"
            className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-slate-100 to-slate-200 dark:from-gray-900 dark:to-gray-950"
        >
            <span
                className={`pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-black uppercase tracking-tighter text-gray-900/[0.16] transition-opacity duration-500 sm:text-5xl dark:text-white/[0.15] ${
                    showFrame ? "opacity-0" : "opacity-100"
                }`}
            >
                Stargazer
            </span>

            <div
                className={`relative flex h-24 w-40 items-center justify-center rounded-2xl border transition-all duration-500 ${
                    showFrame
                        ? "border-gray-300/80 bg-white/50 shadow-inner backdrop-blur-[2px] dark:border-gray-600/70 dark:bg-gray-800/30"
                        : "border-transparent bg-transparent"
                }`}
            >
                {[
                    "left-2 top-2 border-l border-t",
                    "right-2 top-2 border-r border-t",
                    "bottom-2 left-2 border-b border-l",
                    "bottom-2 right-2 border-b border-r",
                ].map((corner) => (
                    <span
                        key={corner}
                        className={`absolute h-3 w-3 border-blue-400/50 transition-opacity duration-500 ${corner} ${
                            showFrame ? "opacity-100" : "opacity-0"
                        }`}
                    />
                ))}

                <CarFront
                    size={40}
                    strokeWidth={1.5}
                    className="relative text-red-500 drop-shadow"
                />
            </div>
        </div>
    </div>
);

const ThemeSettings = () => {
    const toast = useToast();

    const { refreshSeasonConfig } = useTheme();

    const {
        settings,
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [christmas, setChristmas] = useState(() =>
        normalizeChristmasWindow(
            settings?.themeSettings?.christmas
        )
    );

    const [navbarStyle, setNavbarStyle] = useState(() =>
        resolveNavbarStyle(settings?.themeSettings?.navbarStyle)
    );

    const isPill = navbarStyle === NAVBAR_STYLES.PILL;

    const [featuredImageFrame, setFeaturedImageFrame] = useState(
        () => settings?.themeSettings?.featuredImageFrame !== false
    );

    const [cardHoverMode, setCardHoverMode] = useState(() =>
        resolveCardHoverMode(settings?.themeSettings?.cardHoverMode)
    );

    const [cardHoverColor, setCardHoverColor] = useState(() =>
        resolveCardHoverColor(settings?.themeSettings?.cardHoverColor)
    );

    const [loaded, setLoaded] = useState(false);
    const [buttonColors, setButtonColors] = useState(() => resolveButtonColors(settings?.themeSettings));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void getSettings();
    }, [getSettings]);

    useEffect(() => {
        if (settings?.themeSettings?.christmas) {
            setButtonColors(resolveButtonColors(settings.themeSettings));
            setChristmas(
                normalizeChristmasWindow(
                    settings.themeSettings.christmas
                )
            );

            setNavbarStyle(
                resolveNavbarStyle(settings.themeSettings.navbarStyle)
            );

            setFeaturedImageFrame(
                settings.themeSettings.featuredImageFrame !== false
            );

            setCardHoverMode(
                resolveCardHoverMode(settings.themeSettings.cardHoverMode)
            );

            setCardHoverColor(
                resolveCardHoverColor(settings.themeSettings.cardHoverColor)
            );

            setLoaded(true);
        }
    }, [settings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const startValid = isValidMonthDay(
        christmas.startMonth,
        christmas.startDay
    );

    const endValid = isValidMonthDay(
        christmas.endMonth,
        christmas.endDay
    );

    const availableToday = useMemo(
        () => isChristmasAvailable(christmas),
        [christmas]
    );

    const wrapsNewYear =
        christmas.startMonth * 100 + christmas.startDay >
        christmas.endMonth * 100 + christmas.endDay;

    const handleMonthChange = (monthKey, dayKey) => (event) => {
        const month = Number(event.target.value);

        setChristmas((prev) => ({
            ...prev,
            [monthKey]: month,
            // Keep the day legal for the new month (e.g. Jan 31 -> Feb).
            [dayKey]: Math.min(
                prev[dayKey],
                getDaysInMonth(month)
            ),
        }));
    };

    const handleDayChange = (dayKey) => (event) => {
        const raw = event.target.value;

        setChristmas((prev) => ({
            ...prev,
            [dayKey]: raw === "" ? "" : Number(raw),
        }));
    };

    const handleSave = async () => {
        if (!startValid || !endValid) {
            toast.error(
                "Enter a valid day for the selected month."
            );

            return;
        }

        setSaving(true);

        try {
            const result = await updateSettings({
                themeSettings: {
                    ...buttonColors,
                    christmas,
                    navbarStyle,
                    featuredImageFrame,
                    cardHoverMode,
                    cardHoverColor,
                },
            });

            // Failures are surfaced by the settingsError effect above.
            if (result?.meta?.requestStatus === "fulfilled") {
                await refreshSeasonConfig();

                toast.success(
                    "Theme settings saved successfully."
                );
            }
        } catch (error) {
            toast.error(
                error.message || "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    };

    if (settingsLoading && !loaded) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin &amp; operator buttons</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Shared primary action colors in light and dark mode. Text adjusts for readability. Status actions keep their own colors.</p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {[["buttonColor", "Button color"], ["buttonHoverColor", "Hover color"]].map(([key, label]) => (
                        <label key={key} htmlFor={key} className="flex min-w-0 flex-wrap items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                            <span className="w-full">{label}</span>
                            <input id={key} type="color" value={buttonColors[key]} onChange={(event) => setButtonColors((previous) => ({ ...previous, [key]: event.target.value }))} className="h-11 w-16 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-transparent p-1 dark:border-gray-600" />
                            <span className="font-mono text-xs">{buttonColors[key]}</span>
                        </label>
                    ))}
                </div>
                <div className="dashboard-button-preview mt-5 flex flex-wrap items-center gap-3" style={buttonThemeStyle(buttonColors)}>
                    <Button>Preview button</Button>
                    <button type="button" className="rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: buttonColors.buttonHoverColor, color: buttonThemeStyle(buttonColors)["--dashboard-button-hover-text"] }}>Hover preview</button>
                    <Button variant="outline" onClick={() => setButtonColors({ ...DEFAULT_BUTTON_COLORS })}>Reset to blue</Button>
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Use Save Changes below to apply to both dashboards.</p>
            </section>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                        <Snowflake size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Christmas Theme
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            A festive theme with falling snow that users can choose from the Theme menu. It is only offered during the dates below, every year.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        christmas.enabled
                            ? "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Enable Christmas theme
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {christmas.enabled
                                ? "Enabled — the theme shows up in the Theme menu whenever today falls inside the dates below."
                                : "Disabled — the theme is never offered, whatever the date. Anyone who selected it goes back to System."}
                        </p>
                    </div>

                    <Switch
                        checked={Boolean(christmas.enabled)}
                        onChange={(event) =>
                            setChristmas((prev) => ({
                                ...prev,
                                enabled: event.target.checked,
                            }))
                        }
                    />
                </div>

                <div
                    className={`mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 ${
                        christmas.enabled
                            ? ""
                            : "pointer-events-none opacity-60"
                    }`}
                >
                    <fieldset className="space-y-3">
                        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Available from
                        </legend>

                        <div className="grid grid-cols-[1fr_6rem] gap-3">
                            <Select
                                id="christmas-start-month"
                                name="startMonth"
                                label="Month"
                                options={MONTH_OPTIONS}
                                value={String(christmas.startMonth)}
                                onChange={handleMonthChange(
                                    "startMonth",
                                    "startDay"
                                )}
                            />

                            <Input
                                id="christmas-start-day"
                                name="startDay"
                                type="number"
                                label="Day"
                                min={1}
                                max={getDaysInMonth(
                                    christmas.startMonth
                                )}
                                step={1}
                                value={christmas.startDay}
                                onChange={handleDayChange("startDay")}
                                error={
                                    startValid
                                        ? undefined
                                        : "Invalid day"
                                }
                            />
                        </div>
                    </fieldset>

                    <fieldset className="space-y-3">
                        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            Available until (inclusive)
                        </legend>

                        <div className="grid grid-cols-[1fr_6rem] gap-3">
                            <Select
                                id="christmas-end-month"
                                name="endMonth"
                                label="Month"
                                options={MONTH_OPTIONS}
                                value={String(christmas.endMonth)}
                                onChange={handleMonthChange(
                                    "endMonth",
                                    "endDay"
                                )}
                            />

                            <Input
                                id="christmas-end-day"
                                name="endDay"
                                type="number"
                                label="Day"
                                min={1}
                                max={getDaysInMonth(
                                    christmas.endMonth
                                )}
                                step={1}
                                value={christmas.endDay}
                                onChange={handleDayChange("endDay")}
                                error={
                                    endValid
                                        ? undefined
                                        : "Invalid day"
                                }
                            />
                        </div>
                    </fieldset>
                </div>

                {startValid && endValid && (
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Available every year from{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {formatMonthDay(
                                christmas.startMonth,
                                christmas.startDay
                            )}
                        </span>{" "}
                        through{" "}
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {formatMonthDay(
                                christmas.endMonth,
                                christmas.endDay
                            )}
                        </span>
                        {wrapsNewYear
                            ? ", running across the new year."
                            : "."}
                    </p>
                )}

                <div className="mt-6">
                    <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            availableToday
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                    >
                        <span
                            className={`h-1.5 w-1.5 rounded-full ${
                                availableToday
                                    ? "bg-emerald-500"
                                    : "bg-gray-400"
                            }`}
                        />

                        {availableToday
                            ? "Available to users today"
                            : "Not available today"}
                    </span>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
                        <PanelTop size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Display
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            How the public site looks to guests and customers. Admin and operator dashboards are not affected.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        isPill
                            ? "border-yellow-200 bg-yellow-50/60 dark:border-yellow-900 dark:bg-yellow-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Pill navbar
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {isPill
                                ? "On — the logo, the links and the user menu float as separate rounded pills, with a highlight that slides to the active link."
                                : "Off — the default full-width navbar is shown."}
                        </p>
                    </div>

                    <Switch
                        checked={isPill}
                        onChange={(event) =>
                            setNavbarStyle(
                                event.target.checked
                                    ? NAVBAR_STYLES.PILL
                                    : NAVBAR_STYLES.DEFAULT
                            )
                        }
                    />
                </div>

                <NavbarPreview isPill={isPill} />

                <div
                    className={`mt-8 flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        featuredImageFrame
                            ? "border-yellow-200 bg-yellow-50/60 dark:border-yellow-900 dark:bg-yellow-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Featured Fleet image frame
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {featuredImageFrame
                                ? "On — the vehicle photo on the home page sits in a glass frame with corner accents, and the large model name behind it is hidden."
                                : "Off — the frame is invisible (the photo stays in the same place) and the large faded model name shows behind the vehicle instead."}
                        </p>
                    </div>

                    <Switch
                        checked={featuredImageFrame}
                        onChange={(event) =>
                            setFeaturedImageFrame(event.target.checked)
                        }
                    />
                </div>

                <FeaturedFramePreview showFrame={featuredImageFrame} />

                <div className="mt-8 border-t border-gray-200 pt-8 dark:border-gray-800">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                            <MousePointerClick size={19} />
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Vehicle card hover effect
                            </p>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Dark mode only. Shows on vehicle cards and list rows across the public and customer sides.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Select
                            id="card-hover-mode"
                            name="cardHoverMode"
                            label="Effect"
                            options={HOVER_MODE_OPTIONS}
                            value={cardHoverMode}
                            onChange={(event) =>
                                setCardHoverMode(
                                    resolveCardHoverMode(event.target.value)
                                )
                            }
                        />

                        <Select
                            id="card-hover-color"
                            name="cardHoverColor"
                            label="Color"
                            options={HOVER_COLOR_OPTIONS}
                            value={cardHoverColor}
                            onChange={(event) =>
                                setCardHoverColor(
                                    resolveCardHoverColor(event.target.value)
                                )
                            }
                        />
                    </div>

                    <CardHoverPreview
                        mode={cardHoverMode}
                        color={cardHoverColor}
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                >
                    Save Changes
                </Button>
            </div>

            {/* Applies on its own (upload / restore), not via Save Changes. */}
            <HeroBackgroundSettings
                themeSettings={settings?.themeSettings}
                onChanged={getSettings}
            />
        </div>
    );
};

export default ThemeSettings;
