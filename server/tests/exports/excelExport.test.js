import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import cookieParser from "cookie-parser";
import ExcelJS from "exceljs";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import routes from "../../routes/index.js";

import Booking from "../../models/Booking.js";
import ManualRefund from "../../models/ManualRefund.js";
import Payment from "../../models/Payment.js";
import PayoutRequest from "../../models/PayoutRequest.js";
import Rental from "../../models/Rental.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
import WithdrawalRequest from "../../models/WithdrawalRequest.js";
import "../../models/Driver.js";

import {
    buildBookingsWorkbook,
    buildFinancialWorkbook,
    getBookingExportRows,
    getPaymentExportRows,
    getRefundExportRows,
    parseDateRange,
    parseFinancialSections,
    summarizeFinancials,
    getPayoutExportRows,
    getWithdrawalExportRows,
} from "../../services/exportService.js";
import { listAllRefunds } from "../../services/refundService.js";
import { getOnlineRevenueForRange } from "../../services/onlineRevenueService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Raw inserts: the exports only read stored fields, and the full schemas
 * require far more than these figures need. The data mixes every place money
 * is recorded so the tests can check nothing is dropped or counted twice.
 */
const newId = () => new mongoose.Types.ObjectId();

const ids = {};

const ALL_TIME = parseDateRange({});

const insertPayment = (fields) =>
    Payment.collection.insertOne({
        _id: newId(),
        customer: ids.customer,
        paymentType: "RESERVATION_FEE",
        paymentMethod: "GCASH",
        status: "VERIFIED",
        refund: null,
        createdAt: new Date("2026-09-10T02:00:00Z"),
        processedAt: new Date("2026-09-10T02:05:00Z"),
        ...fields,
    });

const insertBooking = (fields) =>
    Booking.collection.insertOne({
        bookingCode: `BK-${newId()}`,
        customer: ids.customer,
        vehicle: ids.vehicle,
        driverOption: "Without Driver",
        startDate: new Date("2026-09-12T00:00:00Z"),
        endDate: new Date("2026-09-14T00:00:00Z"),
        pickupLocation: { type: "Office", address: "Legazpi City", name: "Main Office" },
        returnLocation: { type: "Office", address: "Legazpi City", name: "Main Office" },
        pricing: {
            dailyRate: 1500,
            reservationFee: 500,
            rentalDays: 2,
            subtotal: 3000,
            totalAmount: 3500,
            driverFee: 0,
            pickupDistanceFee: 0,
            returnDistanceFee: 0,
        },
        extensions: [],
        statusHistory: [],
        createdAt: new Date("2026-09-09T00:00:00Z"),
        ...fields,
    });

