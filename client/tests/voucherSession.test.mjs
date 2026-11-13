import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const sliceUrl = new URL("../src/store/promotions/promoSlice.js", import.meta.url).href;
const services = ["fetchVouchers", "fetchVoucherById", "createNewVoucher", "updateExistingVoucher",
    "deleteExistingVoucher", "fetchAvailableVouchers", "applyExistingVoucher"];
const stubUrl = "data:text/javascript," + encodeURIComponent(services.map(name =>
    `export const ${name} = async () => { throw new Error("Unexpected network request"); };`).join("\n"));
const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === sliceUrl && specifier === "../../services/voucherService") {
        return { url: stubUrl, shortCircuit: true };
    }
    return next(specifier, context);
} });
const { default: reducer, clearAppliedVoucher } = await import(sliceUrl);
hooks.deregister();

const action = (name, stage, id, data) => ({
    type: `voucher/${name}/${stage}`, meta: { requestId: id }, payload: { data },
});
const login = id => ({ type: "auth/login/fulfilled", payload: { data: { _id: id } } });
const list = (state, id, values, name = "getAvailableVouchers") => {
    state = reducer(state, action(name, "pending", id));
    return reducer(state, action(name, "fulfilled", id, values));
};

for (const boundary of ["auth/logout/fulfilled", "auth/sessionEnded", "auth/getCurrentUser/rejected"]) {
    test(`clears voucher caches and applied savings on ${boundary}`, () => {
        let state = list(reducer(undefined, login("first")), "list", [{ code: "PRIVATE" }]);
        state = reducer(state, action("applyVoucher", "pending", "apply"));
        state = reducer(state, action("applyVoucher", "fulfilled", "apply", { voucher: { code: "PRIVATE" } }));
        state = reducer(state, { type: boundary });
        assert.deepEqual(state.availableVouchers, []);
        assert.deepEqual(state.vouchers, []);
        assert.equal(state.appliedVoucher, null);
        assert.equal(state.loading, false);
    });
}

for (const name of ["getVouchers", "getVoucherById", "getAvailableVouchers", "applyVoucher",
    "createVoucher", "updateVoucher", "deleteVoucher"]) {
    test(`ignores late ${name} responses after the session ends`, () => {
        let state = reducer(reducer(undefined, login("first")), action(name, "pending", "old"));
        state = reducer(state, { type: "auth/sessionEnded" });
        const cleared = state;
        assert.deepEqual(reducer(state, action(name, "fulfilled", "old", [{ _id: "old", code: "PRIVATE" }])), cleared);
        assert.deepEqual(reducer(state, action(name, "rejected", "old")), cleared);
    });
}

for (const name of ["getVouchers", "getAvailableVouchers"]) {
    test(`${name} retains the newest response when reads finish out of order`, () => {
        let state = reducer(undefined, action(name, "pending", "old"));
        state = reducer(state, action(name, "pending", "new"));
        state = reducer(state, action(name, "fulfilled", "new", [{ code: "LATEST" }]));
        const latest = state;
        assert.deepEqual(reducer(state, action(name, "fulfilled", "old", [{ code: "OLD" }])), latest);
        assert.deepEqual(reducer(state, action(name, "rejected", "old")), latest);
    });
}

test("does not keep expired availability cached after the latest refresh fails", () => {
    let state = list(undefined, "initial", [{ code: "EXPIRED" }]);
    state = reducer(state, action("getAvailableVouchers", "pending", "refresh"));
    state = reducer(state, action("getAvailableVouchers", "rejected", "refresh"));
    assert.deepEqual(state.availableVouchers, []);
});

test("switching users clears vouchers, while refreshing the same user preserves them", () => {
    let state = list(reducer(undefined, login("first")), "initial", [{ code: "PRIVATE" }]);
    state = reducer(state, { type: "auth/getCurrentUser/fulfilled", payload: { data: { _id: "first" } } });
    assert.equal(state.availableVouchers[0].code, "PRIVATE");
    state = reducer(state, { type: "auth/getCurrentUser/fulfilled", payload: { data: { _id: "second" } } });
    assert.deepEqual(state.availableVouchers, []);
});

test("a list started before an admin creates a voucher cannot erase that creation", () => {
    let state = reducer(undefined, action("getVouchers", "pending", "list"));
    state = reducer(state, action("createVoucher", "pending", "create"));
    state = reducer(state, action("createVoucher", "fulfilled", "create", { _id: "created", code: "NEW" }));
    state = reducer(state, action("getVouchers", "fulfilled", "list", []));
    assert.equal(state.vouchers[0].code, "NEW");
});

test("applying a voucher stays loading when an unrelated availability read finishes", () => {
    let state = reducer(undefined, action("getAvailableVouchers", "pending", "list"));
    state = reducer(state, action("applyVoucher", "pending", "apply"));
    state = reducer(state, action("getAvailableVouchers", "fulfilled", "list", []));
    assert.equal(state.loading, true);
    state = reducer(state, clearAppliedVoucher());
    assert.equal(state.loading, false);
    const cleared = state;
    assert.deepEqual(reducer(state, action("applyVoucher", "fulfilled", "apply", { voucher: { code: "LATE" } })), cleared);
});
