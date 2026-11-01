import assert from "node:assert/strict";
import { it } from "node:test";
import { getPeakConcurrentBookings } from "../../utils/bookingConcurrency.js";

const day = (value) => `2030-01-${String(value).padStart(2, "0")}T08:00:00+08:00`;
const booking = (start, end) => ({ startDate: day(start), endDate: day(end) });
const peak = (bookings, start = 1, end = 10) => getPeakConcurrentBookings(bookings, day(start), day(end));

it("permits a limit-two booking spanning two nonoverlapping existing rentals", () => {
    const existingPeak = peak([booking(1, 2), booking(3, 4)], 1, 4);
    assert.equal(existingPeak, 1);
    assert.ok(existingPeak + 1 <= 2);
});

it("detects a genuine limit breach when existing rentals run simultaneously", () => {
    const existingPeak = peak([booking(1, 4), booking(2, 5)], 1, 5);
    assert.equal(existingPeak, 2);
    assert.ok(existingPeak + 1 > 2);
});

it("treats a return and pickup at the same instant as back-to-back", () => {
    assert.equal(peak([booking(1, 3), booking(3, 5), booking(5, 7)]), 1);
});

it("counts bookings that began before the requested range", () => {
    assert.equal(peak([booking(1, 9), booking(2, 8)], 4, 6), 2);
});

it("ignores concurrency outside the requested interval", () => {
    assert.equal(peak([booking(1, 4), booking(1, 3), booking(6, 10)], 4, 6), 0);
});

it("counts identical and nested intervals independently", () => {
    assert.equal(peak([booking(1, 8), booking(1, 8), booking(3, 5)]), 3);
});

it("works with unsorted intervals and an empty schedule", () => {
    assert.equal(peak([booking(6, 9), booking(1, 3), booking(2, 5)]), 2);
    assert.equal(peak([]), 0);
});

it("compares actual instants including timezone offsets", () => {
    assert.equal(getPeakConcurrentBookings([
        { startDate: "2030-01-01T08:00:00+08:00", endDate: "2030-01-02T08:00:00+08:00" },
        { startDate: "2030-01-02T00:00:00Z", endDate: "2030-01-03T00:00:00Z" },
    ], day(1), day(4)), 1);
});

it("rejects invalid or nonpositive requested intervals", () => {
    assert.throws(() => getPeakConcurrentBookings([], "invalid", day(2)), RangeError);
    assert.throws(() => peak([], 2, 2), RangeError);
    assert.throws(() => peak([], 3, 2), RangeError);
});
