import {
    getProfile,
    updateProfile,
    uploadProfileImage as uploadProfileImageApi,
    changePassword,
    getUsers,
    getBlacklistedUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    deleteUser,
    blacklistUser,
    unblacklistUser,
    verifyValidId as verifyValidIdApi,
    unverifyValidId as unverifyValidIdApi,
    getValidIdHistory as getValidIdHistoryApi,
    uploadRenewedValidId as uploadRenewedValidIdApi,
    uploadProofOfBilling as uploadProofOfBillingApi,
    grantRenewalAttempt as grantRenewalAttemptApi,
    requestRenewalAttempt as requestRenewalAttemptApi,
} from "../api/userApi";

export const fetchProfile = async () => {
    return await getProfile();
};

export const saveProfile = async (profileData) => {
    return await updateProfile(profileData);
};

export const uploadProfileImage = async (file) => {
    return await uploadProfileImageApi(file);
};

export const updatePassword = async (passwordData) => {
    return await changePassword(passwordData);
};

export const fetchUsers = async () => {
    return await getUsers();
};

export const fetchBlacklistedUsers =
    async () => {
        return await getBlacklistedUsers();
    };

export const fetchUserById = async (userId) => {
    return await getUserById(userId);
};

export const saveUser = async (userId, userData) => {
    return await updateUser(userId, userData);
};

export const saveUserStatus = async (userId, isSuspended) => {
    return await updateUserStatus(userId, isSuspended);
};

export const removeUser = async (userId) => {
    return await deleteUser(userId);
};

export const blacklistUserAccount = async (
    userId,
    reason
) => {
    return await blacklistUser(
        userId,
        reason
    );
};

export const removeUserBlacklist = async (
    userId
) => {
    return await unblacklistUser(userId);
};

export const verifyUserValidId = async (
    userId,
    payload
) => {
    return await verifyValidIdApi(userId, payload);
};

export const fetchValidIdHistory = (userId) =>
    getValidIdHistoryApi(userId);

export const unverifyUserValidId = async (
    userId
) => {
    return await unverifyValidIdApi(userId);
};

export const uploadRenewedValidId = async (file) => {
    return await uploadRenewedValidIdApi(file);
};

export const uploadProofOfBilling = (file) =>
    uploadProofOfBillingApi(file);

export const grantRenewalAttempt = async (
    userId,
    amount
) => {
    return await grantRenewalAttemptApi(userId, amount);
};

export const requestRenewalAttempt = async (userId) => {
    return await requestRenewalAttemptApi(userId);
};