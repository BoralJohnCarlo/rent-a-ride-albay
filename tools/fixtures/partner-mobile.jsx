// Copied into client/src temporarily by verify-admin-mobile.mjs.
// Real screens, local GET fixtures only. No credentials or live account data.
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import store from "./store";
import ThemeProvider from "./providers/ThemeProvider";
import ToastProvider from "./providers/ToastProvider";
import OperatorLayout from "./layouts/OperatorLayout";
import Dashboard from "./pages/operator/Dashboard";
import Bookings from "./pages/operator/Bookings";
import Vehicles from "./pages/operator/Vehicles";
import Consignments from "./pages/operator/Consignments";
import Earnings from "./pages/operator/Earnings/Earnings";
import Tracking from "./pages/operator/Tracking";
import Profile from "./pages/operator/Profile";
import Settings from "./pages/operator/Settings";
import Notifications from "./pages/operator/Notifications";
import api from "./lib/axios";
import "./index.css";

const id = n => String(n).padStart(24, "0");
const customer = { _id: id(1), id: id(1), firstName: "Maria Alexandra", lastName: "Dela Cruz", email: "customer@example.test", role: "customer", phoneNumber: "09171234567", isVerified: false, isApproved: true, validIdType: "National ID", address: { city: "Legazpi City", province: "Albay" }, createdAt: "2026-10-01" };
const vehicle = { _id: id(2), vehicleCode: "VH-000002", brand: "Toyota", model: "Innova 2.8 Automatic", plateNumber: "ABC1234", vehicleType: "Car", ownership: "Company", status: "Available", year: 2025, images: [], pricing: { dailyRate: 3500, reservationFee: 500 }, specifications: { transmission: "Automatic", fuelType: "Diesel", seatingCapacity: 7 }, compliance: { licenseExpiration: "2027-12-31" }, availability: { bookingEnabled: true }, createdAt: "2026-10-01" };
const booking = { _id: id(3), bookingCode: "BK-000003", customer, vehicle, status: "Pending", createdAt: "2026-11-09T00:00:00Z", startDate: "2026-12-10T01:00:00Z", endDate: "2026-12-13T01:00:00Z", pickupLocation: "Legazpi City, Albay", dropoffLocation: "Legazpi City, Albay", rentalType: "Self Drive", totalAmount: 10500, pricing: { total: 10500, dailyRate: 3500, grandTotal: 10500 }, payment: { status: "Pending", amountPaid: 0 }, driver: null };
const consignment = { _id: id(4), consignmentCode: "CON-000004", createdAt: "2026-11-09", snapshots: { vehicle: { ...vehicle, ownership: "Consigned" }, applicant: { identity: { displayName: "Juan Miguel Dela Cruz" }, contact: { email: "partner@example.test", phone: "09171234568" }, address: {} } }, application: { status: "Pending", inspection: { status: "Pending", scheduledDate: "2026-12-10", scheduledTime: "09:00" }, submitted: { submittedAt: "2026-11-09", submittedBy: id(1) }, review: {}, approval: {}, rejection: {} }, reschedule: { status: "None" }, archive: { isArchived: false }, audit: { createdBy: { ...customer, role: "operator" } }, timeline: { events: [] } };
const dashboard = {
    stats: [{ key: "users", title: "Customers", label: "Customers", value: 128 }, { key: "vehicles", title: "Vehicles", label: "Vehicles", value: 24 }, { key: "bookings", title: "Bookings", label: "Bookings", value: 346 }, { key: "revenue", title: "Revenue", label: "Revenue", value: 1250000 }],
    fleetSummary: { available: 12, reserved: 4, rented: 6, maintenance: 2 },
    revenue: { total: 1250000, growth: 12, period: "This Month" }, recentBookings: [booking, { ...booking, _id: id(5), status: "Approved" }], recentPayments: [],
};
const statistics = { overview: { totalCustomers: 128, totalBookings: 346, totalRentals: 215, pendingPayments: 4, verifiedPayments: 98, completedRentals: 190, totalRevenue: 1250000 }, revenueTrend: [{ date: "2026-11-01", revenue: 24000, total: 24000 }, { date: "2026-11-02", revenue: 35000, total: 35000 }], bookingStatus: [{ name: "Pending", value: 4, count: 4 }, { name: "Approved", value: 12, count: 12 }], paymentMethods: [{ name: "GCash", value: 12, count: 12 }], vehicleStatus: [{ name: "Available", value: 12, count: 12 }] };
window.fixtureMode = new URLSearchParams(location.search).get("state") || "populated";
window.fixtureErrors = [];
window.addEventListener("error", event => window.fixtureErrors.push(event.message));
api.defaults.adapter = async config => {
    if (config.method !== "get") throw new Error("The partner visual audit never changes live records");
    const url = config.url;
    if (window.fixtureMode === "loading" && !url.includes("settings")) await new Promise(resolve => setTimeout(resolve, 1500));
    if (window.fixtureMode === "error" && !url.includes("settings")) throw { response: { data: { message: "Audit fixture: data temporarily unavailable" } } };
    const empty = window.fixtureMode === "empty";
    let data = [];
    if (url === "/users/profile") data = { ...customer, role: "operator", firstName: "Alexandra" };
    else if (url === "/wallet") data = { wallet: { balance: 1250000 }, transactions: [] };
    else if (url === "/payouts/my/summary") data = { totalEarned: 1850000, totalPaid: 600000, pendingAmount: 1250000, totalPending: 1250000 };
    else if (url.includes("settings")) data = { platformCommissionRate: 20, minWithdrawalAmount: 100, proofOfBillingEnabled: false, validIdRenewalSettings: {}, validIdExpirationSettings: {}, inspectionSlots: [] };
    else if (url === "/telemetry/fleet/mine") data = empty ? [] : [{ vehicle, tracker: null, trackingState: null }];
    else if (url.startsWith("/bookings/") && !url.endsWith("/my")) data = booking;
    else if (url === "/notifications") data = empty ? [] : [{ _id: id(15), title: "Inspection appointment updated", message: "Your inspection appointment for Toyota Innova has been confirmed. Open your consignments to review the schedule.", type: "consignment", category: "consignments", isRead: false, createdAt: "2026-11-09T01:00:00Z" }];
    else if (url === "/withdrawals/mine") data = empty ? [] : [{ _id: id(16), amount: 12500, gcashNumber: "09171234567", accountName: "Alexandra Dela Cruz", status: "Pending", createdAt: "2026-11-09" }];
    else if (url.includes("activity-counts")) data = { bookings: 12, users: 6, consignments: 3 };
    else if (url === "/dashboard") data = empty ? { ...dashboard, stats: [], recentBookings: [] } : dashboard;
    else if (url.includes("vehicle-leaderboard")) data = { performance: [], ratings: [] };
    else if (url.startsWith("/statistics")) data = empty ? { ...statistics, revenueTrend: [], bookingStatus: [], vehicleStatus: [] } : statistics;
    else if (url.includes("unread")) data = { count: 3, unreadCount: 3 };
    else if (url.includes("counts")) data = { total: 3, active: 3, available: 2, pending: 1, pending_review: 1, customer: 2, operator: 1 };
    else if (url.includes("inspection")) data = { slots: [], inspectionSlots: [], disabledDates: [] };
    else if (!empty && url.startsWith("/bookings")) data = [booking, { ...booking, _id: id(6), bookingCode: "BK-000006", status: "Approved" }];
    else if (!empty && url.startsWith("/users") && !url.includes("blacklist")) data = [{ ...customer, role: config.params?.role || "customer" }, { ...customer, _id: id(7), id: id(7), firstName: "Christopher Emmanuel", lastName: "Santos" }];
    else if (!empty && url.startsWith("/vehicles") && !url.includes("categories")) data = [vehicle, { ...vehicle, _id: id(8), vehicleCode: "VH-000008", brand: "Mitsubishi", model: "Montero Sport", plateNumber: "DEF5678" }];
    else if (!empty && url.startsWith("/consignments")) data = config.params?.status === "Archived" ? [] : [consignment];
    return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, data, pagination: { page: 1, pages: 1, total: Array.isArray(data) ? data.length : 0, limit: 20 } } };
};
store.dispatch({ type: "auth/getCurrentUser/fulfilled", payload: { data: { ...customer, _id: id(10), id: id(10), role: "operator", firstName: "Alexandra", isVerified: true } } });
const Bridge = () => { const navigate = useNavigate(); window.fixtureNavigate = navigate; return null; };
createRoot(document.getElementById("root")).render(
    <Provider store={store}><ThemeProvider><ToastProvider><MemoryRouter initialEntries={[new URLSearchParams(location.search).get("route") || "/operator"]}><Bridge />
        <Routes><Route path="/operator" element={<OperatorLayout />}>
            <Route index element={<Dashboard />} /><Route path="bookings" element={<Bookings />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="consignments" element={<Consignments />} /><Route path="earnings" element={<Earnings />} /><Route path="tracking" element={<Tracking />} /><Route path="profile" element={<Profile />} /><Route path="settings" element={<Settings />} /><Route path="notifications" element={<Notifications />} />
        </Route></Routes>
    </MemoryRouter></ToastProvider></ThemeProvider></Provider>
);
