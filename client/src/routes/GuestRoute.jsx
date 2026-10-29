import { Navigate, Outlet } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

const GuestRoute = () => {
    const {
        initialized,
        loading,
        isAuthenticated,
        user,
    } = useAuth();

    if (!initialized || loading) {
        return (
            <LoadingSpinner
                message="Checking authentication..."
            />
        );
    }

    if (isAuthenticated && user) {
        switch (user.role) {
            case "admin":
                return (
                    <Navigate
                        to="/admin"
                        replace
                    />
                );

            case "customer":
                return (
                    <Navigate
                        to="/customer"
                        replace
                    />
                );

            case "operator":
                return (
                    <Navigate
                        to="/operator"
                        replace
                    />
                );

            default:
                return (
                    <Navigate
                        to="/"
                        replace
                    />
                );
        }
    }

    return <Outlet />;
};

export default GuestRoute;