import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchProfile,
    saveProfile,
    updatePassword,
    fetchUsers,
    fetchBlacklistedUsers,
    fetchUserById,
    saveUser,
    saveUserStatus,
    removeUser,
    blacklistUserAccount,
    removeUserBlacklist,
    verifyUserValidId,
    unverifyUserValidId,
    uploadRenewedValidId as uploadRenewedValidIdService,
    grantRenewalAttempt as grantRenewalAttemptService,
    requestRenewalAttempt as requestRenewalAttemptService,
} from "../../services/userService";

const initialState = {
    profile: null,
    users: [],
    blacklistedUsers: [],
    selectedUser: null,
    loading: false,
    error: null,
};

export const getProfile = createAsyncThunk(
    "user/getProfile",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchProfile();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch profile."
            );
        }
    }
);

export const updateUserProfile = createAsyncThunk(
    "user/updateProfile",
    async (profileData, { rejectWithValue }) => {
        try {
            return await saveProfile(profileData);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to update profile."
            );
        }
    }
);

export const changeUserPassword = createAsyncThunk(
    "user/changePassword",
    async (passwordData, { rejectWithValue }) => {
        try {
            return await updatePassword(passwordData);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to change password."
            );
        }
    }
);

export const getUsers = createAsyncThunk(
    "user/getUsers",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchUsers();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch users."
            );
        }
    }
);

export const getBlacklistedUsers =
    createAsyncThunk(
        "user/getBlacklistedUsers",
        async (
            _,
            { rejectWithValue }
        ) => {
            try {
                return await fetchBlacklistedUsers();
            } catch (error) {
                return rejectWithValue(
                    error.response?.data
                        ?.message ||
                        error.message ||
                        "Unable to fetch blacklisted users."
                );
            }
        }
    );

export const getUser = createAsyncThunk(
    "user/getUser",
    async (userId, { rejectWithValue }) => {
        try {
            return await fetchUserById(userId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to fetch user."
            );
        }
    }
);

export const updateUser = createAsyncThunk(
    "user/updateUser",
    async ({ userId, userData }, { rejectWithValue }) => {
        try {
            return await saveUser(userId, userData);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to update user."
            );
        }
    }
);

export const updateUserAccountStatus = createAsyncThunk(
    "user/updateUserStatus",
    async ({ userId, isSuspended }, { rejectWithValue }) => {
        try {
            return await saveUserStatus(
                userId,
                isSuspended
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to update user status."
            );
        }
    }
);

export const blacklistUser = createAsyncThunk(
    "user/blacklistUser",
    async (
        { userId, reason },
        { rejectWithValue }
    ) => {
        try {
            return await blacklistUserAccount(
                userId,
                reason
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to blacklist user."
            );
        }
    }
);

export const unblacklistUser = createAsyncThunk(
    "user/unblacklistUser",
    async (
        userId,
        { rejectWithValue }
    ) => {
        try {
            return await removeUserBlacklist(
                userId
            );
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to remove user from blacklist."
            );
        }
    }
);

export const deleteUser = createAsyncThunk(
    "user/deleteUser",
    async (userId, { rejectWithValue }) => {
        try {
            await removeUser(userId);

            return userId;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to delete user."
            );
        }
    }
);

export const verifyValidId = createAsyncThunk(
    "user/verifyValidId",
    async ({ userId, payload }, { rejectWithValue }) => {
        try {
            return await verifyUserValidId(userId, payload);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to verify valid ID."
            );
        }
    }
);

export const unverifyValidId = createAsyncThunk(
    "user/unverifyValidId",
    async (userId, { rejectWithValue }) => {
        try {
            return await unverifyUserValidId(userId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to unverify valid ID."
            );
        }
    }
);

export const uploadRenewedValidId = createAsyncThunk(
    "user/uploadRenewedValidId",
    async (file, { rejectWithValue }) => {
        try {
            return await uploadRenewedValidIdService(file);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to upload renewed valid ID."
            );
        }
    }
);

export const grantRenewalAttempt = createAsyncThunk(
    "user/grantRenewalAttempt",
    async ({ userId, amount }, { rejectWithValue }) => {
        try {
            return await grantRenewalAttemptService(userId, amount);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to grant renewal attempt."
            );
        }
    }
);

export const requestRenewalAttempt = createAsyncThunk(
    "user/requestRenewalAttempt",
    async (userId, { rejectWithValue }) => {
        try {
            return await requestRenewalAttemptService(userId);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    error.message ||
                    "Unable to request renewal attempt."
            );
        }
    }
);

