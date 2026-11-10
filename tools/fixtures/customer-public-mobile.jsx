import React from "react";import {createRoot} from "react-dom/client";import {Provider} from "react-redux";import {MemoryRouter,Routes,Route,useNavigate} from "react-router-dom";import store from "./store";import ThemeProvider from "./providers/ThemeProvider";import ToastProvider from "./providers/ToastProvider";import CustomerLayout from "./layouts/CustomerLayout";import PublicLayout from "./layouts/PublicLayout";import api from "./lib/axios";import "./index.css";
import PublicHome from "./pages/public/Home";
import PublicPublicVehicles from "./pages/public/PublicVehicles";
import PublicAvailableVehicles from "./pages/public/AvailableVehicles";
import PublicVehicleDetails from "./pages/public/VehicleDetails";
import PublicDriverProfile from "./pages/public/DriverProfile";
import PublicExploreAlbay from "./pages/public/ExploreAlbay";
import PublicAbout from "./pages/public/About";
import PublicContact from "./pages/public/Contact";
import PublicFAQ from "./pages/public/FAQ";
import PublicTermsOfService from "./pages/public/TermsOfService";
import PublicPrivacy from "./pages/public/Privacy";
import PublicLogin from "./pages/public/Login";
import PublicRegister from "./pages/public/Register";
import PublicRegisterOperator from "./pages/public/RegisterOperator";
import PublicForgotPassword from "./pages/public/ForgotPassword";
import CustomerHome from "./pages/customer/Home";
import CustomerBookings from "./pages/customer/Bookings";
import CustomerBookingDetails from "./pages/customer/BookingDetails";
import CustomerRateBooking from "./pages/customer/RateBooking";
import CustomerFavorites from "./pages/customer/Favorites";
import CustomerProfile from "./pages/customer/Profile";
import CustomerSettings from "./pages/customer/Settings";
import CustomerCheckout from "./pages/customer/Checkout";
import CustomerPaymentResult from "./pages/customer/PaymentResult";
import CustomerCustomerService from "./pages/customer/CustomerService";
import CustomerNotifications from "./pages/customer/Notifications";
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

