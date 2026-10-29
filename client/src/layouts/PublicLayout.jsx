import { Outlet } from "react-router-dom";

import PublicNavbar from "../components/layout/PublicNavbar";
import CustomerNavbar from "../components/layout/CustomerNavbar";
import Footer from "../components/layout/Footer";

import useAuth from "../hooks/auth/useAuth";

const PublicLayout = () => {
    const { user, isAuthenticated } = useAuth();

    const isCustomer =
        isAuthenticated && user?.role === "customer";

    return (
        <>
            {isCustomer ? (
                <CustomerNavbar />
            ) : (
                <PublicNavbar />
            )}

            <main className="min-h-screen">
                <Outlet />
            </main>

            <Footer />
        </>
    );
};

export default PublicLayout;