import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
    registerUser,
    loginUser,
    logoutUser,
    fetchCurrentUser,
    registerOperator as registerOperatorService,
} from "../../services/authService";

const initialState = {
    user: null,
    isAuthenticated: false,
    loading: false,
    logoutLoading: false,
    initialized: false,
    error: null,
};

/*
 * A rejected server-side validation answers "Validation failed." with the
 * field errors alongside — show the first field's own message instead, so
 * the user knows what to fix.
 */
const getRegistrationErrorMessage = (error, fallback) => {
    const data = error.response?.data;
    const firstFieldError = Array.isArray(data?.errors)
        ? data.errors.find((entry) => entry?.msg)?.msg
        : null;

    return firstFieldError || data?.message || error.message || fallback;
};

export const register = createAsyncThunk(
    "auth/register",
    async (userData, { rejectWithValue }) => {
        try {
            return await registerUser(userData);
        } catch (error) {
            return rejectWithValue(
                getRegistrationErrorMessage(error, "Registration failed.")
            );
        }
    }
);

export const registerOperator = createAsyncThunk(
    "auth/registerOperator",
    async (userData, { rejectWithValue }) => {
        try {
            return await registerOperatorService(userData);
        } catch (error) {
            return rejectWithValue(
                getRegistrationErrorMessage(
                    error,
                    "Operator registration failed."
                )
            );
        }
    }
);

export const login = createAsyncThunk(
    "auth/login",
    async (credentials, { rejectWithValue }) => {
        try {
            return await loginUser(credentials);
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Login failed."
            );
        }
    }
);

export const logout = createAsyncThunk(
    "auth/logout",
    async (_, { rejectWithValue }) => {
        const minimumDuration = 500;
        const startTime = Date.now();

        try {
            await logoutUser();

            const elapsed =
                Date.now() - startTime;

            const remaining =
                minimumDuration - elapsed;

            if (remaining > 0) {
                await new Promise(
                    (resolve) =>
                        setTimeout(
                            resolve,
                            remaining
                        )
                );
            }
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Logout failed."
            );
        }
    }
);

export const getCurrentUser = createAsyncThunk(
    "auth/getCurrentUser",
    async (_, { rejectWithValue }) => {
        try {
            return await fetchCurrentUser();
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch user."
            );
        }
    }
);

const authSlice = createSlice({
    name: "auth",

    initialState,

    reducers: {
        clearAuthError: (state) => {
            state.error = null;
        },

        /*
         * Merges freshly-saved profile fields (e.g. a renewed license
         * expiration date) into the already-authenticated user, using data
         * the caller already has from a successful save response — no
         * network round-trip, so unlike `getCurrentUser` a transient
         * failure here can't ever deauthenticate the session.
         */
        // The server rejected this device's session (e.g. the password was
        // changed elsewhere) - drop it locally, no logout request needed.
        sessionEnded: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.initialized = true;
            state.loading = false;
        },

        updateAuthUser: (state, action) => {
            if (!state.user || !action.payload) {
                return;
            }

            state.user = {
                ...state.user,
                ...action.payload,
            };
        },
    },

    extraReducers: (builder) => {
        builder

            // Register

            .addCase(register.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(register.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
                state.user = null;
                state.isAuthenticated = false;
            })

            .addCase(register.rejected, (state, action) => {
                state.loading = false;
                state.user = null;
                state.isAuthenticated = false;
                state.error = action.payload;
            })

            // Register Operator

            .addCase(registerOperator.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(registerOperator.fulfilled, (state) => {
                state.loading = false;
                state.error = null;
                state.user = null;
                state.isAuthenticated = false;
            })

            .addCase(registerOperator.rejected, (state, action) => {
                state.loading = false;
                state.user = null;
                state.isAuthenticated = false;
                state.error = action.payload;
            })

            // Login

            .addCase(login.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(login.fulfilled, (state, action) => {
                state.loading = false;
                state.initialized = true;
                state.error = null;
                state.user =
                    action.payload?.data ?? null;
                state.isAuthenticated =
                    !!action.payload?.data;
            })

            .addCase(login.rejected, (state, action) => {
                state.loading = false;
                state.initialized = true;
                state.user = null;
                state.isAuthenticated = false;
                state.error = action.payload;
            })

            // Logout

            .addCase(logout.pending, (state) => {
                state.logoutLoading = true;
                state.error = null;
            })

            .addCase(logout.fulfilled, (state) => {
                state.logoutLoading = false;
                state.loading = false;
                state.initialized = true;
                state.user = null;
                state.isAuthenticated = false;
                state.error = null;
            })

            .addCase(logout.rejected, (state, action) => {
                state.logoutLoading = false;
                state.error = action.payload;
            })

            // Current User

            .addCase(getCurrentUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })

            .addCase(getCurrentUser.fulfilled, (state, action) => {
                state.loading = false;
                state.initialized = true;
                state.error = null;
                state.user =
                    action.payload?.data ?? null;
                state.isAuthenticated =
                    !!action.payload?.data;
            })

            .addCase(getCurrentUser.rejected, (state) => {
                state.loading = false;
                state.initialized = true;
                state.user = null;
                state.isAuthenticated = false;
                state.error = null;
            });
    },
});

export const { clearAuthError, updateAuthUser, sessionEnded } =
    authSlice.actions;

export default authSlice.reducer;