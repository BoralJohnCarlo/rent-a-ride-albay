/*
 * Mirrors the server's registration rules (server/validators/authValidator.js),
 * so customer and partner sign-up check passwords and phone numbers the same
 * way the API will.
 */

export const PASSWORD_HINT =
    "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";

export const getPasswordError = (password = "") => {
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) {
        return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
        return "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
        return "Password must contain at least one number.";
    }
    return "";
};

// Digits with optional spaces, dashes, parentheses or a leading "+",
// holding 10-15 digits in total.
export const getPhoneError = (phone = "") => {
    const value = phone.trim();

    if (!value) return "Phone number is required.";
    if (!/^\+?[\d\s()-]+$/.test(value)) {
        return "Phone number can only contain digits.";
    }

    const digits = value.replace(/\D/g, "").length;

    if (digits < 10 || digits > 15) {
        return "Phone number must have 10 to 15 digits.";
    }

    return "";
};

// Letters (any language), spaces, periods, apostrophes and hyphens.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;

export const getNameError = (value = "", label, { required = true } = {}) => {
    const name = value.trim();

    if (!name) return required ? `${label} is required.` : "";
    if (required && name.length < 2) {
        return `${label} must be at least 2 characters.`;
    }
    if (name.length > 50) return `${label} must not exceed 50 characters.`;
    if (!NAME_PATTERN.test(name)) {
        return `${label} can only contain letters, spaces, periods, apostrophes and hyphens.`;
    }
    return "";
};

/* A "YYYY-MM-DD" date before today (local calendar). Blank is not past. */
export const isPastDate = (value) => {
    if (!value) return false;

    const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return !Number.isNaN(date.getTime()) && date < today;
};

/* The server's reply when the email's registration is still awaiting its code. */
export const isPendingVerificationError = (message = "") =>
    message.includes("waiting for verification");

/* The server's reply when the code was already used to create the account. */
export const isAlreadyVerifiedError = (message = "") =>
    message.includes("already verified");

/*
 * Server errors that belong to a field on an earlier step, so the form can
 * send the user back there instead of leaving the error on the last step.
 */
export const getRegistrationErrorField = (message = "") => {
    if (/phone number is already used/i.test(message)) return "phoneNumber";
    if (/inspection (slot|date|appointment)/i.test(message)) {
        return "inspectionDate";
    }
    // Sent when the admin turned the field on after the form loaded.
    if (/proof of billing/i.test(message)) return "proofOfBillingImage";
    return null;
};
