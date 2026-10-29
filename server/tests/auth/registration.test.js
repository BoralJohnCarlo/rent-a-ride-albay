import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import transporter from "../../config/email.js";

import InspectionSetting from "../../models/InspectionSetting.js";
import Notification from "../../models/Notification.js";
import PendingRegistration from "../../models/PendingRegistration.js";
import PendingVehicle from "../../models/PendingVehicle.js";
import Settings from "../../models/Settings.js";
import TemporaryValidIdUpload from "../../models/TemporaryValidIdUpload.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";

import {
    registerOperator,
    registerUser,
    resendVerificationEmail,
    verifyEmail,
} from "../../services/authService.js";
import { getBookedInspectionCounts } from "../../services/inspectionSlotService.js";
import {
    createTemporaryValidIdUpload,
    removeTemporaryValidIdUpload,
} from "../../services/temporaryValidIdUploadService.js";
import Blacklist from "../../models/Blacklist.js";

import {
    connectTestDb,
    disconnectTestDb,
} from "../helpers/testDb.js";

/* Captured instead of sent, so tests can read the verification code. */
let sentMail = [];
const originalSendMail = transporter.sendMail;

const lastCodeFor = (email) => {
    const mail = [...sentMail].reverse().find((m) => m.to === email);
    return mail?.text.match(/\b(\d{6})\b/)?.[1];
};

const futureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const SLOT_DATE = futureDate(7);
const SLOT_TIME = "09:00";

let uploadCounter = 0;

/*
 * A real temporary-upload record plus the Cloudinary URL that matches it.
 * `id` is the secret handle the upload endpoint hands the browser.
 */
