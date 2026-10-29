import api from "../lib/axios";

export const register = async (userData) => {
    const { data } = await api.post(
        "/auth/register",
        userData
    );

    return data;
};

export const registerOperator = async (userData) => {
    const { data } = await api.post(
        "/auth/register-operator",
        userData
    );

    return data;
};

export const login = async (credentials) => {
    const { data } = await api.post(
        "/auth/login",
        credentials
    );

    return data;
};

export const logout = async () => {
    const { data } = await api.post(
        "/auth/logout"
    );

    return data;
};

export const getCurrentUser = async () => {
    const { data } = await api.get(
        "/auth/me"
    );

    return data;
};

export const verifyEmail = async (
    email,
    code
) => {
    const { data } = await api.post(
        "/auth/verify-email",
        {
            email,
            code,
        }
    );

    return data;
};

export const resendVerificationEmail =
    async (email) => {
        const { data } = await api.post(
            "/auth/resend-verification",
            {
                email,
            }
        );

        return data;
    };

/*
 * Forgot password: request a code → trade it for a reset token → set the
 * new password with that token.
 */
export const requestPasswordReset = async (email) => {
    const { data } = await api.post(
        "/auth/forgot-password",
        { email }
    );

    return data;
};

export const verifyPasswordResetCode = async (email, code) => {
    const { data } = await api.post(
        "/auth/forgot-password/verify",
        { email, code }
    );

    return data;
};

export const resetPassword = async ({
    email,
    resetToken,
    newPassword,
    confirmPassword,
}) => {
    const { data } = await api.post(
        "/auth/reset-password",
        { email, resetToken, newPassword, confirmPassword }
    );

    return data;
};

export const uploadValidId = async (file) => {
    const formData = new FormData();

    formData.append(
        "validIdImage",
        file
    );

    const { data } = await api.post(
        "/auth/upload-valid-id",
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

export const uploadProofOfBilling = async (file) => {
    const formData = new FormData();

    formData.append(
        "proofOfBillingImage",
        file
    );

    const { data } = await api.post(
        "/auth/upload-proof-of-billing",
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

export const removeTemporaryValidId = async (uploadId) => {
    const { data } = await api.delete(
        `/auth/temporary-valid-id/${uploadId}`
    );
    return data;
};

export const uploadRegistrationVehicleImage = async (file) => {
    const formData = new FormData();

    formData.append(
        "image",
        file
    );

    const { data } = await api.post(
        "/auth/upload-vehicle-image",
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
