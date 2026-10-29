import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import LegalDocument from "../../models/LegalDocument.js";
import Notification from "../../models/Notification.js";
import Payment from "../../models/Payment.js";
import Settings from "../../models/Settings.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";
// Registered for populateBooking's vehicle.category populate.
import "../../models/VehicleCategory.js";

import { BOOKING_DRIVER_OPTIONS } from "../../constants/bookingConstants.js";
import {
    LEGAL_ACCEPTANCE_GRACE_MINUTES,
    LEGAL_DOCUMENT_STATUS,
    LEGAL_DOCUMENT_TYPES,
    TERMS_OUTDATED_MESSAGE,
} from "../../constants/legalDocumentConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

import { createBooking } from "../../services/bookingService.js";
import {
    discardLegalDocumentDraft,
    getCurrentLegalDocument,
    getLegalDocumentAdminView,
    getPublishedLegalDocumentById,
    publishLegalDocument,
    resolveAcceptedLegalVersion,
    sanitizeLegalContent,
    saveLegalDocumentDraft,
} from "../../services/legalDocumentService.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const { BOOKING_TERMS, PARTNER_TERMS, TERMS_OF_SERVICE } = LEGAL_DOCUMENT_TYPES;

const newId = () => new mongoose.Types.ObjectId();

const content = (overrides = {}) => ({
    title: "Terms & Conditions",
    intro: "",
    highlights: [],
    notice: { title: "", body: "" },
    acceptanceLabel: "I agree.",
    sections: [
        {
            title: "Payment",
            icon: "wallet",
            items: [
                { kind: "text", text: "Pay on time." },
                { kind: "live", liveKey: "payment" },
            ],
        },
    ],
    ...overrides,
});

/* Back-dates a version's publish time, as if it went live `ms` ago. */
const publishedAgo = (id, ms) =>
    LegalDocument.updateOne(
        { _id: id },
        { $set: { publishedAt: new Date(Date.now() - ms) } }
    );

let adminId;
let customerId;

before(async () => {
    await connectTestDb();
    await Promise.all(
        [Booking, LegalDocument, Notification, Payment].map((model) =>
            model.init()
        )
    );
});

after(disconnectTestDb);

