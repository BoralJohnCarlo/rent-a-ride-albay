import { createECDH } from "node:crypto";
import { getVapidHeaders } from "web-push";

let previous;
let validated = null;

// Validate once per configuration change, without a network request or secret logs.
export const getPushConfiguration = () => {
    const values = [process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY];
    if (previous && values.every((value, index) => value === previous[index])) return validated;
    previous = values;
    validated = null;
    const [subject, publicKey, privateKey] = values;
    try {
        if (!values.every((value) => typeof value === "string" && value.length > 0)) return null;
        if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey) || !/^[A-Za-z0-9_-]{43}$/.test(privateKey)) return null;
        const contact = new URL(subject);
        if (/\s/.test(subject)) return null;
        if (contact.protocol === "mailto:" && !/^[^@\s]+@[^@\s]+$/.test(decodeURIComponent(contact.pathname))) return null;
        if (contact.protocol === "https:" && (!contact.hostname || contact.hostname === "localhost")) return null;
        const curve = createECDH("prime256v1");
        curve.setPrivateKey(Buffer.from(privateKey, "base64url"));
        if (!curve.getPublicKey().equals(Buffer.from(publicKey, "base64url"))) return null;
        // Uses the same subject/key/signing validation as real provider requests.
        getVapidHeaders("https://fcm.googleapis.com", subject, publicKey, privateKey, "aes128gcm");
        validated = { subject, publicKey, privateKey };
    } catch { /* Incomplete, malformed or mismatched configuration stays unavailable. */ }
    return validated;
};
