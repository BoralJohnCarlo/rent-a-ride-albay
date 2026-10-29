import { useEffect } from "react";

import AuthContext from "../context/AuthContext";
import useAuth from "../hooks/auth/useAuth";

const AuthProvider = ({ children }) => {
    const auth = useAuth();

    const {
        initialized,
        refreshUser,
    } = auth;

    useEffect(() => {
        if (!initialized) {
            refreshUser();
        }
    }, [initialized, refreshUser]);

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;