beforeEach(async () => {
    await Promise.all(
        [
            Booking,
            LegalDocument,
            Notification,
            Payment,
            Settings,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );

    adminId = newId();
    customerId = newId();

    await User.collection.insertMany([
        { _id: adminId, role: "admin", email: `admin-${adminId}@test.local` },
        {
            _id: customerId,
            role: "customer",
            firstName: "Maria",
            lastName: "Santos",
            email: `customer-${customerId}@test.local`,
            isVerified: true,
        },
    ]);
});

describe("versions", () => {
    it("publishes the built-in wording as version 1 on first read", async () => {
        const [first, again] = await Promise.all([
            getCurrentLegalDocument(BOOKING_TERMS),
            getCurrentLegalDocument(BOOKING_TERMS),
        ]);

        assert.equal(first.version, 1);
        assert.equal(String(first._id), String(again._id));
        assert.equal(
            await LegalDocument.countDocuments({ type: BOOKING_TERMS }),
            1
        );
        assert.ok(
            first.sections.some((section) =>
                section.items.some(
                    (item) =>
                        item.kind === "live" &&
                        item.liveKey === "cancellationPolicy"
                )
            )
        );

        const partner = await getCurrentLegalDocument(PARTNER_TERMS);
        assert.equal(partner.version, 1);
        assert.ok(partner.acceptanceLabel);
    });

    it("publishes the next version, clears the draft and leaves old versions untouched", async () => {
        const v1 = await getCurrentLegalDocument(BOOKING_TERMS);

        await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "Draft title" }),
            adminId
        );

        const v2 = await publishLegalDocument(
            BOOKING_TERMS,
            content({ title: "New terms" }),
            { changeNote: "Simplified.", userId: adminId }
        );

        assert.equal(v2.version, 2);
        assert.equal(v2.title, "New terms");
        assert.equal(v2.changeNote, "Simplified.");
        assert.equal(
            await LegalDocument.countDocuments({
                type: BOOKING_TERMS,
                status: LEGAL_DOCUMENT_STATUS.DRAFT,
            }),
            0
        );

        const current = await getCurrentLegalDocument(BOOKING_TERMS);
        assert.equal(String(current._id), String(v2._id));

        const oldVersion = await getPublishedLegalDocumentById(v1._id);
        assert.equal(oldVersion.title, v1.title);
        assert.deepEqual(oldVersion.sections, v1.sections);

        const view = await getLegalDocumentAdminView(BOOKING_TERMS);
        assert.deepEqual(
            view.history.map((entry) => entry.version),
            [2, 1]
        );
        assert.equal(view.draft, null);
    });

    it("never gives two simultaneous publishes the same number", async () => {
        await getCurrentLegalDocument(TERMS_OF_SERVICE);

        const plain = content({
            sections: [
                { title: "Use", items: [{ kind: "text", text: "Be nice." }] },
            ],
        });

        const results = await Promise.allSettled([
            publishLegalDocument(TERMS_OF_SERVICE, plain),
            publishLegalDocument(TERMS_OF_SERVICE, plain),
        ]);

        assert.ok(results.some((result) => result.status === "fulfilled"));

        const versions = results
            .filter((result) => result.status === "fulfilled")
            .map((result) => result.value.version);

        assert.equal(new Set(versions).size, versions.length);

        for (const result of results) {
            if (result.status === "rejected") {
                assert.equal(result.reason.statusCode, 409);
            }
        }
    });

    it("keeps one draft per document, saved over", async () => {
        await saveLegalDocumentDraft(BOOKING_TERMS, content({ title: "A" }), adminId);
        const draft = await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "B" }),
            adminId
        );

        assert.equal(draft.title, "B");
        assert.equal(
            await LegalDocument.countDocuments({
                type: BOOKING_TERMS,
                status: LEGAL_DOCUMENT_STATUS.DRAFT,
            }),
            1
        );
    });
});

describe("drafts shared between admins", () => {
    it("refuses to overwrite a draft someone else saved after this editor loaded it", async () => {
        const first = await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "Admin A" }),
            adminId,
            { baseUpdatedAt: null }
        );

        // Admin B, starting from A's draft, saves over it.
        const second = await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "Admin B" }),
            adminId,
            { baseUpdatedAt: first.updatedAt }
        );
        assert.equal(second.title, "Admin B");

        // A, still on the old copy, can't save or discard over B's draft...
        await assert.rejects(
            saveLegalDocumentDraft(
                BOOKING_TERMS,
                content({ title: "Admin A again" }),
                adminId,
                { baseUpdatedAt: first.updatedAt }
            ),
            (error) => error.statusCode === 409
        );
        await assert.rejects(
            discardLegalDocumentDraft(BOOKING_TERMS, {
                baseUpdatedAt: first.updatedAt,
            }),
            (error) => error.statusCode === 409
        );

        // ...nor start a second one as if there were none.
        await assert.rejects(
            saveLegalDocumentDraft(BOOKING_TERMS, content(), adminId, {
                baseUpdatedAt: null,
            }),
            (error) => error.statusCode === 409
        );

        // Publishing A's own content keeps B's draft.
        await publishLegalDocument(BOOKING_TERMS, content(), {
            baseDraftUpdatedAt: first.updatedAt,
        });

        const view = await getLegalDocumentAdminView(BOOKING_TERMS);
        assert.equal(view.draft.title, "Admin B");
    });

    it("refuses to publish over a version published after the editor loaded", async () => {
        await getCurrentLegalDocument(BOOKING_TERMS);

        // Another admin publishes version 2…
        await publishLegalDocument(BOOKING_TERMS, content({ title: "B" }), {
            baseVersion: 1,
        });

        // …while this one, still looking at version 1, tries to.
        await assert.rejects(
            publishLegalDocument(BOOKING_TERMS, content({ title: "A" }), {
                baseVersion: 1,
            }),
            (error) =>
                error.statusCode === 409 &&
                /Version 2 was published/.test(error.message)
        );

        const current = await getCurrentLegalDocument(BOOKING_TERMS);
        assert.equal(current.title, "B");
    });

    it("starts a new draft when the one being edited was published elsewhere", async () => {
        const draft = await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "Mine" }),
            adminId,
            { baseUpdatedAt: null }
        );

        await publishLegalDocument(BOOKING_TERMS, content(), {
            baseDraftUpdatedAt: draft.updatedAt,
        });

        const again = await saveLegalDocumentDraft(
            BOOKING_TERMS,
            content({ title: "Mine, continued" }),
            adminId,
            { baseUpdatedAt: draft.updatedAt }
        );

        assert.equal(again.title, "Mine, continued");
    });
});

