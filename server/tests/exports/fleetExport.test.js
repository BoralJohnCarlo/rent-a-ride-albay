import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import cookieParser from "cookie-parser";
import ExcelJS from "exceljs";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import routes from "../../routes/index.js";

import Booking from "../../models/Booking.js";
import Consignment from "../../models/Consignment.js";
import Review from "../../models/Review.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";

import {
    buildPartnersWorkbook,
    buildVehiclesWorkbook,
    getPartnerExportRows,
    getVehicleExportRows,
} from "../../services/fleetExportService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/* Raw inserts, same as excelExport.test.js: only the fields read here. */
const newId = () => new mongoose.Types.ObjectId();

const ids = {};

const DAY = 24 * 60 * 60 * 1000;

const readWorkbook = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
};

const insertVehicle = (fields) =>
    Vehicle.collection.insertOne({
        brand: "Toyota",
        model: "Vios",
        year: 2022,
        vehicleType: "Car",
        status: "Available",
        ownership: "Company",
        specifications: { transmission: "Automatic", fuelType: "Gasoline", seatingCapacity: "5" },
        pricing: { dailyRate: 1500, reservationFee: 499.97 },
        availability: { bookingEnabled: true },
        createdAt: new Date("2026-08-01T00:00:00Z"),
        ...fields,
    });

const insertBooking = (fields) =>
    Booking.collection.insertOne({
        bookingCode: `BK-${newId()}`,
        customer: ids.customer,
        startDate: new Date("2026-09-12T00:00:00Z"),
        endDate: new Date("2026-09-14T00:00:00Z"),
        pricing: { rentalDays: 2, totalAmount: 3500 },
        ...fields,
    });

const insertConsignment = (fields) =>
    Consignment.collection.insertOne({
        consignmentCode: `CON-${newId()}`,
        snapshots: {
            applicant: {
                identity: { displayName: "Ana Partner" },
                organization: { name: "Ana Rentals" },
                contact: { phoneNumber: "09171234567", email: "ana@test.local" },
                address: { street: "Rizal St", barangay: "Bonot", city: "Legazpi", province: "Albay" },
                verification: { status: "Verified" },
            },
            vehicle: {
                brand: "Isuzu",
                model: "Crosswind",
                year: 2020,
                vehicleType: "Car",
                plateNumber: "XYZ 999",
                specifications: { transmission: "Manual", fuelType: "Diesel", seatingCapacity: 7 },
                pricing: {},
            },
        },
        audit: { createdBy: ids.operator },
        archive: { isArchived: false },
        createdAt: new Date("2026-08-01T00:00:00Z"),
        ...fields,
    });

