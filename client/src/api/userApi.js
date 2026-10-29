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

export const changePassword = async (passwordData) => {
    const { data } = await api.patch(
        "/users/change-password",
        passwordData
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

export const createUser = async (
    userData
) => {
    const { data } =
        await api.post(
            "/users",
            userData
        );

    return data;
};

export const verifyValidId = async (
    userId
) => {
    const { data } = await api.post(
        `/users/${userId}/verify-valid-id`
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