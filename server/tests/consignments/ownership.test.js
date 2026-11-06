import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../../models/User.js";
import Consignment from "../../models/Consignment.js";
import { updateDraftConsignment, submitConsignment } from "../../services/consignmentService.js";

test("edit and submit enforce owner access before changing a consignment", async () => {
    const owner = new mongoose.Types.ObjectId();
    const stranger = new mongoose.Types.ObjectId();
    const originalUserLookup = User.findById;
    const originalConsignmentLookup = Consignment.findById;
    const record = { audit: { createdBy: owner }, archive: { isArchived: true } };
    const before = JSON.stringify(record);
    Consignment.findById = async () => record;
    try {
        for (const action of [updateDraftConsignment, submitConsignment]) {
            for (const user of [
                { _id: stranger, role: "operator" },
                { _id: owner, role: "customer" },
            ]) {
                User.findById = async () => user;
                await assert.rejects(action("application", {}, user._id), { statusCode: 403 });
                assert.equal(JSON.stringify(record), before);
            }
            for (const user of [
                { _id: owner, role: "operator" },
                { _id: stranger, role: "admin" },
            ]) {
                User.findById = async () => user;
                // Authorized users proceed to the existing workflow validation.
                await assert.rejects(action("application", {}, user._id), /Archived consignments/);
            }
        }
    } finally {
        User.findById = originalUserLookup;
        Consignment.findById = originalConsignmentLookup;
    }
});
