import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import PublicNavbar from "../components/layout/PublicNavbar";
import CustomerNavbar from "../components/layout/CustomerNavbar";
import Footer from "../components/layout/Footer";

import useAuth from "../hooks/auth/useAuth";

const PublicLayout = () => {
    const { user, isAuthenticated } = useAuth();

    const isCustomer =
        isAuthenticated && user?.role === "customer";

    // Start every page (e.g. Register opened from the bottom of Home) at the
    // top — the admin/operator DashboardShell already does this.
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname]);

    return (
        <div className="site-texture lit-seams">
            {isCustomer ? (
                <CustomerNavbar />
            ) : (
                <PublicNavbar />
            )}

            <main className="min-h-screen">
                <Outlet />
            </main>

            <div className="relative z-10">
                <Footer />
            </div>
        </div>
    );
};

export default PublicLayout;