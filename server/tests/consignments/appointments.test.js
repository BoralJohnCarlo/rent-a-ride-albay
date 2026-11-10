import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import InspectionSetting from "../../models/InspectionSetting.js";
import PendingVehicle from "../../models/PendingVehicle.js";
import Consignment from "../../models/Consignment.js";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import Vehicle from "../../models/Vehicle.js";
import { updatePendingVehicleStatus, updatePendingVehicle, getPendingVehicles, getMyPendingVehicles, getPendingVehicleCounts } from "../../controllers/pendingVehicleController.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";
import { inspectionInstant } from "../../utils/inspectionTime.js";
import { assertInspectionSlotAvailable } from "../../services/inspectionSlotService.js";
import { updateRegistrationAppointment } from "../../services/registrationAppointmentService.js";
import { bookInspectionAppointment, requestReschedule, approveReschedule, withdrawConsignment, sendInspectionAppointmentReminders } from "../../services/consignmentService.js";
import { updateInspectionSetting, getInspectionAvailability } from "../../controllers/inspectionSettingController.js";
import { removeAllNotificationRecords } from "../../services/notificationStore.js";

const owner = new mongoose.Types.ObjectId();
const stranger = new mongoose.Types.ObjectId();
const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
const date = "2099-12-10";
const operator = { _id: owner, role: "operator" };
before(connectTestDb);
after(disconnectTestDb);
beforeEach(async () => {
    await Promise.all([InspectionSetting, PendingVehicle, Consignment, Notification, Vehicle].map(model => model.deleteMany({})));
    await InspectionSetting.create({ inspectionSlots: [{ date, timeSlots: [{ time: "09:00" }, { time: "10:00" }] }] });
});
const vehicle = (plate, time = "09:00") => PendingVehicle.create({
    vehicleType: "Car", brand: "Toyota", model: "Vios", plateNumber: plate,
    specifications: { transmission: "Automatic", fuelType: "Gasoline", seatingCapacity: 5 },
    operator: owner, inspection: { scheduledDate: date, scheduledTime: time },
});
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const next = error => { throw error; };

test("parallel first reads initialize exactly one inspection setting", async () => {
    await InspectionSetting.deleteMany({});
    const results = await Promise.all(Array.from({ length: 16 }, () => InspectionSetting.getInstance()));
    assert.equal(await InspectionSetting.countDocuments(), 1);
    assert.equal(new Set(results.map(setting => String(setting._id))).size, 1);
});
test("singleton initialization preserves existing legacy settings", async () => {
    const existing = await InspectionSetting.findOne();
    const results = await Promise.all(Array.from({ length: 8 }, () => InspectionSetting.getInstance()));
    assert.ok(results.every(setting => setting._id.equals(existing._id)));
    assert.equal(results[0].inspectionSlots[0].date, date);
    assert.equal(await InspectionSetting.countDocuments(), 1);
});

