import { it } from "node:test";
import assert from "node:assert/strict";
import { getRefundTotals } from "../src/utils/refundStatus.js";

it("shows approved refunds awaiting payment as processing, counting their payment once", () => {
    const booking = { paymentId: "payment-1", paymentRefund: { amount: 500, status: "pending" }, refundAmount: 500 };
    for (const gatewayStatus of ["pending", "processing", "requires_manual_action"]) {
        const rental = { refunds: [{ amount: 500, status: "Approved", gatewayStatus, gatewayPayment: "payment-1" }] };
        assert.deepEqual(getRefundTotals(booking, rental), { refunded: 0, pending: 0, processing: 500, failed: 0 });
    }
});

it("totals earlier booking refunds, successful rental refunds, and paid owed refunds", () => {
    assert.deepEqual(getRefundTotals({
        paymentId: "earlier", paymentRefund: { amount: 1000, status: "succeeded" },
        extensionRefunds: [{ amount: 200, status: "succeeded" }],
        owedRefunds: [{ amount: 100, status: "Paid" }, { amount: 50, status: "Owed" }],
    }, { refunds: [{ amount: 500, status: "Approved", gatewayStatus: "succeeded" }] }),
    { refunded: 1800, pending: 0, processing: 50, failed: 0 });
});

it("does not double count successful linked payment refunds", () => {
    assert.equal(getRefundTotals({ paymentId: "linked", paymentRefund: { amount: 500, status: "succeeded" } }, {
        refunds: [{ amount: 500, status: "Approved", gatewayStatus: "succeeded", gatewayPayment: { _id: "linked" } }],
    }).refunded, 500);
});

it("separates pending, rejected and failed rental refunds", () => {
    assert.deepEqual(getRefundTotals({}, { refunds: [
        { amount: 100, status: "Pending" }, { amount: 200, status: "Rejected" },
        { amount: 300, status: "Approved", gatewayStatus: "failed" },
    ] }), { refunded: 0, pending: 100, processing: 0, failed: 300 });
});

it("preserves legacy manually recorded refunds and aggregate-only bookings", () => {
    assert.equal(getRefundTotals({ refundAmount: 100 }).refunded, 100);
    assert.equal(getRefundTotals({}, { refunds: [{ amount: 150 },
        { amount: 50, status: "Approved", gatewayStatus: "not_applicable" }] }).refunded, 200);
});

it("a pending request does not hide an earlier successful booking refund", () => {
    assert.deepEqual(getRefundTotals({ paymentRefund: { amount: 1000, status: "succeeded" } }, {
        refunds: [{ amount: 500, status: "Pending" }],
    }), { refunded: 1000, pending: 500, processing: 0, failed: 0 });
});

it("deduplicates extension refunds by payment ID or gateway refund ID", () => {
    for (const link of [{ gatewayPayment: "ext-1" }, { gatewayRefundId: "ref-1" }]) {
        assert.equal(getRefundTotals({ extensionRefunds: [{ paymentId: "ext-1", refundId: "ref-1", amount: 100, status: "processing" }] }, {
            refunds: [{ amount: 100, status: "Approved", gatewayStatus: "processing", ...link }],
        }).processing, 100);
    }
});
