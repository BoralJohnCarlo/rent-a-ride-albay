import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveNotificationPath } from "../src/components/notification/notificationMeta.js";

test("admin boundary notifications open penalty review instead of the generic bookings list", () => {
    assert.equal(resolveNotificationPath({ type: "Boundary Alert", category: "Rental" }, "admin"), "/admin/settings/penalties");
});

test("customer boundary warnings open the affected booking without changing partner navigation", () => {
    const notification = { type: "Boundary Alert", category: "Rental", metadata: { relatedModel: "Booking", relatedId: "a".repeat(24) } };
    assert.equal(resolveNotificationPath(notification, "customer"), `/customer/bookings/${"a".repeat(24)}`);
    assert.equal(resolveNotificationPath(notification, "operator"), "/operator/bookings");
    assert.equal(resolveNotificationPath(notification, "unknown"), null);
});
