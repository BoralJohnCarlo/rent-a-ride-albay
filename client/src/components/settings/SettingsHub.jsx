import { useEffect, useRef } from "react";

import { AnimatePresence, motion } from "framer-motion";

import {
    ArrowLeft,
    BellRing,
    ChevronRight,
    KeyRound,
    Volume2,
    VolumeX,
} from "lucide-react";

import { useSearchParams } from "react-router-dom";

import ChangePasswordForm from "../forms/ChangePasswordForm";
import NotificationSoundSettings from "./NotificationSoundSettings";

import useAuth from "../../hooks/auth/useAuth";
import { DEFAULT_SOUND_PREFERENCES } from "../../utils/notificationSound";
import { formatRelative } from "../../utils/relativeTime";

/*
 * The Settings page body shared by partners and customers: a card per
 * setting, and the setting itself once its card is opened. The open one
 * lives in the URL (?section=…), so browser back returns to the cards and
 * a section can be linked to directly.
 */
const SECTIONS = [
    {
        key: "sounds",
        title: "Notification Sounds",
        description:
            "Turn alert sounds up, down or off for new notifications and pop-up messages.",
        icon: BellRing,
        component: NotificationSoundSettings,
        status: (user) => {
            const { soundVolume, soundMuted } = {
                ...DEFAULT_SOUND_PREFERENCES,
                ...(user?.notificationPreferences || {}),
            };

            return soundMuted || !soundVolume
                ? { label: "Muted", icon: VolumeX, muted: true }
                : { label: `Volume ${soundVolume}%`, icon: Volume2 };
        },
    },
    {
        key: "password",
        title: "Change Password",
        description:
            "Set a new password. Other devices are signed out and you're emailed a confirmation.",
        icon: KeyRound,
        component: ChangePasswordForm,
        status: (user) => ({
            label: user?.passwordChangedAt
                ? `Changed ${formatRelative(user.passwordChangedAt)}`
                : "Never changed",
            muted: !user?.passwordChangedAt,
        }),
    },
];

const SettingCard = ({ section, user, onOpen, index }) => {
    const Icon = section.icon;
    const status = section.status(user);
    const StatusIcon = status.icon;

    return (
        <motion.button
            type="button"
            onClick={onOpen}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            className="group flex w-full items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-shadow hover:border-yellow-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-yellow-500/40 sm:p-6"
        >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700 transition-colors group-hover:bg-yellow-400 group-hover:text-gray-950 dark:bg-yellow-500/15 dark:text-yellow-400">
                <Icon size={22} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-gray-950 dark:text-white">
                    {section.title}
                </span>
                <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">
                    {section.description}
                </span>
                <span
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        status.muted
                            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            : "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                    }`}
                >
                    {StatusIcon && <StatusIcon size={13} />}
                    {status.label}
                </span>
            </span>

            <ChevronRight
                size={20}
                className="mt-3 shrink-0 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-gray-700 dark:group-hover:text-gray-200"
            />
        </motion.button>
    );
};

const SettingsHub = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const rootRef = useRef(null);

    const active = SECTIONS.find(
        (section) => section.key === searchParams.get("section")
    );

    // Opening or closing a section starts at the top of it.
    useEffect(() => {
        rootRef.current?.scrollIntoView({ block: "nearest" });
    }, [active?.key]);

    const open = (key) => setSearchParams({ section: key });
    const close = () => setSearchParams({});

    const ActiveSection = active?.component;

    return (
        <div ref={rootRef} className="scroll-mt-24">
            <AnimatePresence mode="wait" initial={false}>
                {active ? (
                    <motion.div
                        key={active.key}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        <button
                            type="button"
                            onClick={close}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-950 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <ArrowLeft size={16} />
                            All settings
                        </button>

                        <ActiveSection />
                    </motion.div>
                ) : (
                    <motion.div
                        key="cards"
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.2 }}
                        className="grid gap-4 md:grid-cols-2"
                    >
                        {SECTIONS.map((section, index) => (
                            <SettingCard
                                key={section.key}
                                section={section}
                                user={user}
                                index={index}
                                onOpen={() => open(section.key)}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SettingsHub;
