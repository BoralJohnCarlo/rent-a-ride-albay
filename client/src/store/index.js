import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./auth";
import userReducer from "./users";
import vehicleOwnerReducer from "./vehicleOwners";
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


const store = configureStore({
    reducer: {
        auth: authReducer,
        users: userReducer,
        vehicleOwners: vehicleOwnerReducer,
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
    },
});


export default store;