const makeUpload = async () => {
    uploadCounter += 1;
    const publicId = `rent-a-ride/registration/test-${uploadCounter}`;
    const { upload, handle } = await createTemporaryValidIdUpload(publicId);

    return {
        id: handle,
        recordId: upload._id,
        publicId,
        url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/${publicId}.jpg`,
    };
};

// Image URLs must be on this app's own Cloudinary account.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;

// One account per phone number, so every test user gets its own.
let phoneCounter = 0;
const nextPhone = () => {
    phoneCounter += 1;
    return `0917${String(1000000 + phoneCounter).slice(-7)}`;
};

const baseUser = (email) => ({
    firstName: "Juan",
    lastName: "Dela Cruz",
    email,
    password: "Password123",
    phoneNumber: nextPhone(),
    birthdate: "1990-01-01",
    validIdType: "Driver's License",
    termsAgreed: true,
});

const customerPayload = async (email, overrides = {}) => {
    const [front, back, billing] = await Promise.all([
        makeUpload(),
        makeUpload(),
        makeUpload(),
    ]);

    return {
        ...baseUser(email),
        validIdImage: front.url,
        validIdBack: back.url,
        // Proof of billing is on by default (Settings → Registration).
        proofOfBillingImage: billing.url,
        temporaryUploadIds: [front.id, back.id, billing.id],
        uploads: [front, back, billing],
        ...overrides,
    };
};

const operatorPayload = async (email, overrides = {}) => {
    const [front, back, photo, billing] = await Promise.all([
        makeUpload(),
        makeUpload(),
        makeUpload(),
        makeUpload(),
    ]);

    return {
        ...baseUser(email),
        validIdImage: front.url,
        validIdBack: back.url,
        proofOfBillingImage: billing.url,
        temporaryUploadIds: [front.id, back.id, photo.id, billing.id],
        inspectionDate: `${SLOT_DATE}T${SLOT_TIME}:00`,
        termsAgreed: true,
        vehicle: {
            vehicleType: "Car",
            brand: "Toyota",
            model: "Vios",
            year: 2022,
            plateNumber: "ABC 1234",
            registrationNumber: "REG-1",
            images: [{ url: photo.url, publicId: photo.publicId }],
            specifications: {
                transmission: "Automatic",
                fuelType: "Gasoline",
                seatingCapacity: 5,
            },
            // Admin-only fields a crafted request might try to set.
            isFeatured: true,
            pricing: { dailyRate: 1, reservationFee: 1 },
            compliance: { registrationNumberVerified: true },
            gps: { deviceId: "SPOOFED" },
            availability: { bookingEnabled: true },
        },
        ...overrides,
    };
};

// Skip the per-registration resend cooldown.
const backdateLastCode = (email, ms = 2 * 60 * 1000) =>
    PendingRegistration.updateOne(
        { email },
        { $set: { lastCodeSentAt: new Date(Date.now() - ms) } }
    );

const setSlots = async (maxAppointments = 1) => {
    const setting = await InspectionSetting.getInstance();
    setting.inspectionSlots = [
        {
            date: SLOT_DATE,
            enabled: true,
            timeSlots: [{ time: SLOT_TIME, maxAppointments }],
        },
    ];
    setting.disabledDates = [];
    await setting.save();
};

before(async () => {
    transporter.sendMail = async (mail) => {
        sentMail.push(mail);
        return { messageId: "test" };
    };

    await connectTestDb();
    await Promise.all([User.init(), PendingRegistration.init(), Vehicle.init()]);
});

after(async () => {
    transporter.sendMail = originalSendMail;
    await disconnectTestDb();
});

beforeEach(async () => {
    sentMail = [];
    await Promise.all(
        [
            Blacklist,
            InspectionSetting,
            Notification,
            PendingRegistration,
            PendingVehicle,
            Settings,
            TemporaryValidIdUpload,
            User,
            Vehicle,
        ].map((model) => model.deleteMany({}))
    );
    await setSlots(1);
});

describe("partner registration", () => {
    it("keeps admin-only vehicle fields out of the submitted vehicle", async () => {
        await registerOperator(await operatorPayload("p1@test.com"));

        const pending = await PendingRegistration.findOne({
            email: "p1@test.com",
        }).lean();

        assert.equal(pending.vehicleData.isFeatured, false);
        assert.equal(pending.vehicleData.pricing.dailyRate, null);
        assert.equal(
            pending.vehicleData.compliance.registrationNumberVerified,
            false
        );
        assert.equal(pending.vehicleData.gps.deviceId, "");
        assert.deepEqual(pending.inspectionSlot, {
            date: SLOT_DATE,
            time: SLOT_TIME,
        });
    });

    it("rejects a slot the admin does not offer", async () => {
        await assert.rejects(
            registerOperator(
                await operatorPayload("p2@test.com", {
                    inspectionDate: `${SLOT_DATE}T15:00:00`,
                })
            ),
            /no longer offered/
        );
    });

    it("holds the slot while the email is unverified, so it can't be double-booked", async () => {
        await registerOperator(await operatorPayload("p3@test.com"));

        const counts = await getBookedInspectionCounts();
        assert.equal(counts.get(`${SLOT_DATE}|${SLOT_TIME}`), 1);

        await assert.rejects(
            registerOperator(await operatorPayload("p4@test.com")),
            /fully booked/
        );
    });

    it("rejects an image URL that wasn't uploaded for this registration", async () => {
        await assert.rejects(
            registerOperator(
                await operatorPayload("p5@test.com", {
                    validIdImage: "https://example.com/fake-id.jpg",
                })
            ),
            /could not be confirmed/
        );
    });

    it("rejects a plate that is already registered, ignoring case and spacing", async () => {
        await Vehicle.collection.insertOne({
            plateNumber: "abc-1234",
            vehicleCode: "VH-000001",
            createdAt: new Date(),
        });

        await assert.rejects(
            registerOperator(await operatorPayload("p6@test.com")),
            /plate number is already registered/
        );
    });

    it("on verification, creates the vehicle with the booked slot and no admin-only fields", async () => {
        await registerOperator(await operatorPayload("p7@test.com"));

        // Even if an older record already held admin-only values, they
        // must not reach the vehicle.
        await PendingRegistration.updateOne(
            { email: "p7@test.com" },
            {
                $set: {
                    "vehicleData.isFeatured": true,
                    "vehicleData.pricing.dailyRate": 1,
                },
            }
        );

        const result = await verifyEmail(
            "p7@test.com",
            lastCodeFor("p7@test.com")
        );

        const vehicle = await PendingVehicle.findById(
            result.pendingVehicle.id
        ).lean();

        assert.equal(vehicle.isFeatured, false);
        assert.equal(vehicle.pricing?.dailyRate ?? null, null);
        assert.equal(vehicle.gps?.deviceId ?? "", "");
        assert.deepEqual(vehicle.inspection, {
            scheduledDate: SLOT_DATE,
            scheduledTime: SLOT_TIME,
        });
        assert.equal(
            await PendingRegistration.countDocuments({ email: "p7@test.com" }),
            0
        );

        // The slot is now held by the pending vehicle instead.
        const counts = await getBookedInspectionCounts();
        assert.equal(counts.get(`${SLOT_DATE}|${SLOT_TIME}`), 1);
    });

    it("undoes the new account when the vehicle can't be saved, so the code can be retried", async () => {
        await registerOperator(await operatorPayload("p8@test.com"));
        const code = lastCodeFor("p8@test.com");

        const originalCreate = PendingVehicle.create;
        PendingVehicle.create = async () => {
            throw new Error("simulated failure");
        };

        try {
            await assert.rejects(
                verifyEmail("p8@test.com", code),
                /couldn't save your vehicle/
            );
        } finally {
            PendingVehicle.create = originalCreate;
        }

        assert.equal(await User.countDocuments({ email: "p8@test.com" }), 0);
        assert.equal(
            await PendingRegistration.countDocuments({ email: "p8@test.com" }),
            1
        );

        const result = await verifyEmail("p8@test.com", code);
        assert.ok(result.pendingVehicle?.id);
    });
});

describe("customer registration", () => {
    it("accepts ID images uploaded for the registration", async () => {
        await registerUser(await customerPayload("c1@test.com"));

        assert.equal(
            await PendingRegistration.countDocuments({ email: "c1@test.com" }),
            1
        );
    });

    it("rejects an outside image URL for the back of the ID", async () => {
        await assert.rejects(
            registerUser(
                await customerPayload("c2@test.com", {
                    validIdBack: "https://example.com/back.jpg",
                })
            ),
            /could not be confirmed/
        );
    });

    it("rejects an upload id without its secret", async () => {
        const payload = await customerPayload("c3@test.com");

        await assert.rejects(
            registerUser({
                ...payload,
                temporaryUploadIds: payload.uploads.map((upload) =>
                    String(upload.recordId)
                ),
            }),
            /could not be confirmed/
        );
    });

    it("requires agreeing to the terms and privacy notice", async () => {
        await assert.rejects(
            registerUser(
                await customerPayload("c4@test.com", { termsAgreed: false })
            ),
            /Terms and Conditions/
        );
    });

    it("tells a verified account apart from one awaiting its code", async () => {
        await registerUser(await customerPayload("c5@test.com"));

        await assert.rejects(
            registerUser(await customerPayload("c5@test.com")),
            (error) =>
                /waiting for verification/.test(error.message) &&
                error.statusCode === 409
        );

        await verifyEmail("c5@test.com", lastCodeFor("c5@test.com"));

        await assert.rejects(
            registerUser(await customerPayload("c5@test.com")),
            (error) =>
                /already exists\. Please log in/.test(error.message) &&
                error.statusCode === 409
        );
    });

    it("keeps uploads only as long as the registration, then for good once verified", async () => {
        const payload = await customerPayload("c6@test.com");
        await registerUser(payload);

        const pending = await PendingRegistration.findOne({
            email: "c6@test.com",
        }).select("+emailVerificationExpires");

        const held = await TemporaryValidIdUpload.find({
            _id: { $in: payload.uploads.map((upload) => upload.recordId) },
        }).lean();

        // Not claimed yet - still swept if the registration is abandoned,
        // but held at least until the code expires.
        assert.equal(held.length, 3);
        held.forEach((upload) =>
            assert.ok(upload.expiresAt >= pending.emailVerificationExpires)
        );

        await verifyEmail("c6@test.com", lastCodeFor("c6@test.com"));

        assert.equal(
            await TemporaryValidIdUpload.countDocuments({
                _id: { $in: payload.uploads.map((upload) => upload.recordId) },
            }),
            0
        );

        const user = await User.findOne({ email: "c6@test.com" }).lean();
        assert.ok(user.termsAcceptedAt instanceof Date);
    });

    it("voids the code after too many wrong guesses, until a new one is sent", async () => {
        await registerUser(await customerPayload("c7@test.com"));
        const code = lastCodeFor("c7@test.com");
        const wrong = code === "000000" ? "111111" : "000000";

        for (let attempt = 1; attempt <= 4; attempt += 1) {
            await assert.rejects(
                verifyEmail("c7@test.com", wrong),
                new RegExp(`${5 - attempt} attempts? left`)
            );
        }

        await assert.rejects(
            verifyEmail("c7@test.com", wrong),
            /Too many incorrect codes/
        );

        // Even the right code no longer works.
        await assert.rejects(
            verifyEmail("c7@test.com", code),
            /locked after too many/
        );

        // A new code (after the resend cooldown) comes with a fresh set of
        // attempts.
        await backdateLastCode("c7@test.com");
        await resendVerificationEmail("c7@test.com");
        const result = await verifyEmail(
            "c7@test.com",
            lastCodeFor("c7@test.com")
        );
        assert.equal(result.email, "c7@test.com");
    });

    it("refuses a new sign-up that reuses a blacklisted customer's phone number", async () => {
        const admin = await User.create({
            ...baseUser("admin@test.com"),
            role: "admin",
            phoneNumber: "09990000000",
        });
        const banned = await User.create({
            ...baseUser("banned@test.com"),
            phoneNumber: "+63 917 555 0101",
        });

        await Blacklist.create({
            user: banned._id,
            reason: "Test",
            blacklistedBy: admin._id,
        });

        await assert.rejects(
            registerUser(
                await customerPayload("new@test.com", {
                    phoneNumber: "09175550101",
                })
            ),
            /unable to create an account/
        );
    });

    it("only lets the uploader remove a temporary upload", async () => {
        const upload = await makeUpload();

        // Record id alone, or with the wrong secret: nothing is removed.
        await removeTemporaryValidIdUpload(String(upload.recordId));
        await removeTemporaryValidIdUpload(`${upload.recordId}.wrong`);

        assert.equal(
            await TemporaryValidIdUpload.countDocuments({
                _id: upload.recordId,
            }),
            1
        );
    });
});

describe("abuse limits and identity rules", () => {
    it("escapes the registrant's name in the verification email", async () => {
        await registerUser(
            await customerPayload("html@test.com", {
                firstName: `<a href="//evil.example">Verify</a>`,
            })
        );

        const mail = sentMail.find((m) => m.to === "html@test.com");

        assert.ok(!mail.html.includes("<a href"));
        assert.ok(
            mail.html.includes("&lt;a href=&quot;//evil.example&quot;&gt;")
        );
    });

    it("rejects an image on a different Cloudinary account with the same public id", async () => {
        const payload = await customerPayload("cloud@test.com");

        await assert.rejects(
            registerUser({
                ...payload,
                validIdImage: payload.validIdImage.replace(
                    `/${CLOUD_NAME}/`,
                    "/someone-else/"
                ),
            }),
            /could not be confirmed/
        );
    });

    it("limits resends per registration: a cooldown, a cap, and a lifetime", async () => {
        await registerUser(await customerPayload("resend@test.com"));

        // Cooldown, whatever IP asks.
        await assert.rejects(
            resendVerificationEmail("resend@test.com"),
            (error) =>
                /Please wait/.test(error.message) && error.statusCode === 429
        );

        // Cap: 10 codes per registration (the first came with registering).
        for (let sent = 2; sent <= 10; sent += 1) {
            await backdateLastCode("resend@test.com");
            await resendVerificationEmail("resend@test.com");
        }

        await backdateLastCode("resend@test.com");
        await assert.rejects(
            resendVerificationEmail("resend@test.com"),
            /maximum number of codes/
        );

        // Lifetime: resends can't extend a registration past 6 hours.
        await PendingRegistration.updateOne(
            { email: "resend@test.com" },
            {
                $set: {
                    codesSent: 1,
                    registrationStartedAt: new Date(
                        Date.now() - 6 * 60 * 60 * 1000 + 60 * 1000
                    ),
                },
            }
        );
        await backdateLastCode("resend@test.com");
        await assert.rejects(
            resendVerificationEmail("resend@test.com"),
            /can't be extended any further/
        );
    });

    it("doesn't count a code replacing a locked one, so lockouts can't use up the cap", async () => {
        await registerUser(await customerPayload("lock@test.com"));
        await PendingRegistration.updateOne(
            { email: "lock@test.com" },
            { $set: { codesSent: 10, emailVerificationToken: null } }
        );
        await backdateLastCode("lock@test.com");

        await resendVerificationEmail("lock@test.com");

        const pending = await PendingRegistration.findOne({
            email: "lock@test.com",
        }).lean();
        assert.equal(pending.codesSent, 10);

        const result = await verifyEmail(
            "lock@test.com",
            lastCodeFor("lock@test.com")
        );
        assert.equal(result.email, "lock@test.com");
    });

    it("allows one account per phone number, whatever its formatting", async () => {
        await registerUser(
            await customerPayload("phone1@test.com", {
                phoneNumber: "09175551234",
            })
        );

        // Same number, written differently, still awaiting verification.
        await assert.rejects(
            registerUser(
                await customerPayload("phone2@test.com", {
                    phoneNumber: "+63 917 555 1234",
                })
            ),
            (error) =>
                /phone number is already used/.test(error.message) &&
                error.statusCode === 409
        );

        // And once it's a verified account.
        await verifyEmail("phone1@test.com", lastCodeFor("phone1@test.com"));

        await assert.rejects(
            registerOperator(
                await operatorPayload("phone3@test.com", {
                    phoneNumber: "0917-555-1234",
                })
            ),
            /phone number is already used/
        );
    });

    it("refuses a new sign-up matching a suspended partner's phone or license", async () => {
        await User.create({
            ...baseUser("suspended@test.com"),
            role: "operator",
            isSuspended: true,
            licenseNumber: "N01-12-345678",
        });

        await assert.rejects(
            registerOperator(
                await operatorPayload("comeback@test.com", {
                    licenseNumber: "n0112345678",
                })
            ),
            (error) =>
                /unable to create an account/.test(error.message) &&
                error.statusCode === 403
        );
    });

    it("caps unverified partner registrations per IP", async () => {
        await setSlots(5);

        const payloadFor = async (email, plate) => {
            const payload = await operatorPayload(email);
            payload.vehicle.plateNumber = plate;
            return payload;
        };

        const ip = { ip: "203.0.113.7" };

        await registerOperator(await payloadFor("ip1@test.com", "IP 001"), ip);
        await registerOperator(await payloadFor("ip2@test.com", "IP 002"), ip);

        await assert.rejects(
            registerOperator(await payloadFor("ip3@test.com", "IP 003"), ip),
            (error) =>
                /from your network/.test(error.message) &&
                error.statusCode === 429
        );

        // A different network is unaffected.
        await registerOperator(await payloadFor("ip4@test.com", "IP 004"), {
            ip: "198.51.100.9",
        });
    });

    it("reports 'already verified' when the same code is submitted twice", async () => {
        await registerUser(await customerPayload("twice@test.com"));
        const code = lastCodeFor("twice@test.com");

        const results = await Promise.allSettled([
            verifyEmail("twice@test.com", code),
            verifyEmail("twice@test.com", code),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        assert.equal(fulfilled.length, 1);
        assert.equal(rejected.length, 1);
        assert.match(rejected[0].reason.message, /already verified/);
        assert.equal(rejected[0].reason.statusCode, 409);
        assert.equal(await User.countDocuments({ email: "twice@test.com" }), 1);
    });

    it("records consent at the time of this submission, even when reusing an expired record", async () => {
        const oldDate = new Date("2020-01-01T00:00:00Z");

        await PendingRegistration.collection.insertOne({
            email: "reuse@test.com",
            firstName: "Old",
            lastName: "Record",
            password: "x".repeat(60),
            phoneNumber: "09170009999",
            birthdate: "1990-01-01",
            validIdType: "Driver's License",
            validIdImage: "https://example.com/old.jpg",
            emailVerificationExpires: new Date(Date.now() - 1000),
            termsAgreed: true,
            createdAt: oldDate,
            updatedAt: oldDate,
        });

        const before = Date.now();
        await registerUser(await customerPayload("reuse@test.com"));
        await verifyEmail("reuse@test.com", lastCodeFor("reuse@test.com"));

        const user = await User.findOne({ email: "reuse@test.com" }).lean();
        assert.ok(user.termsAcceptedAt.getTime() >= before - 1000);
    });

    it("keeps the pending registration (and the images unclaimed) if finishing the account fails", async () => {
        const payload = await customerPayload("claimfail@test.com");
        await registerUser(payload);
        const code = lastCodeFor("claimfail@test.com");

        const originalDeleteMany = TemporaryValidIdUpload.deleteMany;
        TemporaryValidIdUpload.deleteMany = async () => {
            throw new Error("simulated claim failure");
        };

        try {
            await assert.rejects(
                verifyEmail("claimfail@test.com", code),
                /couldn't finish creating your account/
            );
        } finally {
            TemporaryValidIdUpload.deleteMany = originalDeleteMany;
        }

        assert.equal(
            await User.countDocuments({ email: "claimfail@test.com" }),
            0
        );
        assert.equal(
            await PendingRegistration.countDocuments({
                email: "claimfail@test.com",
            }),
            1
        );

        await verifyEmail("claimfail@test.com", code);
        assert.equal(
            await TemporaryValidIdUpload.countDocuments({
                _id: { $in: payload.uploads.map((upload) => upload.recordId) },
            }),
            0
        );
    });
});

describe("proof of billing address (Settings → Registration)", () => {
    const setProofOfBilling = (proofOfBillingEnabled) =>
        Settings.findOneAndUpdate(
            {},
            { registrationSettings: { proofOfBillingEnabled } },
            { upsert: true }
        );

    it("is required by default, for customers and partners alike", async () => {
        await assert.rejects(
            registerUser(
                await customerPayload("pb1@test.com", {
                    proofOfBillingImage: "",
                })
            ),
            /proof of billing address/
        );

        await assert.rejects(
            registerOperator(
                await operatorPayload("pb2@test.com", {
                    proofOfBillingImage: undefined,
                })
            ),
            /proof of billing address/
        );
    });

    it("must be one of the registration's own uploads", async () => {
        await assert.rejects(
            registerUser(
                await customerPayload("pb3@test.com", {
                    proofOfBillingImage: "https://example.com/bill.jpg",
                })
            ),
            /could not be confirmed/
        );
    });

    it("carries the image from the pending registration to the account", async () => {
        const payload = await customerPayload("pb4@test.com");
        await registerUser(payload);

        await verifyEmail("pb4@test.com", lastCodeFor("pb4@test.com"));

        const user = await User.findOne({ email: "pb4@test.com" }).lean();
        assert.equal(user.proofOfBillingImage, payload.proofOfBillingImage);
    });

    it("when turned off, registers without one and ignores any that is sent", async () => {
        await setProofOfBilling(false);

        // None at all.
        await registerUser(
            await customerPayload("pb5@test.com", {
                proofOfBillingImage: undefined,
            })
        );
        await verifyEmail("pb5@test.com", lastCodeFor("pb5@test.com"));

        const user = await User.findOne({ email: "pb5@test.com" }).lean();
        assert.equal(user.proofOfBillingImage, "");

        // A stale form still sending one (even an unconfirmable URL) is fine.
        await registerUser(
            await customerPayload("pb6@test.com", {
                proofOfBillingImage: "https://example.com/bill.jpg",
            })
        );

        const pending = await PendingRegistration.findOne({
            email: "pb6@test.com",
        }).lean();
        assert.equal(pending.proofOfBillingImage, "");

        await registerOperator(
            await operatorPayload("pb7@test.com", {
                proofOfBillingImage: undefined,
            })
        );
        assert.equal(
            await PendingRegistration.countDocuments({ email: "pb7@test.com" }),
            1
        );
    });

    it("turning it back on keeps accounts made while it was off working", async () => {
        await setProofOfBilling(false);
        await registerUser(
            await customerPayload("pb8@test.com", {
                proofOfBillingImage: undefined,
            })
        );
        await setProofOfBilling(true);

        // A registration made while it was off still verifies.
        await verifyEmail("pb8@test.com", lastCodeFor("pb8@test.com"));

        const user = await User.findOne({ email: "pb8@test.com" }).lean();
        assert.equal(user.proofOfBillingImage, "");
    });
});
