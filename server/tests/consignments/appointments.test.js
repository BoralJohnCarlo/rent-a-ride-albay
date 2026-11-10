import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import InspectionSetting from "../../models/InspectionSetting.js";
import PendingVehicle from "../../models/PendingVehicle.js";
import Consignment from "../../models/Consignment.js";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";
import { inspectionInstant } from "../../utils/inspectionTime.js";
import { assertInspectionSlotAvailable } from "../../services/inspectionSlotService.js";
import { updateRegistrationAppointment } from "../../services/registrationAppointmentService.js";
import { bookInspectionAppointment, requestReschedule, approveReschedule, withdrawConsignment, sendInspectionAppointmentReminders } from "../../services/consignmentService.js";
import { updateInspectionSetting, getInspectionAvailability } from "../../controllers/inspectionSettingController.js";

const owner = new mongoose.Types.ObjectId();
const stranger = new mongoose.Types.ObjectId();
const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };
const date = "2099-12-10";
const operator = { _id: owner, role: "operator" };
before(connectTestDb);
after(disconnectTestDb);
beforeEach(async () => {
    await Promise.all([InspectionSetting, PendingVehicle, Consignment, Notification].map(model => model.deleteMany({})));
    await InspectionSetting.create({ inspectionSlots: [{ date, timeSlots: [{ time: "09:00" }, { time: "10:00" }] }] });
});
const vehicle = (plate, time = "09:00") => PendingVehicle.create({
    vehicleType: "Car", brand: "Toyota", model: "Vios", plateNumber: plate,
    specifications: { transmission: "Automatic", fuelType: "Gasoline", seatingCapacity: 5 },
    operator: owner, inspection: { scheduledDate: date, scheduledTime: time },
});
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

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
