import { Navigate, Outlet } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

const AdminRoute = () => {
    const {
        initialized,
        loading,
        isAuthenticated,
        user,
    } = useAuth();

    if (!initialized || loading) {
        return (
            <LoadingSpinner
                message="Verifying administrator access..."
            />
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    if (user?.role !== "admin") {
        return (
            <Navigate
                to="/unauthorized"
                replace
            />
        );
    }

    return <Outlet />;
};

export default AdminRoute;