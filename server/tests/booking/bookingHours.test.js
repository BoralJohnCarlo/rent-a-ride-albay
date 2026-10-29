import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import Settings from "../../models/Settings.js";

import { updateSettings } from "../../controllers/settingsController.js";
import {
    getBookingLocationPolicy,
    getEarliestBookingPickupMs,
} from "../../services/settingsService.js";
import {
    getBookingHoursError,
    getEarliestPickupMs,
    getPickupHoursError,
    getPickupSlotMinutes,
} from "../../utils/bookingHours.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const HOURS_8_TO_8 = {
    enabled: true,
    openTime: "08:00",
    closeTime: "20:00",
};

/* A Manila wall-clock moment as epoch ms. */
const manila = (dateTime) => Date.parse(`${dateTime}:00+08:00`);

const earliest = (now, hours = HOURS_8_TO_8) =>
    new Date(getEarliestPickupMs(manila(now), hours)).getTime();

describe("getEarliestPickupMs", () => {
    it("is plain now + 2 hours when booking hours are off", () => {
        assert.equal(
            earliest("2026-10-05T23:00", { ...HOURS_8_TO_8, enabled: false }),
            manila("2026-10-06T01:00")
        );
    });

    it("is now + 2 hours during booking hours", () => {
        assert.equal(earliest("2026-10-05T15:00"), manila("2026-10-05T17:00"));
    });

    it("starts counting at opening for a booking made overnight", () => {
        assert.equal(earliest("2026-10-05T23:00"), manila("2026-10-06T10:00"));
        assert.equal(earliest("2026-10-06T06:00"), manila("2026-10-06T10:00"));
        assert.equal(earliest("2026-10-05T20:00"), manila("2026-10-06T10:00"));
    });

    it("carries notice left at closing over to the next morning", () => {
        // 30 minutes tonight + 90 minutes tomorrow.
        assert.equal(earliest("2026-10-05T19:30"), manila("2026-10-06T09:30"));
    });

    it("spans several days when the open window is shorter than the notice", () => {
        const oneHourWindow = {
            enabled: true,
            openTime: "09:00",
            closeTime: "10:00",
        };

        assert.equal(
            earliest("2026-10-05T09:30", oneHourWindow),
            // 30 min today, 60 tomorrow, 30 the day after.
            manila("2026-10-07T09:30")
        );
    });
});

describe("getBookingHoursError", () => {
    it("accepts a same-day window on the half hour", () => {
        assert.equal(getBookingHoursError(HOURS_8_TO_8), null);
    });

    it("rejects a window that closes before it opens, or off the half hour", () => {
        assert.ok(
            getBookingHoursError({ ...HOURS_8_TO_8, closeTime: "07:00" })
        );
        assert.ok(
            getBookingHoursError({ ...HOURS_8_TO_8, openTime: "08:15" })
        );
        assert.ok(
            getBookingHoursError({ ...HOURS_8_TO_8, openTime: "8am" })
        );
        assert.ok(
            getBookingHoursError({ ...HOURS_8_TO_8, enabled: "yes" })
        );
    });
});

describe("pickup hours", () => {
    it("defaults to 8:00 AM – 6:00 PM every 30 minutes", () => {
        const minutes = getPickupSlotMinutes(null);

        assert.equal(minutes.length, 21);
        assert.equal(minutes[0], 8 * 60);
        assert.equal(minutes.at(-1), 18 * 60);
    });

    it("uses a configured window, and falls back to the default when it's invalid", () => {
        const minutes = getPickupSlotMinutes({
            earliestTime: "09:30",
            latestTime: "16:00",
        });

        assert.equal(minutes[0], 9 * 60 + 30);
        assert.equal(minutes.at(-1), 16 * 60);
        assert.equal(minutes.length, 14);

        assert.equal(
            getPickupSlotMinutes({ earliestTime: "17:00", latestTime: "09:00" })
                .length,
            21
        );
    });

    it("validates the window", () => {
        assert.equal(
            getPickupHoursError({ earliestTime: "07:00", latestTime: "19:00" }),
            null
        );
        assert.ok(
            getPickupHoursError({ earliestTime: "10:00", latestTime: "09:00" })
        );
        assert.ok(
            getPickupHoursError({ earliestTime: "08:15", latestTime: "18:00" })
        );
        assert.ok(getPickupHoursError({ earliestTime: "", latestTime: "18:00" }));
    });
});

/* Calls the settings controller and returns { status, body }. */
const saveSettings = async (body) => {
    const result = {};

    const res = {
        status(code) {
            result.status = code;
            return this;
        },
        json(payload) {
            result.body = payload;
            return this;
        },
    };

    await updateSettings({ body }, res);

    return result;
};

describe("saving Settings → Bookings", () => {
    before(connectTestDb);
    after(disconnectTestDb);

    beforeEach(() => Settings.deleteMany({}));

    it("defaults to booking hours off, so the earliest pickup is unchanged", async () => {
        const policy = await getBookingLocationPolicy();

        assert.equal(policy.bookingSettings.bookingHours.enabled, false);

        const now = Date.now();
        assert.equal(
            await getEarliestBookingPickupMs(now),
            now + 2 * 60 * 60 * 1000
        );
    });

    it("keeps the booking hours when only the buffer is saved, and vice versa", async () => {
        await saveSettings({
            bookingSettings: { bookingHours: HOURS_8_TO_8 },
        });

        await saveSettings({
            bookingSettings: { turnaroundBufferMinutes: 180 },
        });

        let { bookingSettings } = await getBookingLocationPolicy();

        assert.equal(bookingSettings.turnaroundBufferMinutes, 180);
        assert.deepEqual(bookingSettings.bookingHours, HOURS_8_TO_8);

        await saveSettings({
            bookingSettings: { bookingHours: { closeTime: "21:00" } },
        });

        ({ bookingSettings } = await getBookingLocationPolicy());

        assert.equal(bookingSettings.turnaroundBufferMinutes, 180);
        assert.deepEqual(bookingSettings.bookingHours, {
            ...HOURS_8_TO_8,
            closeTime: "21:00",
        });
    });

    it("saves pickup hours without touching the other booking settings", async () => {
        await saveSettings({
            bookingSettings: {
                turnaroundBufferMinutes: 180,
                bookingHours: HOURS_8_TO_8,
            },
        });

        const { status } = await saveSettings({
            bookingSettings: {
                pickupHours: { earliestTime: "09:00", latestTime: "17:00" },
            },
        });

        assert.equal(status, 200);

        const { bookingSettings } = await getBookingLocationPolicy();

        assert.deepEqual(bookingSettings.pickupHours, {
            earliestTime: "09:00",
            latestTime: "17:00",
        });
        assert.equal(bookingSettings.turnaroundBufferMinutes, 180);
        assert.deepEqual(bookingSettings.bookingHours, HOURS_8_TO_8);

        const refused = await saveSettings({
            bookingSettings: {
                pickupHours: { earliestTime: "17:00", latestTime: "09:00" },
            },
        });

        assert.equal(refused.status, 400);
    });

    it("refuses invalid booking hours without changing anything", async () => {
        const { status } = await saveSettings({
            bookingSettings: {
                bookingHours: { ...HOURS_8_TO_8, closeTime: "06:00" },
            },
        });

        assert.equal(status, 400);

        const { bookingSettings } = await getBookingLocationPolicy();
        assert.equal(bookingSettings.bookingHours.enabled, false);
    });
});
