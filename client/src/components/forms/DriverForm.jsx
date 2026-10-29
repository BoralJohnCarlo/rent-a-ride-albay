import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    ArrowRight,
    Check,
    Pencil,
} from "lucide-react";

import {
    DRIVER_LICENSE_TYPE_VALUES,
    DRIVER_LICENSE_CODE_VALUES,
} from "../../constants/driverConstants";

import Button from "../common/Button";
import DriverLicenseCodePicker from "../driver/DriverLicenseCodePicker";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";
import Checkbox from "../common/Checkbox";
import Input from "../common/Input";
import Select from "../common/Select";
import {
    REGIONS,
    getBarangays,
    getCities,
    getProvinces,
} from "../../data/philippineLocations";

import ReviewField from "../common/ReviewField";
import ReviewSection from "../common/ReviewSection";
import ReviewImageGallery from "../common/ReviewImageGallery";

import ImageUploadZone from "../shared/ImageUploadZone";

const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

const EMPTY_ERRORS = {};

const sanitizeName = (value) =>
    value.replace(/[^a-zA-ZÀ-ÿ' -]/g, "");

const sanitizePhoneNumber = (value) =>
    value.replace(/\D/g, "").slice(0, 11);

const sanitizeLicenseNumber = (value) =>
    value.replace(/[^a-zA-Z0-9-]/g, "");

const sanitizeTime = (value) =>
    value.replace(/[^0-9:]/g, "").slice(0, 5);

const STEP_VARIANTS = {
    initial: {
        opacity: 0,
        x: 20,
    },

    animate: {
        opacity: 1,
        x: 0,
    },

    exit: {
        opacity: 0,
        x: -20,
    },
};

const STEP_TRANSITION = {
    duration: 0.2,
    ease: "easeOut",
};

const FORM_STEPS = [
    {
        title: "Personal Information",
        description:
            "Basic driver identity and contact information.",
    },
    {
        title: "Address & Emergency",
        description:
            "Driver address and emergency contact information.",
    },
    {
        title: "Driver's License",
        description:
            "License information and driving restrictions.",
    },
    {
        title: "Schedule & Documents",
        description:
            "Working schedule and verification documents.",
    },
    {
        title: "Review",
        description:
            "Review the driver information before saving.",
    },
];

const createInitialState = () => ({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    alternativeContact: "",

    profileImage: [],

    address: {
        region: "",
        province: "",
        city: "",
        barangay: "",
        street: "",
    },

    license: {
        licenseNumber: "",
        licenseType: "",
        expiryDate: "",
        restrictionCodes: [],
    },

    uploadedDocuments: {
        driversLicense: [],
        governmentId: [],
        selfieVerification: [],
    },

    emergencyContact: {
        name: "",
        relationship: "",
        phoneNumber: "",
    },

    schedule: {
        workingDays: [],
        startTime: "",
        endTime: "",
        timezone: "Asia/Manila",
    },
    pricing: { dailyRate: "" },
});

const createImageObject = (
    value,
    name = "Existing Image"
) => {
    if (!value) {
        return [];
    }

    if (typeof value === "string") {
        return [
            {
                id: value,
                url: value,
                preview: value,
                originalName: name,
                isPrimary: true,
            },
        ];
    }

    if (Array.isArray(value)) {
        return value;
    }

    return [];
};

const getInitialState = (driver) => {
    if (!driver) {
        return createInitialState();
    }

    return {
        firstName:
            driver.firstName ?? "",

        lastName:
            driver.lastName ?? "",

        email:
            driver.email ?? "",

        phoneNumber:
            driver.phoneNumber ?? "",

        alternativeContact:
            driver.alternativeContact ?? "",

        profileImage:
            createImageObject(
                driver.profileImage,
                "Profile Image"
            ),

        address: {
            region:
                driver.address?.region ||
                findRegionForProvince(
                    driver.address?.province
                ),

            province:
                driver.address?.province ??
                "",

            city:
                driver.address?.city ??
                "",

            barangay:
                driver.address?.barangay ??
                "",

            street:
                driver.address?.street ??
                "",
        },

        license: {
            licenseNumber:
                driver.license
                    ?.licenseNumber ?? "",

            licenseType:
                driver.license?.licenseType ??
                "",

            expiryDate:
                driver.license?.expiryDate
                    ? new Date(
                          driver.license.expiryDate
                      )
                          .toISOString()
                          .slice(0, 10)
                    : "",

            restrictionCodes:
                Array.isArray(
                driver.license?.restrictionCodes
            )
                ? driver.license.restrictionCodes
            : [],
            },

        uploadedDocuments: {
            driversLicense:
                createImageObject(
                    driver.uploadedDocuments
                        ?.driversLicense,
                    "Driver's License"
                ),

            governmentId:
                createImageObject(
                    driver.uploadedDocuments
                        ?.governmentId,
                    "Government ID"
                ),

            selfieVerification:
                createImageObject(
                    driver.uploadedDocuments
                        ?.selfieVerification,
                    "Selfie Verification"
                ),
        },

        emergencyContact: {
            name:
                driver.emergencyContact
                    ?.name ?? "",

            relationship:
                driver.emergencyContact
                    ?.relationship ?? "",

            phoneNumber:
                driver.emergencyContact
                    ?.phoneNumber ?? "",
        },

        schedule: {
            workingDays:
                driver.schedule
                    ?.workingDays ?? [],

            startTime:
                driver.schedule
                    ?.startTime ?? "",

            endTime:
                driver.schedule
                    ?.endTime ?? "",

            timezone:
                driver.schedule
                    ?.timezone ??
                "Asia/Manila",
        },
        pricing: { dailyRate: driver.pricing?.dailyRate ?? "" },
    };
};

const createOptions = (values) =>
    values.map((value) => ({
        label: value,
        value,
    }));

const getImageValue = (images) => {
    if (!Array.isArray(images) || !images.length) {
        return "";
    }

    const primary =
        images.find(
            (image) => image?.isPrimary
        ) ?? images[0];

    if (typeof primary === "string") {
        return primary;
    }

    return (
        primary?.url ??
        ""
    );
};

const getImageReviewValue = (
    images
) => {
    if (!Array.isArray(images)) {
        return [];
    }

    return images;
};

const formatDate = (value) => {
    if (!value) {
        return "Not set";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "long",
            day: "numeric",
        }
    );
};

const getDriverFullName = (
    driver
) =>
    [
        driver?.firstName,
        driver?.lastName,
    ]
        .filter(Boolean)
        .join(" ") ||
    "Driver";

/* Drivers saved before the address dropdowns have no region: find the one
   that contains their province so the dropdowns can pre-fill. */
const findRegionForProvince = (province) =>
    (province &&
        REGIONS.find((region) =>
            getProvinces(region).includes(province)
        )) ||
    "";

const toOptions = (values) =>
    values.map((value) => ({ value, label: value }));

const DriverForm = ({
    mode = "create",
    driver = null,
    loading = false,
    errors = EMPTY_ERRORS,
    onSubmit,
    onCancel,
}) => {
    const isViewMode =
        mode === "view";

    const isEditMode =
        mode === "edit";

    const [
        formData,
        setFormData,
    ] = useState(() =>
        getInitialState(driver)
    );

    const [
        currentStep,
        setCurrentStep,
    ] = useState(0);

    const [
        validationErrors,
        setValidationErrors,
    ] = useState({});

    const fieldRefs = useRef({});

    useEffect(() => {
        setFormData(
            getInitialState(driver)
        );

        setCurrentStep(0);

        setValidationErrors({});
    }, [driver, mode]);

    // The form lives in a Modal body, so scrolling `window` did nothing —
    // reset the real scroll container on every step change.
    const stepTopRef =
        useScrollTopOnChange(currentStep);

    const disabled =
        loading || isViewMode;

    const getFieldError = (
        path
    ) =>
        validationErrors?.[path] ||
        errors?.[path] ||
        "";

    const updateField = (
        field,
        value
    ) => {
        setFormData(
            (previous) => ({
                ...previous,
                [field]: value,
            })
        );

        setValidationErrors(
            (previous) => {
                const next = {
                    ...previous,
                };

                delete next[field];

                return next;
            }
        );
    };

    const ADDRESS_RESETS = {
        region: ["province", "city", "barangay"],
        province: ["city", "barangay"],
        city: ["barangay"],
    };

    const updateAddressField = (field, value) => {
        updateNestedField("address", field, value);

        for (const child of ADDRESS_RESETS[field] ?? []) {
            updateNestedField("address", child, "");
        }
    };

    const updateNestedField = (
        section,
        field,
        value
    ) => {
        setFormData(
            (previous) => ({
                ...previous,
                [section]: {
                    ...previous[section],
                    [field]: value,
                },
            })
        );

        setValidationErrors(
            (previous) => {
                const next = {
                    ...previous,
                };

                delete next[
                    `${section}.${field}`
                ];

                return next;
            }
        );
    };

    const handleImageChange = (
        field,
        images
    ) => {
        if (field === "profileImage") {
            updateField(
                field,
                images
            );

            return;
        }

        updateNestedField(
            "uploadedDocuments",
            field,
            images
        );
    };

    const toggleWorkingDay = (
        day
    ) => {
        setFormData(
            (previous) => {
                const currentDays =
                    previous.schedule
                        .workingDays ?? [];

                const exists =
                    currentDays.includes(
                        day
                    );

                return {
                    ...previous,

                    schedule: {
                        ...previous.schedule,

                        workingDays:
                            exists
                                ? currentDays.filter(
                                      (
                                          item
                                      ) =>
                                          item !==
                                          day
                                  )
                                : [
                                      ...currentDays,
                                      day,
                                  ],
                    },
                };
            }
        );

        setValidationErrors(
            (previous) => {
                const next = {
                    ...previous,
                };

                delete next[
                    "schedule.workingDays"
                ];

                return next;
            }
        );
    };

    const getStepForField = (field) => {
    if (
        field === "firstName" ||
        field === "lastName" ||
        field === "email" ||
        field === "phoneNumber" ||
        field === "alternativeContact"
    ) {
        return 0;
    }

    if (
        field.startsWith("address.") ||
        field.startsWith("emergencyContact.")
    ) {
        return 1;
    }

    if (field.startsWith("license.")) {
        return 2;
    }

    if (
        field.startsWith("schedule.") ||
        field.startsWith("uploadedDocuments.")
    ) {
        return 3;
    }

    return currentStep;
};

const goToFirstError = (
    validationErrors
) => {
    const firstErrorField =
        Object.keys(validationErrors)[0];

    if (!firstErrorField) {
        return;
    }

    const errorStep =
        getStepForField(
            firstErrorField
        );

    if (errorStep !== currentStep) {
        setCurrentStep(errorStep);
    }

    setTimeout(() => {
        const field =
            fieldRefs.current[
                firstErrorField
            ];

        if (!field) {
            return;
        }

        field.focus();

        field.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }, 100);
};


    const validateStep = (
    stepToValidate = currentStep
    ) => {
        const nextErrors = {};

        if (stepToValidate === 0) {
            if (
                !formData.firstName.trim()
            ) {
                nextErrors.firstName =
                    "First name is required.";
            }

            if (
                !formData.lastName.trim()
            ) {
                nextErrors.lastName =
                    "Last name is required.";
            }

            if (
                !formData.email.trim()
            ) {
                nextErrors.email =
                    "Email is required.";
            } else if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    formData.email
                )
            ) {
                nextErrors.email =
                    "Please provide a valid email address.";
            }

            if (
            !formData.phoneNumber.trim()
        ) {
            nextErrors.phoneNumber =
            "Phone number is required.";
        } else if (
            !/^09\d{9}$/.test(
            formData.phoneNumber
            )
        ) {
            nextErrors.phoneNumber =
                "Please provide a valid 11-digit Philippine mobile number.";
        }
                }

        if (stepToValidate === 1) {
            if (
                formData.emergencyContact.phoneNumber &&
                !/^09\d{9}$/.test(
                    formData.emergencyContact.phoneNumber
                )
            ) {
                nextErrors[
                    "emergencyContact.phoneNumber"
                ] =
                    "Please provide a valid 11-digit Philippine mobile number.";
            }
        }

        if (stepToValidate === 2) {
            if (
                !formData.license
                    .licenseNumber
                    .trim()
            ) {
                nextErrors[
                    "license.licenseNumber"
                ] =
                    "Driver's license number is required.";
            }

            if (
                !formData.license
                    .licenseType
            ) {
                nextErrors[
                    "license.licenseType"
                ] =
                    "Driver's license type is required.";
            }

            if (
                !formData.license
                    .expiryDate
            ) {
                nextErrors[
                    "license.expiryDate"
                ] =
                    "Driver's license expiry date is required.";
            } else {
                const expiry =
                    new Date(
                        formData.license
                            .expiryDate
                    );

                const today =
                    new Date();

                today.setHours(
                    0,
                    0,
                    0,
                    0
                );

                if (
                    expiry <= today
                ) {
                    nextErrors[
                        "license.expiryDate"
                    ] =
                        "Driver's license must not be expired.";
                }
            }

            const invalidRestrictionCodes =
                formData.license.restrictionCodes.filter(
                    (code) =>
                        !DRIVER_LICENSE_CODE_VALUES.includes(
                            code
                        )
                );

            if (
                invalidRestrictionCodes.length
            ) {
                nextErrors[
                    "license.restrictionCodes"
                ] =
                    "One or more driver's license codes are invalid.";
            }
        }

                if (stepToValidate === 3) {
            const startTime =
                formData.schedule.startTime;

            const endTime =
                formData.schedule.endTime;

            if (
                startTime &&
                endTime &&
                startTime === endTime
            ) {
                nextErrors[
                    "schedule.endTime"
                ] =
                    "End time must be different from start time.";
            }

            if (
                startTime &&
                endTime &&
                endTime <= startTime
            ) {
                nextErrors[
                    "schedule.endTime"
                ] =
                    "End time must be later than start time.";
            }
        }

        setValidationErrors(
    nextErrors
);

if (
    Object.keys(nextErrors).length > 0
) {
    goToFirstError(nextErrors);
}

return (
    Object.keys(
        nextErrors
    ).length === 0
    );
};

    const validateAllSteps = () => {
    for (let step = 0; step <= 3; step++) {
        if (!validateStep(step)) {
            return false;
        }
    }

    return true;
};

    const handleNext = () => {
        if (
            !validateStep()
        ) {
            return;
        }

        setCurrentStep(
            (previous) =>
                Math.min(
                    previous + 1,
                    FORM_STEPS.length -
                        1
                )
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const handlePrevious = () => {
        setCurrentStep(
            (previous) =>
                Math.max(
                    previous - 1,
                    0
                )
        );

        setValidationErrors(
            {}
        );

        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const buildPayload = () => ({
        firstName:
            formData.firstName.trim(),

        lastName:
            formData.lastName.trim(),

        email:
            formData.email.trim(),

        phoneNumber:
            formData.phoneNumber.trim(),

        alternativeContact:
            formData.alternativeContact.trim(),

        profileImage:
            getImageValue(
                formData.profileImage
            ),

        address: {
            region:
                formData.address.region.trim(),

            province:
                formData.address.province.trim(),

            city:
                formData.address.city.trim(),

            barangay:
                formData.address.barangay.trim(),

            street:
                formData.address.street.trim(),
        },

        license: {
            licenseNumber:
                formData.license
                    .licenseNumber.trim(),

            licenseType:
                formData.license
                    .licenseType,

            expiryDate:
                formData.license
                    .expiryDate,

            restrictionCodes:
                formData.license
                    .restrictionCodes,
                },

        uploadedDocuments: {
            driversLicense:
                getImageValue(
                    formData
                        .uploadedDocuments
                        .driversLicense
                ),

            governmentId:
                getImageValue(
                    formData
                        .uploadedDocuments
                        .governmentId
                ),

            selfieVerification:
                getImageValue(
                    formData
                        .uploadedDocuments
                        .selfieVerification
                ),
        },

        emergencyContact: {
            name:
                formData
                    .emergencyContact
                    .name.trim(),

            relationship:
                formData
                    .emergencyContact
                    .relationship.trim(),

            phoneNumber:
                formData
                    .emergencyContact
                    .phoneNumber.trim(),
        },

        schedule: {
            workingDays:
                formData.schedule
                    .workingDays,

            startTime:
                formData.schedule
                    .startTime,

            endTime:
                formData.schedule
                    .endTime,

            timezone: "Asia/Manila",
        },
        pricing: {
            dailyRate: formData.pricing?.dailyRate === ""
                ? null
                : Number(formData.pricing?.dailyRate) || null,
        },
    });

    const handleSubmit = (
        event
    ) => {
        event.preventDefault();

        if (isViewMode) {
            return;
        }

        if (!validateAllSteps()) {
            return;
        }

        onSubmit?.(
            buildPayload()
        );
    };

    const progress =
        ((currentStep + 1) /
            FORM_STEPS.length) *
        100;

    const licenseTypeOptions =
        useMemo(
            () =>
                createOptions(
                    DRIVER_LICENSE_TYPE_VALUES
                ),
            []
        );

    return (
        <form
            ref={stepTopRef}
            onSubmit={
                handleSubmit
            }
            className="space-y-6"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Step{" "}
                            {currentStep +
                                1}{" "}
                            of{" "}
                            {
                                FORM_STEPS.length
                            }
                        </p>

                        <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {
                                FORM_STEPS[
                                    currentStep
                                ]
                                    .title
                            }
                        </h2>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {
                                FORM_STEPS[
                                    currentStep
                                ]
                                    .description
                            }
                        </p>
                    </div>

                    <div className="hidden shrink-0 text-right sm:block">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {Math.round(
                                progress
                            )}
                            %
                        </span>
                    </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <motion.div
                        className="h-full rounded-full bg-gray-900 dark:bg-white"
                        initial={{
                            width: 0,
                        }}
                        animate={{
                            width: `${progress}%`,
                        }}
                        transition={{
                            duration: 0.25,
                            ease: "easeOut",
                        }}
                    />
                </div>

                <div className="hidden gap-2 md:flex">
                    {FORM_STEPS.map(
                        (
                            step,
                            index
                        ) => {
                            const completed =
                                index <
                                currentStep;

                            const active =
                                index ===
                                currentStep;

                            return (
                                <button
                                    key={
                                        step.title
                                    }
                                    type="button"
                                    disabled={
                                        loading
                                    }
                                    onClick={() => {
                                        if (
                                            index <
                                            currentStep
                                        ) {
                                            setCurrentStep(
                                                index
                                            );
                                            setValidationErrors(
                                                {}
                                            );
                                        }
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                >
                                    <span
                                        className={[
                                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                                            completed ||
                                            active
                                                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                                        ].join(
                                            " "
                                        )}
                                    >
                                        {completed ? (
                                            <Check
                                                size={
                                                    14
                                                }
                                            />
                                        ) : (
                                            index +
                                            1
                                        )}
                                    </span>

                                    <span
                                        className={[
                                            "hidden truncate text-xs font-medium lg:block",
                                            active
                                                ? "text-gray-900 dark:text-gray-100"
                                                : "text-gray-500 dark:text-gray-400",
                                        ].join(
                                            " "
                                        )}
                                    >
                                        {
                                            step.title
                                        }
                                    </span>
                                </button>
                            );
                        }
                    )}
                </div>
            </div>

            <div className="overflow-hidden">
                <AnimatePresence
                    mode="wait"
                >
                    <motion.div
                        key={
                            currentStep
                        }
                        variants={
                            STEP_VARIANTS
                        }
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={
                            STEP_TRANSITION
                        }
                    >
                        {currentStep ===
                            0 && (
                            <div className="space-y-6">
                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Personal Information
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Enter the driver's basic identity and contact information.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <Input
                                            label="First Name"
                                            value={
                                                formData.firstName
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                "firstName",
                                                sanitizeName(event.target.value)
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "firstName"
                                            )}
                                        />

                                        <Input
                                            label="Last Name"
                                            value={
                                                formData.lastName
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                "lastName",
                                                sanitizeName(event.target.value)
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "lastName"
                                            )}
                                        />

                                        <Input
                                            label="Email"
                                            type="email"
                                            value={
                                                formData.email
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateField(
                                                    "email",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "email"
                                            )}
                                        />

                                        <Input
                                            label="Phone Number"
                                            value={
                                                formData.phoneNumber
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                "phoneNumber",
                                                sanitizePhoneNumber(
                                                event.target.value
                                                    )
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "phoneNumber"
                                            )}
                                            ref={(element) => {
                                                fieldRefs.current.phoneNumber =
                                                    element;
                                            }}
                                        />
                                        

                                        <Input
                                            label="Alternative Contact"
                                            value={
                                                formData.alternativeContact
                                            }
                                            onChange={(event) =>
                                                updateField(
                                                "alternativeContact",
                                                sanitizePhoneNumber(
                                                event.target.value
                                                    )
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />
                                    </div>
                                </section>

                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Profile Image
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Upload a profile image for the driver.
                                        </p>
                                    </div>

                                    <ImageUploadZone
                                        title="Driver Profile Image"
                                        helperText="Upload one profile image."
                                        images={
                                            formData.profileImage
                                        }
                                        onChange={(
                                            images
                                        ) =>
                                            handleImageChange(
                                                "profileImage",
                                                images
                                            )
                                        }
                                        maxFiles={
                                            1
                                        }
                                        canSetPrimary={
                                            false
                                        }
                                        disabled={
                                            disabled
                                        }
                                    />
                                </section>
                            </div>
                        )}

                        {currentStep ===
                            1 && (
                            <div className="space-y-6">
                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Address
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Driver residential and contact address.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <Select
                                            label="Region"
                                            value={formData.address.region}
                                            onChange={(event) =>
                                                updateAddressField(
                                                    "region",
                                                    event.target.value
                                                )
                                            }
                                            options={toOptions(REGIONS)}
                                            placeholder="Select region"
                                            disabled={disabled}
                                        />

                                        <Select
                                            label="Province"
                                            value={formData.address.province}
                                            onChange={(event) =>
                                                updateAddressField(
                                                    "province",
                                                    event.target.value
                                                )
                                            }
                                            options={toOptions(
                                                getProvinces(
                                                    formData.address.region
                                                )
                                            )}
                                            placeholder="Select province"
                                            disabled={
                                                disabled ||
                                                !formData.address.region
                                            }
                                        />

                                        <Select
                                            label="City / Municipality"
                                            value={formData.address.city}
                                            onChange={(event) =>
                                                updateAddressField(
                                                    "city",
                                                    event.target.value
                                                )
                                            }
                                            options={toOptions(
                                                getCities(
                                                    formData.address.region,
                                                    formData.address.province
                                                )
                                            )}
                                            placeholder="Select city / municipality"
                                            disabled={
                                                disabled ||
                                                !formData.address.province
                                            }
                                        />

                                        <Select
                                            label="Barangay"
                                            value={formData.address.barangay}
                                            onChange={(event) =>
                                                updateAddressField(
                                                    "barangay",
                                                    event.target.value
                                                )
                                            }
                                            options={toOptions(
                                                getBarangays(
                                                    formData.address.region,
                                                    formData.address.province,
                                                    formData.address.city
                                                )
                                            )}
                                            placeholder="Select barangay"
                                            disabled={
                                                disabled ||
                                                !formData.address.city
                                            }
                                        />

                                        <Input
                                            label="Street"
                                            value={
                                                formData.address.street
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateNestedField(
                                                    "address",
                                                    "street",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />
                                    </div>
                                </section>

                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Emergency Contact
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Optional emergency contact information.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <Input
                                            label="Name"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .name
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateNestedField(
                                                    "emergencyContact",
                                                    "name",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />

                                        <Input
                                            label="Relationship"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .relationship
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateNestedField(
                                                    "emergencyContact",
                                                    "relationship",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />

                                        <Input
                                            label="Phone Number"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .phoneNumber
                                            }
                                            onChange={(event) =>
                                                updateNestedField(
                                                "emergencyContact",
                                                "phoneNumber",
                                                sanitizePhoneNumber(
                                                event.target.value
                                                    )
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />
                                    </div>
                                </section>
                            </div>
                        )}

                        {currentStep ===
                            2 && (
                            <div className="space-y-6">
                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Driver's License
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Provide the driver's current license information.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <Input
                                            label="License Number"
                                            value={
                                                formData.license
                                                    .licenseNumber
                                            }
                                            onChange={(event) =>
                                                updateNestedField(
                                                "license",
                                                "licenseNumber",
                                                sanitizeLicenseNumber(
                                                event.target.value
                                                    )
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "license.licenseNumber"
                                            )}
                                        />

                                        <Select
                                            label="License Type"
                                            value={
                                                formData.license
                                                    .licenseType
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateNestedField(
                                                    "license",
                                                    "licenseType",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            options={
                                                licenseTypeOptions
                                            }
                                            placeholder="Select license type"
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "license.licenseType"
                                            )}
                                        />

                                        <Input
                                            label="Expiry Date"
                                            type="date"
                                            value={
                                                formData.license
                                                    .expiryDate
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                updateNestedField(
                                                    "license",
                                                    "expiryDate",
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            required
                                            disabled={
                                                disabled
                                            }
                                            error={getFieldError(
                                                "license.expiryDate"
                                            )}
                                            ref={(element) => {
                                                fieldRefs.current[
                                                    "license.expiryDate"
                                                        ] = element;
                                            }}
                                        />

                                        <div className="md:col-span-2">
                                            <DriverLicenseCodePicker
                                                value={formData.license.restrictionCodes}
                                                onChange={(codes) => updateNestedField("license", "restrictionCodes", codes)}
                                                disabled={disabled}
                                                error={getFieldError("license.restrictionCodes")}
                                            />
                                        </div>

                                    </div>
                                </section>
                            </div>
                        )}

                        {currentStep ===
                            3 && (
                            <div className="space-y-6">
                                <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Driver Schedule
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Select the days and normal working hours for this driver.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {DAYS.map(
                                            (
                                                day
                                            ) => (
                                                <Checkbox
                                                    key={
                                                        day
                                                    }
                                                    id={`driver-day-${day}`}
                                                    name={`workingDay-${day}`}
                                                    label={
                                                        day
                                                    }
                                                    checked={formData.schedule.workingDays.includes(
                                                        day
                                                    )}
                                                    onChange={() =>
                                                        toggleWorkingDay(
                                                            day
                                                        )
                                                    }
                                                    disabled={
                                                        disabled
                                                    }
                                                />
                                            )
                                        )}
                                    </div>

                                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                                        <Input
                                            label="Start Time"
                                            type="time"
                                            value={
                                                formData.schedule.startTime
                                            }
                                            onChange={(event) =>
                                                updateNestedField(
                                                "schedule",
                                                "startTime",
                                                sanitizeTime(event.target.value)
                                                )
                                            }
                                            disabled={
                                                disabled
                                            }
                                            ref={(element) => {
                                                fieldRefs.current[
                                                    "schedule.startTime"
                                                        ] = element;
                                            }}
                                        />

                                        <Input
                                            label="End Time"
                                            type="time"
                                            value={
                                                formData.schedule.endTime
                                            }
                                            onChange={(event) =>
                                                updateNestedField(
                                                "schedule",
                                                "endTime",
                                                sanitizeTime(event.target.value)
                                                )
                                            }
                                                disabled={
                                                    disabled
                                            }
                                                error={getFieldError(
                                            "schedule.endTime"
                                            )}
                                            ref={(element) => {
                                                fieldRefs.current[
                                                    "schedule.endTime"
                                                        ] = element;
                                            }}
                                        />

                                        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Timezone
                                                </p>
                                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                    Asia/Manila
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 max-w-sm">
                                        <Input
                                            label="Individual daily rate (PHP)"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formData.pricing?.dailyRate ?? ""}
                                            onChange={(event) =>
                                                setFormData((previous) => ({
                                                    ...previous,
                                                    pricing: { dailyRate: event.target.value },
                                                }))
                                            }
                                            disabled={disabled}
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Leave blank to use the global driver rate when individual pricing is enabled.
                                        </p>
                                    </div>
                                </section>

                                <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                            Verification Documents
                                        </h3>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Upload the driver's verification documents.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <ImageUploadZone
                                            title="Driver's License"
                                            helperText="Upload an image of the driver's license."
                                            images={
                                                formData
                                                    .uploadedDocuments
                                                    .driversLicense
                                            }
                                            onChange={(
                                                images
                                            ) =>
                                                handleImageChange(
                                                    "driversLicense",
                                                    images
                                                )
                                            }
                                            maxFiles={
                                                1
                                            }
                                            canSetPrimary={
                                                false
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />

                                        <ImageUploadZone
                                            title="Government ID"
                                            helperText="Upload an image of a valid government-issued ID."
                                            images={
                                                formData
                                                    .uploadedDocuments
                                                    .governmentId
                                            }
                                            onChange={(
                                                images
                                            ) =>
                                                handleImageChange(
                                                    "governmentId",
                                                    images
                                                )
                                            }
                                            maxFiles={
                                                1
                                            }
                                            canSetPrimary={
                                                false
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />

                                        <ImageUploadZone
                                            title="Selfie Verification"
                                            helperText="Upload the driver's verification selfie."
                                            images={
                                                formData
                                                    .uploadedDocuments
                                                    .selfieVerification
                                            }
                                            onChange={(
                                                images
                                            ) =>
                                                handleImageChange(
                                                    "selfieVerification",
                                                    images
                                                )
                                            }
                                            maxFiles={
                                                1
                                            }
                                            canSetPrimary={
                                                false
                                            }
                                            disabled={
                                                disabled
                                            }
                                        />
                                    </div>
                                </section>
                            </div>
                        )}

                        {currentStep ===
                            4 && (
                            <div className="space-y-6">
                                <ReviewSection
                                    title="Personal Information"
                                    onEdit={() =>
                                        setCurrentStep(
                                            0
                                        )
                                    }
                                >
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <ReviewField
                                            label="First Name"
                                            value={
                                                formData.firstName
                                            }
                                        />

                                        <ReviewField
                                            label="Last Name"
                                            value={
                                                formData.lastName
                                            }
                                        />

                                        <ReviewField
                                            label="Email"
                                            value={
                                                formData.email
                                            }
                                        />

                                        <ReviewField
                                            label="Phone Number"
                                            value={
                                                formData.phoneNumber
                                            }
                                        />

                                        <ReviewField
                                            label="Alternative Contact"
                                            value={
                                                formData.alternativeContact
                                            }
                                        />
                                    </div>

                                    <div className="mt-6">
                                        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Profile Image
                                        </p>

                                        <ReviewImageGallery
                                            images={getImageReviewValue(
                                                formData.profileImage
                                            )}
                                        />
                                    </div>
                                </ReviewSection>

                                <ReviewSection
                                    title="Address & Emergency Contact"
                                    onEdit={() =>
                                        setCurrentStep(
                                            1
                                        )
                                    }
                                >
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <ReviewField
                                            label="Region"
                                            value={
                                                formData.address.region
                                            }
                                        />

                                        <ReviewField
                                            label="Province"
                                            value={
                                                formData.address.province
                                            }
                                        />

                                        <ReviewField
                                            label="City / Municipality"
                                            value={
                                                formData.address.city
                                            }
                                        />

                                        <ReviewField
                                            label="Barangay"
                                            value={
                                                formData.address.barangay
                                            }
                                        />

                                        <ReviewField
                                            label="Street"
                                            value={
                                                formData.address.street
                                            }
                                        />

                                        <ReviewField
                                            label="Emergency Contact"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .name
                                            }
                                        />

                                        <ReviewField
                                            label="Relationship"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .relationship
                                            }
                                        />

                                        <ReviewField
                                            label="Emergency Phone"
                                            value={
                                                formData
                                                    .emergencyContact
                                                    .phoneNumber
                                            }
                                        />
                                    </div>
                                </ReviewSection>

                                <ReviewSection
                                    title="Driver's License"
                                    onEdit={() =>
                                        setCurrentStep(
                                            2
                                        )
                                    }
                                >
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <ReviewField
                                            label="License Number"
                                            value={
                                                formData
                                                    .license
                                                    .licenseNumber
                                            }
                                        />

                                        <ReviewField
                                            label="License Type"
                                            value={
                                                formData
                                                    .license
                                                    .licenseType
                                            }
                                        />

                                        <ReviewField
                                            label="Expiry Date"
                                            value={formatDate(
                                                formData
                                                    .license
                                                    .expiryDate
                                            )}
                                        />

                                        <ReviewField
                                            label="Driver's License Codes"
                                            value={
                                                formData.license
                                                    .restrictionCodes
                                                    .length
                                            ? formData.license.restrictionCodes.join(
                                                ", "
                                            )
                                                    : "None"
                                            }
                                        />
                                    </div>
                                </ReviewSection>

                                <ReviewSection
                                    title="Schedule & Documents"
                                    onEdit={() =>
                                        setCurrentStep(
                                            3
                                        )
                                    }
                                >
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <ReviewField
                                            label="Working Days"
                                            value={
                                                formData
                                                    .schedule
                                                    .workingDays
                                                    .length
                                                    ? formData.schedule.workingDays.join(
                                                          ", "
                                                      )
                                                    : "Not set"
                                            }
                                        />

                                        <ReviewField
                                            label="Working Hours"
                                            value={
                                                formData
                                                    .schedule
                                                    .startTime &&
                                                formData
                                                    .schedule
                                                    .endTime
                                                    ? `${formData.schedule.startTime} – ${formData.schedule.endTime}`
                                                    : "Not set"
                                            }
                                        />

                                        <ReviewField
                                            label="Timezone"
                                            value={
                                                formData
                                                    .schedule
                                                    .timezone
                                            }
                                        />
                                    </div>

                                    <div className="mt-6 space-y-6">
                                        <div>
                                            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Driver's License Document
                                            </p>

                                            <ReviewImageGallery
                                                images={getImageReviewValue(
                                                    formData
                                                        .uploadedDocuments
                                                        .driversLicense
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Government ID
                                            </p>

                                            <ReviewImageGallery
                                                images={getImageReviewValue(
                                                    formData
                                                        .uploadedDocuments
                                                        .governmentId
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Selfie Verification
                                            </p>

                                            <ReviewImageGallery
                                                images={getImageReviewValue(
                                                    formData
                                                        .uploadedDocuments
                                                        .selfieVerification
                                                )}
                                            />
                                        </div>
                                    </div>
                                </ReviewSection>

                                {isEditMode && (
                                    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                                        <Pencil
                                            size={
                                                18
                                            }
                                            className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                                        />

                                        <div>
                                            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                                Editing Driver
                                            </p>

                                            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                                                {
                                                    getDriverFullName(
                                                        driver
                                                    )
                                                }
                                                's driver information will be updated when you save the changes.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
                <div>
                    {currentStep ===
                    0 ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                onCancel
                            }
                            disabled={   
                                loading
                            }
                        >
                            {isViewMode
                                ? "Close"
                                : "Cancel"}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={
                                handlePrevious
                            }
                            disabled={
                                loading
                            }
                        >
                            <span className="inline-flex items-center gap-2">
                                <ArrowLeft
                                    size={
                                        16
                                    }
                                />
                                Previous
                            </span>
                        </Button>
                    )}
                </div>

                <div>
                    {currentStep ===
                    FORM_STEPS.length -
                        1 ? (
                        isViewMode ? (
                            <Button
                                type="button"
                                onClick={
                                    onCancel
                                }
                                disabled={
                                    loading
                                }
                            >
                                Close
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                loading={
                                    loading
                                }
                            >
                                {isEditMode
                                    ? "Update Driver"
                                    : "Create Driver"}
                            </Button>
                        )
                    ) : (
                        <Button
                            type="button"
                            onClick={
                                handleNext
                            }
                            disabled={
                                loading
                            }
                        >
                            <span className="inline-flex items-center gap-2">
                                Next
                                <ArrowRight
                                    size={
                                        16
                                    }
                                />
                            </span>
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
};

export default DriverForm;
