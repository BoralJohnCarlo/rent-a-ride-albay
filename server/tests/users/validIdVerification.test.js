import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import ValidIdDocument from "../../models/ValidIdDocument.js";

import Settings from "../../models/Settings.js";

import {
    checkValidIdExpirationNotifications,
    unverifyValidId,
    updateUserProfile,
    uploadRenewedValidId,
    verifyValidId,
} from "../../services/userService.js";
import {
    getValidIdHistory,
    recordValidIdUpload,
} from "../../services/validIdHistoryService.js";
import formatUser, {
    isUserEffectivelyVerified,
} from "../../utils/userFormatter.js";

import {
    connectTestDb,
    disconnectTestDb,
} from "../helpers/testDb.js";

const DAY_MS = 24 * 60 * 60 * 1000;

let counter = 0;

const createUser = (overrides = {}) => {
    counter += 1;

    return User.create({
        firstName: "Juan",
        lastName: "Dela Cruz",
        email: `valid-id-${counter}@example.com`,
        password: "Password123!",
        phoneNumber: `0917000${String(counter).padStart(4, "0")}`,
        role: "customer",
        validIdType: "Passport",
        validIdImage: `https://example.com/id-${counter}-front.jpg`,
        validIdBack: `https://example.com/id-${counter}-back.jpg`,
        ...overrides,
    });
};

// "YYYY-MM-DD" of the Manila day `days` from now.
const manilaDateKey = (days) =>
    new Date(Date.now() + days * DAY_MS + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

const adminId = new mongoose.Types.ObjectId();

before(async () => {
    await connectTestDb();
    await ValidIdDocument.init();
});

after(disconnectTestDb);

beforeEach(() =>
    Promise.all([
        User.deleteMany({}),
        ValidIdDocument.deleteMany({}),
        Notification.deleteMany({}),
        Settings.deleteMany({}),
    ])
);

describe("valid ID expiry", () => {
    it("puts a verified user's badge on hold once the ID expires", async () => {
        const user = await createUser({
            isVerified: true,
            validIdExpirationDate: new Date(Date.now() - 1000),
        });

        assert.equal(isUserEffectivelyVerified(user), false);

        const formatted = formatUser(user);
        assert.equal(formatted.isVerified, false);
        assert.equal(formatted.verifiedByAdmin, true);
        assert.equal(formatted.validIdExpired, true);
    });

    it("keeps verification for an unexpired ID or one with no expiry", async () => {
        const future = await createUser({
            isVerified: true,
            validIdExpirationDate: new Date(Date.now() + DAY_MS),
        });
        const noExpiry = await createUser({ isVerified: true });

        assert.equal(isUserEffectivelyVerified(future), true);
        assert.equal(isUserEffectivelyVerified(noExpiry), true);
    });
});

describe("verifyValidId", () => {
    it("refuses an ID whose recorded expiry has passed", async () => {
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() - DAY_MS),
        });

        await assert.rejects(
            verifyValidId(user._id, { adminId }),
            (error) => error.statusCode === 400 && /expired/.test(error.message)
        );

        assert.equal((await User.findById(user._id)).isVerified, false);
    });

    it("refuses an expiry date the admin enters in the past", async () => {
        const user = await createUser();

        await assert.rejects(
            verifyValidId(user._id, {
                adminId,
                expirationDate: manilaDateKey(-2),
            }),
            (error) => error.statusCode === 400
        );
    });

    it("records the printed expiry as the end of that Manila day", async () => {
        const user = await createUser();
        const key = manilaDateKey(30);

        const result = await verifyValidId(user._id, {
            adminId,
            expirationDate: key,
        });

        assert.equal(result.isVerified, true);

        const saved = await User.findById(user._id);
        assert.equal(
            saved.validIdExpirationDate.toISOString(),
            new Date(`${key}T23:59:59.999+08:00`).toISOString()
        );
    });

    it("can clear the date for an ID that never expires", async () => {
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() - DAY_MS),
        });

        await verifyValidId(user._id, { adminId, expirationDate: null });

        const saved = await User.findById(user._id);
        assert.equal(saved.validIdExpirationDate, null);
        assert.equal(saved.isVerified, true);
    });

    it("stamps the admin and date on the current history record", async () => {
        const user = await createUser();
        await recordValidIdUpload(user, { source: "registration" });

        await verifyValidId(user._id, {
            adminId,
            expirationDate: manilaDateKey(90),
        });

        const current = await ValidIdDocument.findOne({
            user: user._id,
            isCurrent: true,
        });

        assert.equal(String(current.verifiedBy), String(adminId));
        assert.ok(current.verifiedAt);
        assert.ok(current.expirationDate > new Date());
    });
});

describe("renewed valid ID", () => {
    it("goes back to admin review and keeps the old ID in history", async () => {
        const admin = await createUser({ role: "admin" });
        const user = await createUser({
            isVerified: true,
            validIdExpirationDate: new Date(Date.now() - DAY_MS),
        });
        const oldFront = user.validIdImage;

        const result = await uploadRenewedValidId(user._id, {
            url: "https://example.com/renewed.jpg",
        });

        assert.equal(result.isVerified, false);
        assert.equal(result.verifiedByAdmin, false);

        const history = await getValidIdHistory(user._id);
        assert.equal(history.length, 2);
        assert.equal(history[0].isCurrent, true);
        assert.equal(history[0].source, "renewal");
        assert.equal(history[0].frontImage, "https://example.com/renewed.jpg");
        assert.equal(history[1].isCurrent, false);
        assert.equal(history[1].source, "on_file");
        assert.equal(history[1].frontImage, oldFront);
        assert.ok(history[1].replacedAt);

        assert.ok(
            await Notification.exists({
                recipient: admin._id,
                "metadata.reference": "valid-id-renewal",
            }),
            "admins are told a renewed ID needs review"
        );
    });
});

