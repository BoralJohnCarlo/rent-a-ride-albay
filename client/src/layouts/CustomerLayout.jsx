import { Outlet } from "react-router-dom";

import PageTransition from "../components/common/PageTransition";

import {
    CustomerNavbar,
} from "../components/layout";

const CustomerLayout = () => {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-950">
            <CustomerNavbar />

            <main className="min-h-screen">
                <PageTransition>
                    <Outlet />
                </PageTransition>
            </main>
        </div>
    );
};

export default CustomerLayout;