import {
    register,
    login,
    logout,
    getCurrentUser,
    verifyEmail,
    resendVerificationEmail as resendVerificationEmailApi,
    uploadValidId as uploadValidIdApi,
} from "../api/authApi";

export const registerUser = (userData) => {
    return register(userData);
};

export const loginUser = (credentials) => {
    return login(credentials);
};

export const logoutUser = () => {
    return logout();
};

export const fetchCurrentUser = () => {
    return getCurrentUser();
};

export const verifyUserEmail = (token) => {
    return verifyEmail(token);
};

export const resendVerificationEmail = (email) => {
    return resendVerificationEmailApi(email);
};

export const uploadValidId = async (file) => {
    return await uploadValidIdApi(file);
};