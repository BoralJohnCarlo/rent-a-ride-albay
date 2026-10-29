import * as yup from "yup";

const DRIVER_STATUS_VALUES = [
    "Active",
    "Suspended",
    "Inactive",
];

const DRIVER_AVAILABILITY_VALUES = [
    "Available",
    "Unavailable",
    "On Duty",
];

const DRIVER_LICENSE_TYPE_VALUES = [
    "Non-Professional",
    "Professional",
];

const workingDaysSchema = yup
    .array()
    .of(yup.string())
    .default([]);

const addressSchema = yup.object({
    province: yup.string().trim().default(""),
    city: yup.string().trim().default(""),
    barangay: yup.string().trim().default(""),
    street: yup.string().trim().default(""),
});

const licenseSchema = yup.object({
    licenseNumber: yup
        .string()
        .trim()
        .required(
            "Driver's license number is required."
        ),

    licenseType: yup
        .string()
        .trim()
        .required(
            "Driver's license type is required."
        )
        .oneOf(
            DRIVER_LICENSE_TYPE_VALUES,
            "Invalid driver's license type."
        ),

    expiryDate: yup
        .date()
        .typeError(
            "Driver's license expiry date must be a valid date."
        )
        .required(
            "Driver's license expiry date is required."
        ),

    restrictionCodes: yup
        .array()
        .of(yup.string())
        .default([]),
});

const uploadedDocumentsSchema = yup.object({
    driversLicense: yup
        .string()
        .trim()
        .default(""),

    governmentId: yup
        .string()
        .trim()
        .default(""),

    selfieVerification: yup
        .string()
        .trim()
        .default(""),
});

const emergencyContactSchema = yup.object({
    name: yup
        .string()
        .trim()
        .default(""),

    relationship: yup
        .string()
        .trim()
        .default(""),

    phoneNumber: yup
        .string()
        .trim()
        .default(""),
});

const scheduleSchema = yup.object({
    workingDays: workingDaysSchema,

    startTime: yup
        .string()
        .trim()
        .default(""),

    endTime: yup
        .string()
        .trim()
        .default(""),

    timezone: yup
        .string()
        .trim()
        .default("Asia/Manila"),
});

export const driverSchema = yup.object({
    firstName: yup
        .string()
        .trim()
        .required("First name is required."),

    lastName: yup
        .string()
        .trim()
        .required("Last name is required."),

    email: yup
        .string()
        .trim()
        .required("Email is required.")
        .email(
            "Please provide a valid email address."
        ),

    phoneNumber: yup
        .string()
        .trim()
        .required("Phone number is required."),

    alternativeContact: yup
        .string()
        .trim()
        .default(""),

    profileImage: yup
        .string()
        .trim()
        .default(""),

    address: addressSchema,

    license: licenseSchema,

    uploadedDocuments:
        uploadedDocumentsSchema,

    emergencyContact:
        emergencyContactSchema,

    status: yup
        .string()
        .trim()
        .oneOf(
            DRIVER_STATUS_VALUES,
            "Invalid driver status."
        )
        .default("Active"),

    availability: yup
        .string()
        .trim()
        .oneOf(
            DRIVER_AVAILABILITY_VALUES,
            "Invalid driver availability."
        )
        .default("Available"),

    schedule: scheduleSchema,
});

export const driverUpdateSchema = yup.object({
    firstName: yup
        .string()
        .trim()
        .notRequired(),

    lastName: yup
        .string()
        .trim()
        .notRequired(),

    email: yup
        .string()
        .trim()
        .email(
            "Please provide a valid email address."
        )
        .notRequired(),

    phoneNumber: yup
        .string()
        .trim()
        .notRequired(),

    alternativeContact: yup
        .string()
        .trim()
        .notRequired(),

    profileImage: yup
        .string()
        .trim()
        .notRequired(),

    address: addressSchema.notRequired(),

    license: licenseSchema.notRequired(),

    uploadedDocuments:
        uploadedDocumentsSchema.notRequired(),

    emergencyContact:
        emergencyContactSchema.notRequired(),

    status: yup
        .string()
        .trim()
        .oneOf(
            DRIVER_STATUS_VALUES,
            "Invalid driver status."
        )
        .notRequired(),

    availability: yup
        .string()
        .trim()
        .oneOf(
            DRIVER_AVAILABILITY_VALUES,
            "Invalid driver availability."
        )
        .notRequired(),

    schedule:
        scheduleSchema.notRequired(),
});

export const driverStatusSchema = yup.object({
    status: yup
        .string()
        .trim()
        .required("Driver status is required.")
        .oneOf(
            DRIVER_STATUS_VALUES,
            "Invalid driver status."
        ),
});

export const driverAvailabilitySchema =
    yup.object({
        availability: yup
            .string()
            .trim()
            .required(
                "Driver availability is required."
            )
            .oneOf(
                DRIVER_AVAILABILITY_VALUES,
                "Invalid driver availability."
            ),
    });

export const DRIVER_STATUS_OPTIONS =
    DRIVER_STATUS_VALUES;

export const DRIVER_AVAILABILITY_OPTIONS =
    DRIVER_AVAILABILITY_VALUES;

export const DRIVER_LICENSE_TYPE_OPTIONS =
    DRIVER_LICENSE_TYPE_VALUES;

export default driverSchema;