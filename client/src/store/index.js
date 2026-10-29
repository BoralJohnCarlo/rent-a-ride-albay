import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./auth";
import userReducer from "./users";
import vehicleReducer from "./vehicles";
import vehicleCategoryReducer from "./categories";
import { consignmentReducer } from "./consignments";
import driverReducer from "./drivers";
import bookingReducer from "./bookings";
import rentalReducer from "./rentals";
import paymentReducer from "./payments";
import dashboardReducer from "./dashboard";
import statisticsReducer from "./statistics";
import serviceLocationsReducer from "./serviceLocations";
import distanceFeeRulesReducer from "./distanceFeeRules";
import settingsReducer from "./settings";
import reviewReducer from "./reviews";
import promoReducer from "./promotions";
import favoriteReducer from "./favorites";
import pendingVehiclesReducer from "./pendingVehicles";
import payoutsReducer from "./payouts";
import refundReducer from "./refunds";
import supportTicketReducer from "./supportTickets";
import walletReducer from "./wallets";
import withdrawalReducer from "./withdrawals";
import vehicleAvailabilityRequestsReducer from "./vehicleAvailabilityRequests";
import gpsReducer from "./gps";
import trackerReducer from "./trackers";
import alertReducer from "./alerts";


const store = configureStore({
    reducer: {
        auth: authReducer,
        users: userReducer,
        vehicles: vehicleReducer,
        categories: vehicleCategoryReducer,
        consignments: consignmentReducer,
        drivers: driverReducer,
        bookings: bookingReducer,
        rentals: rentalReducer,
        payments: paymentReducer,
        dashboard: dashboardReducer,
        statistics: statisticsReducer,
        serviceLocations: serviceLocationsReducer,
        distanceFeeRules: distanceFeeRulesReducer,
        settings: settingsReducer,
        reviews: reviewReducer,
        promotions: promoReducer,
        favorites: favoriteReducer,
        pendingVehicles: pendingVehiclesReducer,
        payouts: payoutsReducer,
        refunds: refundReducer,
        supportTickets: supportTicketReducer,
        wallets: walletReducer,
        withdrawals: withdrawalReducer,
        vehicleAvailabilityRequests:
            vehicleAvailabilityRequestsReducer,
        gps: gpsReducer,
        trackers: trackerReducer,
        alerts: alertReducer,
    },
});


export default store;