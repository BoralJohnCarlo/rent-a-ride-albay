import api from "../lib/axios";

export const getProfile = async () => {
    const { data } = await api.get("/users/profile");

    return data;
};

export const updateProfile = async (profileData) => {
    const { data } = await api.patch(
        "/users/profile",
        profileData
    );

    return data;
};

export const uploadProfileImage = async (file) => {
    const formData = new FormData();

    formData.append("profileImage", file);

    const { data } = await api.post(
        "/users/profile/upload-image",
        formData,
        {
            headers: {
                "Content-Type":
                    undefined,
            },
        }
    );

    return data;
};

export const changePassword = async (passwordData) => {
    const { data } = await api.patch(
        "/users/change-password",
        passwordData
    );

    return data;
};

// { soundVolume?: 0-100, soundMuted?: boolean } → the saved preferences.
export const updateNotificationPreferences = async (preferences) => {
    const { data } = await api.patch(
        "/users/notification-preferences",
        preferences
    );

    return data;
};

export const getUsers = async () => {
    const { data } = await api.get("/users");

    return data;
};

export const getBlacklistedUsers = async () => {
    const { data } = await api.get(
        "/users/blacklisted"
    );

    return data;
};

export const getUserById = async (userId) => {
    const { data } = await api.get(
        `/users/${userId}`
    );

    return data;
};

export const updateUser = async (
    userId,
    userData
) => {
    const { data } = await api.patch(
        `/users/${userId}`,
        userData
    );

    return data;
};

export const updateUserStatus = async (
    userId,
    isSuspended
) => {
    const { data } = await api.patch(
        `/users/${userId}/status`,
        {
            isSuspended,
        }
    );

    return data;
};

export const deleteUser = async (userId) => {
    const { data } = await api.delete(
        `/users/${userId}`
    );

    return data;
};

export const blacklistUser = async (
    userId,
    reason
) => {
    const { data } = await api.post(
        `/users/${userId}/blacklist`,
        {
            reason,
        }
    );

    return data;
};

export const unblacklistUser = async (
    userId
) => {
    const { data } = await api.delete(
        `/users/${userId}/blacklist`
    );

    return data;
};

/*
 * `payload.expirationDate`: the expiry printed on the ID ("YYYY-MM-DD"),
 * null when the ID has none, or left out to keep the date on file.
 */
export const verifyValidId = async (
    userId,
    payload = {}
) => {
    const { data } = await api.post(
        `/users/${userId}/verify-valid-id`,
        payload
    );

    return data;
};

// Every valid ID the user has had on file, current one first.
export const getValidIdHistory = async (
    userId
) => {
    const { data } = await api.get(
        `/users/${userId}/valid-id-history`
    );

    return data;
};

export const unverifyValidId = async (
    userId
) => {
    const { data } = await api.post(
        `/users/${userId}/unverify-valid-id`
    );

    return data;
};

export const grantRenewalAttempt = async (
    userId,
    amount
) => {
    const { data } = await api.post(
        `/users/${userId}/grant-renewal-attempt`,
        {
            amount,
        }
    );

    return data;
};

export const requestRenewalAttempt = async () => {
    const { data } = await api.post(
        `/users/request-renewal-attempt`,
        {}
    );

    return data;
};

export const uploadProofOfBilling = async (file) => {
    const formData = new FormData();

    formData.append("proofOfBillingImage", file);

    const { data } = await api.post(
        "/users/profile/proof-of-billing",
        formData,
        {
            headers: {
                "Content-Type": undefined,
            },
        }
    );

    return data;
};

export const uploadRenewedValidId = async (
    file,
    licenseUpgrade = null
) => {
    const formData = new FormData();

    formData.append("validIdImage", file);

    /*
     * Deliberately just the type + basic license identity fields here, not
     * licenseCodes/transmissions too - those are plain strings, safe to
     * send as ordinary multipart fields (unlike arrays, which multer only
     * turns into a real array when a field repeats more than once,
     * otherwise leaving a single value as a bare string). A customer
     * upgrading their ID type can declare what they're licensed to drive
     * afterward in the Driver's License section, which becomes visible as
     * soon as hasDriversLicense flips to true.
     */
    if (licenseUpgrade?.validIdType) {
        formData.append(
            "validIdType",
            licenseUpgrade.validIdType
        );
        formData.append(
            "licenseNumber",
            licenseUpgrade.licenseNumber || ""
        );
        formData.append(
            "licenseExpirationDate",
            licenseUpgrade.licenseExpirationDate || ""
        );
    }

    const { data } = await api.post(
        `/users/profile/renew-valid-id`,
        formData,
        {
            headers: {
                "Content-Type":
                    undefined,
            },
        }
    );

    return data;
};