describe("content checks", () => {
    it("treats a missing body as empty instead of crashing", () => {
        assert.throws(
            () => sanitizeLegalContent(BOOKING_TERMS, null, { strict: true }),
            /needs a title/
        );
    });

    it("allows live blocks only in the booking terms", () => {
        assert.throws(
            () => sanitizeLegalContent(PARTNER_TERMS, content()),
            /only be used in the booking Terms/
        );
        assert.throws(
            () =>
                sanitizeLegalContent(
                    BOOKING_TERMS,
                    content({
                        sections: [
                            {
                                title: "X",
                                items: [{ kind: "live", liveKey: "madeUp" }],
                            },
                        ],
                    })
                ),
            /unknown live block/
        );
    });

    it("lets a draft be unfinished but not a published version", () => {
        const unfinished = content({
            sections: [{ title: "", items: [{ kind: "text", text: " " }] }],
        });

        assert.doesNotThrow(() =>
            sanitizeLegalContent(BOOKING_TERMS, unfinished)
        );
        assert.throws(
            () =>
                sanitizeLegalContent(BOOKING_TERMS, unfinished, {
                    strict: true,
                }),
            /needs a title/
        );
        assert.throws(
            () =>
                sanitizeLegalContent(
                    BOOKING_TERMS,
                    content({ acceptanceLabel: "" }),
                    { strict: true }
                ),
            /acceptance statement/
        );
    });

    it("rejects unknown icons and makes section anchors unique", () => {
        assert.throws(
            () =>
                sanitizeLegalContent(
                    BOOKING_TERMS,
                    content({
                        sections: [{ title: "A", icon: "rocket", items: [] }],
                    })
                ),
            /unknown icon/
        );

        const { sections } = sanitizeLegalContent(
            BOOKING_TERMS,
            content({
                sections: [
                    { title: "Fees", items: [] },
                    { title: "Fees", items: [] },
                ],
            })
        );

        assert.deepEqual(
            sections.map((section) => section.key),
            ["fees", "fees-2"]
        );
    });
});

