import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Link,
    useNavigate,
} from "react-router-dom";

import {
    Contact,
    IdCard,
    Lock,
    Mail,
    Phone,
    User,
} from "lucide-react";

import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import ImageUploadZone from "../../components/shared/ImageUploadZone";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import useAuth from "../../hooks/auth/useAuth";
import useEmailVerification from "../../hooks/auth/useEmailVerification";

import { uploadValidId } from "../../services/authService";

import image1 from "../../assets/images/slideshow/image1.webp";
import image2 from "../../assets/images/slideshow/image2.webp";
import image3 from "../../assets/images/slideshow/image3.png";
import image4 from "../../assets/images/slideshow/image4.jpg";
import image5 from "../../assets/images/slideshow/image5.png";

const REGISTER_IMAGES = [
    image1,
    image2,
    image3,
    image4,
    image5,
];

const FORM_STEPS = [
    {
        title: "Personal Information",
        description:
            "Tell us a bit about yourself.",
    },
    {
        title: "Security",
        description:
            "Set up your password.",
    },
    {
        title: "Verification",
        description:
            "Verify your email and ID.",
    },
];

const VALID_ID_TYPES = [
    "Philippine Passport",
    "Driver's License",
    "SSS ID",
    "PhilHealth ID",
    "Pag-IBIG ID",
    "National ID (PhilSys)",
    "Voter's ID",
    "Postal ID",
    "Senior Citizen ID",
    "PWD ID",
];

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