const seed = async () => {
    ids.customer = newId();
    ids.operator = newId();
    ids.vehicle = newId();

    await User.collection.insertMany([
        { _id: ids.customer, firstName: "Juan", lastName: "Dela Cruz", email: "juan@test.local", phoneNumber: "09170000000" },
        { _id: ids.operator, firstName: "Ana", lastName: "Partner", email: "ana@test.local" },
    ]);

    await Vehicle.collection.insertOne({
        _id: ids.vehicle,
        brand: "Toyota",
        model: "Vios",
        year: 2022,
        plateNumber: "ABC 1234",
        vehicleCode: `TEST-${ids.vehicle}`,
        operator: ids.operator,
    });

    // B1: a completed trip with an extension and a tracked rental refund.
    ids.b1 = (await insertBooking({
        bookingCode: "BK-ONE",
        status: "Completed",
        voucher: { code: "SAVE100", discountAmount: 100 },
        extensions: [
            { status: "Approved", pricing: { amount: 300 } },
            { status: "Rejected", pricing: { amount: 999 } },
        ],
    })).insertedId;

    // B2/B3: cancelled before pickup.
    ids.b2 = (await insertBooking({
        bookingCode: "BK-TWO",
        status: "Cancelled",
        statusHistory: [
            { status: "Approved", reason: "" },
            { status: "Cancelled", reason: "Change of plans" },
        ],
    })).insertedId;
    ids.b3 = (await insertBooking({ bookingCode: "BK-THREE", status: "Cancelled" })).insertedId;

    ids.p1 = (await insertPayment({ booking: ids.b1, amount: 1000, refund: { amount: 200, status: "succeeded", reason: "others", method: "automatic", initiatedAt: new Date("2026-09-15T00:00:00Z") } })).insertedId;
    await insertPayment({ booking: ids.b1, paymentType: "EXTENSION_FEE", bookingExtension: newId(), amount: 300 });
    // Partial refund: the payment stays VERIFIED.
    await insertPayment({ booking: ids.b2, amount: 1000, refund: { amount: 700, status: "succeeded", reason: "requested_by_customer", method: "automatic", initiatedAt: new Date("2026-09-11T00:00:00Z") } });
    await insertPayment({ booking: ids.b3, amount: 500, status: "REFUNDED", refund: { amount: 500, status: "requires_manual_action", reason: "requested_by_customer", method: "manual", initiatedAt: new Date("2026-09-11T00:00:00Z") } });
    await insertPayment({ booking: newId(), amount: 400, status: "PENDING", processedAt: null });
    await insertPayment({ booking: newId(), amount: 400, status: "CANCELLED", processedAt: null });
    await insertPayment({ booking: newId(), amount: 300, refund: { amount: 300, status: "failed", reason: "others", method: "automatic", initiatedAt: new Date("2026-09-11T00:00:00Z") } });

    await Rental.collection.insertOne({
        rentalCode: "RN-ONE",
        booking: ids.b1,
        customer: ids.customer,
        vehicle: ids.vehicle,
        status: "Completed",
        financial: { finalAmount: 3700, amountPaid: 3100, balance: 0, lateCharges: 0, damageCharges: 0, otherCharges: 0 },
        payments: [
            { _id: newId(), amount: 2000, type: "Full Payment", status: "Verified", paymentMethod: "Cash", paymentDate: new Date("2026-09-12T01:00:00Z") },
            { _id: newId(), amount: 500, type: "Additional Payment", status: "Pending", paymentMethod: "Cash", paymentDate: new Date("2026-09-13T01:00:00Z") },
        ],
        refunds: [
            // Sent back through P1: counted here, not again on the payment.
            { _id: newId(), amount: 200, reason: "Overpayment", status: "Approved", gatewayStatus: "succeeded", gatewayPayment: ids.p1, createdAt: new Date("2026-09-15T00:00:00Z") },
            { _id: newId(), amount: 100, reason: "Other", status: "Pending", gatewayStatus: "not_applicable", createdAt: new Date("2026-09-15T00:00:00Z") },
            { _id: newId(), amount: 50, reason: "Other", status: "Rejected", gatewayStatus: "not_applicable", createdAt: new Date("2026-09-15T00:00:00Z") },
            { _id: newId(), amount: 80, reason: "Other", status: "Approved", gatewayStatus: "failed", createdAt: new Date("2026-09-15T00:00:00Z") },
        ],
        securityDeposit: { required: false },
        return: { date: new Date("2026-09-14T02:00:00Z") },
    });

    await ManualRefund.collection.insertMany([
        { booking: ids.b2, customer: ids.customer, amount: 150, reason: "Owed", status: "Owed", createdAt: new Date("2026-09-11T00:00:00Z") },
        { booking: ids.b2, customer: ids.customer, amount: 60, reason: "Owed", status: "Not Paid", createdAt: new Date("2026-09-11T00:00:00Z") },
        { booking: ids.b2, customer: ids.customer, amount: 40, reason: "Owed", status: "Paid", createdAt: new Date("2026-09-11T00:00:00Z") },
    ]);

    const payout = (code, status, earnings, commission) => ({
        operator: ids.operator,
        payoutCode: code,
        payoutMethod: "GCASH",
        items: [{ booking: ids.b1, vehicle: ids.vehicle, bookingAmount: earnings + commission, refundDeduction: 0, platformCommission: commission, operatorEarnings: earnings }],
        subtotalAmount: earnings + commission,
        totalCommission: commission,
        payoutAmount: earnings,
        status,
        createdAt: new Date("2026-09-16T00:00:00Z"),
    });

    await PayoutRequest.collection.insertMany([
        payout("PO-1", "PAID", 1800, 200),
        payout("PO-2", "SCHEDULED", 900, 100),
        payout("PO-3", "CANCELLED", 500, 50),
    ]);

    await WithdrawalRequest.collection.insertMany([
        { withdrawalCode: "WD-1", operator: ids.operator, wallet: newId(), amount: 1000, gcashNumber: "09171234567", accountName: "Ana Partner", status: "COMPLETED", createdAt: new Date("2026-09-17T00:00:00Z") },
        { withdrawalCode: "WD-2", operator: ids.operator, wallet: newId(), amount: 300, gcashNumber: "09171234567", accountName: "Ana Partner", status: "PENDING", createdAt: new Date("2026-09-17T00:00:00Z") },
    ]);
};

const readWorkbook = async (buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
};

