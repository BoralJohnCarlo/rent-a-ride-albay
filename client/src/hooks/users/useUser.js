import {
    useCallback,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getProfile,
    updateUserProfile,
    changeUserPassword,
    getBlacklistedUsers,
    getUsers,
    getUser,
    updateUser,
    updateUserAccountStatus,
    blacklistUser,
    unblacklistUser,
    deleteUser,
    clearUserError,
    clearSelectedUser,
    verifyValidId,
    unverifyValidId,
    uploadRenewedValidId,
    grantRenewalAttempt,
} from "../../store/users";

const useUser = () => {
    const dispatch = useDispatch();

    const {
        profile,
        users,
        blacklistedUsers,
        selectedUser,
        loading,
        error,
    } = useSelector(
        (state) => state.users
    );

    const fetchProfile = useCallback(
        () =>
            dispatch(
                getProfile()
            ).unwrap(),
        [dispatch]
    );

    const saveProfile = useCallback(
        (profileData) =>
            dispatch(
                updateUserProfile(
                    profileData
                )
            ).unwrap(),
        [dispatch]
    );

    const updatePassword = useCallback(
        (passwordData) =>
            dispatch(
                changeUserPassword(
                    passwordData
                )
            ).unwrap(),
        [dispatch]
    );

    const fetchUsers = useCallback(
        () =>
            dispatch(
                getUsers()
            ).unwrap(),
        [dispatch]
    );

    const fetchBlacklistedUsers =
    useCallback(
        () =>
            dispatch(
                getBlacklistedUsers()
            ).unwrap(),
        [dispatch]
    );

    const fetchUser = useCallback(
        (userId) =>
            dispatch(
                getUser(userId)
            ).unwrap(),
        [dispatch]
    );

    const saveUser = useCallback(
        (
            userId,
            userData
        ) =>
            dispatch(
                updateUser({
                    userId,
                    userData,
                })
            ).unwrap(),
        [dispatch]
    );

    const saveUserStatus =
        useCallback(
            (
                userId,
                isSuspended
            ) =>
                dispatch(
                    updateUserAccountStatus({
                        userId,
                        isSuspended,
                    })
                ).unwrap(),
            [dispatch]
        );

    const blacklistUserAccount =
    useCallback(
        (
            userId,
            reason
        ) =>
            dispatch(
                blacklistUser({
                    userId,
                    reason,
                })
            ).unwrap(),
        [dispatch]
    );

const removeUserBlacklist =
    useCallback(
        (userId) =>
            dispatch(
                unblacklistUser(userId)
            ).unwrap(),
        [dispatch]
    );

    const removeUser = useCallback(
        (userId) =>
            dispatch(
                deleteUser(userId)
            ).unwrap(),
        [dispatch]
    );

    const verifyCustomerValidId = useCallback(
        (userId, payload) =>
            dispatch(
                verifyValidId({ userId, payload })
            ).unwrap(),
        [dispatch]
    );

    const unverifyCustomerValidId = useCallback(
        (userId) =>
            dispatch(
                unverifyValidId(userId)
            ).unwrap(),
        [dispatch]
    );

    const uploadRenewedValidIdHook = useCallback(
        (file) =>
            dispatch(
                uploadRenewedValidId(file)
            ).unwrap(),
        [dispatch]
    );

    const grantRenewalAttemptHook = useCallback(
        ({ userId, amount }) =>
            dispatch(
                grantRenewalAttempt({ userId, amount })
            ).unwrap(),
        [dispatch]
    );

    const clearError = useCallback(
        () =>
            dispatch(
                clearUserError()
            ),
        [dispatch]
    );

    const clearUser =
        useCallback(
            () =>
                dispatch(
                    clearSelectedUser()
                ),
            [dispatch]
        );

    return {
        profile,
        users,
        blacklistedUsers,
        selectedUser,
        loading,
        error,

        getProfile: fetchProfile,
        updateProfile: saveProfile,
        changePassword: updatePassword,

        getUsers: fetchUsers,
        getBlacklistedUsers:
        fetchBlacklistedUsers,
        getUser: fetchUser,

        updateUser: saveUser,
        updateUserStatus:
        saveUserStatus,

        blacklistUser:
        blacklistUserAccount,

        unblacklistUser:
        removeUserBlacklist,

        deleteUser: removeUser,

        verifyValidId: verifyCustomerValidId,
        unverifyValidId: unverifyCustomerValidId,
        uploadRenewedValidId: uploadRenewedValidIdHook,
        grantRenewalAttempt: grantRenewalAttemptHook,

        clearError,
        clearSelectedUser:
            clearUser,
    };
};

export default useUser;