describe("accepting a version", () => {
    it("accepts the current version, or records it when none is sent", async () => {
        const current = await getCurrentLegalDocument(BOOKING_TERMS);

        const shown = await resolveAcceptedLegalVersion(
            BOOKING_TERMS,
            String(current._id)
        );
        const fallback = await resolveAcceptedLegalVersion(BOOKING_TERMS, null);

        assert.equal(shown.version, 1);
        assert.equal(String(fallback.document), String(current._id));
    });

    it("still accepts the version shown shortly after a newer one went live", async () => {
        const v1 = await getCurrentLegalDocument(BOOKING_TERMS);
        const v2 = await publishLegalDocument(BOOKING_TERMS, content());

        await publishedAgo(v2._id, (LEGAL_ACCEPTANCE_GRACE_MINUTES - 5) * MINUTE);

        const accepted = await resolveAcceptedLegalVersion(
            BOOKING_TERMS,
            String(v1._id)
        );

        assert.equal(accepted.version, 1);
    });

    it("refuses an old version once the grace period has passed", async () => {
        const v1 = await getCurrentLegalDocument(BOOKING_TERMS);
        const v2 = await publishLegalDocument(BOOKING_TERMS, content());

        await publishedAgo(v2._id, (LEGAL_ACCEPTANCE_GRACE_MINUTES + 5) * MINUTE);

        await assert.rejects(
            resolveAcceptedLegalVersion(BOOKING_TERMS, String(v1._id)),
            (error) =>
                error.statusCode === 409 &&
                error.message === TERMS_OUTDATED_MESSAGE
        );
    });

    it("refuses an id from another document or a made-up one", async () => {
        const partner = await getCurrentLegalDocument(PARTNER_TERMS);

        await assert.rejects(
            resolveAcceptedLegalVersion(BOOKING_TERMS, String(partner._id)),
            /couldn't be found/
        );
        await assert.rejects(
            resolveAcceptedLegalVersion(BOOKING_TERMS, "not-an-id"),
            /couldn't be found/
        );
    });
});

describe("bookings", () => {
    const book = async (termsVersionId) => {
        await Settings.collection.updateOne(
            {},
            {
                $set: {
                    "driverAssignmentSettings.requireAdminDriverAssignment": true,
                    "refundSettings.noShowGraceHours": 3,
                },
            },
            { upsert: true }
        );

        const vehicleId = newId();

        await Vehicle.collection.insertOne({
            _id: vehicleId,
            status: VEHICLE_STATUS.AVAILABLE,
            vehicleCode: `TEST-${vehicleId}`,
            plateNumber: `TEST-${vehicleId}`,
            brand: "Toyota",
            model: "Vios",
            vehicleType: "Car",
            pricing: { dailyRate: 2400, reservationFee: 0 },
            availability: { bookingEnabled: true, blockedDates: [] },
        });

        const start = new Date(Date.now() + 5 * DAY);
        start.setUTCHours(2, 0, 0, 0); // 10:00 AM Manila

        const location = {
            type: "Custom",
            address: "Legazpi City",
            latitude: 13.1391,
            longitude: 123.7438,
        };

        return createBooking(
            {
                vehicle: vehicleId,
                driverOption: BOOKING_DRIVER_OPTIONS.WITH_DRIVER,
                driver: "",
                startDate: start.toISOString(),
                endDate: new Date(start.getTime() + 2 * DAY).toISOString(),
                pickupLocation: location,
                returnLocation: location,
                termsAccepted: true,
                termsVersionId,
            },
            customerId
        );
    };

    it("records the version accepted and the settings its rules quoted", async () => {
        const v1 = await getCurrentLegalDocument(BOOKING_TERMS);

        const booking = await book(String(v1._id));
        const stored = await Booking.findById(booking._id).lean();

        assert.equal(String(stored.termsAcceptance.document), String(v1._id));
        assert.equal(stored.termsAcceptance.version, 1);
        assert.ok(stored.termsAcceptance.acceptedAt instanceof Date);
        assert.equal(stored.termsAcceptance.policySnapshot.noShowGraceHours, 3);

        // Editing the terms afterwards doesn't touch what was agreed to.
        await publishLegalDocument(BOOKING_TERMS, content());

        const after = await Booking.findById(booking._id).lean();
        assert.equal(after.termsAcceptance.version, 1);
    });

    it("refuses a booking whose terms are too old, without creating it", async () => {
        const v1 = await getCurrentLegalDocument(BOOKING_TERMS);
        const v2 = await publishLegalDocument(BOOKING_TERMS, content());

        await publishedAgo(v2._id, 2 * HOUR);

        await assert.rejects(book(String(v1._id)), /were updated while you were booking/);
        assert.equal(await Booking.countDocuments({}), 0);
    });
});