const seed = async () => {
    ids.customer = newId();
    ids.operator = newId();
    ids.company = newId();
    ids.consigned = newId();
    ids.consigned2 = newId();
    ids.archived = newId();

    await Settings.collection.insertOne({
        commissionSettings: { platformCommissionRate: 12 },
    });

    await User.collection.insertMany([
        { _id: ids.customer, firstName: "Juan", lastName: "Dela Cruz", email: "juan@test.local" },
        { _id: ids.operator, firstName: "Ana", lastName: "Partner", email: "ana@test.local", phoneNumber: "09171234567", isSuspended: false },
    ]);

    await insertVehicle({ _id: ids.company, vehicleCode: "VH-0001", plateNumber: "AAA 111" });
    await insertVehicle({
        _id: ids.consigned,
        vehicleCode: "VH-0002",
        plateNumber: "XYZ 999",
        ownership: "Consigned",
        operator: ids.operator,
        commission: { mode: null, value: null },
    });
    await insertVehicle({
        _id: ids.consigned2,
        vehicleCode: "VH-0003",
        plateNumber: "XYZ 888",
        ownership: "Consigned",
        operator: ids.operator,
        commission: { mode: "PERCENTAGE", value: 8 },
    });
    await insertVehicle({
        _id: ids.archived,
        vehicleCode: "VH-0004",
        plateNumber: "OLD 000",
        status: "Archived",
        archive: { archivedAt: new Date("2026-09-01T00:00:00Z"), archiveReason: "Sold" },
    });

    // Company car: 2 completed trips, 1 cancelled (not counted), 1 upcoming.
    await insertBooking({ vehicle: ids.company, status: "Completed" });
    await insertBooking({ vehicle: ids.company, status: "Completed", pricing: { rentalDays: 3, totalAmount: 5000.1 } });
    await insertBooking({ vehicle: ids.company, status: "Cancelled", pricing: { rentalDays: 9, totalAmount: 99999 } });
    await insertBooking({
        vehicle: ids.company,
        status: "Approved",
        startDate: new Date(Date.now() + 2 * DAY),
        endDate: new Date(Date.now() + 4 * DAY),
    });

    // Consigned car: out on rent now.
    await insertBooking({
        vehicle: ids.consigned,
        status: "Ongoing",
        startDate: new Date(Date.now() - DAY),
        endDate: new Date(Date.now() + DAY),
        dueBackDate: new Date(Date.now() + DAY),
    });
    await insertBooking({ vehicle: ids.consigned, status: "Completed", pricing: { rentalDays: 1, totalAmount: 2000 } });

    await Review.collection.insertMany([
        // One review per rental (unique index).
        { vehicle: ids.company, rental: newId(), rating: 5 },
        { vehicle: ids.company, rental: newId(), rating: 4 },
    ]);

    // Ana: two approved vehicles; a rejected and an archived one don't count.
    await insertConsignment({
        consignmentCode: "CON-1",
        application: {
            status: "Approved",
            approval: { approvedAt: new Date("2026-08-10T00:00:00Z") },
        },
        generatedEntities: { vehicle: ids.consigned },
    });
    await insertConsignment({
        consignmentCode: "CON-2",
        application: {
            status: "Approved",
            approval: { approvedAt: new Date("2026-09-20T00:00:00Z") },
        },
        generatedEntities: { vehicle: ids.consigned2 },
    });
    await insertConsignment({
        consignmentCode: "CON-3",
        application: { status: "Rejected" },
    });
    await insertConsignment({
        consignmentCode: "CON-4",
        application: { status: "Approved" },
        archive: { isArchived: true },
    });
};

