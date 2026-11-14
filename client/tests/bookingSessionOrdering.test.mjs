import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const sliceUrl = new URL("../src/store/bookings/bookingSlice.js", import.meta.url).href;
const services = ["fetchBookings", "fetchBookingById", "createNewBooking", "updateExistingBooking", "approveExistingBooking",
    "rejectExistingBooking", "cancelExistingBooking", "expireExistingBooking", "markExistingBookingNoShow",
    "requestExistingBookingExtension", "approveExistingBookingExtension", "rejectExistingBookingExtension", "cancelExistingBookingExtension"];
const stubUrl = "data:text/javascript," + encodeURIComponent(services.map(name => `export const ${name}=async()=>{throw Error("Unexpected HTTP request")};`).join("\n"));
const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === sliceUrl && specifier === "../../services/bookingService") return { url: stubUrl, shortCircuit: true };
    return next(specifier, context);
} });
const { default: reducer } = await import(sliceUrl);
hooks.deregister();
const pending = (type, requestId, arg) => ({ type: `booking/${type}/pending`, meta: { requestId, arg } });
const fulfilled = (type, requestId, data) => ({ type: `booking/${type}/fulfilled`, meta: { requestId }, payload: { data } });
const rejected = (type, requestId, payload = "Request failed") => ({ type: `booking/${type}/rejected`, meta: { requestId }, payload });
const seed = () => {
    let state = reducer(undefined, { type: "auth/login/fulfilled", payload: { data: { _id: "customer-a" } } });
    state = reducer(state, pending("getBookings", "list"));
    state = reducer(state, fulfilled("getBookings", "list", [{ _id: "a" }]));
    state = reducer(state, pending("getBookingById", "detail", "a"));
    return reducer(state, fulfilled("getBookingById", "detail", { _id: "a" }));
};

for (const type of ["auth/logout/fulfilled", "auth/sessionEnded", "auth/getCurrentUser/rejected", "auth/login/rejected"]) {
    test(`${type} clears private booking data, filters and pending requests`, () => {
        let state = reducer(seed(), { type: "booking/setBookingFilters", payload: { customer: "private" } });
        state = reducer(state, pending("getBookings", "late"));
        state = reducer(state, { type });
        assert.deepEqual(state.bookings, []);
        assert.equal(state.selectedBooking, null);
        assert.equal(state.filters.customer, "");
        assert.equal(state.loading, false);
        assert.deepEqual(reducer(state, fulfilled("getBookings", "late", [{ _id: "private" }])), state);
    });
}

const operations = ["getBookings", "getBookingById", "createBooking", "updateBooking", "approveBooking", "rejectBooking", "cancelBooking",
    "expireBooking", "markBookingNoShow", "requestBookingExtension", "approveBookingExtension", "rejectBookingExtension", "cancelBookingExtension"];
for (const operation of operations) {
    test(`late ${operation} success or failure cannot alter a new session`, () => {
        let state = reducer(seed(), pending(operation, "old", "a"));
        state = reducer(state, { type: "auth/login/fulfilled", payload: { data: { _id: "customer-b" } } });
        assert.deepEqual(reducer(state, fulfilled(operation, "old", { _id: "private" })), state);
        assert.deepEqual(reducer(state, rejected(operation, "old")), state);
    });
}

test("refreshing the same account preserves data, while changing accounts clears it", () => {
    const state = seed();
    assert.deepEqual(reducer(state, { type: "auth/getCurrentUser/fulfilled", payload: { data: { _id: "customer-a" } } }), state);
    assert.equal(reducer(state, { type: "auth/getCurrentUser/fulfilled", payload: { data: { _id: "customer-b" } } }).selectedBooking, null);
    assert.deepEqual(reducer(state, { type: "auth/logout/rejected" }), state);
});