const approvalRecord = async plate => {
    const record = await vehicle(plate);
    record.year = 2024;
    record.images = [{ url: "https://example.com/vehicle.jpg", publicId: "test-vehicle" }];
    await record.save();
    return record;
};
const approve = async record => {
    const res = response();
    await updatePendingVehicleStatus({ params: { id: String(record._id) }, body: { status: "approved", pricing: { dailyRate: 1000, reservationFee: 100 } } }, res, next);
    assert.equal(res.body.success, true);
    return res.body.data;
};
test("approval retains appointment history, releases capacity, and is safe to retry", async () => {
    const record = await approvalRecord("HISTORY");
    record.reschedule = { status: "Approved", reason: "Work", proposedDate: new Date(date), proposedTime: "09:00" }; await record.save();
    const first = await approve(record), repeated = await approve(record);
    const history = await PendingVehicle.findById(record._id);
    assert.equal(history.status, "approved"); assert.equal(history.isPendingInspection, false);
    assert.equal(history.inspection.scheduledDate, date); assert.equal(history.reschedule.reason, "Work");
    assert.ok(history.approvedVehicle.equals(first.vehicle._id));
    assert.ok(history.approvedAt); assert.ok(repeated.vehicle._id.equals(first.vehicle._id));
    assert.equal(await Vehicle.countDocuments({ registrationSubmission: record._id }), 1);
    assert.equal(first.vehicle.isPendingInspection, false);
    assert.equal(first.vehicle.availability.bookingEnabled, true);
    await assertInspectionSlotAvailable(date, "09:00");
    for (const [controller, user] of [[getPendingVehicles, admin], [getMyPendingVehicles, operator]]) {
        let res = response(); await controller({ query: {}, user }, res, next); assert.equal(res.body.data.length, 0);
        res = response(); await controller({ query: { includeCompleted: "true" }, user }, res, next); assert.equal(res.body.data.length, 1);
    }
});
test("approval recovers the same listing after saving appointment history fails", async () => {
    const record = await approvalRecord("RETRY");
    const original = PendingVehicle.prototype.save;
    PendingVehicle.prototype.save = async function (...args) {
        if (this._id.equals(record._id) && this.status === "approved") throw new Error("simulated history save failure");
        return original.apply(this, args);
    };
    try { await assert.rejects(approve(record), /simulated history save failure/); }
    finally { PendingVehicle.prototype.save = original; }
    assert.equal(await Vehicle.countDocuments({ registrationSubmission: record._id }), 1);
    const staged = await Vehicle.findOne({ registrationSubmission: record._id });
    assert.equal(staged.isPendingInspection, true);
    assert.equal(staged.availability.bookingEnabled, false);
    const rejection = response();
    await updatePendingVehicleStatus({ params: { id: String(record._id) }, body: { status: "rejected", rejectionReason: "Cannot approve" } }, rejection, next);
    assert.equal(rejection.statusCode, 409);
    assert.equal((await PendingVehicle.findById(record._id)).status, "pending_review");
    const edit = response();
    await updatePendingVehicle({ params: { id: String(record._id) }, body: { brand: "Changed" } }, edit, next);
    assert.equal(edit.statusCode, 409);
    await assert.rejects(updateRegistrationAppointment(record._id, { action: "request", date, time: "10:00", reason: "Change" }, operator), { statusCode: 409 });
    await approve(record);
    assert.equal(await Vehicle.countDocuments({ registrationSubmission: record._id }), 1);
    assert.equal((await PendingVehicle.findById(record._id)).status, "approved");
    assert.equal((await Vehicle.findById(staged._id)).availability.bookingEnabled, true);
});

test("approval retry finishes activation after history was saved successfully", async () => {
    const record = await approvalRecord("ACTIVATION-RETRY");
    const original = Vehicle.findOneAndUpdate;
    Vehicle.findOneAndUpdate = async function (filter, ...args) {
        if (filter.registrationSubmission?.equals(record._id)) throw new Error("simulated activation failure");
        return original.call(this, filter, ...args);
    };
    try { await assert.rejects(approve(record), /simulated activation failure/); }
    finally { Vehicle.findOneAndUpdate = original; }
    assert.equal((await PendingVehicle.findById(record._id)).status, "approved");
    const staged = await Vehicle.findOne({ registrationSubmission: record._id });
    assert.equal(staged.availability.bookingEnabled, false);
    const refreshed = response(), counts = response();
    await getPendingVehicles({ query: {} }, refreshed, next);
    await getPendingVehicleCounts({}, counts, next);
    assert.equal(refreshed.body.data.length, 1);
    assert.equal(refreshed.body.data[0].approvalRecoveryRequired, true);
    assert.equal(counts.body.data.total, 1);
    assert.equal(await Notification.countDocuments({ recipient: owner, type: "Vehicle Approved" }), 0);
    // A refreshed retry sends no pricing; the server must use the saved listing.
    const retry = response();
    await updatePendingVehicleStatus({ params: { id: String(record._id) }, body: { status: "approved" } }, retry, next);
    const result = retry.body.data;
    assert.ok(result.vehicle._id.equals(staged._id));
    assert.equal(result.vehicle.isPendingInspection, false);
    assert.equal(result.vehicle.availability.bookingEnabled, true);
    assert.equal(await Vehicle.countDocuments({ registrationSubmission: record._id }), 1);
    await approve(record);
    assert.equal(await Notification.countDocuments({ recipient: owner, type: "Vehicle Approved" }), 1);
    const finished = response(); await getPendingVehicles({ query: {} }, finished, next);
    assert.equal(finished.body.data.length, 0);
});

