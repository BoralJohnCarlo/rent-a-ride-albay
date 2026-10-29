import { Navigate, Outlet } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

const CustomerRoute = () => {
    const {
        initialized,
        loading,
        isAuthenticated,
        user,
    } = useAuth();

    if (!initialized || loading) {
        return (
            <LoadingSpinner
                message="Verifying customer access..."
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

    if (user?.role !== "customer") {
        return (
            <Navigate
                to="/unauthorized"
                replace
            />
        );
    }

    return <Outlet />;
};

export default CustomerRoute;