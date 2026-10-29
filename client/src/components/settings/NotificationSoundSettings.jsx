import { useEffect, useRef, useState } from "react";

import {
    Check,
    LoaderCircle,
    Play,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";

import notificationsSound from "../../assets/sound/Notifications.mp3";

import Button from "../common/Button";
import Switch from "../common/Switch";

import useAuth from "../../hooks/auth/useAuth";
import useToast from "../../hooks/toast/useToast";

import { updateNotificationPreferences } from "../../api/userApi";
import {
    DEFAULT_SOUND_PREFERENCES,
    playSound,
} from "../../utils/notificationSound";

// Slider changes save once the user stops moving it for this long.
const SAVE_DELAY = 600;

const VolumeIcon = ({ volume, muted, ...props }) => {
    if (muted || volume === 0) return <VolumeX {...props} />;
    if (volume < 50) return <Volume1 {...props} />;
    return <Volume2 {...props} />;
};

/*
 * Saved to the account (User.notificationPreferences), so it applies on
 * every device. Changes apply instantly through the auth user, which
 * AuthProvider feeds into utils/notificationSound.
 */
const NotificationSoundSettings = () => {
    const { user, updateUser } = useAuth();
    const toast = useToast();

    const saved = {
        ...DEFAULT_SOUND_PREFERENCES,
        ...(user?.notificationPreferences || {}),
    };

    const [volume, setVolume] = useState(saved.soundVolume);
    const [status, setStatus] = useState("idle"); // idle | saving | saved
    const saveTimerRef = useRef(null);
    const savedTimerRef = useRef(null);
    // Last values the server confirmed, to roll back to if a save fails.
    const confirmedRef = useRef(saved);

    useEffect(
        () => () => {
            clearTimeout(saveTimerRef.current);
            clearTimeout(savedTimerRef.current);
        },
        []
    );

    const save = async (changes) => {
        const previous = confirmedRef.current;

        updateUser({
            notificationPreferences: { ...previous, ...changes },
        });

        setStatus("saving");
        clearTimeout(savedTimerRef.current);

        try {
            const response = await updateNotificationPreferences(changes);
            confirmedRef.current = response.data;
            updateUser({ notificationPreferences: response.data });
            setStatus("saved");
            savedTimerRef.current = setTimeout(
                () => setStatus("idle"),
                2000
            );
        } catch (error) {
            updateUser({ notificationPreferences: previous });
            setVolume(previous.soundVolume);
            setStatus("idle");
            toast.error(
                error.response?.data?.message ||
                    "Couldn't save your sound settings. Please try again.",
                "Not saved"
            );
        }
    };

    const handleMuteChange = (event) => {
        clearTimeout(saveTimerRef.current);
        save({ soundMuted: event.target.checked, soundVolume: volume });
    };

    const handleVolumeChange = (event) => {
        const next = Number(event.target.value);
        setVolume(next);

        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(
            () => save({ soundVolume: next }),
            SAVE_DELAY
        );
    };

    const handleTest = () => {
        // Previews the slider's current position, saved or not.
        playSound(notificationsSound, {
            soundVolume: volume,
            soundMuted: false,
        });
    };

    const muted = saved.soundMuted;

    return (
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:px-8">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-yellow-600 dark:text-yellow-400">
                        Preferences
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                        Notification Sounds
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        How loud new-notification alerts and pop-up messages
                        are. Saved to your account, so it applies on every
                        device you sign in to.
                    </p>
                </div>

                <span
                    aria-live="polite"
                    className="flex h-6 shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400"
                >
                    {status === "saving" && (
                        <>
                            <LoaderCircle size={14} className="animate-spin" />
                            Saving…
                        </>
                    )}
                    {status === "saved" && (
                        <>
                            <Check size={14} className="text-green-600 dark:text-green-400" />
                            Saved
                        </>
                    )}
                </span>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
                <Switch
                    name="soundMuted"
                    checked={muted}
                    onChange={handleMuteChange}
                    label="Mute notification sounds"
                    helperText="Notifications still appear and show on the bell — they just won't make a sound."
                />

                <div className={muted ? "opacity-50" : ""}>
                    <div className="flex items-center justify-between gap-4">
                        <label
                            htmlFor="soundVolume"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Volume
                        </label>

                        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                            {muted ? "Muted" : `${volume}%`}
                        </span>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                        <VolumeIcon
                            volume={volume}
                            muted={muted}
                            size={20}
                            className="shrink-0 text-gray-500 dark:text-gray-400"
                        />

                        <input
                            id="soundVolume"
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={volume}
                            onChange={handleVolumeChange}
                            disabled={muted}
                            aria-valuetext={`${volume}%`}
                            className="h-2 flex-1 cursor-pointer accent-yellow-500 disabled:cursor-not-allowed"
                        />

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTest}
                            disabled={muted || volume === 0}
                            leftIcon={<Play size={14} />}
                        >
                            Test
                        </Button>
                    </div>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {muted
                            ? "Turn off mute to adjust the volume."
                            : volume === 0
                              ? "At 0% nothing plays — same as muting."
                              : "Press Test to hear the notification sound at this volume."}
                    </p>
                </div>
            </div>
        </section>
    );
};

export default NotificationSoundSettings;
