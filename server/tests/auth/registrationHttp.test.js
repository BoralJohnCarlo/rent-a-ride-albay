import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import express from "express";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";

import transporter from "../../config/email.js";

import InspectionSetting from "../../models/InspectionSetting.js";
import PendingRegistration from "../../models/PendingRegistration.js";
import PendingVehicle from "../../models/PendingVehicle.js";
import Settings from "../../models/Settings.js";
import TemporaryValidIdUpload from "../../models/TemporaryValidIdUpload.js";
import User from "../../models/User.js";
import Vehicle from "../../models/Vehicle.js";

import routes from "../../routes/index.js";
import errorMiddleware from "../../middleware/errorMiddleware.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Both sign-up journeys end to end over HTTP — the real routes, validators,
 * controllers and services, exactly as the browser calls them. Only the two
 * outside services are stubbed: email (codes are read from the captured
 * message) and Cloudinary (uploads return a URL on this app's account).
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_CLOUD_NAME = CLOUD_NAME;

let sentMail = [];
let uploadCounter = 0;
const originals = {
    sendMail: transporter.sendMail,
    uploadStream: cloudinary.uploader.upload_stream,
    destroy: cloudinary.uploader.destroy,
};

let server;
let baseUrl;

const codeFor = (email) =>
    [...sentMail].reverse().find((mail) => mail.to === email)
        ?.text.match(/\b(\d{6})\b/)?.[1];

const futureDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const SLOT_DATE = futureDate(5);
const SLOT_TIME = "10:00";

const request = async (method, path, { json, form, cookie } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(json && { "Content-Type": "application/json" }),
            ...(cookie && { Cookie: cookie }),
        },
        body: json ? JSON.stringify(json) : form,
    });

    const body = await response.json().catch(() => null);

    return {
        status: response.status,
        body,
        cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
};

// A tiny JPEG-typed file — the stubbed Cloudinary never reads its bytes.
const imageForm = (field) => {
    const form = new FormData();
    form.append(
        field,
        new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
            type: "image/jpeg",
        }),
        "photo.jpg"
    );
    return form;
};

const uploadIdImage = async () => {
    const { status, body } = await request("POST", "/api/auth/upload-valid-id", {
        form: imageForm("validIdImage"),
    });
    assert.equal(status, 200, JSON.stringify(body));
    return body.data;
};

const uploadBillingImage = async () => {
    const { status, body } = await request(
        "POST",
        "/api/auth/upload-proof-of-billing",
        { form: imageForm("proofOfBillingImage") }
    );
    assert.equal(status, 200, JSON.stringify(body));
    return body.data;
};

const uploadVehicleImage = async () => {
    const { status, body } = await request(
        "POST",
        "/api/auth/upload-vehicle-image",
        { form: imageForm("image") }
    );
    assert.equal(status, 200, JSON.stringify(body));
    return body.data;
};

