// Report only: node scripts/ensureTrackerAssignmentIndex.js
// Install:    node scripts/ensureTrackerAssignmentIndex.js --apply
// Existing duplicate assignments are reported, never changed automatically.
import "dotenv/config";
import mongoose from "mongoose";
import { TRACKER_ASSIGNMENT_INDEX_OPTIONS } from "../models/Tracker.js";

try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    const collection = mongoose.connection.collection("trackers");
    const duplicates = await collection.aggregate([
        { $match: { vehicle: { $type: "objectId" } } },
        { $group: { _id: "$vehicle", count: { $sum: 1 }, trackers: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
    ]).toArray();
    if (duplicates.length) {
        console.error("Resolve these duplicate assignments before installing the index:");
        console.error(JSON.stringify(duplicates, null, 2));
        process.exitCode = 1;
    } else if (process.argv.includes("--apply")) {
        // Keep the old ordinary index: no constraint or data is dropped.
        await collection.createIndex({ vehicle: 1 }, TRACKER_ASSIGNMENT_INDEX_OPTIONS);
        console.log("Unique tracker assignment index installed.");
    } else {
        console.log("No duplicate vehicle assignments found. Report only; no changes made.");
        console.log("Use --apply to install the unique assignment index before rollout.");
    }
} catch (error) {
    console.error(`Tracker assignment index check failed: ${error.message}`);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
