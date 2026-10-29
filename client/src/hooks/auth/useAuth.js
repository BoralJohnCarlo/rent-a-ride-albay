import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    login,
    logout,
    register,
    getCurrentUser,
    clearAuthError,
    registerOperator,
    updateAuthUser,
} from "../../store/auth";

const useAuth = () => {
    const dispatch = useDispatch();

    const {
        user,
        loading,
        logoutLoading,
        initialized,
        isAuthenticated,
        error,
    } = useSelector((state) => state.auth);

    const loginUser = useCallback(
        async (credentials) => {
            return await dispatch(
                login(credentials)
            ).unwrap();
        },
        [dispatch]
    );

    const registerUser = useCallback(
        async (userData) => {
            return await dispatch(
                register(userData)
            ).unwrap();
        },
        [dispatch]
    );

    const registerOperatorUser = useCallback(
        async (userData) => {
            return await dispatch(
                registerOperator(userData)
            ).unwrap();
        },
        [dispatch]
    );

    const logoutUser = useCallback(
        async () => {
            return await dispatch(
                logout()
            ).unwrap();
        },
        [dispatch]
    );

    const refreshUser = useCallback(
        async () => {
            return await dispatch(
                getCurrentUser()
            ).unwrap();
        },
        [dispatch]
    );

    const clearError = useCallback(() => {
        dispatch(clearAuthError());
    }, [dispatch]);

    const updateUser = useCallback(
        (userFields) => {
            dispatch(updateAuthUser(userFields));
        },
        [dispatch]
    );

    return {
        user,
        loading,
        logoutLoading,
        initialized,
        isAuthenticated,
        error,
        login: loginUser,
        register: registerUser,
        registerOperator: registerOperatorUser,
        logout: logoutUser,
        refreshUser,
        updateUser,
        clearError,
    };
};

export default useAuth;