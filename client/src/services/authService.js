import {
    register,
    registerOperator as registerOperatorApi,
    login,
    logout,
    getCurrentUser,
    verifyEmail,
    resendVerificationEmail as resendVerificationEmailApi,
    uploadValidId as uploadValidIdApi,
    uploadProofOfBilling as uploadProofOfBillingApi,
    removeTemporaryValidId as removeTemporaryValidIdApi,
    uploadRegistrationVehicleImage as uploadRegistrationVehicleImageApi,
} from "../api/authApi";

export const registerUser = (userData) => {
    return register(userData);
};

export const registerOperator = (userData) => {
    return registerOperatorApi(userData);
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

export const verifyUserEmail = (email, code) => {
    return verifyEmail(email, code);
};

export const resendVerificationEmail = (email) => {
    return resendVerificationEmailApi(email);
};

export const uploadValidId = async (file) => {
    return await uploadValidIdApi(file);
};

export const uploadProofOfBilling = (file) =>
    uploadProofOfBillingApi(file);

export const removeTemporaryValidId = (uploadId) =>
    removeTemporaryValidIdApi(uploadId);

export const uploadRegistrationVehicleImage = async (file) => {
    return await uploadRegistrationVehicleImageApi(file);
};