for (const operation of ["getBookings", "getBookingById"]) {
    test(`${operation} ignores out-of-order success and failure after the latest read`, () => {
        let state = reducer(seed(), pending(operation, "old", "a"));
        state = reducer(state, pending(operation, "new", "b"));
        const data = operation === "getBookings" ? [{ _id: "b" }] : { _id: "b" };
        state = reducer(state, fulfilled(operation, "new", data));
        assert.deepEqual(reducer(state, fulfilled(operation, "old", data)), state);
        assert.deepEqual(reducer(state, rejected(operation, "old")), state);
        assert.equal(state.loading, false);
    });
    test(`${operation} cannot fall back to an older success after the newest read fails`, () => {
        let state = reducer(seed(), pending(operation, "old", "a"));
        state = reducer(state, pending(operation, "new", "b"));
        state = reducer(state, rejected(operation, "new"));
        assert.deepEqual(reducer(state, fulfilled(operation, "old", { _id: "old" })), state);
    });
}

test("selecting or closing a booking immediately clears the previous selection and invalidates late reads", () => {
    let state = reducer(seed(), pending("getBookingById", "next", "b"));
    assert.equal(state.selectedBooking, null);
    state = reducer(state, { type: "booking/clearSelectedBooking" });
    assert.deepEqual(reducer(state, fulfilled("getBookingById", "next", { _id: "b" })), state);
});

test("parallel list and detail reads keep loading until both settle", () => {
    let state = reducer(seed(), pending("getBookings", "list2"));
    state = reducer(state, pending("getBookingById", "detail2", "b"));
    state = reducer(state, fulfilled("getBookings", "list2", []));
    assert.equal(state.loading, true);
    state = reducer(state, fulfilled("getBookingById", "detail2", { _id: "b" }));
    assert.equal(state.loading, false);
});

test("a successful mutation updates the list without replacing another selected booking", () => {
    let state = reducer(seed(), pending("cancelBooking", "cancel", { bookingId: "a" }));
    state = reducer(state, pending("getBookingById", "b", "b"));
    state = reducer(state, fulfilled("getBookingById", "b", { _id: "b" }));
    state = reducer(state, fulfilled("cancelBooking", "cancel", { _id: "a", status: "Cancelled" }));
    assert.equal(state.selectedBooking._id, "b");
    assert.equal(state.bookings[0].status, "Cancelled");
});

test("mutation success invalidates older reads; a failed mutation preserves them", () => {
    let state = reducer(seed(), pending("getBookings", "stale"));
    state = reducer(state, pending("cancelBooking", "cancel", { bookingId: "a" }));
    state = reducer(state, fulfilled("cancelBooking", "cancel", { _id: "a", status: "Cancelled" }));
    assert.equal(state.selectedBooking.status, "Cancelled");
    assert.deepEqual(reducer(state, fulfilled("getBookings", "stale", [{ _id: "a" }])), state);
    state = reducer(state, pending("getBookings", "fresh"));
    state = reducer(state, pending("cancelBooking", "failed", { bookingId: "a" }));
    state = reducer(state, rejected("cancelBooking", "failed"));
    assert.equal(state.loading, true);
    state = reducer(state, fulfilled("getBookings", "fresh", [{ _id: "fresh" }]));
    assert.equal(state.bookings[0]._id, "fresh");
});

test("changing filters invalidates the old list and its pending response", () => {
    let state = reducer(seed(), pending("getBookings", "stale"));
    state = reducer(state, { type: "booking/setBookingFilters", payload: { status: "Approved" } });
    assert.deepEqual(state.bookings, []);
    assert.deepEqual(reducer(state, fulfilled("getBookings", "stale", [{ _id: "a" }])), state);
});

test("creation selects the new booking and blocked-pickup failures retain their message", () => {
    let state = reducer(seed(), pending("createBooking", "create"));
    state = reducer(state, fulfilled("createBooking", "create", { _id: "new" }));
    assert.equal(state.selectedBooking._id, "new");
    state = reducer(state, pending("markBookingNoShow", "no-show", { bookingId: "new" }));
    state = reducer(state, rejected("markBookingNoShow", "no-show", { message: "Pickup blocked", pickupBlocker: "Maintenance" }));
    assert.equal(state.error, "Pickup blocked");
});