const Register = () => {
    const navigate = useNavigate();

    const {
        register,
        loading,
        error,
        clearError,
        isAuthenticated,
    } = useAuth();

    const {
        resendVerificationEmail,
        loading:
            verificationLoading,
        error:
            verificationError,
        clearError:
            clearVerificationError,
    } = useEmailVerification();

    const [formData, setFormData] = useState({
        firstName: "",
        middleName: "",
        lastName: "",
        birthdate: "",
        phoneNumber: "",
        alternativeContact: "",
        password: "",
        confirmPassword: "",
        email: "",
        validIdType: "",
        validIdImage: "",
        validIdBack: "",
    });

    const [currentStep, setCurrentStep] =
        useState(0);

    const [validationErrors, setValidationErrors] =
        useState({});

    const [validIdFrontFile, setValidIdFrontFile] =
        useState(null);

    const [validIdBackFile, setValidIdBackFile] =
        useState(null);

    const [
        registrationComplete,
        setRegistrationComplete,
    ] = useState(false);

    const [resendMessage, setResendMessage] =
        useState("");

    const [idUploading, setIdUploading] =
        useState(false);

    const [currentImage, setCurrentImage] =
        useState(0);

    useEffect(() => {
        clearError();
        clearVerificationError();
    }, [
        clearError,
        clearVerificationError,
    ]);

    useEffect(() => {
        if (
            isAuthenticated &&
            !registrationComplete
        ) {
            navigate("/", {
                replace: true,
            });
        }
    }, [
        isAuthenticated,
        registrationComplete,
        navigate,
    ]);

    useEffect(() => {
        if (REGISTER_IMAGES.length <= 1) {
            return undefined;
        }

        REGISTER_IMAGES.forEach((src) => {
            const image = new Image();

            image.src = src;
        });

        const interval = window.setInterval(() => {
            setCurrentImage(
                (previous) =>
                    (previous + 1) %
                    REGISTER_IMAGES.length
            );
        }, 5000);

        return () => {
            window.clearInterval(interval);
        };
    }, []);

    const handleChange = ({
        target,
    }) => {
        const {
            name,
            value,
        } = target;

        if (error) {
            clearError();
        }

        if (verificationError) {
            clearVerificationError();
        }

        if (resendMessage) {
            setResendMessage("");
        }

        if (
            validationErrors[name]
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    delete updated[name];

                    return updated;
                }
            );
        }

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleIdImagesChange = (
        images
    ) => {
        const front = images.find(
            (image) => image.file
        );

        const back = images
            .slice(1)
            .find((image) => image.file);

        setValidIdFrontFile(
            front ? front.file : null
        );

        setValidIdBackFile(
            back ? back.file : null
        );

        setFormData(
            (previous) => ({
                ...previous,
                validIdImage: front
                    ? front.url ||
                      front.publicId ||
                      front.preview ||
                      ""
                    : "",
                validIdBack: back
                    ? back.url ||
                      back.publicId ||
                      back.preview ||
                      ""
                    : "",
            })
        );

        if (
            validationErrors.validIdImage ||
            validationErrors.validIdBack
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    if (
                        updated.validIdImage
                    ) {
                        delete updated.validIdImage;
                    }

                    if (
                        updated.validIdBack
                    ) {
                        delete updated.validIdBack;
                    }

                    return updated;
                }
            );
        }
    };

    const validateStep = () => {
        const errors = {};

        switch (currentStep) {
            case 0:
                if (
                    !formData.firstName.trim()
                ) {
                    errors.firstName =
                        "First name is required.";
                } else if (
                    formData.firstName.length <
                    2
                ) {
                    errors.firstName =
                        "First name must be at least 2 characters.";
                }

                if (
                    !formData.lastName.trim()
                ) {
                    errors.lastName =
                        "Last name is required.";
                } else if (
                    formData.lastName.length <
                    2
                ) {
                    errors.lastName =
                        "Last name must be at least 2 characters.";
                }

                if (
                    !formData.birthdate
                ) {
                    errors.birthdate =
                        "Birthdate is required.";
                } else {
                    const [
                        year,
                        month,
                        day,
                    ] = formData.birthdate
                        .split("-")
                        .map(Number);

                    const birthdate =
                        new Date(
                            year,
                            month -
                                1,
                            day
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
                        birthdate >=
                        today
                    ) {
                        errors.birthdate =
                            "Birthdate cannot be in the future.";
                    } else {
                        const age =
                            today.getFullYear() -
                            birthdate.getFullYear();

                        const monthDiff =
                            today.getMonth() -
                            birthdate.getMonth();

                        const dayDiff =
                            today.getDate() -
                            birthdate.getDate();

                        const isOver18 =
                            age > 18 ||
                            (age === 18 &&
                                monthDiff >
                                    0) ||
                            (age ===
                                18 &&
                                monthDiff ===
                                    0 &&
                                dayDiff >=
                                    0);

                        if (
                            !isOver18
                        ) {
                            errors.birthdate =
                                "You must be at least 18 years old.";
                        }
                    }
                }

                if (
                    !formData.phoneNumber.trim()
                ) {
                    errors.phoneNumber =
                        "Phone number is required.";
                }

                break;

            case 1:
                if (
                    !formData.password
                ) {
                    errors.password =
                        "Password is required.";
                } else if (
                    formData.password
                        .length < 8
                ) {
                    errors.password =
                        "Password must be at least 8 characters.";
                }

                if (
                    !formData.confirmPassword
                ) {
                    errors.confirmPassword =
                        "Please confirm your password.";
                } else if (
                    formData.password !==
                        formData.confirmPassword
                ) {
                    errors.confirmPassword =
                        "Passwords do not match.";
                }

                break;

            case 2:
                if (
                    !formData.email.trim()
                ) {
                    errors.email =
                        "Email is required.";
                } else if (
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                        formData.email
                    )
                ) {
                    errors.email =
                        "Please enter a valid email address.";
                }

                if (
                    !formData.validIdType
                ) {
                    errors.validIdType =
                        "Please select a valid ID type.";
                }

                if (
                    !formData.validIdImage
                ) {
                    errors.validIdImage =
                        "Valid ID front image is required.";
                }

                if (
                    !formData.validIdBack
                ) {
                    errors.validIdBack =
                        "Valid ID back image is required.";
                }

                break;

            default:
                break;
        }

        setValidationErrors(errors);

        if (
            Object.keys(errors).length
        ) {
            return false;
        }

        return true;
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

    const handlePrevious = () => {
        setCurrentStep(
            (previous) =>
                previous - 1
        );
    };

    const handleSubmit = async () => {
        if (
            !validateStep() ||
            loading
        ) {
            return;
        }

        setResendMessage("");

        try {
            let validIdImageUrl =
                formData.validIdImage;

            let validIdBackUrl =
                formData.validIdBack;

            if (validIdFrontFile) {
                setIdUploading(true);

                try {
                    const response =
                        await uploadValidId(
                            validIdFrontFile
                        );

                    validIdImageUrl =
                        response?.data?.url ||
                        "";

                    setFormData(
                        (previous) => ({
                            ...previous,
                            validIdImage:
                                validIdImageUrl,
                        })
                    );
                } catch {
                    setValidationErrors(
                        {
                            validIdImage:
                                "Failed to upload valid ID front image. Please try again.",
                        }
                    );

                    setValidIdFrontFile(null);

                    setFormData(
                        (previous) => ({
                            ...previous,
                            validIdImage: "",
                        })
                    );

                    setIdUploading(false);

                    return;
                }

                setValidIdFrontFile(null);
            }

            if (validIdBackFile) {
                setIdUploading(true);

                try {
                    const response =
                        await uploadValidId(
                            validIdBackFile
                        );

                    validIdBackUrl =
                        response?.data?.url ||
                        "";

                    setFormData(
                        (previous) => ({
                            ...previous,
                            validIdBack:
                                validIdBackUrl,
                        })
                    );
                } catch {
                    setValidationErrors(
                        {
                            validIdBack:
                                "Failed to upload valid ID back image. Please try again.",
                        }
                    );

                    setValidIdBackFile(null);

                    setFormData(
                        (previous) => ({
                            ...previous,
                            validIdBack: "",
                        })
                    );

                    setIdUploading(false);

                    return;
                }

                setValidIdBackFile(null);
            }

            setIdUploading(false);

            const payload = {
                firstName:
                    formData.firstName.trim(),
                lastName:
                    formData.lastName.trim(),
                email:
                    formData.email.trim(),
                password:
                    formData.password,
                phoneNumber:
                    formData.phoneNumber.trim(),
                alternativeContact:
                    formData.alternativeContact.trim(),
                middleName:
                    formData.middleName.trim(),
                birthdate:
                    formData.birthdate,
                validIdType:
                    formData.validIdType,
                validIdImage:
                    validIdImageUrl,
                validIdBack:
                    validIdBackUrl,
            };

            await register(payload);

            setRegistrationComplete(
                true
            );
        } catch {
            // Error is handled by Redux.
        }
    };

    const handleResend = async () => {
        const email =
            formData.email.trim();

        if (!email) {
            setResendMessage(
                "Please enter your email address first."
            );

            return;
        }

        if (verificationLoading) {
            return;
        }

        setResendMessage("");
        clearVerificationError();

        try {
            await resendVerificationEmail(
                email
            );

            setResendMessage(
                "Verification email sent successfully. Please check your inbox."
            );
        } catch {
            // Error is handled by the verification hook.
        }
    };

    const progress =
        ((currentStep + 1) /
            FORM_STEPS.length) *
        100;

    const getFieldError = (path) =>
        validationErrors[path] || "";

    const idOptions = useMemo(
        () =>
            VALID_ID_TYPES.map(
                (type) => ({
                    label: type,
                    value: type,
                })
            ),
        []
    );

    const idImages = useMemo(() => {
        const images = [];

        if (formData.validIdImage) {
            images.push({
                id: "valid-id-front",
                url: formData.validIdImage,
                preview: null,
                publicId: null,
                originalName: "Valid ID Front",
                isPrimary: true,
            });
        }

        if (formData.validIdBack) {
            images.push({
                id: "valid-id-back",
                url: formData.validIdBack,
                preview: null,
                publicId: null,
                originalName: "Valid ID Back",
                isPrimary: false,
            });
        }

        return images;
    }, [formData.validIdImage, formData.validIdBack]);

    return (
        <div
            className="
                relative
                flex
                min-h-screen
                w-full
                items-center
                justify-center
                overflow-hidden
                bg-gray-950
                px-4
                py-4
                sm:px-6
                sm:py-6
                lg:px-8
            "
        >
            <div
                className="
                    pointer-events-none
                    absolute
                    inset-0
                    overflow-hidden
                "
            >
                <AnimatePresence initial={false}>
                    <motion.img
                        key={currentImage}
                        src={
                            REGISTER_IMAGES[
                                currentImage
                            ]
                        }
                        alt=""
                        initial={{
                            opacity: 0,
                            scale: 1.03,
                        }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            scale: 1.01,
                        }}
                        transition={{
                            opacity: {
                                duration: 1.4,
                                ease: "easeInOut",
                            },
                            scale: {
                                duration: 6,
                                ease: "linear",
                            },
                        }}
                        className="
                            absolute
                            inset-0
                            h-full
                            w-full
                            object-cover
                            object-center
                        "
                    />
                </AnimatePresence>

                <div
                    className="
                        absolute
                        inset-0
                        bg-gray-950/80
                    "
                />
                <div
                    className="
                        absolute
                        inset-0
                        bg-yellow-500/10
                        mix-blend-color
                    "
                />
                <div
                    className="
                        absolute
                        inset-0
                        bg-gradient-to-br
                        from-gray-950/90
                        via-gray-950/65
                        to-yellow-950/30
                    "
                />
                <div
                    className="
                        absolute
                        inset-0
                        bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.35)_100%)]
                    "
                />
            </div>

            <motion.div
                initial={{
                    opacity: 0,
                    y: 20,
                }}
                animate={{
                    opacity: 1,
                    y: 0,
                }}
                transition={{
                    duration: 0.55,
                    ease: "easeOut",
                }}
                className="
                    relative
                    z-10
                    mx-auto
                    w-full
                    max-w-xl
                "
            >
                <div
                    className="
                        relative
                        overflow-hidden
                        rounded-2xl
                        border
                        border-white/80
                        bg-white
                        p-4
                        shadow-2xl
                        shadow-black/30
                        sm:p-5
                    "
                >
                    <motion.div
                                        initial={{
                                            opacity: 0,
                                            y: 12,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                        }}
                                        transition={{
                                            duration: 0.4,
                                            delay: 0.35,
                                        }}
                                    >
                                        <h1
                                            className="
                                                mb-1
                                                text-center
                                                text-xl
                                                font-bold
                                                tracking-tight
                                                text-gray-950
                                            "
                                        >
                                            Create Your Account
                                        </h1>

                                        <p
                                            className="
                                                mb-3
                                                text-center
                                                text-sm
                                                text-gray-500
                                            "
                                        >
                                            Join Rent-A-Ride
                                            Albay and start
                                            your journey
                                        </p>
                                    </motion.div>

                                    {!registrationComplete ? (
                                        <>
                                        {error && (
                                        <Alert
                                            variant="error"
                                            message={error}
                                            className="mb-4"
                                        />
                                    )}

                                    <div className="mb-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-700">
                                                Step{" "}
                                                {currentStep + 1}{" "}
                                                of{" "}
                                                {FORM_STEPS.length}
                                            </span>

                                            <span className="text-sm text-gray-500">
                                                {
                                                    FORM_STEPS[
                                                        currentStep
                                                    ].title
                                                }
                                            </span>
                                        </div>

                                        <div className="h-1 overflow-hidden rounded-full bg-gray-200">
                                            <motion.div
                                                animate={{
                                                    width: `${progress}%`,
                                                }}
                                                transition={{
                                                    duration: 0.25,
                                                }}
                                                className="h-full rounded-full bg-yellow-500"
                                            />
                                        </div>
                                    </div>

                                    <AnimatePresence mode="wait">
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
                                            className="space-y-4"
                                        >
                                            {currentStep ===
                                                0 && (
                                                <>
                                                        <div
                                                            className="
                                                                grid
                                                                grid-cols-1
                                                                gap-3
                                                                sm:grid-cols-2
                                                            "
                                                        >
                                                        <Input
                                                            id="firstName"
                                                            name="firstName"
                                                            label="First Name"
                                                            placeholder="Enter first name"
                                                            value={
                                                                formData.firstName
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="given-name"
                                                            leftIcon={
                                                                <User
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "firstName"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Input
                                                            id="middleName"
                                                            name="middleName"
                                                            label="Middle Name"
                                                            placeholder="Optional"
                                                            value={
                                                                formData.middleName
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="additional-name"
                                                            leftIcon={
                                                                <User
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                        />

                                                        <Input
                                                            id="lastName"
                                                            name="lastName"
                                                            label="Last Name"
                                                            placeholder="Enter last name"
                                                            value={
                                                                formData.lastName
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="family-name"
                                                            leftIcon={
                                                                <User
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "lastName"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Input
                                                            id="birthdate"
                                                            name="birthdate"
                                                            type="date"
                                                            label="Birthdate"
                                                            value={
                                                                formData.birthdate
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            max={
                                                                new Date(
                                                                    new Date().getTime() -
                                                                        new Date().getTimezoneOffset() *
                                                                            60000
                                                                )
                                                                    .toISOString()
                                                                    .split(
                                                                        "T"
                                                                    )[0]
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "birthdate"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Input
                                                            id="phoneNumber"
                                                            name="phoneNumber"
                                                            type="tel"
                                                            label="Phone Number"
                                                            placeholder="09XXXXXXXXX"
                                                            value={
                                                                formData.phoneNumber
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="tel"
                                                            leftIcon={
                                                                <Phone
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "phoneNumber"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Input
                                                            id="alternativeContact"
                                                            name="alternativeContact"
                                                            label="Alternative Contact"
                                                            placeholder="Messenger, Viber, etc."
                                                            value={
                                                                formData.alternativeContact
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="off"
                                                            leftIcon={
                                                                <Contact
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                        />
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <Button
                                                            type="button"
                                                            onClick={
                                                                handleNext
                                                            }
                                                            className="
                                                                !border-yellow-400
                                                                !bg-yellow-400
                                                                !text-gray-950
                                                                hover:!bg-yellow-300
                                                            "
                                                        >
                                                            Next
                                                        </Button>
                                                    </div>
                                                </>
                                            )}

                                             {currentStep ===
                                                 1 && (
                                                 <>
                                                     <div className="space-y-4">
                                                        <Input
                                                            id="password"
                                                            name="password"
                                                            type="password"
                                                            label="Password"
                                                            placeholder="Create a password"
                                                            value={
                                                                formData.password
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="new-password"
                                                            leftIcon={
                                                                <Lock
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            helperText="Password must be at least 8 characters."
                                                            error={
                                                                getFieldError(
                                                                    "password"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Input
                                                            id="confirmPassword"
                                                            name="confirmPassword"
                                                            type="password"
                                                            label="Confirm Password"
                                                            placeholder="Repeat your password"
                                                            value={
                                                                formData.confirmPassword
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="new-password"
                                                            leftIcon={
                                                                <Lock
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "confirmPassword"
                                                                )
                                                            }
                                                            required
                                                        />
                                                    </div>

                                                    <div className="flex justify-between">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={
                                                                handlePrevious
                                                            }
                                                            className="
                                                                !border-gray-300
                                                                !text-gray-700
                                                                hover:!bg-gray-50
                                                                dark:!border-gray-600
                                                                dark:!text-gray-300
                                                                dark:hover:!bg-gray-800
                                                            "
                                                        >
                                                            Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={
                                                                handleNext
                                                            }
                                                            className="
                                                                !border-yellow-400
                                                                !bg-yellow-400
                                                                !text-gray-950
                                                                hover:!bg-yellow-300
                                                            "
                                                        >
                                                            Next
                                                        </Button>
                                                    </div>
                                                </>
                                            )}

                                             {currentStep ===
                                                 2 && (
                                                 <>
                                                     <div className="space-y-4">
                                                        <Input
                                                            id="email"
                                                            name="email"
                                                            type="email"
                                                            label="Email"
                                                            placeholder="Enter your email"
                                                            value={
                                                                formData.email
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            autoComplete="email"
                                                            leftIcon={
                                                                <Mail
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "email"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <Select
                                                            label="Valid ID Type"
                                                            name="validIdType"
                                                            value={
                                                                formData.validIdType
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            options={
                                                                idOptions
                                                            }
                                                            placeholder="Select ID type"
                                                            leftIcon={
                                                                <IdCard
                                                                    size={
                                                                        18
                                                                    }
                                                                />
                                                            }
                                                            error={
                                                                getFieldError(
                                                                    "validIdType"
                                                                )
                                                            }
                                                            required
                                                        />

                                                        <div className="space-y-2">
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                Valid ID{" "}
                                                                <span className="text-red-500">
                                                                    *
                                                                </span>
                                                            </label>

                                                            <ImageUploadZone
                                                                images={
                                                                    idImages
                                                                }
                                                                onChange={
                                                                    handleIdImagesChange
                                                                }
                                                                maxFiles={
                                                                    2
                                                                }
                                                                title="Upload Valid ID"
                                                                helperText="Upload the front first, then the back. JPG, PNG, or WEBP. Max 5MB each."
                                                            />

                                                            {(getFieldError(
                                                                "validIdImage"
                                                            ) ||
                                                                getFieldError(
                                                                    "validIdBack"
                                                                )) && (
                                                                    <p
                                                                        className="text-sm text-red-600 dark:text-red-400"
                                                                        role="alert"
                                                                    >
                                                                        {getFieldError(
                                                                            "validIdImage"
                                                                        ) ||
                                                                            getFieldError(
                                                                                "validIdBack"
                                                                            )}
                                                                    </p>
                                                                )}
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={
                                                                handlePrevious
                                                            }
                                                            className="
                                                                !border-gray-300
                                                                !text-gray-700
                                                                hover:!bg-gray-50
                                                                dark:!border-gray-600
                                                                dark:!text-gray-300
                                                                dark:hover:!bg-gray-800
                                                            "
                                                        >
                                                            Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={
                                                                handleSubmit
                                                            }
                                                            loading={
                                                                loading ||
                                                                idUploading
                                                            }
                                                            className="
                                                                !border-yellow-400
                                                                !bg-yellow-400
                                                                !text-gray-950
                                                                hover:!bg-yellow-300
                                                            "
                                                        >
                                                            Create Account
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>

                                    <div
                                        className="
                                            mt-3
                                            flex
                                            items-center
                                            justify-center
                                            gap-1.5
                                            text-sm
                                        "
                                    >
                                        <span className="text-gray-500">
                                            Already have an
                                            account?
                                        </span>

                                        <Link
                                            to="/login"
                                            className="
                                                font-medium
                                                text-gray-600
                                                transition-colors
                                                hover:text-gray-950
                                                hover:underline
                                            "
                                        >
                                            Sign In
                                        </Link>
                                    </div>
                                    </>
                            ) : (
                                <motion.div
                                    initial={{
                                        opacity: 0,
                                        y: 15,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                    }}
                                    transition={{
                                        duration: 0.45,
                                    }}
                                    className="
                                        flex
                                        flex-col
                                        items-center
                                        text-center
                                    "
                                >
                                    <div
                                        className="
                                            mb-2
                                            flex
                                            h-10
                                            w-10
                                            items-center
                                            justify-center
                                            rounded-full
                                            bg-yellow-100
                                            text-yellow-600
                                        "
                                    >
                                        <Mail
                                            size={20}
                                        />
                                    </div>

                                    <h1
                                        className="
                                            mb-1
                                            text-xl
                                            font-bold
                                            tracking-tight
                                            text-gray-950
                                        "
                                    >
                                        Check Your Email
                                    </h1>

                                    <p
                                        className="
                                            max-w-sm
                                            text-sm
                                            leading-6
                                            text-gray-500
                                        "
                                    >
                                        Your account has been
                                        created successfully.
                                        We sent a verification
                                        email to:
                                    </p>

                                    <p
                                        className="
                                            mt-1
                                            break-all
                                            font-semibold
                                            text-gray-900
                                        "
                                    >
                                        {formData.email}
                                    </p>

                                    <p
                                        className="
                                            mt-2
                                            max-w-sm
                                            text-sm
                                            leading-6
                                            text-gray-500
                                        "
                                    >
                                        Please open the email
                                        and click the
                                        verification link before
                                        signing in.
                                    </p>

                                    {verificationError && (
                                        <Alert
                                            variant="error"
                                            message={
                                                verificationError
                                            }
                                            className="mt-3 w-full"
                                        />
                                    )}

                                    {resendMessage && (
                                        <Alert
                                            variant="success"
                                            message={
                                                resendMessage
                                            }
                                            className="mt-3 w-full"
                                        />
                                    )}

                                    <div
                                        className="
                                            mt-4
                                            w-full
                                            space-y-3
                                        "
                                    >
                                        <Button
                                            type="button"
                                            fullWidth
                                            loading={
                                                verificationLoading
                                            }
                                            onClick={
                                                handleResend
                                            }
                                            className="
                                                !border-yellow-400
                                                !bg-yellow-400
                                                !text-gray-950
                                                hover:!bg-yellow-300
                                            "
                                        >
                                            Resend Verification
                                            Email
                                        </Button>

                                        <Link
                                            to="/login"
                                            className="
                                                flex
                                                w-full
                                                items-center
                                                justify-center
                                                rounded-lg
                                                border
                                                border-gray-300
                                                px-4
                                                py-3
                                                text-sm
                                                font-medium
                                                text-gray-700
                                                transition
                                                hover:bg-gray-50
                                            "
                                        >
                                            Go to Sign In
                                        </Link>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
    );
};

export default Register;
