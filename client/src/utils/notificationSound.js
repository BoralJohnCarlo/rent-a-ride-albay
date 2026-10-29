/*
 * The signed-in account's sound preferences (User.notificationPreferences),
 * kept at module level so anything can play a sound without depending on
 * provider order - ToastProvider sits outside AuthProvider. AuthProvider
 * pushes the account's values in; signed out falls back to the defaults.
 */
export const DEFAULT_SOUND_PREFERENCES = {
    soundVolume: 50,
    soundMuted: false,
};

let current = { ...DEFAULT_SOUND_PREFERENCES };

export const setSoundPreferences = (preferences) => {
    current = {
        ...DEFAULT_SOUND_PREFERENCES,
        ...(preferences || {}),
    };
};

/*
 * Plays `src` at the account's volume, or not at all when muted / at 0.
 * Pass `preferences` to preview unsaved values (the settings slider).
 */
export const playSound = (src, preferences = current) => {
    const { soundVolume, soundMuted } = preferences;

    if (soundMuted || !soundVolume) {
        return;
    }

    try {
        const audio = new Audio(src);
        audio.volume = Math.min(Math.max(soundVolume / 100, 0), 1);
        audio.play().catch(() => {
            // Ignore autoplay errors (e.g., browser restrictions)
        });
    } catch {
        // Ignore audio playback errors
    }
};
