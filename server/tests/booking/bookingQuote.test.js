import assert from "node:assert/strict";
import { it } from "node:test";
import { assertBookingQuoteMatches, BOOKING_PRICE_CHANGED_MESSAGE, assertCheckoutAmountMatches } from "../../utils/bookingQuote.js";

it("accepts the reviewed total and upfront payment", () => {
    assert.doesNotThrow(() => assertBookingQuoteMatches({ totalAmount: 2500, upfrontAmount: 500 }, 2500, 500));
});

it("rejects a driver price increase before a full payment can start", () => {
    assert.throws(() => assertBookingQuoteMatches({ totalAmount: 3000, upfrontAmount: 500 }, 4000, 500),
        (error) => error.statusCode === 409 && error.message === BOOKING_PRICE_CHANGED_MESSAGE);
});

it("requires review for a price decrease too", () => {
    assert.throws(() => assertBookingQuoteMatches({ totalAmount: 4000, upfrontAmount: 500 }, 3000, 500),
        (error) => error.statusCode === 409);
});

it("detects upfront changes even when the full total is unchanged", () => {
    assert.throws(() => assertBookingQuoteMatches({ totalAmount: 2500, upfrontAmount: 500 }, 2500, 700),
        (error) => error.statusCode === 409);
});

it("accepts a fully discounted booking and harmless floating point differences", () => {
    assert.doesNotThrow(() => assertBookingQuoteMatches({ totalAmount: 0, upfrontAmount: 0 }, 0, 0));
    assert.doesNotThrow(() => assertBookingQuoteMatches({ totalAmount: 0.1 + 0.2, upfrontAmount: 0.1 }, 0.3, 0.1));
});

it("rejects missing, nonnumeric, nonfinite, and negative reviewed amounts", () => {
    for (const expected of [undefined, null, {}, { totalAmount: "2500", upfrontAmount: 500 },
        { totalAmount: NaN, upfrontAmount: 500 }, { totalAmount: 2500, upfrontAmount: Infinity },
        { totalAmount: -1, upfrontAmount: 0 }]) {
        assert.throws(() => assertBookingQuoteMatches(expected, 2500, 500),
            (error) => error.statusCode === 400);
    }
});

it("checkout amount checks use cents and reject increases or decreases", () => {
    assert.doesNotThrow(() => assertCheckoutAmountMatches(0.1 + 0.2, 0.3));
    for (const amount of [250, 750]) {
        assert.throws(() => assertCheckoutAmountMatches(500, amount), (error) => error.statusCode === 409);
    }
    for (const amount of [undefined, null, "500", 0, -1, Infinity]) {
        assert.throws(() => assertCheckoutAmountMatches(amount, 500), (error) => error.statusCode === 400);
    }
});
