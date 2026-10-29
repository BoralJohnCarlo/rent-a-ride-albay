/*
 * Whether a driver's license covers a trip: it must not have expired and,
 * when `validThrough` is given (the trip's end), must last until then.
 * Returns null when it does, else "expired" | "expires-during".
 */
export const getDriverLicenseIssue = (driver, validThrough = null) => {
    const raw = driver?.license?.expiryDate;
    const expiry = raw ? new Date(raw) : null;

    if (!expiry || Number.isNaN(expiry.getTime())) {
        return "expired";
    }

    if (expiry.getTime() <= Date.now()) {
        return "expired";
    }

    if (
        validThrough &&
        expiry.getTime() < new Date(validThrough).getTime()
    ) {
        return "expires-during";
    }

    return null;
};

/* Mongo filter for drivers whose license is valid now and through `validThrough`. */
export const validLicenseFilter = (validThrough = null) => {
    const now = new Date();
    const until =
        validThrough && new Date(validThrough) > now
            ? new Date(validThrough)
            : now;

    return {
        "license.expiryDate": { $gte: until },
    };
};
