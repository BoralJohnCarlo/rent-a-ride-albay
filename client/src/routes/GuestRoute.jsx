import { Navigate, Outlet, useSearchParams } from "react-router-dom";

import LoadingSpinner from "../components/common/LoadingSpinner";
import useAuth from "../hooks/auth/useAuth";

/*
 * A `?redirect=` path set by ProtectedRoute, when it's safe to follow: an
 * in-app path only — never another site ("//evil.com", "https://...").
 */
const safeRedirect = (value) =>
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
        ? value
        : null;

const GuestRoute = () => {
    const {
        initialized,
        isAuthenticated,
        user,
    } = useAuth();

    const [searchParams] = useSearchParams();

    // Only block guest pages while the initial session lookup is pending.
    // Registration and login also use the shared auth loading flag; reacting
    // to it here unmounts the active form and loses its local state.
    if (!initialized) {
        return (
            <LoadingSpinner
                message="Checking authentication..."
            />
        );
    }

    if (isAuthenticated && user) {
        const redirect = safeRedirect(
            searchParams.get("redirect")
        );

        if (redirect) {
            return (
                <Navigate
                    to={redirect}
                    replace
                />
            );
        }

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
