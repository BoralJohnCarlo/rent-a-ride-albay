import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import PageTransition from "../components/common/PageTransition";
import Footer from "../components/layout/Footer";

import {
    CustomerNavbar,
} from "../components/layout";
import CustomerServiceButton from "../components/layout/CustomerServiceButton";
import LicenseInfoRequiredModal from "../components/customer/LicenseInfoRequiredModal";

const CustomerLayout = () => {
    // Start every page (e.g. Rate Booking opened from far down My Bookings)
    // at the top — the admin/operator DashboardShell already does this.
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, [pathname]);

    return (
        <div className="site-texture lit-seams min-h-screen bg-white dark:bg-gray-950">
            <CustomerNavbar />

            <main className="min-h-screen">
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </main>

            {/* The chat page is the destination - and the bubble would sit
                over its message box. */}
            {pathname !== "/customer/customer-service" && (
                <CustomerServiceButton />
            )}

            <LicenseInfoRequiredModal />

            <Footer />
        </div>
    );
};

export default CustomerLayout;