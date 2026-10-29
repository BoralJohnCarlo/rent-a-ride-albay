/*
 * The password policy the server enforces (changePasswordValidator /
 * resetPasswordValidator), as live checklist rules. `currentPassword` adds
 * the "different from current" rule - only known when changing, not
 * resetting a forgotten one.
 */
export const getPasswordRules = ({
    newPassword = "",
    confirmPassword = "",
    currentPassword,
}) => [
    {
        label: "At least 8 characters",
        met: newPassword.length >= 8,
    },
    {
        label: "One uppercase letter (A–Z)",
        met: /[A-Z]/.test(newPassword),
    },
    {
        label: "One lowercase letter (a–z)",
        met: /[a-z]/.test(newPassword),
    },
    {
        label: "One number (0–9)",
        met: /[0-9]/.test(newPassword),
    },
    ...(currentPassword === undefined
        ? []
        : [
              {
                  label: "Different from your current password",
                  met:
                      newPassword.length > 0 &&
                      newPassword !== currentPassword,
              },
          ]),
    {
        label: "Both new passwords match",
        met:
            confirmPassword.length > 0 &&
            newPassword === confirmPassword,
    },
];

export const PASSWORD_STRENGTH_LEVELS = [
    { label: "Weak", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
    { label: "Fair", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    { label: "Good", bar: "bg-lime-500", text: "text-lime-700 dark:text-lime-400" },
    { label: "Strong", bar: "bg-green-600", text: "text-green-700 dark:text-green-400" },
];

// Index into PASSWORD_STRENGTH_LEVELS, or null for an empty password.
export const getPasswordStrength = (password) => {
    if (!password) return null;

    const points = [
        password.length >= 8,
        password.length >= 12,
        /[a-z]/.test(password) && /[A-Z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    if (points <= 2) return 0;
    if (points === 3) return 1;
    if (points === 4) return 2;
    return 3;
};