before(async () => {
    transporter.sendMail = async (mail) => {
        sentMail.push(mail);
        return { messageId: "test" };
    };

    cloudinary.uploader.upload_stream = (options, callback) => ({
        end: () => {
            uploadCounter += 1;
            const publicId = `${options.folder}/http-test-${uploadCounter}`;
            callback(null, {
                public_id: publicId,
                secure_url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/${publicId}.jpg`,
            });
        },
    });
    cloudinary.uploader.destroy = async () => ({ result: "ok" });

    await connectTestDb();
    await Promise.all([User.init(), PendingRegistration.init(), Vehicle.init()]);

    const setting = await InspectionSetting.getInstance();
    setting.inspectionSlots = [
        {
            date: SLOT_DATE,
            enabled: true,
            timeSlots: [{ time: SLOT_TIME, maxAppointments: 1 }],
        },
    ];
    setting.disabledDates = [];
    await setting.save();

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", routes);
    app.use(errorMiddleware);

    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    transporter.sendMail = originals.sendMail;
    cloudinary.uploader.upload_stream = originals.uploadStream;
    cloudinary.uploader.destroy = originals.destroy;

    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
});

const slotRemaining = async () => {
    const { body } = await request(
        "GET",
        "/api/inspection-settings/availability"
    );
    return body.data.slots
        .find((day) => day.date === SLOT_DATE)
        ?.timeSlots.find((slot) => slot.time === SLOT_TIME)?.remaining;
};

describe("customer sign-up over HTTP", () => {
    const email = "maria.santos@example.com";

    it("explains which field is wrong when the server rejects the form", async () => {
        const { status, body } = await request("POST", "/api/auth/register", {
            json: {
                firstName: "Maria",
                lastName: "Santos",
                email,
                password: "weakpass",
                phoneNumber: "09181112222",
                birthdate: "1995-05-05",
                validIdType: "Philippine Passport",
                validIdImage: "https://example.com/a.jpg",
                validIdBack: "https://example.com/b.jpg",
                hasDriversLicense: false,
                termsAgreed: true,
            },
        });

        assert.equal(status, 400);
        assert.equal(body.message, "Validation failed.");
        assert.ok(
            body.errors.some((error) => /uppercase letter/.test(error.msg)),
            "the field error is returned for the form to show"
        );
    });

    it("registers, verifies the email, and logs in", async () => {
        const [front, back] = [await uploadIdImage(), await uploadIdImage()];
        const billing = await uploadBillingImage();

        // The browser gets an opaque handle, not a bare record id.
        assert.match(front.uploadId, /^[0-9a-f]{24}\.[0-9a-f]+$/);

        const register = await request("POST", "/api/auth/register", {
            json: {
                firstName: "María",
                middleName: "de la",
                lastName: "Santos-Reyes",
                email: "Maria.Santos@Example.com",
                password: "Password123",
                confirmPassword: "Password123",
                phoneNumber: "0918 111 2222",
                alternativeContact: "",
                birthdate: "1995-05-05",
                validIdType: "Driver's License",
                validIdImage: front.url,
                validIdBack: back.url,
                proofOfBillingImage: billing.url,
                hasDriversLicense: true,
                licenseNumber: "N01-23-456789",
                licenseExpirationDate: futureDate(400),
                licenseCodes: ["B"],
                motorcycleTransmission: [],
                carTransmission: ["automatic"],
                currentAddress: {
                    houseUnitLot: "12",
                    street: "Rizal St.",
                    barangay: "Bitano",
                    cityMunicipality: "Legazpi City",
                    province: "Albay",
                    region: "Region V",
                    postalCode: "4500",
                },
                temporaryUploadIds: [
                    front.uploadId,
                    back.uploadId,
                    billing.uploadId,
                ],
                termsAgreed: true,
            },
        });

        assert.equal(register.status, 201, JSON.stringify(register.body));

        // Uploads are held for the registration, not yet kept for good.
        assert.equal(await TemporaryValidIdUpload.countDocuments(), 3);

        const code = codeFor(email);
        assert.ok(code, "a verification code was emailed");

        const wrong = await request("POST", "/api/auth/verify-email", {
            json: { email, code: code === "000000" ? "111111" : "000000" },
        });
        assert.equal(wrong.status, 400);
        assert.match(wrong.body.message, /4 attempts left/);

        const verify = await request("POST", "/api/auth/verify-email", {
            json: { email, code },
        });
        assert.equal(verify.status, 200, JSON.stringify(verify.body));

        // Submitting the same code again reports success, not a failure.
        const again = await request("POST", "/api/auth/verify-email", {
            json: { email, code },
        });
        assert.equal(again.status, 409);
        assert.match(again.body.message, /already verified/);

        assert.equal(await TemporaryValidIdUpload.countDocuments(), 0);

        const login = await request("POST", "/api/auth/login", {
            json: { email, password: "Password123" },
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));
        assert.ok(login.cookie, "a session cookie was set");

        const me = await request("GET", "/api/auth/me", {
            cookie: login.cookie,
        });
        assert.equal(me.status, 200);

        const user = await User.findOne({ email }).lean();
        assert.equal(user.role, "customer");
        assert.equal(user.firstName, "María");
        assert.equal(user.validIdImage, front.url);
        assert.equal(user.proofOfBillingImage, billing.url);
        assert.ok(user.termsAcceptedAt);
        assert.equal(user.isVerified, false, "ID still awaits admin review");
    });

    it("tells a returning user to log in instead of sending a code", async () => {
        const [front, back] = [await uploadIdImage(), await uploadIdImage()];
        const billing = await uploadBillingImage();

        const { status, body } = await request("POST", "/api/auth/register", {
            json: {
                firstName: "Maria",
                lastName: "Santos",
                email,
                password: "Password123",
                phoneNumber: "09189990000",
                birthdate: "1995-05-05",
                validIdType: "Philippine Passport",
                validIdImage: front.url,
                validIdBack: back.url,
                proofOfBillingImage: billing.url,
                hasDriversLicense: false,
                temporaryUploadIds: [
                    front.uploadId,
                    back.uploadId,
                    billing.uploadId,
                ],
                termsAgreed: true,
            },
        });

        assert.equal(status, 409);
        assert.match(body.message, /already exists\. Please log in/);
    });
});

describe("partner sign-up over HTTP", () => {
    const email = "jose.partner@example.com";

    it("registers with a vehicle and an inspection slot, verifies, and sees the vehicle", async () => {
        assert.equal(await slotRemaining(), 1);

        const front = await uploadIdImage();
        const back = await uploadIdImage();
        const billing = await uploadBillingImage();
        const photo = await uploadVehicleImage();

        const register = await request(
            "POST",
            "/api/auth/register-operator",
            {
                json: {
                    firstName: "Jose",
                    lastName: "Rizal",
                    email,
                    password: "Partner123",
                    confirmPassword: "Partner123",
                    phoneNumber: "+63 919 222 3333",
                    alternativeContact: "",
                    middleName: "",
                    birthdate: "1988-06-19",
                    validIdType: "Philippine Passport",
                    validIdImage: front.url,
                    validIdBack: back.url,
                    proofOfBillingImage: billing.url,
                    licenseNumber: "",
                    licenseExpirationDate: null,
                    licenseCodes: [],
                    motorcycleTransmission: [],
                    carTransmission: [],
                    currentAddress: {
                        barangay: "Bitano",
                        cityMunicipality: "Legazpi City",
                        province: "Albay",
                        region: "Region V",
                        postalCode: "4500",
                    },
                    temporaryUploadIds: [
                        front.uploadId,
                        back.uploadId,
                        billing.uploadId,
                        photo.uploadId,
                    ],
                    vehicle: {
                        vehicleType: "Car",
                        brand: "Toyota",
                        model: "Vios",
                        year: 2022,
                        plateNumber: "NBC 1234",
                        registrationNumber: "REG-2022-01",
                        compliance: { licenseExpiration: futureDate(300) },
                        images: [{ url: photo.url, publicId: photo.publicId }],
                        specifications: {
                            transmission: "Automatic",
                            fuelType: "Gasoline",
                            seatingCapacity: 5,
                        },
                        // Ignored: admin-only.
                        isFeatured: true,
                        pricing: { dailyRate: 1 },
                    },
                    inspectionDate: `${SLOT_DATE}T${SLOT_TIME}:00`,
                    termsAgreed: true,
                },
            }
        );

        assert.equal(register.status, 201, JSON.stringify(register.body));

        // The slot is held while the email is unverified.
        assert.equal(await slotRemaining(), 0);

        const verify = await request("POST", "/api/auth/verify-email", {
            json: { email, code: codeFor(email) },
        });
        assert.equal(verify.status, 200, JSON.stringify(verify.body));
        assert.ok(verify.body.data.pendingVehicle?.id);

        // ...and now by the vehicle awaiting review.
        assert.equal(await slotRemaining(), 0);

        const login = await request("POST", "/api/auth/login", {
            json: { email, password: "Partner123" },
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));

        const mine = await request("GET", "/api/pending-vehicles/mine", {
            cookie: login.cookie,
        });
        assert.equal(mine.status, 200, JSON.stringify(mine.body));

        const vehicles = mine.body.data?.pendingVehicles ?? mine.body.data;
        const vehicle = Array.isArray(vehicles) ? vehicles[0] : null;

        assert.ok(vehicle, "the partner sees their submitted vehicle");
        assert.equal(vehicle.plateNumber, "NBC 1234");
        assert.deepEqual(vehicle.inspection, {
            scheduledDate: SLOT_DATE,
            scheduledTime: SLOT_TIME,
        });
        assert.equal(vehicle.isFeatured, false);

        const stored = await PendingVehicle.findById(vehicle._id).lean();
        assert.equal(stored.pricing?.dailyRate ?? null, null);

        const user = await User.findOne({ email }).lean();
        assert.equal(user.role, "operator");
        assert.equal(user.proofOfBillingImage, billing.url);
    });

    it("rejects a second partner for the now-full slot, and a reused phone number", async () => {
        const front = await uploadIdImage();
        const back = await uploadIdImage();
        const billing = await uploadBillingImage();
        const photo = await uploadVehicleImage();

        const payload = (overrides) => ({
            firstName: "Andres",
            lastName: "Bonifacio",
            email: "andres@example.com",
            password: "Partner123",
            phoneNumber: "09194445555",
            birthdate: "1990-11-30",
            validIdType: "Philippine Passport",
            validIdImage: front.url,
            validIdBack: back.url,
            proofOfBillingImage: billing.url,
            temporaryUploadIds: [
                front.uploadId,
                back.uploadId,
                billing.uploadId,
                photo.uploadId,
            ],
            vehicle: {
                vehicleType: "Motorcycle",
                brand: "Honda",
                model: "Click",
                year: 2023,
                plateNumber: "MC 4321",
                registrationNumber: "REG-2023-09",
                images: [{ url: photo.url, publicId: photo.publicId }],
                specifications: {
                    transmission: "Automatic",
                    fuelType: "Gasoline",
                    seatingCapacity: 2,
                },
            },
            inspectionDate: `${SLOT_DATE}T${SLOT_TIME}:00`,
            termsAgreed: true,
            ...overrides,
        });

        const full = await request("POST", "/api/auth/register-operator", {
            json: payload(),
        });
        assert.equal(full.status, 409);
        assert.match(full.body.message, /inspection slot is fully booked/);

        const samePhone = await request(
            "POST",
            "/api/auth/register-operator",
            { json: payload({ phoneNumber: "0919-222-3333" }) }
        );
        assert.equal(samePhone.status, 409);
        assert.match(samePhone.body.message, /phone number is already used/);
    });
});

describe("proof of billing address over HTTP", () => {
    const customer = (email, phoneNumber, overrides) => ({
        firstName: "Gabriela",
        lastName: "Silang",
        email,
        password: "Password123",
        phoneNumber,
        birthdate: "1992-03-19",
        validIdType: "Philippine Passport",
        hasDriversLicense: false,
        termsAgreed: true,
        ...overrides,
    });

    // Shared: the valid ID upload endpoint is rate limited per IP.
    let front;
    let back;

    it("names the missing image while it's on, and shows on the public settings", async () => {
        const settings = await request("GET", "/api/settings/public");
        assert.equal(settings.body.data.proofOfBillingEnabled, true);

        [front, back] = [await uploadIdImage(), await uploadIdImage()];

        const { status, body } = await request("POST", "/api/auth/register", {
            json: customer("gabriela@example.com", "09170001111", {
                validIdImage: front.url,
                validIdBack: back.url,
                temporaryUploadIds: [front.uploadId, back.uploadId],
            }),
        });

        assert.equal(status, 400);
        assert.ok(
            body.errors.some((error) =>
                /proof of billing address/.test(error.msg)
            ),
            JSON.stringify(body)
        );
    });

    it("lets a signed-in user add one from their profile", async () => {
        const login = await request("POST", "/api/auth/login", {
            json: {
                email: "maria.santos@example.com",
                password: "Password123",
            },
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));

        const upload = await request(
            "POST",
            "/api/users/profile/proof-of-billing",
            {
                form: imageForm("proofOfBillingImage"),
                cookie: login.cookie,
            }
        );
        assert.equal(upload.status, 200, JSON.stringify(upload.body));
        assert.match(
            upload.body.data.proofOfBillingImage,
            /proof-of-billing/
        );

        const profile = await request("GET", "/api/users/profile", {
            cookie: login.cookie,
        });
        assert.equal(
            profile.body.data.proofOfBillingImage,
            upload.body.data.proofOfBillingImage
        );
    });

    it("registers without one once an admin turns it off", async () => {
        await Settings.findOneAndUpdate(
            {},
            { registrationSettings: { proofOfBillingEnabled: false } },
            { upsert: true }
        );

        const settings = await request("GET", "/api/settings/public");
        assert.equal(settings.body.data.proofOfBillingEnabled, false);

        // The rejected attempt above left its ID uploads unclaimed.

        const register = await request("POST", "/api/auth/register", {
            json: customer("gabriela@example.com", "09170001111", {
                validIdImage: front.url,
                validIdBack: back.url,
                temporaryUploadIds: [front.uploadId, back.uploadId],
            }),
        });
        assert.equal(register.status, 201, JSON.stringify(register.body));

        const verify = await request("POST", "/api/auth/verify-email", {
            json: {
                email: "gabriela@example.com",
                code: codeFor("gabriela@example.com"),
            },
        });
        assert.equal(verify.status, 200, JSON.stringify(verify.body));

        const user = await User.findOne({
            email: "gabriela@example.com",
        }).lean();
        assert.equal(user.proofOfBillingImage, "");
    });
});
