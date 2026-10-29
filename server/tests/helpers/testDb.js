import "dotenv/config";

import mongoose from "mongoose";

import Alert from "../../models/Alert.js";
import Telemetry from "../../models/Telemetry.js";
import Tracker from "../../models/Tracker.js";
import Vehicle from "../../models/Vehicle.js";
import VehicleTrackingState from "../../models/VehicleTrackingState.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

const TEST_DB_PREFIX = "rent_a_ride_albay_test_";

/*
 * Each test file gets its own throwaway database on the MONGO_URI server
 * (never the development database), dropped again in teardown.
 */
export const connectTestDb = async () => {
    const dbName = `${TEST_DB_PREFIX}${process.pid}_${Date.now()}`;

    await mongoose.connect(process.env.MONGO_URI, { dbName });

    // Build indexes up front - the partial unique Alert index is part of
    // what's under test.
    await Promise.all(
        [Alert, Telemetry, Tracker, Vehicle, VehicleTrackingState].map(
            (model) => model.init()
        )
    );

    return dbName;
};

export const disconnectTestDb = async () => {
    const { name } = mongoose.connection;

    try {
        // Hard guard: only ever drop a database this helper created.
        if (!name?.startsWith(TEST_DB_PREFIX)) {
            throw new Error(`Refusing to drop non-test database "${name}".`);
        }

        await mongoose.connection.dropDatabase();
    } finally {
        await mongoose.disconnect();
    }
};

export const clearCollections = () =>
    Promise.all(
        [Alert, Telemetry, Tracker, Vehicle, VehicleTrackingState].map(
            (model) => model.deleteMany({})
        )
    );

/*
 * Vehicle's schema requires a full listing (images, compliance, ...) that
 * GPS logic never reads - insert just _id + status (plus the two unique
 * keys) directly, which is all trackerService/alertService query.
 */
export const createTestVehicle = async (
    status = VEHICLE_STATUS.AVAILABLE,
    { operator = null } = {}
) => {
    const _id = new mongoose.Types.ObjectId();

    await Vehicle.collection.insertOne({
        _id,
        status,
        vehicleCode: `TEST-${_id}`,
        plateNumber: `TEST-${_id}`,
        ...(operator ? { operator } : {}),
    });

    return _id;
};

export const adminId = new mongoose.Types.ObjectId();

let imeiCounter = 0;

export const uniqueImei = () =>
    `TEST${process.pid}${Date.now()}${(imeiCounter += 1)}`;