describe("admin Excel exports", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(async () => {
        await Promise.all(
            [Booking, ManualRefund, Payment, PayoutRequest, Rental, User, Vehicle, WithdrawalRequest].map(
                (model) => model.collection.deleteMany({})
            )
        );
        await seed();
    });

    it("payments include online fees and admin-recorded rental payments", async () => {
        const rows = await getPaymentExportRows(ALL_TIME);

        // 7 Payment documents + 2 rental payments.
        assert.equal(rows.length, 9);

        const summary = summarizeFinancials({ payments: rows });

        assert.equal(summary.payments.collectedOnline, 3100);
        assert.equal(summary.payments.collectedRecorded, 2000);
        assert.equal(summary.payments.totalCollected, 5100);
        assert.equal(summary.payments.pending, 900);

        // Same figure the Financials page / revenue dashboard calls collected.
        const online = await getOnlineRevenueForRange(new Date(0), null);
        assert.equal(summary.payments.collectedOnline, online.received);

        const extension = rows.find((row) => row.purpose === "Extension fee");
        assert.equal(extension.bookingCode, "BK-ONE");
        assert.equal(extension.customerName, "Juan Dela Cruz");
    });

    it("refunds cover every source without double counting", async () => {
        const rows = await getRefundExportRows(ALL_TIME);

        // 4 rental refunds + 3 untracked payment refunds + 3 owed refunds;
        // P1's payment-level refund is the tracked rental refund, so it's not repeated.
        assert.equal(rows.length, 10);

        const summary = summarizeFinancials({ refunds: rows });

        assert.equal(summary.refunds.rentalRefunds, 200);
        assert.equal(summary.refunds.paymentRefunds, 1200);
        assert.equal(summary.refunds.owedRefunds, 190);
        assert.equal(summary.refunds.totalRefunded, 1590);
        assert.equal(summary.refunds.pendingRequestCount, 1);
        assert.equal(summary.refunds.pendingRequestAmount, 100);

        // Matches the Financials page's "Refunded" KPI.
        const page = await listAllRefunds({ limit: 1 });
        assert.equal(
            summary.refunds.totalRefunded,
            page.summary.approvedTotal + page.summary.bookingRefundedTotal
        );
    });

    it("payouts and withdrawals split by status, account numbers masked", async () => {
        const payouts = await getPayoutExportRows(ALL_TIME);
        const withdrawals = await getWithdrawalExportRows(ALL_TIME);

        const summary = summarizeFinancials({ payouts, withdrawals });

        assert.equal(summary.payouts.paid, 1800);
        assert.equal(summary.payouts.notYetReleased, 900);
        assert.equal(summary.payouts.commission, 300);
        assert.equal(summary.payouts.cancelled, 500);
        assert.equal(summary.withdrawals.completed, 1000);
        assert.equal(summary.withdrawals.inProgress, 300);

        assert.equal(payouts[0].vehicle, "Toyota Vios 2022");
        assert.equal(payouts[0].partner, "Ana Partner");
        assert.ok(withdrawals[0].gcashNumber.endsWith("4567"));
        assert.ok(!withdrawals[0].gcashNumber.includes("0917"));
    });

    it("date range uses Manila calendar days", async () => {
        // 00:30 on Oct 1 in Manila is still Sep 30 in UTC.
        await insertPayment({ booking: newId(), amount: 250, processedAt: new Date("2026-09-30T16:30:00Z"), createdAt: new Date("2026-09-30T16:00:00Z") });
        // 23:30 on Sep 30 in Manila.
        await insertPayment({ booking: newId(), amount: 111, processedAt: new Date("2026-09-30T15:30:00Z"), createdAt: new Date("2026-09-30T15:00:00Z") });

        const october = await getPaymentExportRows(
            parseDateRange({ from: "2026-10-01", to: "2026-10-31" })
        );
        assert.deepEqual(october.map((row) => row.amount), [250]);

        const september = await getPaymentExportRows(
            parseDateRange({ from: "2026-09-01", to: "2026-09-30" })
        );
        assert.ok(september.some((row) => row.amount === 111));
        assert.ok(!september.some((row) => row.amount === 250));

        assert.throws(() => parseDateRange({ from: "2026-10-05", to: "2026-10-01" }));
        assert.throws(() => parseDateRange({ from: "10/01/2026" }));
        assert.throws(() => parseFinancialSections("nothing"));
        assert.deepEqual(parseFinancialSections("payouts,payments"), ["payments", "payouts"]);
    });

    it("booking rows follow the given order and add up each booking's money", async () => {
        const rows = await getBookingExportRows([
            String(ids.b2),
            String(newId()),
            String(ids.b1),
        ]);

        assert.deepEqual(rows.map((row) => row.bookingCode), ["BK-TWO", "BK-ONE"]);

        const [two, one] = rows;

        assert.equal(two.endReason, "Change of plans");
        // 700 payment refund + 150 owed + 40 paid (60 "Not Paid" excluded).
        assert.equal(two.refunded, 890);
        assert.equal(two.paidOnline, 1000);
        assert.equal(two.finalAmount, null);

        assert.equal(one.vehicle, "Toyota Vios 2022");
        assert.equal(one.partner, "Ana Partner");
        assert.equal(one.extensionCharges, 300);
        assert.equal(one.voucherCode, "SAVE100");
        assert.equal(one.paidOnline, 1300);
        assert.equal(one.paidRecorded, 2000);
        // Only the tracked 200; P1's own copy of it isn't added again.
        assert.equal(one.refunded, 200);
        assert.equal(one.rentalCode, "RN-ONE");
        assert.equal(one.reservationPaymentStatus, "Verified");
    });

    it("writes formatted workbooks whose totals match the rows", async () => {
        const { buffer: bookingsBuffer } = await buildBookingsWorkbook([
            String(ids.b1),
            String(ids.b2),
        ]);
        const bookings = (await readWorkbook(bookingsBuffer)).getWorksheet("Bookings");

        assert.equal(bookings.getCell("A1").value, "Booking code");
        assert.equal(bookings.getCell("A2").value, "BK-ONE");
        // Two data rows + header + total row.
        assert.equal(bookings.rowCount, 4);
        assert.equal(bookings.getCell("A4").value, "Total");

        const { buffer } = await buildFinancialWorkbook({
            sections: ["payments", "refunds", "payouts"],
            range: ALL_TIME,
        });
        const workbook = await readWorkbook(buffer);

        assert.deepEqual(
            workbook.worksheets.map((sheet) => sheet.name),
            ["Summary", "Payments", "Refunds", "Partner payouts", "Partner withdrawals"]
        );

        const payments = workbook.getWorksheet("Payments");
        const header = payments.getRow(1).values.slice(1);
        const collectedCol = header.indexOf("Collected") + 1;
        const totalCell = payments.getRow(payments.rowCount).getCell(collectedCol);

        assert.match(totalCell.value.formula, /^SUBTOTAL\(109,/);
        assert.equal(totalCell.value.result, 5100);

        // Amounts are stored as numbers, dates as dates.
        const amountCol = header.indexOf("Amount") + 1;
        assert.equal(typeof payments.getRow(2).getCell(amountCol).value, "number");
        assert.ok(payments.getRow(2).getCell(1).value instanceof Date);

        const summaryValues = workbook
            .getWorksheet("Summary")
            .getSheetValues()
            .filter(Boolean)
            .map((row) => [row[1], row[2]]);
        const totalRefunded = summaryValues.find(([label]) => label === "Total refunded");
        assert.equal(totalRefunded[1], 1590);
        const net = summaryValues.find(([label]) => label === "Total collected less total refunded");
        assert.equal(net[1], 5100 - 1590);
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
            const customer = await cookieFor("customer");

            const response = await fetch(`${baseUrl}/exports/financials`, {
                headers: { Cookie: customer },
            });
            assert.equal(response.status, 403);

            const anonymous = await fetch(`${baseUrl}/exports/financials`);
            assert.equal(anonymous.status, 401);
        });

        it("returns xlsx files and rejects bad input", async () => {
            const admin = await cookieFor("admin");

            const financials = await fetch(
                `${baseUrl}/exports/financials?sections=payments,refunds&from=2026-09-01&to=2026-09-30`,
                { headers: { Cookie: admin } }
            );
            assert.equal(financials.status, 200);
            assert.match(financials.headers.get("content-type"), /spreadsheetml/);

            const workbook = await readWorkbook(
                Buffer.from(await financials.arrayBuffer())
            );
            assert.deepEqual(
                workbook.worksheets.map((sheet) => sheet.name),
                ["Summary", "Payments", "Refunds"]
            );

            const bookings = await fetch(`${baseUrl}/exports/bookings`, {
                method: "POST",
                headers: { Cookie: admin, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingIds: [String(ids.b1)] }),
            });
            assert.equal(bookings.status, 200);

            const badId = await fetch(`${baseUrl}/exports/bookings`, {
                method: "POST",
                headers: { Cookie: admin, "Content-Type": "application/json" },
                body: JSON.stringify({ bookingIds: [{ $gt: "" }] }),
            });
            assert.equal(badId.status, 400);

            const badRange = await fetch(
                `${baseUrl}/exports/financials?from=2026-10-05&to=2026-10-01`,
                { headers: { Cookie: admin } }
            );
            assert.equal(badRange.status, 400);
            assert.match((await badRange.json()).message, /start date/);
        });
    });
});