const userSlice = createSlice({
    name: "user",

    initialState,

    reducers: {
        clearUserError: (state) => {
            state.error = null;
        },

        clearSelectedUser: (state) => {
            state.selectedUser = null;
        },
    },

    extraReducers: (builder) => {
        builder

            .addCase(getProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.profile = action.payload?.data ?? null;
            })

            .addCase(getProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(updateUserProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(updateUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.profile = action.payload?.data ?? null;
            })

            .addCase(updateUserProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(changeUserPassword.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(changeUserPassword.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
            })

            .addCase(changeUserPassword.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getUsers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getUsers.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.users = action.payload?.data ?? [];
            })

            .addCase(getUsers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getBlacklistedUsers.pending,(state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getBlacklistedUsers.fulfilled,(state, action) => {
                state.loading = false;
                state.error = null;
                state.blacklistedUsers =
                action.payload?.data ?? [];
            })

            .addCase(getBlacklistedUsers.rejected,(state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(getUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getUser.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                state.selectedUser = action.payload?.data ?? null;
            })

            .addCase(getUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(updateUser.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.selectedUser = action.payload?.data ?? null;

                state.users = state.users.map((user) =>
                    user.id === action.payload?.data?.id
                        ? action.payload.data
                        : user
                );
            })

            .addCase(updateUserAccountStatus.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.selectedUser = action.payload?.data ?? null;

                const updatedUserId =
                    action.payload?.data?._id ??
                    action.payload?.data?.id;

                state.users = state.users.map((user) =>
                    (user._id ?? user.id) ===
                        updatedUserId
                        ? action.payload.data
                        : user
                );
            })

            .addCase(
    blacklistUser.fulfilled,
    (state, action) => {
        state.loading = false;
        state.error = null;

        const blacklistedUserId =
            action.payload?.data?._id ??
            action.payload?.data?.id;

        if (blacklistedUserId) {
            state.users = state.users.filter(
                (user) =>
                    (user._id ?? user.id) !==
                    blacklistedUserId
            );

            state.blacklistedUsers = [
                action.payload.data,
                ...state.blacklistedUsers,
            ];
        }
    }
)

.addCase(
    blacklistUser.rejected,
    (state, action) => {
        state.loading = false;
        state.error = action.payload;
    }
)

.addCase(
    unblacklistUser.fulfilled,
    (state, action) => {
        state.loading = false;
        state.error = null;

        const unblacklistedUserId =
            action.payload?.data?._id ??
            action.payload?.data?.id;

        if (unblacklistedUserId) {
            state.blacklistedUsers =
                state.blacklistedUsers.filter(
                    (user) =>
                        (user._id ??
                            user.id) !==
                        unblacklistedUserId
                );

            state.users = [
                action.payload.data,
                ...state.users,
            ];
        }
    }
)

.addCase(
    unblacklistUser.rejected,
    (state, action) => {
        state.loading = false;
        state.error = action.payload;
    }
)

            .addCase(deleteUser.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.users = state.users.filter(
                    (user) => user.id !== action.payload
                );

                if (
                    state.selectedUser?.id === action.payload
                ) {
                    state.selectedUser = null;
                }
            })

            .addCase(verifyValidId.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.selectedUser = action.payload?.data ?? null;

                state.users = state.users.map((user) =>
                    user.id === action.payload?.data?.id
                        ? action.payload.data
                        : user
                );
            })

            .addCase(verifyValidId.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(unverifyValidId.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.selectedUser = action.payload?.data ?? null;

                state.users = state.users.map((user) =>
                    user.id === action.payload?.data?.id
                        ? action.payload.data
                        : user
                );
            })

            .addCase(unverifyValidId.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(uploadRenewedValidId.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.profile = action.payload?.data ?? null;
            })

            .addCase(uploadRenewedValidId.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            .addCase(grantRenewalAttempt.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                state.selectedUser = action.payload?.data ?? null;

                state.users = state.users.map((user) =>
                    (user._id ?? user.id) ===
                        (action.payload?.data?._id ??
                            action.payload?.data?.id)
                        ? action.payload.data
                        : user
                );
            })

            .addCase(grantRenewalAttempt.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const {
    clearUserError,
    clearSelectedUser,
} = userSlice.actions;

export default userSlice.reducer;