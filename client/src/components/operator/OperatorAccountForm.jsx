import {
    User,
    Mail,
    Phone,
    Image as ImageIcon,
} from "lucide-react";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import Button from "../common/Button";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";
import Input from "../common/Input";
import ImageUploadZone from "../shared/ImageUploadZone";

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
        title: "Partner Account",
        description:
            "Create the partner login account.",
    },
    {
        title: "Profile",
        description:
            "Contact information and profile image.",
    },
    {
        title: "Review",
        description:
            "Review everything before continuing.",
    },
];

const createInitialState = () => ({
    firstName: "",
    lastName: "",

    email: "",

    password: "",
    confirmPassword: "",

    phoneNumber: "",
    alternativeContact: "",

    profileImage: [],
});

const OperatorAccountForm = ({
    mode = "create",
    operator = null,
    loading = false,
    errors = {},
    onSubmit,
    onCancel,
    onNext,
}) => {
    const isCreateMode =
    mode === "create";

const isEditMode =
    mode === "edit";

const isViewMode =
    mode === "view";

const isWizardMode =
    mode === "wizard";

const isDisabled =
    loading || isViewMode;

    const [formData, setFormData] =
    useState(createInitialState());

const [currentStep, setCurrentStep] =
    useState(0);

const stepTopRef =
    useScrollTopOnChange(currentStep);

const [validationErrors, setValidationErrors] =
    useState({});

const [backendErrors, setBackendErrors] =
    useState({});

    useEffect(() => {
    if (!errors) {
        setBackendErrors({});
        return;
    }

    setBackendErrors(errors);
}, [errors]);

useEffect(() => {
    if (
        isCreateMode ||
        !operator
    ) {
        setFormData(
            createInitialState()
        );

        setCurrentStep(0);
        setValidationErrors({});
        setBackendErrors({});

        return;
    }

    setFormData({
        firstName:
            operator.firstName ?? "",

        lastName:
            operator.lastName ?? "",

        email:
            operator.email ?? "",

        password: "",

        confirmPassword: "",

        phoneNumber:
            operator.phoneNumber ?? "",

        alternativeContact:
            operator.alternativeContact ??
            "",

        profileImage:
            operator.profileImage
                ? [operator.profileImage]
                : [],
    });

    setCurrentStep(0);

    setValidationErrors({});

    setBackendErrors({});

}, [
    operator,
    isCreateMode,
]);

    const getFieldError = (path) =>
    validationErrors?.[path] ||
    backendErrors?.[path] ||
    "";

    const firstNameRef =
    useRef(null);

const lastNameRef =
    useRef(null);

const emailRef =
    useRef(null);

const passwordRef =
    useRef(null);

const confirmPasswordRef =
    useRef(null);

const phoneNumberRef =
    useRef(null);

const updateField = (
    field,
    value
) => {
    setFormData((previous) => ({
        ...previous,
        [field]: value,
    }));

    setValidationErrors(
        (previous) => {
            if (!previous[field]) {
                return previous;
            }

            const next = {
                ...previous,
            };

            delete next[field];

            return next;
        }
    );

    setBackendErrors(
        (previous) => {
            if (!previous[field]) {
                return previous;
            }

            const next = {
                ...previous,
            };

            delete next[field];

            return next;
        }
    );
};

const buildPayload = () => ({
    firstName:
        formData.firstName.trim(),

    lastName:
        formData.lastName.trim(),

    email:
        formData.email
            .trim()
            .toLowerCase(),

    password:
        formData.password,

    phoneNumber:
        formData.phoneNumber.trim(),

    alternativeContact:
        formData.alternativeContact.trim(),

    profileImage:
        formData.profileImage,
});

const validateStep = () => {
    const errors = {};

    if (
        currentStep === 0
    ) {
        if (!formData.firstName.trim()) {
    errors.firstName =
        "First name is required.";
}

if (!formData.lastName.trim()) {
    errors.lastName =
        "Last name is required.";
}

if (!formData.email.trim()) {
    errors.email =
        "Email is required.";
} else if (
    !/\S+@\S+\.\S+/.test(
        formData.email
    )
) {
    errors.email =
        "Invalid email address.";
}

if (
    isCreateMode &&
    !formData.password
) {
    errors.password =
        "Password is required.";
}

if (
    isCreateMode &&
    formData.password.length < 8
) {
    errors.password =
        "Password must be at least 8 characters.";
}

if (
    isCreateMode &&
    formData.password !==
        formData.confirmPassword
) {
    errors.confirmPassword =
        "Passwords do not match.";
}
    }

    if (
        currentStep === 1
    ) {
        if (
            !formData.phoneNumber.trim()
        ) {
            errors.phoneNumber =
                "Phone number is required.";
        }
    }

    setValidationErrors(
        errors
    );

    return (
        Object.keys(errors)
            .length === 0
    );
};

const handleNext = () => {

    if (!validateStep()) {
        return;
    }

    setCurrentStep(
        (previous) =>
            previous + 1
    );
};

const handlePrevious =
    () => {
        setCurrentStep(
            (previous) =>
                previous - 1
        );
    };

const handleSubmit = (event) => {
    event.preventDefault();

    const payload =
        buildPayload();

    if (isWizardMode) {
        onNext?.(payload);
        return;
    }

    onSubmit?.(payload);
};

    const progress =
    ((currentStep + 1) /
        FORM_STEPS.length) *
    100;

    return (
    <form
    ref={stepTopRef}
    className="space-y-6"
    onSubmit={handleSubmit}
>
        <div className="space-y-4">

    <div>

        <div className="flex items-center justify-between">

            <div>

                <h2 className="text-xl font-semibold text-gray-900">
                    {
                        FORM_STEPS[
                            currentStep
                        ].title
                    }
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    {
                        FORM_STEPS[
                            currentStep
                        ].description
                    }
                </p>

            </div>

            <span className="text-sm font-medium text-gray-500">
                Step {currentStep + 1} of{" "}
                {
                    FORM_STEPS.length
                }
            </span>

        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">

            <motion.div
                className="h-full rounded-full bg-blue-600"
                animate={{
                    width: `${progress}%`,
                }}
                transition={{
                    duration: 0.25,
                }}
            />

        </div>

    </div>
    <AnimatePresence
    mode="wait"
>
    <motion.div
        key={currentStep}
        variants={
            STEP_VARIANTS
        }
        initial="initial"
        animate="animate"
        exit="exit"
        transition={
            STEP_TRANSITION
        }
        className="space-y-6"
    >
        {currentStep === 0 && (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

        <div className="grid gap-5 md:grid-cols-2">

            <Input
                ref={
                    firstNameRef
                }
                label="First Name"
                value={
                    formData.firstName
                }
                onChange={(event) =>
                    updateField(
                        "firstName",
                        event.target.value
                    )
                }
                error={getFieldError(
                    "firstName"
                )}
                required
                disabled={
                    isDisabled
                }
            />

            <Input
                ref={
                    lastNameRef
                }
                label="Last Name"
                value={
                    formData.lastName
                }
                onChange={(event) =>
                    updateField(
                        "lastName",
                        event.target.value
                    )
                }
                error={getFieldError(
                    "lastName"
                )}
                required
                disabled={
                    isDisabled
                }
            />

            <Input
                ref={emailRef}
                type="email"
                label="Email"
                value={
                    formData.email
                }
                onChange={(event) =>
                    updateField(
                        "email",
                        event.target.value
                    )
                }
                error={getFieldError(
                    "email"
                )}
                required
                disabled={
                    isDisabled
                }
                className="md:col-span-2"
            />

            {isCreateMode && (
                <>
                    <Input
                        ref={
                            passwordRef
                        }
                        type="password"
                        label="Password"
                        value={
                            formData.password
                        }
                        onChange={(
                            event
                        ) =>
                            updateField(
                                "password",
                                event.target
                                    .value
                            )
                        }
                        error={getFieldError(
                            "password"
                        )}
                        required
                    />

                    <Input
                        ref={
                            confirmPasswordRef
                        }
                        type="password"
                        label="Confirm Password"
                        value={
                            formData.confirmPassword
                        }
                        onChange={(
                            event
                        ) =>
                            updateField(
                                "confirmPassword",
                                event.target
                                    .value
                            )
                        }
                        error={getFieldError(
                            "confirmPassword"
                        )}
                        required
                    />
                </>
            )}

        </div>

    </div>
)}

    {currentStep === 1 && (
    <div className="space-y-6">

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <h3 className="mb-5 text-lg font-semibold text-gray-900">
                Contact Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

                <Input
                    ref={phoneNumberRef}
                    label="Phone Number"
                    value={
                        formData.phoneNumber
                    }
                    onChange={(event) =>
                        updateField(
                            "phoneNumber",
                            event.target.value
                        )
                    }
                    error={getFieldError(
                        "phoneNumber"
                    )}
                    required
                    disabled={isDisabled}
                />

                <Input
                    label="Alternative Contact"
                    value={
                        formData.alternativeContact
                    }
                    onChange={(event) =>
                        updateField(
                            "alternativeContact",
                            event.target.value
                        )
                    }
                    error={getFieldError(
                        "alternativeContact"
                    )}
                    disabled={isDisabled}
                />

            </div>

        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <h3 className="mb-5 text-lg font-semibold text-gray-900">
                Profile Image
            </h3>

            <ImageUploadZone
                value={
                    formData.profileImage
                }
                onChange={(images) =>
                    updateField(
                        "profileImage",
                        images
                    )
                }
                maxFiles={1}
                disabled={isDisabled}
            />

        </div>

    </div>
)}

{currentStep === 2 && (
    <div className="space-y-6">

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <div className="mb-6 flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <User size={22} />
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        Partner Account
                    </h3>

                    <p className="text-sm text-gray-500">
                        Review the partner information before creating the account.
                    </p>
                </div>

            </div>

            <div className="grid gap-6 md:grid-cols-2">

                <div>

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        First Name
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                        {formData.firstName || "-"}
                    </p>

                </div>

                <div>

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Last Name
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                        {formData.lastName || "-"}
                    </p>

                </div>

            </div>

        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <div className="mb-5 flex items-center gap-3">

                <Mail
                    size={20}
                    className="text-blue-600"
                />

                <h3 className="text-lg font-semibold text-gray-900">
                    Login Account
                </h3>

            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Email Address
            </p>

            <p className="mt-1 font-medium text-gray-900">
                {formData.email || "-"}
            </p>

        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <div className="mb-5 flex items-center gap-3">

                <Phone
                    size={20}
                    className="text-blue-600"
                />

                <h3 className="text-lg font-semibold text-gray-900">
                    Contact Information
                </h3>

            </div>

            <div className="grid gap-6 md:grid-cols-2">

                <div>

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Phone Number
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                        {formData.phoneNumber || "-"}
                    </p>

                </div>

                <div>

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        Alternative Contact
                    </p>

                    <p className="mt-1 font-medium text-gray-900">
                        {formData.alternativeContact || "-"}
                    </p>

                </div>

            </div>

        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">

            <div className="mb-5 flex items-center gap-3">

                <ImageIcon
                    size={20}
                    className="text-blue-600"
                />

                <h3 className="text-lg font-semibold text-gray-900">
                    Profile Image
                </h3>

            </div>

            {formData.profileImage?.length > 0 ? (
                <img
                    src={
                        typeof formData.profileImage[0] === "string"
                            ? formData.profileImage[0]
                            : URL.createObjectURL(
                                  formData.profileImage[0]
                              )
                    }
                    alt="Profile"
                    className="h-32 w-32 rounded-xl border object-cover"
                />
            ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400">
                    No Image
                </div>
            )}

        </div>

    </div>
)}

    </motion.div>
    </AnimatePresence>

    <div className="flex items-center justify-between border-t pt-6">

    <Button
        variant="outline"
        onClick={
            currentStep === 0
                ? onCancel
                : handlePrevious
        }
    >
        {currentStep === 0
            ? "Cancel"
            : "Previous"}
    </Button>

    {currentStep <
    FORM_STEPS.length - 1 ? (
        <Button
            onClick={handleNext}
        >
            Next
        </Button>
    ) : (
    <Button
        type="submit"
        loading={loading}
    >
    {isWizardMode
        ? "Continue"
        : isEditMode
        ? "Update Partner"
        : "Create Partner"}
    </Button>
    )}

</div>

</div>
</form>
);
};

export default OperatorAccountForm;