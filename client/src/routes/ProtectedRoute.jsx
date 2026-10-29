import { Navigate, Outlet, useLocation } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

const ProtectedRoute = ({ allowedRoles = [] }) => {
    const {
        initialized,
        loading,
        isAuthenticated,
        user,
    } = useAuth();

    const location = useLocation();

    if (!initialized || loading) {
        return (
            <LoadingSpinner
                message="Verifying your session..."
            />
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(user?.role)
    ) {
        return (
            <Navigate
                to="/unauthorized"
                replace
            />
        );
    }

    return <Outlet />;
};

export default ProtectedRoute;