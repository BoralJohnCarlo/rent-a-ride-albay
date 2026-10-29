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
import RegisterOperator from "../pages/public/RegisterOperator";
import Unauthorized from "../pages/public/Unauthorized";
import NotFound from "../pages/public/NotFound";
import PublicVehicles from "../pages/public/PublicVehicles";
import AvailableVehicles from "../pages/public/AvailableVehicles";
import VehicleDetails from "../pages/public/VehicleDetails";
import DriverProfile from "../pages/public/DriverProfile";
import About from "../pages/public/About";
import ExploreAlbay from "../pages/public/ExploreAlbay";
import Contact from "../pages/public/Contact";
import FAQ from "../pages/public/FAQ";
import TermsOfService from "../pages/public/TermsOfService";
import Privacy from "../pages/public/Privacy";
import ForgotPassword from "../pages/public/ForgotPassword";

import Dashboard from "../pages/admin/Dashboard/Dashboard";
import UserModeration from "../pages/admin/UserModeration/UserModeration";
import Vehicles from "../pages/admin/Vehicles/Vehicles";
import Consignments from "../pages/admin/Consignments/Consignments";
import GPS from "../pages/admin/GPS/GPS";
import Drivers from "../pages/admin/Drivers/Drivers";
import Bookings from "../pages/admin/Bookings/Bookings";
import Payments from "../pages/admin/Payments/Payments";
import Settings from "../pages/admin/settings/Settings";
import ServiceLocations from "../pages/admin/settings/ServiceLocations";
import PenaltySettings from "../pages/admin/settings/PenaltySettings";
import RefundSettings from "../pages/admin/settings/RefundSettings";
import DriverSettings from "../pages/admin/settings/DriverSettings";
import ValidIdRenewalSettings from "../pages/admin/settings/ValidIdRenewalSettings";
import CommissionSettings from "../pages/admin/settings/CommissionSettings";
import VehicleRegistrationSettings from "../pages/admin/settings/VehicleRegistrationSettings";
import CustomerSettings from "../pages/admin/settings/CustomerSettings";
import RegistrationSettings from "../pages/admin/settings/RegistrationSettings";
import BookingSettings from "../pages/admin/settings/BookingSettings";
import ThemeSettings from "../pages/admin/settings/ThemeSettings";
import TestimonialSettings from "../pages/admin/settings/TestimonialSettings";
import LegalDocumentSettings from "../pages/admin/settings/LegalDocumentSettings";
import DestinationSettings from "../pages/admin/settings/DestinationSettings";
import AdminNotifications from "../pages/admin/Notifications";
// eslint-disable-next-line no-unused-vars
import ReviewManagement from "../pages/admin/Reviews/Reviews";
import Promotions from "../pages/admin/Promotions/Promotions";

// Import new payout pages
import CustomerServicePage from "../pages/admin/CustomerService";

import OperatorDashboard from "../pages/operator/Dashboard";
import OperatorConsignments from "../pages/operator/Consignments";
import OperatorVehicles from "../pages/operator/Vehicles";
import OperatorTracking from "../pages/operator/Tracking";
import OperatorNotifications from "../pages/operator/Notifications";
import OperatorBookings from "../pages/operator/Bookings";
import OperatorProfile from "../pages/operator/Profile";
import OperatorSettings from "../pages/operator/Settings";

// Import new earnings page
import Earnings from "../pages/operator/Earnings/Earnings";

import CustomerHome from "../pages/customer/Home";
import CustomerBookings from "../pages/customer/Bookings";
import CustomerBookingDetails from "../pages/customer/BookingDetails";
import RateBooking from "../pages/customer/RateBooking";
import CustomerNotifications from "../pages/customer/Notifications";
import Checkout from "../pages/customer/Checkout";
import PaymentResult from "../pages/customer/PaymentResult";
import Profile from "../pages/customer/Profile";
// Not CustomerSettings - that name is the admin's customer-policy settings page.
import CustomerAccountSettings from "../pages/customer/Settings";
import Favorites from "../pages/customer/Favorites";
import CustomerService from "../pages/customer/CustomerService";

