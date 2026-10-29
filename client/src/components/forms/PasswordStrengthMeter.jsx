import {
    PASSWORD_STRENGTH_LEVELS,
    getPasswordStrength,
} from "../../utils/passwordRules";

const PasswordStrengthMeter = ({ password }) => {
    const strength = getPasswordStrength(password);

    if (strength === null) {
        return null;
    }

    const level = PASSWORD_STRENGTH_LEVELS[strength];

    return (
        <div aria-live="polite">
            <div className="flex gap-1.5">
                {PASSWORD_STRENGTH_LEVELS.map((entry, index) => (
                    <span
                        key={entry.label}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                            index <= strength
                                ? level.bar
                                : "bg-gray-200 dark:bg-gray-700"
                        }`}
                    />
                ))}
            </div>

            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Strength:{" "}
                <span className={`font-semibold ${level.text}`}>
                    {level.label}
                </span>
                {strength < 3 &&
                    " — longer passwords with a symbol are stronger."}
            </p>
        </div>
    );
};

export default PasswordStrengthMeter;
