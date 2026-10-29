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
        // Back here after signing in — e.g. a receipt link opened from an
        // email while logged out (see GuestRoute).
        const redirect = encodeURIComponent(
            `${location.pathname}${location.search}`
        );

        return (
            <Navigate
                to={`/login?redirect=${redirect}`}
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