import ReceiptPage from "../pages/documents/ReceiptPage";
import BookingStatementPage from "../pages/documents/BookingStatementPage";

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
                    path="available"
                    element={<AvailableVehicles />}
                />

                <Route
                    path="vehicles/:vehicleId"
                    element={<VehicleDetails />}
                />

                <Route
                    path="drivers/:driverId"
                    element={<DriverProfile />}
                />

                <Route
                    path="explore"
                    element={<ExploreAlbay />}
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
                        path="register-operator"
                        element={<RegisterOperator />}
                    />

                    <Route
                        path="forgot-password"
                        element={<ForgotPassword />}
                    />

                    {/* Reset is code-based now (all on /forgot-password). */}
                    <Route
                        path="reset-password/*"
                        element={<Navigate to="/forgot-password" replace />}
                    />

                </Route>
            </Route>

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
                {/*
                    Printable documents: no layout chrome, so they print
                    clean. Admins and the booking's customer (server-checked).
                */}
                <Route
                    path="documents/receipts/:receiptId"
                    element={<ReceiptPage />}
                />

                <Route
                    path="documents/statements/:bookingId"
                    element={<BookingStatementPage />}
                />

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
                            path="vehicles"
                            element={<Vehicles />}
                        />

                        <Route
                            path="drivers"
                            element={<Drivers />}
                        />

                        <Route path="consignments" element={<Consignments />} />

                        <Route
                            path="gps"
                            element={<GPS />}
                        />

                        {/* Trackers and GPS Alerts merged into the GPS Tracking page above. */}
                        <Route
                            path="trackers"
                            element={<Navigate to="/admin/gps" replace />}
                        />

                        <Route
                            path="gps-alerts"
                            element={<Navigate to="/admin/gps" replace />}
                        />

                        <Route
                            path="bookings"
                            element={<Bookings />}
                        />

                        <Route
                            path="payments"
                            element={<Payments />}
                        />

                        <Route
                            path="promotions"
                            element={<Promotions />}
                        />

                        {/* Old link: the Vouchers page is now a tab. */}
                        <Route
                            path="vouchers"
                            element={
                                <Navigate
                                    to="/admin/promotions"
                                    replace
                                />
                            }
                        />

                        <Route
                            path="customer-service"
                            element={<CustomerServicePage />}
                        />

<Route
                              path="settings"
                              element={<Settings />}
                          >
                               <Route
                                   path="service-locations"
                                   element={<ServiceLocations />}
                               />
                               
                               <Route
                                   path="penalties"
                                   element={<PenaltySettings />}
                               />
                               
                               <Route
                                   path="refunds"
                                   element={<RefundSettings />}
                               />
                               
                               <Route
                                   path="driver-settings"
                                   element={<DriverSettings />}
                               />
                               
                               <Route
                                   path="valid-id-renewal"
                                   element={<ValidIdRenewalSettings />}
                               />

                               <Route
                                   path="commission"
                                   element={<CommissionSettings />}
                               />

                               <Route
                                   path="vehicle-registration"
                                   element={<VehicleRegistrationSettings />}
                               />

                               <Route
                                   path="customer-settings"
                                   element={<CustomerSettings />}
                               />

                               <Route
                                   path="registration"
                                   element={<RegistrationSettings />}
                               />

                               <Route
                                   path="bookings"
                                   element={<BookingSettings />}
                               />

                               <Route
                                   path="themes"
                                   element={<ThemeSettings />}
                               />

                               <Route
                                   path="testimonials"
                                   element={<TestimonialSettings />}
                               />

                               <Route
                                   path="destinations"
                                   element={<DestinationSettings />}
                               />

                               <Route
                                   path="legal"
                                   element={<LegalDocumentSettings />}
                               />
                           </Route>

                         <Route
                             path="notifications"
                             element={<AdminNotifications />}
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
                        path="bookings/:bookingId"
                        element={<CustomerBookingDetails />}
                    />

                    <Route
                        path="bookings/:bookingId/rate"
                        element={<RateBooking />}
                    />

                    <Route
                        path="favorites"
                        element={<Favorites />}
                    />

                    <Route
                        path="profile"
                        element={<Profile />}
                    />

                    <Route
                        path="settings"
                        element={<CustomerAccountSettings />}
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
                        path="customer-service"
                        element={<CustomerService />}
                    />

                    <Route
                        path="notifications"
                        element={<CustomerNotifications />}
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
                            path="vehicles"
                            element={<OperatorVehicles />}
                        />

                        <Route
                            path="tracking"
                            element={<OperatorTracking />}
                        />

                        <Route
                            path="notifications"
                            element={<OperatorNotifications />}
                        />

                        {/* Operator Earnings */}
                        <Route
                            path="earnings"
                            element={<Earnings />}
                        />

                        {/* Operator Bookings */}
                        <Route
                            path="bookings"
                            element={<OperatorBookings />}
                        />

                        <Route
                            path="profile"
                            element={<OperatorProfile />}
                        />

                        <Route
                            path="settings"
                            element={<OperatorSettings />}
                        />

                        {/*
                            Future Operator Routes

                            <Route
                                path="fleet"
                                element={<FleetManagement />}
                            />

                            <Route
                                path="rental-history"
                                element={<RentalHistory />}
                            />

                            <Route
                                path="gps"
                                element={<GpsTracking />}
                            />
                        */}
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
