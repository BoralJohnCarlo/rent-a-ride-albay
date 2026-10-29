import { useState } from "react";

import { motion } from "framer-motion";
import { Film, Image as ImageIcon, Layers } from "lucide-react";

import HeroImageSettings from "./HeroImageSettings";
import HeroVideoSettings from "./HeroVideoSettings";

import { updateSettings } from "../../api/settingsApi";

import useTheme from "../../hooks/theme/useTheme";
import useToast from "../../hooks/toast/useToast";

const MODES = [
    {
        value: "video",
        label: "Video",
        icon: Film,
        hint: "A looping background video.",
    },
    {
        value: "image",
        label: "Image",
        icon: ImageIcon,
        hint: "A still background picture.",
    },
];

/*
 * Settings → Themes & Display → Hero Background: choose whether the home
 * hero shows a video or a still image, then manage that one below. Each
 * keeps its own upload (or bundled default), so switching back and forth
 * never loses either. The mode switch applies immediately, like the uploads.
 */
const HeroBackgroundSettings = ({ themeSettings, onChanged }) => {
    const toast = useToast();
    const { refreshSeasonConfig } = useTheme();

    const savedMode =
        themeSettings?.heroMediaType === "image" ? "image" : "video";

    // Optimistic while saving; otherwise follow the saved value.
    const [pendingMode, setPendingMode] = useState(null);
    const mode = pendingMode ?? savedMode;

    const handleModeChange = async (next) => {
        if (next === mode || pendingMode) return;

        setPendingMode(next);

        try {
            await updateSettings({ themeSettings: { heroMediaType: next } });
            await refreshSeasonConfig();
            await onChanged?.();
            toast.success(
                next === "image"
                    ? "The home page now shows the hero image."
                    : "The home page now shows the hero video."
            );
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to change the hero background."
            );
        } finally {
            setPendingMode(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                            <Layers size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Hero Background
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {MODES.find((m) => m.value === mode)?.hint}{" "}
                                Switching applies immediately; each keeps its own upload.
                            </p>
                        </div>
                    </div>

                    <div
                        role="tablist"
                        aria-label="Hero background type"
                        className="flex shrink-0 items-center gap-1 self-start rounded-full border border-gray-200 bg-gray-50 p-1 sm:self-auto dark:border-gray-700 dark:bg-gray-800/60"
                    >
                        {MODES.map((option) => {
                            const active = option.value === mode;
                            const Icon = option.icon;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    disabled={Boolean(pendingMode)}
                                    onClick={() => handleModeChange(option.value)}
                                    className={`relative inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-wait ${
                                        active
                                            ? "text-white"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="hero-background-mode"
                                            className="absolute inset-0 rounded-full bg-violet-600 shadow-md shadow-violet-600/25"
                                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                        />
                                    )}
                                    <Icon size={15} className="relative" />
                                    <span className="relative">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {mode === "image" ? (
                <HeroImageSettings
                    heroImage={themeSettings?.heroImage}
                    onChanged={onChanged}
                />
            ) : (
                <HeroVideoSettings
                    heroVideo={themeSettings?.heroVideo}
                    onChanged={onChanged}
                />
            )}
        </div>
    );
};

export default HeroBackgroundSettings;