test("confirmation failures remain recoverable without duplicating notices", async () => {
    const record = await approvalRecord("NOTICE-RETRY");
    const original = Notification.create;
    Notification.create = async () => { throw new Error("simulated notification failure"); };
    try { await assert.rejects(approve(record), /confirmation could not be delivered/); }
    finally { Notification.create = original; }
    assert.equal((await Vehicle.findOne({ registrationSubmission: record._id })).isPendingInspection, false);
    assert.equal((await PendingVehicle.findById(record._id)).approvalPending, true);
    const refreshed = response(); await getPendingVehicles({ query: {} }, refreshed, next);
    assert.equal(refreshed.body.data[0].approvalRecoveryRequired, true);
    await approve(record); await approve(record);
    assert.equal(await Notification.countDocuments({ recipient: owner, type: "Vehicle Approved" }), 1);
    assert.equal((await PendingVehicle.findById(record._id)).approvalPending, false);
    await removeAllNotificationRecords(owner);
    await approve(record);
    assert.equal(await Notification.countDocuments({ recipient: owner }), 1, "dismissed receipt prevents a duplicate");
});

test("legacy activation failures without a recovery flag remain visible", async () => {
    const record = await approvalRecord("LEGACY-RETRY");
    const result = await approve(record);
    await Vehicle.updateOne({ _id: result.vehicle._id }, { isPendingInspection: true, "availability.bookingEnabled": false });
    await PendingVehicle.updateOne({ _id: record._id }, { $unset: { approvalPending: "" } });
    const refreshed = response(); await getPendingVehicles({ query: {} }, refreshed, next);
    assert.equal(refreshed.body.data.length, 1);
    assert.equal(refreshed.body.data[0].approvalRecoveryRequired, true);
    await approve(record);
    assert.equal((await Vehicle.findById(result.vehicle._id)).isPendingInspection, false);
    assert.equal(await Notification.countDocuments({ recipient: owner, type: "Vehicle Approved" }), 1);
});

test("approval preserves an administrator's disabled booking preference", async () => {
    const record = await approvalRecord("DISABLED");
    record.availability.bookingEnabled = false; await record.save();
    const result = await approve(record);
    assert.equal(result.vehicle.availability.bookingEnabled, false);
    assert.equal(result.vehicle.isPendingInspection, false);
});

test("pending dashboard totals match the default queue and exclude completed history", async () => {
    await approve(await approvalRecord("COMPLETED"));
    await vehicle("PENDING");
    const rejected = await vehicle("REJECTED"); rejected.status = "rejected"; await rejected.save();
    const list = response(), counts = response();
    await getPendingVehicles({ query: {} }, list, next);
    await getPendingVehicleCounts({}, counts, next);
    assert.equal(counts.body.data.total, list.body.pagination.total);
    assert.equal(counts.body.data.total, 2);
    assert.equal(counts.body.data.approved, 1);
});

test("older recovery submissions remain reachable beyond the first 50 records", async () => {
    const recoveryId = new mongoose.Types.ObjectId();
    await PendingVehicle.collection.insertMany([
        { _id: recoveryId, status: "approved", approvalPending: true, brand: "Older", model: "Recovery", createdAt: new Date("2025-01-01") },
        ...Array.from({ length: 50 }, (_, index) => ({ status: "pending_review", brand: "Newer", model: String(index), createdAt: new Date("2026-01-01") })),
    ]);
    const first = response(), second = response();
    await getPendingVehicles({ query: { page: 1, limit: 50, sortBy: "createdAt", sortOrder: "desc" } }, first, next);
    await getPendingVehicles({ query: { page: 2, limit: 50, sortBy: "createdAt", sortOrder: "desc" } }, second, next);
    assert.equal(first.body.pagination.pages, 2);
    assert.equal(first.body.data.length, 50);
    assert.equal(second.body.data.length, 1);
    assert.equal(String(second.body.data[0]._id), String(recoveryId));
    assert.equal(second.body.data[0].approvalRecoveryRequired, true);
    assert.equal(new Set([...first.body.data, ...second.body.data].map(record => String(record._id))).size, 51);
});

