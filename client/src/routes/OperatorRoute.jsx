import { Navigate, Outlet } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

const OperatorRoute = () => {
    const {
        initialized,
        loading,
        isAuthenticated,
        user,
    } = useAuth();

    if (!initialized || loading) {
        return (
            <LoadingSpinner
                message="Verifying operator access..."
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

    if (user?.role !== "operator") {
        return (
            <Navigate
                to="/unauthorized"
                replace
            />
        );
    }

    return <Outlet />;
};

export default OperatorRoute;