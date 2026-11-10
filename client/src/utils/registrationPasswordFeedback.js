import { getPasswordCharacterCount, getPasswordError } from "./registrationRules.js";

export const getRegistrationPasswordFeedback = (password = "", confirmation = "", confirmationRequired = false) => {
    const rules = [
        { id: "length", label: "At least 8 characters", met: getPasswordCharacterCount(password) >= 8 },
        { id: "uppercase", label: "One uppercase letter (A–Z)", met: /[A-Z]/.test(password) },
        { id: "lowercase", label: "One lowercase letter (a–z)", met: /[a-z]/.test(password) },
        { id: "number", label: "One number (0–9)", met: /[0-9]/.test(password) },
        { id: "bytes", label: "No more than 72 UTF-8 bytes (accented letters and emoji can use multiple bytes)", met: new TextEncoder().encode(password).length <= 72 },
    ];
    const matches = confirmation.length > 0 && confirmation === password;
    return {
        passwordError: getPasswordError(password),
        unmet: rules.filter((rule) => !rule.met),
        matches,
        confirmationError: confirmation.length > 0
            ? matches ? "" : "Passwords do not match."
            : confirmationRequired ? "Please confirm your password." : "",
    };
};