test("inspection times use Philippine time and reject invalid calendar dates", () => {
    assert.equal(inspectionInstant("2099-12-10", "09:00").toISOString(), "2099-12-10T01:00:00.000Z");
    for (const [day, time] of [["2099-02-30", "09:00"], [date, "24:00"], [date, "9:00"]]) assert.ok(Number.isNaN(inspectionInstant(day, time).getTime()));
});
test("rejects elapsed times and filters them from availability", async () => {
    const elapsed = new Date(Date.now() - 60000 + 8 * 3600000).toISOString();
    const day = elapsed.slice(0, 10), time = elapsed.slice(11, 16);
    await InspectionSetting.updateOne({}, { inspectionSlots: [{ date: day, timeSlots: [{ time }] }] });
    await assert.rejects(assertInspectionSlotAvailable(day, time), /future/);
    const res = response(); await getInspectionAvailability({}, res);
    assert.deepEqual(res.body.data.slots, []);
});
test("registration ownership and admin-only decisions are enforced", async () => {
    const record = await vehicle("OWN");
    await assert.rejects(updateRegistrationAppointment(record._id, { action: "request", date, time: "10:00", reason: "Change" }, { _id: stranger, role: "operator" }), { statusCode: 403 });
    await assert.rejects(updateRegistrationAppointment(record._id, { action: "book", date, time: "10:00" }, operator), { statusCode: 403 });
    assert.equal((await PendingVehicle.findById(record._id)).inspection.scheduledTime, "09:00");
});
test("a request keeps the old slot; approval moves it; duplicate requests are rejected", async () => {
    const record = await vehicle("MOVE");
    const request = { action: "request", date, time: "10:00", reason: "Work schedule" };
    await updateRegistrationAppointment(record._id, request, operator);
    assert.equal((await PendingVehicle.findById(record._id)).inspection.scheduledTime, "09:00");
    await assert.rejects(updateRegistrationAppointment(record._id, request, operator), /already pending/);
    await updateRegistrationAppointment(record._id, { action: "approve" }, admin);
    const saved = await PendingVehicle.findById(record._id);
    assert.equal(saved.inspection.scheduledTime, "10:00"); assert.equal(saved.reschedule.status, "Approved");
    await assertInspectionSlotAvailable(date, "09:00");
});
test("admin must recheck proposed capacity and cannot change a closed inspection", async () => {
    const record = await vehicle("RECHECK");
    await updateRegistrationAppointment(record._id, { action: "request", date, time: "10:00", reason: "Work" }, operator);
    await vehicle("OCCUPIED", "10:00");
    await assert.rejects(updateRegistrationAppointment(record._id, { action: "approve" }, admin), /fully booked/);
    assert.equal((await PendingVehicle.findById(record._id)).reschedule.status, "Pending");
    await PendingVehicle.updateOne({ _id: record._id }, { status: "rejected" });
    await assert.rejects(updateRegistrationAppointment(record._id, { action: "approve" }, admin), /closed/);
});
test("simultaneous moves cannot consume the same last slot", async () => {
    await InspectionSetting.updateOne({}, { $push: { "inspectionSlots.0.timeSlots": { time: "11:00", maxAppointments: 1 } } });
    const first = await vehicle("FIRST"), second = await vehicle("SECOND", "10:00");
    const results = await Promise.allSettled([first, second].map(record => updateRegistrationAppointment(record._id, { action: "book", date, time: "11:00" }, admin)));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected" && result.reason.statusCode === 409).length, 1);
    assert.equal(await PendingVehicle.countDocuments({ "inspection.scheduledTime": "11:00" }), 1);
});
test("admin cannot remove a booked slot or silently clear omitted settings", async () => {
    await vehicle("PROTECT");
    let res = response(); await updateInspectionSetting({ body: { inspectionSlots: [], disabledDates: [] } }, res);
    assert.equal(res.statusCode, 409);
    res = response(); await updateInspectionSetting({ body: { disabledDates: [] } }, res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.data.inspectionSlots.length, 1);
});
test("consignment booking and requests reject another operator before changing the record", async () => {
    const originalFind = Consignment.findById, originalUser = User.findById;
    const record = { audit: { createdBy: owner }, application: { status: "Pending", inspection: { status: "Pending", scheduledDate: date } } };
    Consignment.findById = async () => record;
    User.findById = async () => ({ _id: stranger, role: "operator" });
    try {
        await assert.rejects(bookInspectionAppointment("id", { date, time: "10:00" }, stranger), { statusCode: 403 });
        await assert.rejects(requestReschedule("id", { proposedDate: date, proposedTime: "10:00", reason: "Change" }, stranger), { statusCode: 403 });
        await assert.rejects(withdrawConsignment("id", "Cancel", stranger), { statusCode: 403 });
        assert.equal(record.reschedule, undefined);
    } finally { Consignment.findById = originalFind; User.findById = originalUser; }
});
test("admin cannot approve a consignment reschedule after withdrawal", async () => {
    const originalFind = Consignment.findById, originalUser = User.findById;
    Consignment.findById = async () => ({ application: { status: "Withdrawn", inspection: { status: "Pending" } }, reschedule: { status: "Pending" } });
    User.findById = async () => admin;
    try { await assert.rejects(approveReschedule("id", {}, admin._id), /no longer/); }
    finally { Consignment.findById = originalFind; User.findById = originalUser; }
});
test("consignment booking stores the appointment instant and blocks direct partner reschedules", async () => {
    const originalFind = Consignment.findById, originalUser = User.findById;
    const record = { _id: new mongoose.Types.ObjectId(), audit: { createdBy: owner }, timeline: { events: [] }, application: { status: "Pending", inspection: { status: "Pending", toObject: () => ({ status: "Pending" }) } }, save: async () => { throw new Error("SAVE_REACHED"); } };
    Consignment.findById = async () => record; User.findById = async () => operator;
    try {
        await assert.rejects(bookInspectionAppointment(record._id, { date, time: "09:00" }, owner), /SAVE_REACHED/);
        assert.equal(record.application.inspection.scheduledAt.toISOString(), "2099-12-10T01:00:00.000Z");
        await assert.rejects(bookInspectionAppointment(record._id, { date, time: "10:00" }, owner), /submit a reschedule request/);
    } finally { Consignment.findById = originalFind; User.findById = originalUser; }
});
test("consignment approval rechecks capacity without approving a full slot", async () => {
    await vehicle("FULL", "10:00");
    const originalFind = Consignment.findById, originalUser = User.findById;
    const record = { _id: new mongoose.Types.ObjectId(), application: { status: "Under Review", inspection: { status: "Pending" } }, reschedule: { status: "Pending", proposedDate: new Date(date), proposedTime: "10:00" } };
    Consignment.findById = async () => record; User.findById = async () => admin;
    try {
        await assert.rejects(approveReschedule(record._id, {}, admin._id), /fully booked/);
        assert.equal(record.reschedule.status, "Pending");
    } finally { Consignment.findById = originalFind; User.findById = originalUser; }
});
test("registration inspections receive one reminder during the due window", async () => {
    const soon = new Date(Date.now() + 3600000 + 8 * 3600000).toISOString();
    const record = await vehicle("REMINDER");
    record.inspection = { scheduledDate: soon.slice(0, 10), scheduledTime: soon.slice(11, 16) }; await record.save();
    await sendInspectionAppointmentReminders(); await sendInspectionAppointmentReminders();
    assert.equal(await Notification.countDocuments({ recipient: owner, "metadata.relatedId": record._id, type: "Inspection Appointment Reminder" }), 1);
});