const route=new URLSearchParams(location.search).get("route")||"/";
window.fixtureMode=new URLSearchParams(location.search).get("state")||"populated";window.fixtureErrors=[];window.fixtureRequests=[];window.addEventListener("error",e=>window.fixtureErrors.push(e.message));window.addEventListener("unhandledrejection",e=>window.fixtureErrors.push(String(e.reason?.message||e.reason)));
const account={...customer,_id:id(10),id:id(10),firstName:"Alexandra",role:"customer",isVerified:true,licenseNumber:"N01-23-456789",licenseExpiration:"2028-12-31",licenseCodes:["B"],licenseTransmission:{B:["automatic","manual"]},drivingExperience:5};
const completed={...booking,_id:id(6),bookingCode:"BK-000006",status:"Completed",customer:account};
const payment={_id:id(11),amount:10500,status:route.includes("/payment/")?"Paid":"Pending",booking:{...booking,customer:account},type:"Reservation",paymentMethod:"GCash"};
api.defaults.adapter=async config=>{
 const url=config.url;if(config.method!=="get"&&!url.endsWith("/reconcile"))throw Error("Visual audit blocks all live mutations");window.fixtureRequests.push(url);
 if(window.fixtureMode==="loading"&&!url.includes("settings"))await new Promise(r=>setTimeout(r,1800));
 if(window.fixtureMode==="error"&&!url.includes("settings"))throw {response:{data:{message:"Fixture: temporarily unavailable"}}};
 const empty=window.fixtureMode==="empty";let data=[];
 if(url.includes("settings"))data={proofOfBillingEnabled:false,licenseInfoRequired:false,inspectionSlots:[],refundSettings:{},bookingSettings:{}};
 else if(url==="/users/profile")data=account;
 else if(url.includes("unread"))data={count:1,unreadCount:1};
 else if(url==="/notifications")data=empty?[]:[{_id:id(15),title:"Booking approved",message:"Your Toyota Innova booking is ready. Review your trip details and pickup arrangements.",category:"bookings",type:"booking",isRead:false,createdAt:"2026-11-09"}];
 else if(url==="/vehicles"||url==="/vehicles/available")data=empty?[]:[vehicle,{...vehicle,_id:id(8),brand:"Mitsubishi",model:"Montero Sport"}];
 else if(url==="/vehicles/"+id(2))data=vehicle;
 else if(url.includes("categor"))data=empty?[]:[{_id:id(20),name:"Car",isActive:true}];
 else if(url.startsWith("/bookings/"))data=url.endsWith(id(6))?completed:{...booking,customer:account};
 else if(url==="/bookings")data=empty?[]:[{...booking,customer:account},completed];
 else if(url.endsWith("/reconcile"))data={paid:true,payment:{...payment,status:"VERIFIED"}};
 else if(url.startsWith("/payments/"))data=payment;
 else if(url==="/favorites")data=empty?[]:[vehicle];
 else if(url.startsWith("/drivers/"))data={_id:id(9),firstName:"Juan Miguel",lastName:"Dela Cruz",status:"Available",licenseNumber:"N01-23-456789",experience:5};
 else if(url.includes("reviews"))data=[];
 return {status:200,statusText:"OK",headers:{},config,data:{success:true,data,pagination:{page:1,pages:1,total:Array.isArray(data)?data.length:0,limit:20}}};
};
if(route.startsWith("/customer"))store.dispatch({type:"auth/getCurrentUser/fulfilled",payload:{data:account}});
const Bridge=()=>{window.fixtureNavigate=useNavigate();return null;};
createRoot(document.getElementById("root")).render(<Provider store={store}><ThemeProvider><ToastProvider><MemoryRouter initialEntries={[route]}><Bridge/><Routes><Route element={<PublicLayout/>}><Route path="/" element={<PublicHome/>}/><Route path="/vehicles" element={<PublicPublicVehicles/>}/><Route path="/available" element={<PublicAvailableVehicles/>}/><Route path="/vehicles/:vehicleId" element={<PublicVehicleDetails/>}/><Route path="/drivers/:driverId" element={<PublicDriverProfile/>}/><Route path="/explore" element={<PublicExploreAlbay/>}/><Route path="/about" element={<PublicAbout/>}/><Route path="/contact" element={<PublicContact/>}/><Route path="/faq" element={<PublicFAQ/>}/><Route path="/terms" element={<PublicTermsOfService/>}/><Route path="/privacy" element={<PublicPrivacy/>}/><Route path="/login" element={<PublicLogin/>}/><Route path="/register" element={<PublicRegister/>}/><Route path="/register-operator" element={<PublicRegisterOperator/>}/><Route path="/forgot-password" element={<PublicForgotPassword/>}/></Route><Route element={<CustomerLayout/>}><Route path="/customer/home" element={<CustomerHome/>}/><Route path="/customer/bookings" element={<CustomerBookings/>}/><Route path="/customer/bookings/:bookingId" element={<CustomerBookingDetails/>}/><Route path="/customer/bookings/:bookingId/rate" element={<CustomerRateBooking/>}/><Route path="/customer/favorites" element={<CustomerFavorites/>}/><Route path="/customer/profile" element={<CustomerProfile/>}/><Route path="/customer/settings" element={<CustomerSettings/>}/><Route path="/customer/checkout/:paymentId" element={<CustomerCheckout/>}/><Route path="/customer/payment/:status" element={<CustomerPaymentResult/>}/><Route path="/customer/customer-service" element={<CustomerCustomerService/>}/><Route path="/customer/notifications" element={<CustomerNotifications/>}/></Route></Routes></MemoryRouter></ToastProvider></ThemeProvider></Provider>);