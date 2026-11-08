const KEY = "pending-registration-email";
const MAX_AGE = 6 * 60 * 60 * 1000;

// Store only the email, never the password, OTP, ID files, or upload handles.
export const rememberVerificationEmail = (email) => {
    try {
        sessionStorage.setItem(KEY, JSON.stringify({ email: email.trim(), expiresAt: Date.now() + MAX_AGE }));
    } catch { /* Verification still works when browser storage is unavailable. */ }
};

export const readVerificationEmail = () => {
    try {
        const saved = JSON.parse(sessionStorage.getItem(KEY));
        return typeof saved?.email === "string" && saved.expiresAt > Date.now() ? saved.email : "";
    } catch {
        return "";
    }
};

export const clearVerificationEmail = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* Storage is optional. */ }
};