describe("profile ID change", () => {
    it("records the new ID, closes the old one and clears the old expiry", async () => {
        const user = await createUser({
            isVerified: true,
            validIdExpirationDate: new Date(Date.now() + 100 * DAY_MS),
        });
        await recordValidIdUpload(user, { source: "registration" });

        await updateUserProfile(user._id, {
            validIdType: "UMID",
            validIdImage: "https://example.com/umid-front.jpg",
            validIdBack: "https://example.com/umid-back.jpg",
        });

        const saved = await User.findById(user._id);
        assert.equal(saved.isVerified, false);
        assert.equal(saved.validIdExpirationDate, null);

        const records = await ValidIdDocument.find({ user: user._id }).sort({
            createdAt: 1,
        });
        assert.equal(records.length, 2);
        assert.equal(records[0].source, "registration");
        assert.equal(records[0].isCurrent, false);
        assert.equal(records[1].source, "profile_update");
        assert.equal(records[1].validIdType, "UMID");
        assert.equal(records[1].isCurrent, true);
    });

    it("does not touch history when the ID is unchanged", async () => {
        const user = await createUser();
        await recordValidIdUpload(user, { source: "registration" });

        await updateUserProfile(user._id, {
            validIdType: user.validIdType,
            alternativeContact: "09170000000",
        });

        assert.equal(
            await ValidIdDocument.countDocuments({ user: user._id }),
            1
        );
    });
});

describe("getValidIdHistory", () => {
    it("lists the ID of an account from before history was kept", async () => {
        const user = await createUser();

        const history = await getValidIdHistory(user._id);

        assert.equal(history.length, 1);
        assert.equal(history[0].isCurrent, true);
        assert.equal(history[0].source, "on_file");
        assert.equal(history[0].frontImage, user.validIdImage);
        // A read never writes.
        assert.equal(
            await ValidIdDocument.countDocuments({ user: user._id }),
            0
        );
    });

    it("allows only one current record per user", async () => {
        const user = await createUser();
        await recordValidIdUpload(user, { source: "registration" });

        await assert.rejects(
            ValidIdDocument.create({
                user: user._id,
                source: "registration",
                isCurrent: true,
            }),
            (error) => error.code === 11000
        );
    });

    it("unverifying leaves the history as it was", async () => {
        const user = await createUser({ isVerified: true });
        await recordValidIdUpload(user, { source: "registration" });

        await unverifyValidId(user._id);

        const history = await getValidIdHistory(user._id);
        assert.equal(history.length, 1);
        assert.equal(history[0].isCurrent, true);
    });
});

describe("expiry notifications", () => {
    const countOf = (user, type) =>
        Notification.countDocuments({ recipient: user._id, type });

    // Pretends every notice so far was sent `days` ago - i.e. the daily
    // sweep is running again on a later day.
    const ageNotifications = (user, days) =>
        Notification.collection.updateMany(
            { recipient: user._id },
            { $set: { createdAt: new Date(Date.now() - days * DAY_MS) } }
        );

    const enableReminders = () =>
        Settings.create({
            validIdExpirationSettings: {
                enabled: true,
                firstReminderDays: 30,
                secondReminderDays: 7,
                thirdReminderDays: 1,
                notifyOnExpired: true,
            },
        });

    it("sends the expired notice once, not every day", async () => {
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() - 10 * DAY_MS),
        });

        await checkValidIdExpirationNotifications(user._id);
        await ageNotifications(user, 3);
        await checkValidIdExpirationNotifications(user._id);

        assert.equal(await countOf(user, "validIdExpired"), 1);
    });

    it("sends a new expired notice when a later expiry date passes", async () => {
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() - 400 * DAY_MS),
        });

        await checkValidIdExpirationNotifications(user._id);
        await ageNotifications(user, 399);

        // Renewed, and that ID has now expired too.
        await User.updateOne(
            { _id: user._id },
            { validIdExpirationDate: new Date(Date.now() - DAY_MS) }
        );
        await checkValidIdExpirationNotifications(user._id);

        assert.equal(await countOf(user, "validIdExpired"), 2);
    });

    it("sends each reminder threshold once", async () => {
        await enableReminders();
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() + 20 * DAY_MS),
        });

        // Inside the 30-day window: one reminder, however often it runs.
        await checkValidIdExpirationNotifications(user._id);
        await ageNotifications(user, 5);
        await checkValidIdExpirationNotifications(user._id);
        assert.equal(await countOf(user, "validIdExpiringSoon"), 1);

        // Days later, inside the 7-day window: a second, separate reminder.
        await User.updateOne(
            { _id: user._id },
            { validIdExpirationDate: new Date(Date.now() + 5 * DAY_MS) }
        );
        await checkValidIdExpirationNotifications(user._id);
        await checkValidIdExpirationNotifications(user._id);
        assert.equal(await countOf(user, "validIdExpiringSoon"), 2);
    });

    it("sends no reminders while reminders are turned off", async () => {
        const user = await createUser({
            validIdExpirationDate: new Date(Date.now() + 5 * DAY_MS),
        });

        await checkValidIdExpirationNotifications(user._id);

        assert.equal(await countOf(user, "validIdExpiringSoon"), 0);
    });
});
