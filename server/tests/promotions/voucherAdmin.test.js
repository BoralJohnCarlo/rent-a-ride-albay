import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import Voucher from "../../models/Voucher.js";

import {
    VOUCHER_ASSIGNMENT_TYPE,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_STATUS,
    VOUCHER_TYPE,
} from "../../constants/voucherConstants.js";

import {
    createVoucher,
    getActiveVouchersForUser,
    getVoucherDateState,
    updateVoucherById,
    validateVoucherForUser,
} from "../../services/voucherService.js";

import {
    connectTestDb,
    disconnectTestDb,
} from "../helpers/testDb.js";

/* Users are inserted raw: only _id and role matter here. */
const insertUser = async (role) => {
    const _id = new mongoose.Types.ObjectId();

    await User.collection.insertOne({
        _id,
        role,
        email: `voucher-test-${_id}@example.com`,
        firstName: "Test",
        lastName: role,
    });

    return _id;
};

const DAY = 24 * 60 * 60 * 1000;

const baseVoucher = (overrides = {}) => ({
    name: "Test promo",
    type: VOUCHER_TYPE.RESERVATION_FEE,
    discountMethod: VOUCHER_DISCOUNT_METHOD.PERCENTAGE,
    discountValue: 10,
    startDate: new Date(Date.now() - DAY).toISOString(),
    endDate: new Date(Date.now() + 30 * DAY).toISOString(),
    maxUsagesPerUser: 1,
    assignmentType: VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
    assignedTo: [],
    ...overrides,
});

describe("admin voucher management", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(() =>
        Promise.all([
            Notification.deleteMany({}),
            User.collection.deleteMany({}),
            Voucher.deleteMany({}),
        ])
    );

    it("saves the status chosen on create (it used to always go live)", async () => {
        const voucher = await createVoucher(
            baseVoucher({ status: VOUCHER_STATUS.INACTIVE })
        );

        assert.equal(voucher.status, VOUCHER_STATUS.INACTIVE);

        const defaulted = await createVoucher(baseVoucher());
        assert.equal(defaulted.status, VOUCHER_STATUS.ACTIVE);
    });

    it("rejects percentage discounts over 100, including by switching method on edit", async () => {
        await assert.rejects(
            createVoucher(baseVoucher({ discountValue: 150 })),
            /cannot exceed 100/
        );

        const fixed = await createVoucher(
            baseVoucher({
                discountMethod: VOUCHER_DISCOUNT_METHOD.FIXED,
                discountValue: 500,
            })
        );

        await assert.rejects(
            updateVoucherById(fixed._id, {
                discountMethod: VOUCHER_DISCOUNT_METHOD.PERCENTAGE,
            }),
            /cannot exceed 100/
        );

        await assert.rejects(
            updateVoucherById(fixed._id, {
                endDate: new Date(Date.now() - 5 * DAY).toISOString(),
            }),
            /End date must be after start date/
        );
    });

    it("only lets admins assign vouchers to customer accounts", async () => {
        const customer = await insertUser("customer");
        const operator = await insertUser("operator");

        await assert.rejects(
            createVoucher(
                baseVoucher({
                    assignmentType:
                        VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS,
                    assignedTo: [String(customer), String(operator)],
                })
            ),
            /only be assigned to customer/
        );

        const voucher = await createVoucher(
            baseVoucher({
                assignmentType: VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS,
                assignedTo: [String(customer)],
            })
        );

        assert.deepEqual(
            voucher.assignedTo.map((id) => String(id._id ?? id)),
            [String(customer)]
        );

        await assert.rejects(
            updateVoucherById(voucher._id, {
                assignedTo: [String(operator)],
            }),
            /only be assigned to customer/
        );
    });

    it("locks auto-issued vouchers except for their status", async () => {
        const customer = await insertUser("customer");

        const credit = await createVoucher(
            baseVoucher({
                type: VOUCHER_TYPE.TOTAL,
                discountMethod: VOUCHER_DISCOUNT_METHOD.FIXED,
                discountValue: 1200,
                assignmentType: VOUCHER_ASSIGNMENT_TYPE.SPECIFIC_USERS,
                assignedTo: [customer],
                source: "early_return",
            })
        );

        await assert.rejects(
            updateVoucherById(credit._id, { discountValue: 5000 }),
            /can't be edited/
        );

        const deactivated = await updateVoucherById(credit._id, {
            status: VOUCHER_STATUS.INACTIVE,
        });

        assert.equal(deactivated.status, VOUCHER_STATUS.INACTIVE);
        assert.equal(deactivated.discountValue, 1200);
    });

    it("treats start and end as whole days in Philippine time", () => {
        // An admin picking Oct 1 – Oct 2 stores UTC midnights.
        const voucher = {
            startDate: new Date("2026-10-01T00:00:00.000Z"),
            endDate: new Date("2026-10-02T00:00:00.000Z"),
        };

        // Sep 30, 23:30 in Manila.
        assert.equal(
            getVoucherDateState(voucher, new Date("2026-09-30T15:30:00Z")),
            "upcoming"
        );
        // Oct 1, 00:30 in Manila (still Sep 30 in UTC).
        assert.equal(
            getVoucherDateState(voucher, new Date("2026-09-30T16:30:00Z")),
            "current"
        );
        // Oct 2, 23:30 in Manila: the whole end day counts.
        assert.equal(
            getVoucherDateState(voucher, new Date("2026-10-02T15:30:00Z")),
            "current"
        );
        // Oct 3, 00:30 in Manila.
        assert.equal(
            getVoucherDateState(voucher, new Date("2026-10-02T16:30:00Z")),
            "expired"
        );
    });

    it("lists the same vouchers a customer can actually redeem", async () => {
        const customer = await insertUser("customer");

        const current = await createVoucher(baseVoucher({ name: "Now" }));

        await createVoucher(
            baseVoucher({
                name: "Ended",
                startDate: new Date(Date.now() - 20 * DAY).toISOString(),
                endDate: new Date(Date.now() - 3 * DAY).toISOString(),
            })
        );

        await createVoucher(
            baseVoucher({
                name: "Later",
                startDate: new Date(Date.now() + 3 * DAY).toISOString(),
                endDate: new Date(Date.now() + 20 * DAY).toISOString(),
            })
        );

        const listed = await getActiveVouchersForUser(customer);

        assert.deepEqual(
            listed.map((voucher) => voucher.name),
            ["Now"]
        );

        const validated = await validateVoucherForUser(
            current.code,
            customer
        );
        assert.equal(validated.name, "Now");
    });
});
