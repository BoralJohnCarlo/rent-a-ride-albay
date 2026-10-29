/*
 * One-time migration for the VehicleOwner removal.
 *
 * The VehicleOwner entity was retired — an operator (User) is now the sole
 * owner-of-record on Vehicle.operator, and PayoutRequest is keyed by operator.
 * This backfills any legacy data that still routed ownership through the old
 * `vehicleowners` collection, then drops that collection.
 *
 * Safe to run more than once. Run with:  node scripts/dropVehicleOwner.js
 */

import "dotenv/config";
import mongoose from "mongoose";

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const owners = await db
        .collection("vehicleowners")
        .find({}, { projection: { _id: 1, operator: 1 } })
        .toArray()
        .catch(() => []);

    const operatorByOwnerId = new Map(
        owners
            .filter((o) => o.operator)
            .map((o) => [String(o._id), o.operator])
    );

    // 1. Vehicle.operator <- operator behind the legacy Vehicle.owner
    let vehiclesFixed = 0;
    const vehicles = await db
        .collection("vehicles")
        .find(
            { operator: { $in: [null, undefined] }, owner: { $ne: null } },
            { projection: { _id: 1, owner: 1 } }
        )
        .toArray();

    for (const v of vehicles) {
        const operator = operatorByOwnerId.get(String(v.owner));
        if (operator) {
            await db
                .collection("vehicles")
                .updateOne({ _id: v._id }, { $set: { operator } });
            vehiclesFixed += 1;
        }
    }

    // 2. Drop the now-dead reference fields.
    const vehicleUnset = await db
        .collection("vehicles")
        .updateMany({ owner: { $exists: true } }, { $unset: { owner: "" } });

    const payoutUnset = await db
        .collection("payoutrequests")
        .updateMany(
            { vehicleOwner: { $exists: true } },
            { $unset: { vehicleOwner: "" } }
        );

    const consignmentUnset = await db
        .collection("consignments")
        .updateMany(
            { "generatedEntities.vehicleOwner": { $exists: true } },
            { $unset: { "generatedEntities.vehicleOwner": "" } }
        );

    // 3. Drop the collection itself.
    const dropped = await db
        .collection("vehicleowners")
        .drop()
        .then(() => true)
        .catch(() => false);

    console.log("VehicleOwner migration complete:");
    console.log(`  vehicles.operator backfilled : ${vehiclesFixed}`);
    console.log(`  vehicles.owner unset         : ${vehicleUnset.modifiedCount}`);
    console.log(`  payoutrequests.vehicleOwner  : ${payoutUnset.modifiedCount}`);
    console.log(`  consignments.vehicleOwner    : ${consignmentUnset.modifiedCount}`);
    console.log(`  vehicleowners collection     : ${dropped ? "dropped" : "already gone"}`);

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
