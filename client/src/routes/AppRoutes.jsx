import {
    Navigate,
    Route,
    Routes,
} from "react-router-dom";

import PublicLayout from "../layouts/PublicLayout";
import AdminLayout from "../layouts/AdminLayout";
import CustomerLayout from "../layouts/CustomerLayout";
import OperatorLayout from "../layouts/OperatorLayout";

import GuestRoute from "./GuestRoute";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import CustomerRoute from "./CustomerRoute";
import OperatorRoute from "./OperatorRoute";

import Home from "../pages/public/Home";
import Login from "../pages/public/Login";
import Register from "../pages/public/Register";
import Unauthorized from "../pages/public/Unauthorized";
import NotFound from "../pages/public/NotFound";
import PublicVehicles from "../pages/public/PublicVehicles";
import VehicleDetails from "../pages/public/VehicleDetails";
import About from "../pages/public/About";
import Contact from "../pages/public/Contact";
import FAQ from "../pages/public/FAQ";
import TermsOfService from "../pages/public/TermsOfService";
import Privacy from "../pages/public/Privacy";
import ForgotPassword from "../pages/public/ForgotPassword";
import ResetPassword from "../pages/public/ResetPassword";
import VerifyEmail from "../pages/public/VerifyEmail";

import Dashboard from "../pages/admin/Dashboard/Dashboard";
import UserModeration from "../pages/admin/UserModeration/UserModeration";
import Vehicles from "../pages/admin/Vehicles/Vehicles";
import VehicleCategories from "../pages/admin/categories";
import VehicleOwners from "../pages/admin/VehicleOwners/VehicleOwners";
import Consignments from "../pages/admin/Consignments/Consignments";
import Drivers from "../pages/admin/Drivers/Drivers";
import Bookings from "../pages/admin/Bookings/Bookings";
import Rentals from "../pages/admin/Rentals/Rentals";
import Payments from "../pages/admin/Payments/Payments";
import Statistics from "../pages/admin/Statistics/Statistics";
import Settings from "../pages/admin/settings/Settings";
import ServiceLocations from "../pages/admin/settings/ServiceLocations";
import ReviewManagement from "../pages/admin/Reviews/Reviews";

import OperatorDashboard from "../pages/operator/Dashboard";
import OperatorConsignments from "../pages/operator/Consignments";
import OperatorRentals from "../pages/operator/Rentals";
import OperatorStatistics from "../pages/operator/Statistics";

import CustomerHome from "../pages/customer/Home";
import CustomerBookings from "../pages/customer/Bookings";
import Checkout from "../pages/customer/Checkout";
import PaymentResult from "../pages/customer/PaymentResult";
import Profile from "../pages/customer/Profile";

const AppRoutes = () => {
    return (
        <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
                {/* Guest-only public home */}
                <Route element={<GuestRoute />}>
                    <Route
                        index
                        element={<Home />}
                    />
                </Route>

                <Route
                    path="vehicles"
                    element={<PublicVehicles />}
                />

                <Route
                    path="vehicles/:vehicleId"
                    element={<VehicleDetails />}
                />

                <Route
                    path="about"
                    element={<About />}
                />

                <Route
                    path="contact"
                    element={<Contact />}
                />

                <Route
                    path="faq"
                    element={<FAQ />}
                />

                <Route
                    path="terms"
                    element={<TermsOfService />}
                />

                <Route
                    path="/verify-email"
                    element={<VerifyEmail />}
                />

                <Route
                    path="privacy"
                    element={<Privacy />}
                />

                <Route
                    path="unauthorized"
                    element={<Unauthorized />}
                />

                {/* Guest Routes */}
                <Route element={<GuestRoute />}>
                    <Route
                        path="login"
                        element={<Login />}
                    />

                    <Route
                        path="register"
                        element={<Register />}
                    />

                    <Route
                        path="forgot-password"
                        element={<ForgotPassword />}
                    />

                    <Route
                        path="reset-password/:token"
                        element={<ResetPassword />}
                    />

                </Route>
            </Route>

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
                {/* Admin */}
                <Route element={<AdminRoute />}>
                    <Route
                        path="admin"
                        element={<AdminLayout />}
                    >
                        <Route
                            index
                            element={<Dashboard />}
                        />

                        <Route
                            path="users"
                            element={<UserModeration />}
                        />

                        <Route
                            path="vehicle-owners"
                            element={<VehicleOwners />}
                        />

                        <Route
                            path="vehicles"
                            element={<Vehicles />}
                        />

                        <Route
                            path="drivers"
                            element={<Drivers />}
                        />

                        <Route
                            path="categories"
                            element={<VehicleCategories />}
                        />

                        <Route
                            path="consignments"
                            element={<Consignments />}
                        />

                        <Route
                            path="bookings"
                            element={<Bookings />}
                        />

                        <Route
                            path="rentals"
                            element={<Rentals />}
                        />

                        <Route
                            path="payments"
                            element={<Payments />}
                        />

                        <Route
                            path="statistics"
                            element={<Statistics />}
                        />

                        <Route
                            path="settings"
                            element={<Settings />}
                        >
                            <Route
                                path="service-locations"
                                element={<ServiceLocations />}
                            />
                        </Route>

                    {/*
                        Future Admin Routes

                        <Route
                            path="payments"
                            element={<PaymentManagement />}
                        />

                        <Route
                            path="promotions"
                            element={<PromotionManagement />}
                        />

                        <Route
                            path="reviews"
                            element={<ReviewManagement />}
                        />

                        <Route
                            path="reports"
                            element={<Reports />}
                        />

                        <Route
                            path="settings"
                            element={<Settings />}
                        />
                    */}
                    </Route>
                </Route>

                <Route element={<CustomerRoute />}>
                    <Route
                        path="customer"
                        element={<CustomerLayout />}
                    >
                    <Route
                        index
                        element={
                    <Navigate
                        to="home"
                        replace
                    />
                    }
                    />

                    <Route
                        path="home"
                        element={<CustomerHome />}
                    />

                    <Route
                        path="bookings"
                        element={<CustomerBookings />}
                    />

                    <Route
                        path="profile"
                        element={<Profile />}
                    />

                    <Route
                        path="checkout/:paymentId"
                        element={<Checkout />}
                    />

                    <Route
                        path="payment/:status"
                        element={<PaymentResult />}
                    />

                    <Route
                        path="dashboard"
                        element={<Dashboard />}
                        />
                    </Route>
                </Route>

                {/* Operator */}
                <Route element={<OperatorRoute />}>
                    <Route
                        path="operator"
                        element={<OperatorLayout />}
                    >
                        <Route
                            index
                            element={<OperatorDashboard />}
                        />

                        <Route
                            path="consignments"
                            element={<OperatorConsignments />}
                        />

                        <Route
                            path="rentals"
                            element={<OperatorRentals />}
                        />

                        <Route
                            path="statistics"
                            element={<OperatorStatistics />}
                        />

                        {/*
                            Future Operator Routes

                            <Route
                                path="fleet"
                                element={<FleetManagement />}
                            />

                            <Route
                                path="bookings"
                                element={<OperatorBookings />}
                            />

                            <Route
                                path="rental-history"
                                element={<RentalHistory />}
                            />

                            <Route
                                path="gps"
                                element={<GpsTracking />}
                            />

                            <Route
                                path="profile"
                                element={<OperatorProfile />}
                            />
                        */}
                    </Route>
                </Route>
            </Route>

            {/* 404 */}
            <Route
                path="*"
                element={<NotFound />}
            />
        </Routes>
    );
};

export default AppRoutes;