describe("fleet and partner Excel exports", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(async () => {
        await Promise.all(
            [Booking, Consignment, Review, Settings, User, Vehicle].map(
                (model) => model.collection.deleteMany({})
            )
        );
        await seed();
    });

    it("vehicle rows follow the given order with all-time stats", async () => {
        const rows = await getVehicleExportRows([
            String(ids.consigned),
            String(newId()),
            String(ids.company),
        ]);

        assert.deepEqual(rows.map((row) => row.vehicleCode), ["VH-0002", "VH-0001"]);

        const [consigned, company] = rows;

        // Cancelled booking left out; value is completed trips only.
        assert.equal(company.bookings, 3);
        assert.equal(company.completedTrips, 2);
        assert.equal(company.rentalDays, 5);
        assert.equal(company.bookingValue, 8500.1);
        assert.equal(company.averageRating, 4.5);
        assert.equal(company.reviewCount, 2);
        assert.equal(company.upcomingCount, 1);
        assert.ok(company.nextPickup);
        assert.equal(company.dueBack, null);
        assert.equal(company.dailyTotal, 1999.97);
        assert.equal(company.commission, "");
        assert.equal(company.partner, "");

        assert.ok(consigned.dueBack);
        assert.equal(consigned.partner, "Ana Partner");
        assert.equal(consigned.partnerEmail, "ana@test.local");
        assert.equal(consigned.commission, "Default (12%)");
        assert.equal(consigned.seats, "5");
    });

    it("adds archive columns only when an archived vehicle is exported", async () => {
        const active = await readWorkbook(
            (await buildVehiclesWorkbook([String(ids.company)])).buffer
        );
        const activeHeader = active.getWorksheet("Fleet").getRow(1).values;
        assert.ok(!activeHeader.includes("Archive reason"));

        const archived = await readWorkbook(
            (await buildVehiclesWorkbook([String(ids.archived), String(ids.company)])).buffer
        );
        const sheet = archived.getWorksheet("Fleet");
        const header = sheet.getRow(1).values;
        const reasonCol = header.indexOf("Archive reason");

        assert.ok(reasonCol > 0);
        assert.equal(sheet.getRow(2).getCell(reasonCol).value, "Sold");
        // The active vehicle's archive cells stay empty.
        assert.equal(sheet.getRow(3).getCell(reasonCol).value, null);

        const valueCol = header.indexOf("Completed booking value");
        const total = sheet.getRow(sheet.rowCount).getCell(valueCol);
        assert.equal(sheet.getRow(sheet.rowCount).getCell(1).value, "Total");
        assert.equal(total.value.result, 8500.1);
    });

    it("groups approved, non-archived consignments by partner", async () => {
        const { partnerRows, vehicleRows } = await getPartnerExportRows();

        assert.deepEqual(
            vehicleRows.map((row) => row.consignmentCode),
            ["CON-1", "CON-2"]
        );

        assert.equal(partnerRows.length, 1);

        const [ana] = partnerRows;
        assert.equal(ana.partner, "Ana Partner");
        assert.equal(ana.organization, "Ana Rentals");
        assert.equal(ana.vehicleCount, 2);
        assert.equal(ana.completedTrips, 1);
        assert.equal(ana.bookingValue, 2000);
        assert.equal(ana.account, "Active");
        assert.equal(ana.address, "Rizal St, Bonot, Legazpi, Albay");
        assert.equal(ana.firstApproved.toISOString(), "2026-08-10T00:00:00.000Z");
        assert.equal(ana.latestApproved.toISOString(), "2026-09-20T00:00:00.000Z");

        const [one, two] = vehicleRows;
        assert.equal(one.vehicleCode, "VH-0002");
        assert.equal(one.commission, "Default (12%)");
        assert.equal(two.commission, "8%");
        assert.equal(one.dailyRate, 1500);

        const workbook = await readWorkbook((await buildPartnersWorkbook()).buffer);
        assert.deepEqual(
            workbook.worksheets.map((sheet) => sheet.name),
            ["Partners", "Approved vehicles"]
        );
    });

    describe("over HTTP", () => {
        let server;
        let baseUrl;

        before(async () => {
            const app = express();
            app.use(express.json());
            app.use(cookieParser());
            app.use("/api", routes);

            await new Promise((resolve) => {
                server = app.listen(0, resolve);
            });
            baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        });

        after(() => new Promise((resolve) => server.close(resolve)));

        const cookieFor = async (role) => {
            const _id = newId();

            await User.collection.insertOne({
                _id,
                role,
                firstName: "Test",
                lastName: role,
                email: `${role}-${_id}@test.local`,
            });

            return `token=${jwt.sign({ id: _id }, process.env.JWT_SECRET)}`;
        };

        it("is admin only", async () => {
            const operator = await cookieFor("operator");

            const partners = await fetch(`${baseUrl}/exports/partners`, {
                headers: { Cookie: operator },
            });
            assert.equal(partners.status, 403);

            const vehicles = await fetch(`${baseUrl}/exports/vehicles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleIds: [String(ids.company)] }),
            });
            assert.equal(vehicles.status, 401);

            const schedule = await fetch(`${baseUrl}/vehicles/booking-schedule`, {
                headers: { Cookie: operator },
            });
            assert.equal(schedule.status, 403);
        });

        it("returns xlsx files and rejects bad input", async () => {
            const admin = await cookieFor("admin");

            const vehicles = await fetch(`${baseUrl}/exports/vehicles`, {
                method: "POST",
                headers: { Cookie: admin, "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleIds: [String(ids.company)] }),
            });
            assert.equal(vehicles.status, 200);
            assert.match(vehicles.headers.get("content-type"), /spreadsheetml/);

            const partners = await fetch(`${baseUrl}/exports/partners`, {
                headers: { Cookie: admin },
            });
            assert.equal(partners.status, 200);

            const empty = await fetch(`${baseUrl}/exports/vehicles`, {
                method: "POST",
                headers: { Cookie: admin, "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleIds: [] }),
            });
            assert.equal(empty.status, 400);

            const badId = await fetch(`${baseUrl}/exports/vehicles`, {
                method: "POST",
                headers: { Cookie: admin, "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleIds: [{ $gt: "" }] }),
            });
            assert.equal(badId.status, 400);

            const schedule = await fetch(`${baseUrl}/vehicles/booking-schedule`, {
                headers: { Cookie: admin },
            });
            assert.equal(schedule.status, 200);
            const { data } = await schedule.json();
            assert.equal(data[String(ids.company)].upcomingCount, 1);
            assert.ok(data[String(ids.consigned)].current);
        });
    });
});
