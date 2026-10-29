import api from "../lib/axios";

export const register = async (userData) => {
    const { data } = await api.post(
        "/auth/register",
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
    token
) => {
    const { data } = await api.get(
        "/auth/verify-email",
        {
            params: {
                token,
            },
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
                    "multipart/form-data",
            },
        }
    );

    return data;
};