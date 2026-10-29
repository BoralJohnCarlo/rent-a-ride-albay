import {
    createUser,
    getProfile,
    updateProfile,
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
} from "../api/userApi";

export const fetchProfile = async () => {
    return await getProfile();
};

export const saveProfile = async (profileData) => {
    return await updateProfile(profileData);
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

export const createUserAccount = async (
    userData
) => {
    return await createUser(userData);
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
    userId
) => {
    return await verifyValidIdApi(userId);
};

export const unverifyUserValidId = async (
    userId
) => {
    return await unverifyValidIdApi(userId);
};