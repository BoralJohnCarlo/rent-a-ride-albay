import assert from "node:assert/strict";
import { before, after, beforeEach, it, mock } from "node:test";
import dotenv from "dotenv";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
dotenv.config({ path: new URL("../../.env", import.meta.url), quiet: true });
mock.method(nodemailer, "createTransport", () => ({ verify: async () => {} }));
await import("../../services/notificationService.js");
const { evaluateBoundary, deliverBoundaryNotices, reviewBoundaryIncident } = await import("../../services/boundaryService.js");
const { updateBookingLocationPolicy } = await import("../../services/settingsService.js");
mock.restoreAll();
const { default: Settings } = await import("../../models/Settings.js");
const { default: Vehicle } = await import("../../models/Vehicle.js");
const { default: Tracker } = await import("../../models/Tracker.js");
const { default: Rental } = await import("../../models/Rental.js");
const { default: Booking } = await import("../../models/Booking.js");
const { default: User } = await import("../../models/User.js");
const { default: State } = await import("../../models/VehicleTrackingState.js");
const { default: Incident } = await import("../../models/BoundaryIncident.js");
const { default: Notice } = await import("../../models/BoundaryNotice.js");
const { default: Notification } = await import("../../models/Notification.js");
const { default: Alert } = await import("../../models/Alert.js");
const { default: boundaryRoutes } = await import("../../routes/boundaryRoutes.js");
const { BOUNDARY_DEFAULTS } = await import("../../utils/boundaryPolicy.js");
const id = () => new mongoose.Types.ObjectId();
let tracker, rental, admin, base;
let httpServer, httpBase;
process.env.JWT_SECRET ||= "boundary-local-test-secret";
const dbName = `rent_a_ride_albay_test_boundary_${process.pid}_${Date.now()}`;
before(async () => {
    const uri = process.env.MONGO_URI;
    if (!uri || !["localhost", "127.0.0.1"].includes(new URL(uri).hostname)) throw new Error("Boundary integration tests require a local MongoDB replica set.");
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 3000 });
    await Promise.all([Incident, Notice, Notification, Alert, Rental].map(model => model.init()));
    const app = express(); app.use(express.json()); app.use(cookieParser()); app.use("/boundary", boundaryRoutes);
    httpServer = await new Promise(resolve => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); });
    httpBase = `http://127.0.0.1:${httpServer.address().port}`;
});
after(async () => {
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    if (mongoose.connection.name === dbName && dbName.startsWith("rent_a_ride_albay_test_")) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});
beforeEach(async () => {
    for (const collection of await mongoose.connection.db.collections()) await collection.deleteMany({});
    base = Date.now() - 3600000;
    admin = id(); const customer = id(), vehicle = id(), booking = id();
    await Settings.create({ boundarySettings: { ...BOUNDARY_DEFAULTS, penaltiesEnabled: true } });
    await User.collection.insertMany([
        { _id: admin, role: "admin", email: "admin@example.invalid", firstName: "Test" },
        { _id: customer, role: "customer", email: "customer@example.invalid", firstName: "Test" },
    ]);
    await Vehicle.collection.insertOne({ _id: vehicle, vehicleCode: String(vehicle), plateNumber: String(vehicle), status: "Rented" });
    tracker = { _id: id(), vehicle, status: "active", protocol: "http_simulator", assignedAt: new Date(base - 1000) };
    await Tracker.collection.insertOne(tracker);
    await Booking.collection.insertOne({ _id: booking, termsAcceptance: { policySnapshot: { boundary: { ...BOUNDARY_DEFAULTS, penaltiesEnabled: true } } } });
    rental = await Rental.create({ rentalCode: "TEST-BOUNDARY", booking, customer, vehicle,
        bookingPeriod: { originalStartDate: new Date(base - 1000), actualStartDate: new Date(base - 1000), originalEndDate: new Date(base + 86400000) },
        financial: { baseRentalCharge: 1000, reservationFee: 100 },
    });
});
const fix = async (minute, latitude = 12.97, longitude = 124) => {
    await State.collection.updateOne({ vehicle: tracker.vehicle }, { $set: {
        tracker: tracker._id, gpsFix: true, latitude, longitude, recordedAt: new Date(base + minute * 60000),
    } }, { upsert: true });
    await evaluateBoundary(tracker, new Date(base + minute * 60000));
};
const eligible = async () => {
    for (let minute = 0; minute <= 16; minute++) await fix(minute);
    return Incident.findOne({ review: "eligible" });
};
const request = (path, user, body) => fetch(httpBase + path, {
    method: body ? "POST" : "GET", headers: { "Content-Type": "application/json",
        ...(user ? { Cookie: `token=${jwt.sign({ id: String(user), credentialVersion: 0 }, process.env.JWT_SECRET, { expiresIn: "5m" })}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
});

it("creates one excursion, persists warnings, and applies exactly one financial charge under concurrent approval", async () => {
    const incident = await eligible();
    assert.ok(incident); assert.equal(incident.amount, 500);
    assert.equal(await Incident.countDocuments(), 1);
    assert.equal(await Alert.countDocuments({ type: "BOUNDARY_OUTSIDE", status: "active" }), 1);
    await fix(16); assert.equal(await Incident.countDocuments(), 1);
    await deliverBoundaryNotices(); await deliverBoundaryNotices();
    assert.equal(await Notification.countDocuments({ recipient: rental.customer }), 2);
    const results = await Promise.allSettled([
        reviewBoundaryIncident(incident._id, "approve", "Route and warning reviewed", admin),
        reviewBoundaryIncident(incident._id, "approve", "Duplicate click", admin),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const charged = await Rental.findById(rental._id);
    assert.equal(charged.charges.length, 1); assert.equal(charged.charges[0].amount, 500);
    assert.equal(charged.financial.otherCharges, 500); assert.equal(charged.financial.finalAmount, 1600);
    assert.equal(charged.financial.balance, 1600);
    await fix(17, 13.18, 123.65); await fix(18, 13.18, 123.65);
    assert.equal((await Incident.findById(incident._id)).review, "approved");
    assert.equal(await Alert.countDocuments({ type: "BOUNDARY_OUTSIDE", status: "active" }), 0);
});
it("preserves eligible evidence on reentry and allows a reasoned waiver", async () => {
    const incident = await eligible();
    await fix(17, 13.18, 123.65); await fix(18, 13.18, 123.65);
    const returned = await Incident.findById(incident._id);
    assert.equal(returned.stage, "returned"); assert.equal(returned.evidenceMinutes, 15);
    await reviewBoundaryIncident(incident._id, "waive", "Accidental crossing reviewed", admin);
    assert.equal((await Rental.findById(rental._id)).charges.length, 0);
});
it("disabling alerts cancels countdowns, pending reviews, alerts and undelivered notices", async () => {
    await eligible();
    await updateBookingLocationPolicy({ boundarySettings: { alertsEnabled: false } });
    assert.equal((await Settings.findOne()).boundarySettings.penaltiesEnabled, false);
    assert.equal(await Incident.countDocuments({ active: true }), 0);
    assert.equal(await Incident.countDocuments({ review: "eligible" }), 0);
    assert.equal(await Notice.countDocuments({ delivered: false }), 0);
    assert.equal(await Alert.countDocuments({ status: "active" }), 0);
});
it("never proposes penalties for rentals without accepted boundary terms", async () => {
    await Booking.updateOne({ _id: rental.booking }, { $unset: { termsAcceptance: 1 } });
    for (let minute = 0; minute <= 18; minute++) await fix(minute);
    assert.equal(await Incident.countDocuments({ review: "eligible" }), 0);
    assert.equal(await Incident.countDocuments({ stage: "outside" }), 1);
});
it("approved outside trips suppress detection until expiry", async () => {
    await Rental.updateOne({ _id: rental._id }, { $set: { boundaryExemption: { until: new Date(base + 3600000), reason: "Approved route", approvedBy: admin } } });
    await fix(0); await fix(1);
    assert.equal(await Incident.countDocuments(), 0);
});
it("does not attribute pre-pickup fixes to the new rental", async () => {
    await Rental.updateOne({ _id: rental._id }, { $set: { "bookingPeriod.actualStartDate": new Date(base + 120000) } });
    await fix(0); await fix(1);
    assert.equal(await Incident.countDocuments(), 0);
});
it("restricts admin history and financial review while exposing only the customer's own warning", async () => {
    await eligible();
    assert.equal((await request("/boundary/incidents")).status, 401);
    assert.equal((await request("/boundary/incidents", rental.customer)).status, 403);
    const stranger = id(); await User.collection.insertOne({ _id: stranger, role: "customer" });
    assert.deepEqual((await (await request("/boundary/current", stranger)).json()).data, []);
    const own = (await (await request("/boundary/current", rental.customer)).json()).data;
    assert.equal(own.length, 1); assert.equal(own[0].latitude, undefined); assert.equal(own[0].customer, undefined);
    assert.equal((await request("/boundary/incidents", admin)).status, 200);
});
it("records, cancels and revokes approved outside trips through admin-only endpoints", async () => {
    await eligible();
    const path = `/boundary/rentals/${rental._id}/exemption`;
    const payload = { until: new Date(Date.now() + 3600000).toISOString(), reason: "Approved destination" };
    assert.equal((await request(path, rental.customer, payload)).status, 403);
    assert.equal((await request(path, admin, payload)).status, 200);
    assert.equal(await Incident.countDocuments({ review: "eligible" }), 0);
    assert.equal(await Alert.countDocuments({ status: "active" }), 0);
    let updated = await Rental.findById(rental._id);
    assert.equal(updated.boundaryExemptionHistory.length, 1);
    assert.equal((await request(path, admin, { revoke: true, reason: "Trip ended" })).status, 200);
    updated = await Rental.findById(rental._id);
    assert.equal(updated.boundaryExemption?.until, undefined);
    assert.equal(updated.boundaryExemptionHistory.length, 2);
});
it("requires a persisted customer warning and allows reducing the charge", async () => {
    const incident = await eligible();
    await Notification.deleteOne({ recipient: rental.customer, dedupeKey: `boundary:${incident._id}:outside:${rental.customer}` });
    await assert.rejects(reviewBoundaryIncident(incident._id, "approve", "Reviewed", admin), /warning has not been saved/);
    await deliverBoundaryNotices();
    await assert.rejects(reviewBoundaryIncident(incident._id, "approve", "Reviewed", admin, 501), { statusCode: 400 });
    await reviewBoundaryIncident(incident._id, "approve", "Reduced for accidental crossing", admin, 250);
    const charged = await Rental.findById(rental._id);
    assert.equal(charged.charges[0].amount, 250); assert.equal(charged.financial.finalAmount, 1350);
});
it("saves the customer's booking-linked warning atomically with crossing confirmation", async () => {
    await fix(0); await fix(1);
    const incident = await Incident.findOne({ stage: "outside" });
    const notice = await Notice.findOne({ incident: incident._id, recipient: rental.customer, kind: "outside" });
    assert.equal(notice.delivered, false);
    const warning = await Notification.findOne({ recipient: rental.customer, dedupeKey: notice.key });
    assert.ok(warning);
    assert.equal(warning.metadata.relatedModel, "Booking");
    assert.equal(String(warning.metadata.relatedId), String(rental.booking));
    assert.equal(warning.pushPending, true);
});
it("disabling only penalties cancels current reviews without stopping alerts or reviving the charge on reenable", async () => {
    const incident = await eligible();
    await updateBookingLocationPolicy({ boundarySettings: { penaltiesEnabled: false } });
    let updated = await Incident.findById(incident._id);
    assert.equal(updated.active, true); assert.equal(updated.review, "waived");
    assert.ok(updated.penaltyCancelledAt);
    assert.equal(await Alert.countDocuments({ type: "BOUNDARY_OUTSIDE", status: "active" }), 1);
    await updateBookingLocationPolicy({ boundarySettings: { penaltiesEnabled: true } });
    await fix(17); await fix(18);
    updated = await Incident.findById(incident._id);
    assert.equal(updated.review, "waived");
    await assert.rejects(reviewBoundaryIncident(incident._id, "approve", "Reviewed", admin), { statusCode: 409 });
    assert.equal((await Rental.findById(rental._id)).charges.length, 0);
});
it("reentry cancels delayed outside pushes while preserving in-app warning history", async () => {
    await fix(0); await fix(1);
    const incident = await Incident.findOne({ stage: "outside" });
    await fix(2, 13.18, 123.65); await fix(3, 13.18, 123.65);
    const outside = await Notice.findOne({ incident: incident._id, recipient: rental.customer, kind: "outside" });
    assert.equal(outside.delivered, true);
    const warning = await Notification.findOne({ dedupeKey: outside.key, recipient: rental.customer });
    assert.equal(warning.pushPending, false); assert.equal(warning.pushCancelled, true);
    assert.match(warning.title, /outside Albay/);
    assert.equal(await Notice.countDocuments({ incident: incident._id, kind: "returned", delivered: false }), 2);
});
it("shows an older pending review even when over 100 newer incidents exist", async () => {
    const incident = await eligible();
    await Incident.collection.insertMany(Array.from({ length: 101 }, (_, index) => ({
        vehicle: tracker.vehicle, tracker: tracker._id, rental: rental._id, active: false,
        stage: "returned", review: "none", createdAt: new Date(Date.now() + index * 1000),
    })));
    const result = await (await request("/boundary/incidents", admin)).json();
    assert.equal(String(result.data[0]._id), String(incident._id));
    assert.equal(result.data.length, 101);
});
