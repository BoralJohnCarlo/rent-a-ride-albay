import { useCallback, useState } from "react";

import {
    verifyUserEmail,
    resendVerificationEmail as resendVerificationEmailApi,
} from "../../services/authService";

const useEmailVerification = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const verifyEmail = useCallback(
        async (email, code) => {
            setLoading(true);
            setError(null);

            try {
                return await verifyUserEmail(email, code);
            } catch (error) {
                const message =
                    error.response?.data?.message ||
                    "Unable to verify your email.";

                setError(message);

                throw error;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const resendVerificationEmail = useCallback(
        async (email) => {
            setLoading(true);
            setError(null);

            try {
                return await resendVerificationEmailApi(email);
            } catch (error) {
                const message =
                    error.response?.data?.message ||
                    "Unable to resend verification email.";

                setError(message);

                throw error;
            } finally {
                setLoading(false);
            }
        },
        []
    );

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        loading,
        error,
        verifyEmail,
        resendVerificationEmail,
        clearError,
    };
};

export default useEmailVerification;