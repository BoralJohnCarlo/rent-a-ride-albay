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
    Link,
    useNavigate,
} from "react-router-dom";

import {
    Car,
    Calendar,
    Check,
    ChevronLeft,
    ChevronRight,
    Contact,
    IdCard,
    Lock,
    Mail,
    Phone,
    ReceiptText,
    ShieldCheck,
    User,
} from "lucide-react";

import {
    REGIONS,
    getProvinces,
    getCities,
    getBarangays,
} from "../../data/philippineLocations";

import { VEHICLE_BRANDS } from "../../utils/vehicleBrands";
import {
    PASSWORD_HINT,
    getNameError,
    getPasswordError,
    getPhoneError,
    getRegistrationErrorField,
    isAlreadyVerifiedError,
    isPastDate,
    isPendingVerificationError,
} from "../../utils/registrationRules";

import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import ImageUploadZone from "../../components/shared/ImageUploadZone";
import IdImageUploadRow, {
    SingleImageUpload,
} from "../../components/shared/IdImageUploadRow";
import Input from "../../components/common/Input";
import Select from "../../components/common/Select";
import Switch from "../../components/common/Switch";
import InspectionAppointmentCalendar from "../../components/consignments/InspectionAppointmentCalendar";
import TermsAgreement from "../../components/booking/TermsAgreement";

import useAuth from "../../hooks/auth/useAuth";

import {
    verifyUserEmail,
    resendVerificationEmail as resendVerificationEmailApi,
    loginUser,
} from "../../services/authService";

import {
    uploadValidId,
    uploadProofOfBilling,
    removeTemporaryValidId,
    uploadRegistrationVehicleImage,
} from "../../services/authService";

import useProofOfBillingEnabled from "../../hooks/settings/useProofOfBillingEnabled";
import useLegalDocument from "../../hooks/legal/useLegalDocument";
import {
    LEGAL_DOCUMENT_TYPES,
    isTermsOutdatedError,
} from "../../constants/legalDocuments";

import image1 from "../../assets/images/slideshow/image1.webp";
import image2 from "../../assets/images/slideshow/image2.webp";
import image3 from "../../assets/images/slideshow/image3.png";
import image4 from "../../assets/images/slideshow/image4.jpg";
import image5 from "../../assets/images/slideshow/image5.png";
import useScrollTopOnChange from "../../hooks/useScrollTopOnChange";

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
        description: "Tell us a bit about yourself.",
    },
    {
        title: "ID Verification",
        description: "Upload your valid ID.",
    },
    {
        title: "Vehicle Information",
        description: "Provide details about your vehicle.",
    },
    {
        title: "Appointment Date",
        description: "Select when your vehicle will be available for inspection.",
    },
    {
        title: "Email & Security",
        description: "Set up your email and password.",
    },
    {
        title: "Verify Email",
        description: "Enter the 6-digit code sent to your email.",
    },
    {
        title: "Complete",
        description: "Your partner account has been created.",
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

const RegisterOperator = () => {
    const navigate = useNavigate();

    const {
        registerOperator,
        loading,
        error,
        clearError,
        isAuthenticated,
    } = useAuth();

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
        licenseNumber: "",
        licenseExpirationDate: "",
        licenseCodes: [],
        motorcycleTransmission: [],
        carTransmission: [],
        vehicleType: "",
        brand: "",
        model: "",
        year: "",
        plateNumber: "",
        registrationNumber: "",
        registrationExpiration: "",
        vehicleImages: [],
        specifications: {
            transmission: "",
            fuelType: "",
            seatingCapacity: "",
        },
        currentAddress: {
            houseUnitLot: "",
            street: "",
            barangay: "",
            cityMunicipality: "",
            province: "",
            postalCode: "",
        },
        inspectionDate: "",
        termsAgreed: false,
    });

    const [currentStep, setCurrentStep] =
        useState(0);
    const stepTopRef = useScrollTopOnChange(currentStep);

    const registrationFlowRef = useRef(false);

    const [validationErrors, setValidationErrors] =
        useState({});

    const [idImages, setIdImages] = useState([]);

    const [idUploading, setIdUploading] =
        useState(false);

    /*
     * Proof of billing address: shown and required only while the admin has
     * it on. `billingRequiredByServer` covers the admin turning it on after
     * this form loaded - the server names the field and the form adds it.
     */
    const { enabled: proofOfBillingSetting } =
        useProofOfBillingEnabled();
    const [billingRequiredByServer, setBillingRequiredByServer] =
        useState(false);
    const proofOfBillingEnabled =
        proofOfBillingSetting || billingRequiredByServer;
    const [billingImage, setBillingImage] = useState(null);

    const [vehicleImages, setVehicleImages] = useState([]);
    const [vehicleImageUploading, setVehicleImageUploading] = useState(false);

    const [inspectionDate, setInspectionDate] = useState("");
    const [termsAgreed, setTermsAgreed] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    // The Terms version on show (here and in the pop-up): the one recorded
    // as accepted when the registration is sent.
    const {
        document: termsDocument,
        reload: reloadTerms,
    } = useLegalDocument(LEGAL_DOCUMENT_TYPES.BOOKING_TERMS);

    const [customBrand, setCustomBrand] =
        useState("");
    const [customModel, setCustomModel] =
        useState("");
    const [isCustom, setIsCustom] =
        useState(false);

    const [currentRegion, setCurrentRegion] =
        useState("");

    const [hasValidated, setHasValidated] =
        useState(false);

    const [isVerifying, setIsVerifying] =
        useState(false);

    const [code, setCode] =
        useState(["", "", "", "", "", ""]);
    const codeInputRefs = useRef([]);
    const [resendCooldown, setResendCooldown] =
        useState(0);
    const [resendDisabled, setResendDisabled] =
        useState(false);
    const [verificationError, setVerificationError] =
        useState(null);
    const [resendError, setResendError] =
        useState(null);
    const resendTimerRef = useRef(null);

    const [currentImage, setCurrentImage] =
        useState(0);

    useEffect(() => {
        clearError();
    }, [
        clearError,
    ]);

    useEffect(() => {
        return () => {
            if (resendTimerRef.current) {
                window.clearInterval(resendTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (
            isAuthenticated &&
            !registrationFlowRef.current
        ) {
            navigate("/", {
                replace: true,
            });
        }
    }, [
        isAuthenticated,
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

    const handleChange = (
        event
    ) => {
        const {
            name,
            value,
            type,
            checked,
        } = event.target;

        const newValue = (name === "plateNumber" || name === "registrationNumber") && type !== "checkbox"
            ? value.toUpperCase()
            : value;

        if (name === "currentAddress.region") {
            setCurrentRegion(newValue);
            if (validationErrors.region) {
                setValidationErrors((prev) => {
                    const updated = { ...prev };
                    delete updated.region;
                    return updated;
                });
            }
        }

        const handleNestedChange = (
            previous,
            fieldPath,
            val
        ) => {
            const keys = fieldPath.split(".");
            const result = { ...previous };
            let current = result;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] =
                    { ...(current[keys[i]] || {}) };
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = val;
            return result;
        };

        setFormData((previous) => ({
            ...previous,
            ...(name.includes(".")
                ? handleNestedChange(
                      previous,
                      name,
                      type === "checkbox"
                          ? checked
                          : newValue,
                  )
                : {
                      [name]:
                          type === "checkbox"
                              ? checked
                              : newValue,
                  }),
        }));

        if (error) {
            clearError();
        }

        if (hasValidated) {
            clearFieldErrors(name);
        }
    };

    const handlePhoneNumberChange = (e) => {
        const value = e.target.value.replace(/\D/g, "");
        if (hasValidated) {
            clearFieldErrors("phoneNumber");
        }
        setFormData((previous) => ({
            ...previous,
            phoneNumber: value,
        }));
    };

    const handleVehicleTypeChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            vehicleType: value,
            brand: "",
            model: "",
        }));

        setCustomBrand("");

        setCustomModel("");

        setIsCustom(false);

        if (hasValidated) {
            clearFieldErrors(
                "vehicleType"
            );

            clearFieldErrors("brand");

            clearFieldErrors("model");
        }
    };

    const handleBrandChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            brand: value,
            model: "",
        }));

        setCustomModel("");

        if (hasValidated) {
            clearFieldErrors("brand");

            clearFieldErrors("model");
        }
    };

    const handleModelChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setFormData((previous) => ({
            ...previous,
            model: value,
        }));

        if (hasValidated) {
            clearFieldErrors("model");
        }
    };

    const clearFieldErrors = (
        field
    ) => {
        setValidationErrors(
            (previous) => {
                if (field.includes(".")) {
                    const [parentKey, ...rest] = field.split(".");
                    const leafKey = rest[rest.length - 1];

                    if (!previous?.[parentKey]?.[leafKey]) {
                        return previous;
                    }

                    const updated = { ...previous };
                    updated[parentKey] = {
                        ...updated[parentKey],
                    };
                    delete updated[parentKey][leafKey];
                    return updated;
                }

                if (!previous?.[field]) {
                    return previous;
                }

                const updated = {
                    ...previous,
                };

                delete updated[field];

                return updated;
            }
        );
    };

    const handleIdImagesChange = (
        images
    ) => {
        const [front, back] = images;

        setIdImages(images);

        setIdImages(images);

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

    const handleVehicleImagesChange = (
        images
    ) => {
        setVehicleImages(images);

        if (
            validationErrors.vehicleImages
        ) {
            setValidationErrors(
                (previous) => {
                    const updated = {
                        ...previous,
                    };

                    delete updated.vehicleImages;

                    return updated;
                }
            );
        }
    };

    const handleCustomToggle = (
        event
    ) => {
        const { checked } =
            event.target;

        setIsCustom(checked);

        if (!checked) {
            setCustomBrand("");

            setCustomModel("");

            setFormData(
                (previous) => ({
                    ...previous,
                    brand: "",

                    model: "",
                })
            );
        }

        if (hasValidated) {
            clearFieldErrors("brand");

            clearFieldErrors("model");
        }
    };

    const handleCustomBrandChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setCustomBrand(value);

        if (hasValidated) {
            clearFieldErrors("brand");
        }
    };

    const handleCustomModelChange = (
        event
    ) => {
        const {
            value,
        } = event.target;

        setCustomModel(value);

        if (hasValidated) {
            clearFieldErrors("model");
        }
    };

    const handleNestedChange = (
        parent,
        field,
        value
    ) => {
        setFormData(
            (previous) => ({
                ...previous,
                [parent]: {
                    ...previous[parent],
                    [field]: value,
                },
            })
        );

        const fieldPath = `${parent}.${field}`;

        if (
            validationErrors[fieldPath]
        ) {
            clearFieldErrors(fieldPath);
        }

        if (hasValidated) {
            clearFieldErrors(fieldPath);
        }
    };

    const validateStep = () => {
        const errors = {};

        switch (currentStep) {
            case 0:
                {
                    const nameErrors = {
                        firstName: getNameError(
                            formData.firstName,
                            "First name"
                        ),
                        middleName: getNameError(
                            formData.middleName,
                            "Middle name",
                            { required: false }
                        ),
                        lastName: getNameError(
                            formData.lastName,
                            "Last name"
                        ),
                    };

                    Object.entries(nameErrors).forEach(([field, message]) => {
                        if (message) {
                            errors[field] = message;
                        }
                    });
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

                {
                    const phoneError = getPhoneError(
                        formData.phoneNumber
                    );

                    if (phoneError) {
                        errors.phoneNumber = phoneError;
                    }
                }

                // Address validation
                if (
                    !formData.currentAddress.barangay.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        barangay: "Barangay is required.",
                    };
                }

                if (
                    !formData.currentAddress.cityMunicipality.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        cityMunicipality: "City/Municipality is required.",
                    };
                }

                if (
                    !formData.currentAddress.province.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        province: "Province is required.",
                    };
                }

                if (
                    !formData.currentAddress.postalCode.trim()
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        postalCode: "Postal Code is required.",
                    };
                } else if (
                    !/^\d{4}$/.test(
                        formData.currentAddress.postalCode.trim()
                    )
                ) {
                    errors.currentAddress = {
                        ...(errors.currentAddress || {}),
                        postalCode: "Postal Code must be exactly 4 digits.",
                    };
                }

                if (!currentRegion) {
                    errors.region = "Region is required.";
                }

                break;

            case 1:
                if (
                    !formData.validIdType
                ) {
                    errors.validIdType =
                        "Please select a valid ID type.";
                }

                if (
                    !formData.validIdImage &&
                    !idImages[0]?.file
                ) {
                    errors.validIdImage =
                        "Valid ID front image is required.";
                }

                if (
                    !formData.validIdBack &&
                    !idImages[1]?.file
                ) {
                    errors.validIdBack =
                        "Valid ID back image is required.";
                }

                if (proofOfBillingEnabled && !billingImage?.file) {
                    errors.proofOfBillingImage =
                        "Proof of billing address is required.";
                }

                break;

            case 2:
                if (
                    !formData.vehicleType
                ) {
                    errors.vehicleType =
                        "Vehicle type is required.";
                }

                if (
                    isCustom
                        ? !customBrand.trim()
                        : !formData.brand
                ) {
                    errors.brand =
                        "Brand is required.";
                }

                if (
                    isCustom
                        ? !customModel.trim()
                        : !formData.model
                ) {
                    errors.model =
                        "Model is required.";
                }

                if (
                    formData.year === "" ||
                    formData.year === null ||
                    formData.year === undefined
                ) {
                    errors.year =
                        "Year is required.";
                } else {
                    const parsedYear =
                        Number(formData.year);

                    if (
                        Number.isNaN(parsedYear) ||
                        parsedYear < 1900 ||
                        parsedYear >
                            new Date().getFullYear() +
                                1
                    ) {
                        errors.year =
                            "Enter a valid vehicle year.";
                    }
                }

                if (
                    !formData.plateNumber.trim()
                ) {
                    errors.plateNumber =
                        "Plate number is required.";
                }

                if (
                    !formData.registrationNumber.trim()
                ) {
                    errors.registrationNumber =
                        "Registration number is required.";
                }

                if (isPastDate(formData.registrationExpiration)) {
                    errors.registrationExpiration =
                        "The vehicle's registration has already expired. Please renew it before registering the vehicle.";
                }

                if (vehicleImages.length > 10) {
                    errors.vehicleImages =
                        "You can add up to 10 vehicle photos.";
                }

                if (
                    !vehicleImages.length
                ) {
                    errors.vehicleImages =
                        "At least one vehicle image is required.";
                } else {
                    const allowedTypes = [
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                    ];
                    const maxSize = 5 * 1024 * 1024;

                    const invalidType = vehicleImages.find(
                        (img) =>
                            img?.file &&
                            !allowedTypes.includes(img.file.type),
                    );

                    if (invalidType?.file) {
                        errors.vehicleImages =
                            "Invalid file type. Only JPG, PNG, and WEBP are allowed.";
                    }

                    const tooLarge = vehicleImages.find(
                        (img) =>
                            img?.file && img.file.size > maxSize,
                    );

                    if (tooLarge?.file) {
                        errors.vehicleImages =
                            "File size exceeds 5MB limit.";
                    }
                }

                if (
                    !formData.specifications.transmission
                ) {
                    errors.specifications = {
                        ...(errors.specifications || {}),
                        transmission: "Transmission is required.",
                    };
                }

                if (
                    !formData.specifications.fuelType
                ) {
                    errors.specifications = {
                        ...(errors.specifications || {}),
                        fuelType: "Fuel type is required.",
                    };
                }

                if (
                    !formData.specifications.seatingCapacity ||
                    Number(formData.specifications.seatingCapacity) < 1
                ) {
                    errors.specifications = {
                        ...(errors.specifications || {}),
                        seatingCapacity:
                            "Seating capacity is required and must be at least 1.",
                    };
                }

                break;

            case 3:
                if (!inspectionDate) {
                    errors.inspectionDate =
                        "Please select an inspection appointment date and time.";
                } else {
                    const selectedDate = new Date(inspectionDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    if (selectedDate < today) {
                        errors.inspectionDate =
                            "Inspection date cannot be in the past.";
                    }
                }

                if (!termsAgreed) {
                    errors.termsAgreed =
                        "You must agree to the terms and conditions.";
                }

                break;

            case 4:
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

                {
                    const passwordError = getPasswordError(
                        formData.password
                    );

                    if (passwordError) {
                        errors.password = passwordError;
                    }
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

            default:
                break;
        }

        setValidationErrors(errors);

        if (
            Object.keys(errors).length
        ) {
            return false;
        }

        setHasValidated(true);

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

    const verifyCode = async () => {
        if (
            isVerifying ||
            code.some((digit) => digit === "")
        ) {
            return;
        }

        setVerificationError(null);
        setResendError(null);
        setIsVerifying(true);

        try {
            await verifyUserEmail(
                formData.email,
                code.join("")
            );

            /*
             * The account exists from here on. Signing in is a convenience:
             * if it fails (e.g. the code was for an earlier registration
             * with a different password), the success step still shows,
             * with its login link.
             */
            try {
                await loginUser({
                    email: formData.email,
                    password: formData.password,
                });
            } catch {
                // Not an error here — fall through to the success step.
                clearError();
            }

            setCurrentStep(
                (previous) =>
                    previous + 1
            );
        } catch (err) {
            const message =
                err.response?.data?.message ||
                "Verification failed. Please try again.";

            // The code was already used (e.g. submitted twice): the account
            // exists, so this is the success step, not an error.
            if (isAlreadyVerifiedError(message)) {
                setCurrentStep((previous) => previous + 1);

                return;
            }

            setVerificationError(message);
        } finally {
            setIsVerifying(false);
        }
    };

    const startResendCooldown = () => {
        if (resendTimerRef.current) {
            window.clearInterval(resendTimerRef.current);
        }

        setResendDisabled(true);
        setResendCooldown(60);

        resendTimerRef.current = window.setInterval(() => {
            setResendCooldown((previous) => {
                if (previous <= 1) {
                    window.clearInterval(resendTimerRef.current);
                    resendTimerRef.current = null;
                    setResendDisabled(false);
                    return 0;
                }

                return previous - 1;
            });
        }, 1000);
    };

    const resendCode = async () => {
        if (resendDisabled) {
            return;
        }

        setResendError(null);
        startResendCooldown();

        try {
            await resendVerificationEmailApi(
                formData.email
            );
        } catch (err) {
            setResendError(
                err.response?.data?.message ||
                    "Failed to resend code. Please try again."
            );
            setResendDisabled(false);
            setResendCooldown(0);
            if (resendTimerRef.current) {
                window.clearInterval(resendTimerRef.current);
                resendTimerRef.current = null;
            }
            return;
        }
    };

    const handleSubmit = async () => {
        if (
            !validateStep() ||
            !termsAgreed ||
            loading
        ) {
            return;
        }

        registrationFlowRef.current = true;

        /*
         * Every image is uploaded fresh on each attempt and the chosen files
         * stay in state — never swapped for the uploaded URLs. A failed
         * attempt deletes its uploads (via discardUploads), so keeping those
         * URLs around would make the next attempt register images that no
         * longer exist.
         */
        const temporaryUploadIds = [];

        const discardUploads = () =>
            Promise.all(
                temporaryUploadIds.map((uploadId) =>
                    removeTemporaryValidId(uploadId).catch(() => undefined)
                )
            );

        const failSubmit = async (errors) => {
            setValidationErrors(errors);
            setIdUploading(false);
            setVehicleImageUploading(false);
            await discardUploads();
            registrationFlowRef.current = false;
        };

        const uploadIdImage = async (index, field) => {
            if (!idImages[index]?.file) {
                return formData[field];
            }

            const response = await uploadValidId(idImages[index].file);

            if (response?.data?.uploadId) {
                temporaryUploadIds.push(response.data.uploadId);
            }

            return response?.data?.url || "";
        };

        try {
            setIdUploading(true);

            let validIdImageUrl;
            let validIdBackUrl;

            try {
                validIdImageUrl = await uploadIdImage(0, "validIdImage");
            } catch {
                await failSubmit({
                    validIdImage:
                        "Failed to upload valid ID front image. Please try again.",
                });

                return;
            }

            try {
                validIdBackUrl = await uploadIdImage(1, "validIdBack");
            } catch {
                await failSubmit({
                    validIdBack:
                        "Failed to upload valid ID back image. Please try again.",
                });

                return;
            }

            let proofOfBillingUrl = "";

            if (proofOfBillingEnabled && billingImage?.file) {
                try {
                    const response = await uploadProofOfBilling(
                        billingImage.file
                    );

                    if (response?.data?.uploadId) {
                        temporaryUploadIds.push(response.data.uploadId);
                    }

                    proofOfBillingUrl = response?.data?.url || "";
                } catch {
                    await failSubmit({
                        proofOfBillingImage:
                            "Failed to upload proof of billing address. Please try again.",
                    });

                    return;
                }
            }

            setIdUploading(false);

            let vehicleImageUrls = [];

            if (vehicleImages.length > 0) {
                setVehicleImageUploading(true);

                // allSettled, so every upload that did succeed is known (and
                // cleaned up) even when another one fails.
                const results = await Promise.allSettled(
                    vehicleImages.map(async (image) => {
                        if (!image?.file) {
                            return {
                                url: image?.url || "",
                                publicId: image?.publicId || "",
                            };
                        }

                        const response =
                            await uploadRegistrationVehicleImage(image.file);

                        if (response?.data?.uploadId) {
                            temporaryUploadIds.push(response.data.uploadId);
                        }

                        return {
                            url: response?.data?.url || "",
                            publicId: response?.data?.publicId || "",
                        };
                    })
                );

                if (results.some((result) => result.status === "rejected")) {
                    await failSubmit({
                        vehicleImages:
                            "Failed to upload vehicle images. Please try again.",
                    });

                    return;
                }

                vehicleImageUrls = results.map((result) => result.value);

                setVehicleImageUploading(false);
            }

            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                password: formData.password,
                phoneNumber: formData.phoneNumber.trim(),
                alternativeContact: formData.alternativeContact.trim(),
                middleName: formData.middleName.trim(),
                birthdate: formData.birthdate,
                validIdType: formData.validIdType,
                validIdImage: validIdImageUrl,
                validIdBack: validIdBackUrl,
                proofOfBillingImage: proofOfBillingUrl,
                licenseNumber: formData.licenseNumber,
                licenseExpirationDate:
                    formData.licenseExpirationDate || null,
                licenseCodes: formData.licenseCodes,
                motorcycleTransmission: formData.motorcycleTransmission,
                carTransmission: formData.carTransmission,
                currentAddress: formData.currentAddress,
                temporaryUploadIds,
                vehicle: {
                    vehicleType: formData.vehicleType,
                    brand: isCustom
                        ? customBrand.trim()
                        : formData.brand.trim(),
                    model: isCustom
                        ? customModel.trim()
                        : formData.model.trim(),
                    year: formData.year ? Number(formData.year) : null,
                    plateNumber: formData.plateNumber.trim(),
                    registrationNumber: formData.registrationNumber.trim(),
                    compliance: {
                        licenseExpiration:
                            formData.registrationExpiration || null,
                    },
                    images: vehicleImageUrls,
                    specifications: {
                        transmission: formData.specifications.transmission,
                        fuelType: formData.specifications.fuelType,
                        seatingCapacity: formData.specifications.seatingCapacity,
                    },
                },
                inspectionDate: formData.inspectionDate,
                termsAgreed: formData.termsAgreed,
                termsVersionId: termsDocument?._id ?? null,
            };

            await registerOperator(payload);

            startResendCooldown();

            setCurrentStep(
                (previous) => previous + 1
            );
        } catch (err) {
            setIdUploading(false);
            setVehicleImageUploading(false);
            await discardUploads();
            registrationFlowRef.current = false;

            const errorMessage =
                typeof err === "string"
                    ? err
                    : err.response?.data?.message || err.message || "";

            // Only a registration still awaiting its code has one to enter;
            // a verified account keeps the error ("please log in") shown.
            if (isPendingVerificationError(errorMessage)) {
                clearError();
                startResendCooldown();
                setCurrentStep((previous) => previous + 1);

                return;
            }

            // The terms were updated since this form loaded: show the new
            // version and ask for the box to be ticked again.
            if (isTermsOutdatedError(errorMessage)) {
                clearError();
                setTermsAgreed(false);
                setFormData((previous) => ({
                    ...previous,
                    termsAgreed: false,
                }));
                reloadTerms();
                setValidationErrors({ termsAgreed: errorMessage });
                setCurrentStep(3);

                return;
            }

            const errorField = getRegistrationErrorField(errorMessage);

            // A problem with the phone number is fixed on the first step.
            if (errorField === "phoneNumber") {
                clearError();
                setValidationErrors({ phoneNumber: errorMessage });
                setCurrentStep(0);

                return;
            }

            /*
             * The chosen slot filled up (or was withdrawn) meanwhile: back
             * to the calendar with the choice cleared. The calendar only
             * renders on that step, so returning remounts it and it reloads
             * the current availability.
             */
            if (errorField === "inspectionDate") {
                clearError();
                setInspectionDate("");
                setFormData((previous) => ({
                    ...previous,
                    inspectionDate: "",
                }));
                setValidationErrors({ inspectionDate: errorMessage });
                setCurrentStep(3);

                return;
            }

            // Proof of billing was turned on after this form loaded.
            if (errorField === "proofOfBillingImage") {
                clearError();
                setBillingRequiredByServer(true);
                setValidationErrors({ proofOfBillingImage: errorMessage });
                setCurrentStep(1);
            }
        }
    };

    const getFieldError = (path) => {
        const keys = path.split(".");
        let value = validationErrors;
        for (const key of keys) {
            if (!value || typeof value !== "object") return "";
            value = value[key];
        }
        return value || "";
    };

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

    const brandOptions = useMemo(() => {
        const brands =
            formData.vehicleType &&
            VEHICLE_BRANDS[formData.vehicleType]
                ? Object.keys(
                      VEHICLE_BRANDS[
                          formData.vehicleType
                      ]
                  )
                : [];

        const hasCurrent =
            formData.brand &&
            !brands.includes(
                formData.brand
            );

        return [
            {
                label: formData.vehicleType
                    ? "Select Brand"
                    : "Select Vehicle Type First",
                value: "",
            },
            ...brands.map(
                (brand) => ({
                    label: brand,
                    value: brand,
                })
            ),
            ...(hasCurrent
                ? [
                      {
                          label: formData.brand,
                          value: formData.brand,
                      },
                  ]
                : []),
        ];
    }, [formData.vehicleType, formData.brand]);

    const modelOptions = useMemo(() => {
        const models =
            formData.vehicleType &&
            formData.brand &&
            VEHICLE_BRANDS[
                formData.vehicleType
            ]?.[formData.brand]
                ? VEHICLE_BRANDS[
                      formData.vehicleType
                  ][formData.brand]
                : [];

        const hasCurrent =
            formData.model &&
            !models.includes(
                formData.model
            );

        return [
            {
                label: formData.brand
                    ? "Select Model"
                    : "Select Brand First",
                value: "",
            },
            ...models.map(
                (model) => ({
                    label: model,
                    value: model,
                })
            ),
            ...(hasCurrent
                ? [
                      {
                          label: formData.model,
                          value: formData.model,
                      },
                  ]
                : []),
        ];
    }, [
        formData.vehicleType,
        formData.brand,
        formData.model,
    ]);

    return (
        <div className="relative min-h-screen w-full overflow-x-hidden bg-[#f3f1ec] dark:bg-gray-950">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <AnimatePresence initial={false}>
                    <motion.img
                        key={currentImage}
                        src={REGISTER_IMAGES[currentImage]}
                        alt=""
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.01 }}
                        transition={{ opacity: { duration: 1.4, ease: "easeInOut" }, scale: { duration: 6, ease: "linear" } }}
                        className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                </AnimatePresence>

                <div className="absolute inset-0 bg-gray-950/78" />
                <div className="absolute inset-0 bg-gradient-to-br from-gray-950/85 via-gray-950/65 to-yellow-950/20" />
            </div>

            <div className="relative z-10 flex min-h-screen items-start justify-center px-3 pb-4 pt-20 sm:px-5 sm:pb-5 sm:pt-20 lg:px-8 lg:pt-20">
                <motion.div
                    initial={{ opacity: 0, y: 28, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="h-[480px] max-h-[calc(100vh-96px)] w-full max-w-[660px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
                >
                    <div className="flex h-full min-h-0 flex-col lg:flex-row">
                        <aside className="relative w-full shrink-0 overflow-hidden bg-[#f8f7f3] px-4 py-4 sm:px-5 sm:py-4 lg:h-full lg:w-[27%] lg:px-5 lg:py-5 dark:bg-gray-900">
                            <div className="absolute -bottom-24 -left-16 h-44 w-44 rounded-full border-[28px] border-gray-200/60 dark:border-gray-700/60" />
                            <div className="absolute -bottom-32 left-12 h-44 w-44 rounded-full border-[28px] border-gray-200/40 dark:border-gray-700/40" />

                            <div className="relative z-10 flex h-full flex-col">
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <h1 className="text-sm font-bold tracking-tight text-gray-950 dark:text-gray-100 sm:text-base">
                                            Create Your Partner Account
                                        </h1>
                                    </div>

                                    <p className="mt-1 text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                                        Complete the steps to get started.
                                    </p>
                                </div>

                                <div className="mt-4 hidden sm:block lg:mt-3">
                                    {FORM_STEPS.map((step, index) => {
                                        const isActive = currentStep === index;
                                        const isComplete = currentStep > index;

                                        return (
                                            <div key={step.title} className="flex min-h-[38px]">
                                                <div className="mr-2 flex w-5 flex-col items-center">
                                                    <motion.div
                                                        animate={{ scale: isActive ? 1.05 : 1 }}
                                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-semibold transition-all ${isComplete ? "border-yellow-500 bg-yellow-500 text-gray-950" : isActive ? "border-yellow-500 bg-white text-yellow-600 dark:bg-gray-800 dark:text-yellow-400" : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800"}`}
                                                    >
                                                        {isComplete ? (<Check size={11} strokeWidth={2.5} />) : (index + 1)}
                                                    </motion.div>

                                                    {index < FORM_STEPS.length - 1 && (
                                                        <div className={`mt-0.5 w-px flex-1 ${currentStep > index ? "bg-yellow-400" : "bg-gray-300"}`}
                                                        />
                                                    )}
                                                </div>

                                                <div className="pb-1 pt-0">
                                                    <p className={`text-[10px] font-semibold leading-tight ${isActive || isComplete ? "text-gray-900 dark:text-gray-100" : "text-gray-400"}`}>{step.title}</p>
                                                    <p className={`mt-0.5 text-[8px] leading-3 ${isActive ? "text-gray-500" : "text-gray-400"}`}>{step.description}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-5 sm:hidden">
                                    <div className="flex items-center">
                                        {FORM_STEPS.map((step, index) => {
                                            const isActive = currentStep === index;
                                            const isComplete = currentStep > index;

                                            return (
                                                <div key={step.title} className="flex flex-1 items-center">
                                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold ${isComplete ? "border-yellow-500 bg-yellow-500 text-gray-950" : isActive ? "border-yellow-500 bg-white text-yellow-600 dark:bg-gray-800 dark:text-yellow-400" : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800"}`}
                                                    >
                                                        {isComplete ? (<Check size={13} />) : (index + 1)}
                                                    </div>

                                                    {index < FORM_STEPS.length - 1 && (
                                                        <div className={`mx-1 h-px flex-1 ${currentStep > index ? "bg-yellow-400" : "bg-gray-300"}`}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-[11px] font-semibold text-gray-900">{FORM_STEPS[currentStep].title}</p>
                                        <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                            {FORM_STEPS[currentStep].description}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto hidden pt-3 sm:block">
                                    <p className="text-[9px] text-gray-500 dark:text-gray-400">
                                        Already have an account?
                                    </p>
                                    <Link to="/login" className="mt-0.5 inline-flex text-[9px] font-semibold text-gray-700 transition-colors hover:text-yellow-600 hover:underline dark:text-gray-300">
                                        Back to login
                                    </Link>
                                </div>
                            </div>
                        </aside>

                        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-4">
                            <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">
                                {error && (
                                    <Alert variant="error" message={error} className="mb-3" />
                                )}

<div className="mb-2.5 shrink-0 sm:mb-3">
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-100 text-yellow-700">
                                                {currentStep === 0 && <User size={15} />}
                                                {currentStep === 1 && <ShieldCheck size={15} />}
                                                {currentStep === 2 && <Car size={15} />}
                                                {currentStep === 3 && <Calendar size={15} />}
                                                {currentStep === 4 && <Lock size={15} />}
                                                {currentStep === 5 && <Mail size={15} />}
                                                {currentStep === 6 && <Check size={15} />}
                                            </div>
                                            <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-gray-400">Step {currentStep + 1} of {FORM_STEPS.length}</span>
                                        </div>

                                        <h2 className="text-[15px] font-bold tracking-tight text-gray-950 dark:text-gray-100 sm:text-base">{FORM_STEPS[currentStep].title}</h2>

                                        <p className="mt-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400 sm:text-xs">{FORM_STEPS[currentStep].description}</p>
                                    </div>

                                <div className="mb-3 shrink-0 border-b border-gray-200 dark:border-gray-700" />

                                <div ref={stepTopRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [&_label]:text-xs [&_h3]:text-[13px] [&_p]:text-[11px] [&_input]:py-2 [&_input]:text-[13px] [&_[role=combobox]]:py-2 [&_[role=combobox]]:text-[13px] [&_.space-y-2]:space-y-1">
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.div key={currentStep} variants={STEP_VARIANTS} initial="initial" animate="animate" exit="exit" transition={STEP_TRANSITION} className="flex min-h-full w-full flex-col justify-center">
                                            {currentStep === 0 && (
                                                <div className="w-full space-y-1.5">
                                                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 sm:grid-cols-2">
                                                        <Input id="firstName" name="firstName" label="First Name" placeholder="Enter first name" value={formData.firstName} onChange={handleChange} autoComplete="given-name" leftIcon={<User size={17} />} error={getFieldError("firstName")} required />

                                                        <Input id="lastName" name="lastName" label="Last Name" placeholder="Enter last name" value={formData.lastName} onChange={handleChange} autoComplete="family-name" leftIcon={<User size={17} />} error={getFieldError("lastName")} required />

                                                        <Input id="middleName" name="middleName" label="Middle Name" placeholder="Optional" value={formData.middleName} onChange={handleChange} autoComplete="additional-name" leftIcon={<User size={17} />} error={getFieldError("middleName")} />

                                                        <Input id="birthdate" name="birthdate" type="date" label="Birthdate" value={formData.birthdate} onChange={handleChange} max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0]} error={getFieldError("birthdate")} required />

                                                        <Input id="phoneNumber" name="phoneNumber" type="tel" label="Phone Number" placeholder="09XXXXXXXXX" value={formData.phoneNumber} onChange={handlePhoneNumberChange} autoComplete="tel" leftIcon={<Phone size={17} />} error={getFieldError("phoneNumber")} required />

                                                        <Input id="alternativeContact" name="alternativeContact" label="Alternative Contact" placeholder="" value={formData.alternativeContact} onChange={handleChange} autoComplete="off" leftIcon={<Contact size={17} />} />
                                                    </div>

                                                    <div className="mt-4">
                                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                            Current Address
                                                            <span className="ml-1 text-red-500">*</span>
                                                        </h3>
                                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            Provide your current residential address.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 sm:grid-cols-3">
                                                        <Input
                                                            id="currentAddress.houseUnitLot"
                                                            name="currentAddress.houseUnitLot"
                                                            label="House/Unit/Lot No."
                                                            placeholder="123"
                                                            value={formData.currentAddress.houseUnitLot}
                                                            onChange={handleChange}
                                                        />

                                                        <Input
                                                            id="currentAddress.street"
                                                            name="currentAddress.street"
                                                            label="Street"
                                                            placeholder="Main Street"
                                                            value={formData.currentAddress.street}
                                                            onChange={handleChange}
                                                        />

                                                        <Select
                                                            id="currentAddress.region"
                                                            name="currentAddress.region"
                                                            label="Region"
                                                            value={currentRegion}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setCurrentRegion(value);
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        province: "",
                                                                        cityMunicipality: "",
                                                                        barangay: "",
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.region) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.region;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            options={REGIONS.map((r) => ({
                                                                value: r,
                                                                label: r,
                                                            }))}
                                                            placeholder="Select region"
                                                            error={getFieldError("region")}
                                                            required
                                                            fullOptionText
                                                        />

                                                        <Select
                                                            id="currentAddress.province"
                                                            name="currentAddress.province"
                                                            label="Province"
                                                            value={formData.currentAddress.province}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        province: value,
                                                                        cityMunicipality: "",
                                                                        barangay: "",
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            options={currentRegion
                                                                ? getProvinces(currentRegion).map((p) => ({
                                                                    value: p,
                                                                    label: p,
                                                                }))
                                                                : []}
                                                            placeholder="Select province"
                                                            error={getFieldError("currentAddress.province")}
                                                            required
                                                            fullOptionText
                                                            disabled={!currentRegion}
                                                        />

                                                        <Select
                                                            id="currentAddress.cityMunicipality"
                                                            name="currentAddress.cityMunicipality"
                                                            label="City/Municipality"
                                                            value={formData.currentAddress.cityMunicipality}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        cityMunicipality: value,
                                                                        barangay: "",
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            options={formData.currentAddress.province
                                                                ? getCities(currentRegion, formData.currentAddress.province).map((c) => ({
                                                                    value: c,
                                                                    label: c,
                                                                }))
                                                                : []}
                                                            placeholder="Select city"
                                                            error={getFieldError("currentAddress.cityMunicipality")}
                                                            required
                                                            fullOptionText
                                                            disabled={!formData.currentAddress.province}
                                                        />

                                                        <Select
                                                            id="currentAddress.barangay"
                                                            name="currentAddress.barangay"
                                                            label="Barangay"
                                                            value={formData.currentAddress.barangay}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setFormData((prev) => ({
                                                                    ...prev,
                                                                    currentAddress: {
                                                                        ...prev.currentAddress,
                                                                        barangay: value,
                                                                    },
                                                                }));
                                                                if (error) clearError();
                                                                if (validationErrors.currentAddress) {
                                                                    setValidationErrors((prev) => {
                                                                        const updated = { ...prev };
                                                                        delete updated.currentAddress;
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            options={formData.currentAddress.cityMunicipality
                                                                ? getBarangays(
                                                                      currentRegion,
                                                                      formData.currentAddress.province,
                                                                      formData.currentAddress.cityMunicipality
                                                                  ).map((b) => ({
                                                                      value: b,
                                                                      label: b,
                                                                }))
                                                                : []}
                                                            placeholder="Select barangay"
                                                            error={getFieldError("currentAddress.barangay")}
                                                            required
                                                            fullOptionText
                                                            disabled={!formData.currentAddress.cityMunicipality}
                                                        />

                                                        <Input
                                                            id="currentAddress.postalCode"
                                                            name="currentAddress.postalCode"
                                                            label="Postal Code"
                                                            placeholder="1234"
                                                            value={formData.currentAddress.postalCode}
                                                            onChange={handleChange}
                                                            error={getFieldError("currentAddress.postalCode")}
                                                            required
                                                        />
                                                    </div>

                                                    <div className="flex justify-end pt-0.5">
                                                        <Button type="button" onClick={handleNext} rightIcon={<ChevronRight size={16} />} className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">Continue</Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 1 && (
                                                <div className="w-full space-y-1.5">
                                                    <Select label="Valid ID Type" name="validIdType" value={formData.validIdType} onChange={handleChange} options={idOptions} placeholder="Select ID type" leftIcon={<IdCard size={17} />} error={getFieldError("validIdType")} required fullOptionText />

                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                                                        <div className="mb-2 flex items-start gap-2">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-yellow-400 dark:ring-gray-700">
                                                                <IdCard size={16} />
                                                            </div>

                                                            <div>
                                                                <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">Upload your valid ID</p>
                                                                <p className="mt-0.5 text-[10px] leading-4 text-gray-500">Upload the front first, then the back. JPG, PNG, or WEBP. Max 5MB each.</p>
                                                            </div>
                                                        </div>

                                                        <IdImageUploadRow images={idImages} onChange={handleIdImagesChange} disabled={idUploading || loading} title="Upload Valid ID" helperText="Front and back images are required." />

                                                        {idImages.length > 0 && (
                                                            <button type="button" onClick={() => {
                                                                idImages.map((image) => image.temporaryUploadId).filter(Boolean).forEach((uploadId) => {
                                                                    removeTemporaryValidId(uploadId).catch(() => undefined);
                                                                });
                                                                setIdImages([]);
                                                                setFormData((previous) => ({
                                                                    ...previous,
                                                                    validIdImage: "",
                                                                    validIdBack: "",
                                                                }));
                                                            }} disabled={idUploading || loading} className="mt-2 text-xs font-medium text-yellow-700 hover:underline disabled:opacity-50 dark:text-yellow-400">
                                                                Replace ID images
                                                            </button>
                                                        )}

                                                        {(getFieldError("validIdImage") ||
                                                            getFieldError("validIdBack")) && (
                                                            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                                {getFieldError("validIdImage") ||
                                                                    getFieldError("validIdBack")}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {proofOfBillingEnabled && (
                                                        <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                                                            <div className="mb-2 flex items-start gap-2">
                                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-yellow-400 dark:ring-gray-700">
                                                                    <ReceiptText size={16} />
                                                                </div>

                                                                <div>
                                                                    <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                                                                        Proof of billing address
                                                                        <span className="ml-1 text-red-500">*</span>
                                                                    </p>
                                                                    <p className="mt-0.5 text-[10px] leading-4 text-gray-500">
                                                                        A recent utility bill or bank statement showing your name and address. One image, JPG, PNG, or WEBP, max 5MB.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <SingleImageUpload
                                                                label="Proof of billing"
                                                                image={billingImage}
                                                                onChange={(image) => {
                                                                    setBillingImage(image);
                                                                    setValidationErrors((previous) => {
                                                                        const updated = { ...previous };
                                                                        delete updated.proofOfBillingImage;
                                                                        return updated;
                                                                    });
                                                                }}
                                                                disabled={idUploading || loading}
                                                            />

                                                            {getFieldError("proofOfBillingImage") && (
                                                                <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                                    {getFieldError("proofOfBillingImage")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button type="button" variant="outline" onClick={handlePrevious} leftIcon={<ChevronLeft size={16} />} className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800">Back</Button>

                                                        <Button type="button" onClick={handleNext} disabled={idUploading || loading} rightIcon={<ChevronRight size={16} />} className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">
                                                             Continue
                                                         </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 2 && (
                                                <div className="w-full space-y-1.5">
<Select
                                label="Vehicle Type"
                                name="vehicleType"
                                value={formData.vehicleType}
                                onChange={handleVehicleTypeChange}
                                options={[
                                    { label: "Car", value: "Car" },
                                    { label: "Motorcycle", value: "Motorcycle" },
                                ]}
                                placeholder="Select vehicle type"
                                error={getFieldError("vehicleType")}
                                required
                                fullOptionText
                            />

                                                    {!isCustom ? (
                                                        <Select
                                                            label="Brand"
                                                            name="brand"
                                                            error={getFieldError("brand")}
                                                            value={formData.brand}
                                                            onChange={handleBrandChange}
                                                            options={brandOptions}
                                                            disabled={!formData.vehicleType}
                                                            required
                                                            fullOptionText
                                                        />
) : (
                                                         <Input
                                                             id="customBrand"
                                                             name="customBrand"
                                                             label="Brand"
                                                             placeholder="Enter brand name"
                                                             value={customBrand}
                                                             onChange={handleCustomBrandChange}
                                                             error={getFieldError("brand")}
                                                             required
                                                         />
                                                     )}

                                                    {!isCustom ? (
                                                        <Select
                                                            label="Model"
                                                            name="model"
                                                            error={getFieldError("model")}
                                                            value={formData.model}
                                                            onChange={handleModelChange}
                                                            options={modelOptions}
                                                            disabled={!formData.brand}
                                                            required
                                                            fullOptionText
                                                        />
) : (
                                                         <Input
                                                             id="customModel"
                                                             name="customModel"
                                                             label="Model"
                                                             placeholder="Enter model name"
                                                             value={customModel}
                                                             onChange={handleCustomModelChange}
                                                             error={getFieldError("model")}
                                                             required
                                                         />
                                                     )}

                                                    <div className="col-span-2">
                                                        <Switch
                                                            id="isCustom"
                                                            name="isCustom"
                                                            label="Others"
                                                            helperText="Please specify if brand or model is not in the list"
                                                            checked={isCustom}
                                                            onChange={handleCustomToggle}
                                                            disabled={!formData.vehicleType}
                                                        />
                                                    </div>

<Input
                                                         id="year"
                                                         name="year"
                                                         type="number"
                                                         label="Year"
                                                         placeholder="Enter vehicle year"
                                                         value={formData.year}
                                                         onChange={handleChange}
                                                         max={new Date().getFullYear() + 1}
                                                         min={1900}
                                                         error={getFieldError("year")}
                                                         required
                                                     />

                                                     <Input
                                                         id="plateNumber"
                                                         name="plateNumber"
                                                         label="Plate Number"
                                                         placeholder="Enter plate number"
                                                         value={formData.plateNumber}
                                                         onChange={handleChange}
                                                         error={getFieldError("plateNumber")}
                                                         required
                                                     />

                                                     <Input
                                                         id="registrationNumber"
                                                         name="registrationNumber"
                                                         label="Registration Number"
                                                         placeholder="Enter registration number"
                                                         value={formData.registrationNumber}
                                                         onChange={handleChange}
                                                         error={getFieldError("registrationNumber")}
                                                         required
                                                     />

                                                     <Input
                                                         id="registrationExpiration"
                                                         name="registrationExpiration"
                                                         type="date"
                                                         label="Registration Expiration"
                                                         value={formData.registrationExpiration}
                                                         onChange={handleChange}
                                                         error={getFieldError("registrationExpiration")}
                                                     />

                                                     <Select
                                                        label="Transmission"
                                                        name="specifications.transmission"
                                                        error={getFieldError("specifications.transmission")}
                                                        value={formData.specifications.transmission}
                                                        onChange={(event) =>
                                                            handleNestedChange(
                                                                "specifications",
                                                                "transmission",
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        disabled={loading}
                                                        required
                                                        options={[
                                                            {
                                                                label: "Automatic",
                                                                value: "Automatic",
                                                            },
                                                            {
                                                                label: "Manual",
                                                                value: "Manual",
                                                            },
                                                            {
                                                                label: "CVT",
                                                                value: "CVT",
                                                            },
                                                        ]}
                                                        fullOptionText
                                                    />

                                                    <Select
                                                        label="Fuel Type"
                                                        name="specifications.fuelType"
                                                        error={getFieldError("specifications.fuelType")}
                                                        value={formData.specifications.fuelType}
                                                        onChange={(event) =>
                                                            handleNestedChange(
                                                                "specifications",
                                                                "fuelType",
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        disabled={loading}
                                                        required
                                                        options={[
                                                            {
                                                                label: "Gasoline",
                                                                value: "Gasoline",
                                                            },
                                                            {
                                                                label: "Diesel",
                                                                value: "Diesel",
                                                            },
                                                            {
                                                                label: "Electric",
                                                                value: "Electric",
                                                            },
                                                            {
                                                                label: "Hybrid",
                                                                value: "Hybrid",
                                                            },
                                                        ]}
                                                        fullOptionText
                                                    />

                                                    <Input
                                                        label="Seating Capacity"
                                                        name="specifications.seatingCapacity"
                                                        type="number"
                                                        error={getFieldError("specifications.seatingCapacity")}
                                                        min="1"
                                                        value={formData.specifications.seatingCapacity}
                                                        onChange={(event) =>
                                                            handleNestedChange(
                                                                "specifications",
                                                                "seatingCapacity",
                                                                event.target
                                                                    .value
                                                            )
                                                        }
                                                        disabled={loading}
                                                        required
                                                    />

                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                                                        <div className="mb-2 flex items-start gap-2">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-yellow-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-yellow-400 dark:ring-gray-700">
                                                                <IdCard size={16} />
                                                            </div>

                                                            <div>
                                                                <p className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">Upload vehicle images</p>
                                                                <p className="mt-0.5 text-[10px] leading-4 text-gray-500">Upload images of the vehicle. JPG, PNG, or WEBP. Max 5MB each.</p>
                                                            </div>
                                                        </div>

                                                        <ImageUploadZone
                                                            images={vehicleImages}
                                                            onChange={handleVehicleImagesChange}
                                                            maxFiles={5}
                                                            canSetPrimary={false}
                                                            canDelete={false}
                                                            disabled={vehicleImageUploading || loading}
                                                            title="Upload Vehicle Images"
                                                            helperText="At least one vehicle image is required."
                                                        />

                                                        {getFieldError("vehicleImages") && (
                                                            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                                {getFieldError("vehicleImages")}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button type="button" variant="outline" onClick={handlePrevious} leftIcon={<ChevronLeft size={16} />} className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800">Back</Button>

                                                        <Button type="button" onClick={handleNext} rightIcon={<ChevronRight size={16} />} className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300" disabled={vehicleImageUploading || loading}>Continue</Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 3 && (
                                                <div className="w-full space-y-1.5">
                                                    <InspectionAppointmentCalendar
                                                        value={inspectionDate}
                                                        disabled={loading}
                                                        onChange={(value) => {
                                                            setInspectionDate(value);
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                inspectionDate: value,
                                                            }));
                                                            if (hasValidated && validationErrors.inspectionDate) {
                                                                clearFieldErrors("inspectionDate");
                                                            }
                                                        }}
                                                        error={getFieldError("inspectionDate")}
                                                    />

                                                    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={termsAgreed}
                                                                onChange={(e) => {
                                                                    setTermsAgreed(e.target.checked);
                                                                    setFormData((prev) => ({
                                                                        ...prev,
                                                                        termsAgreed: e.target.checked,
                                                                    }));
                                                                    if (hasValidated && validationErrors.termsAgreed) {
                                                                        clearFieldErrors("termsAgreed");
                                                                    }
                                                                }}
                                                                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                                                            />
                                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                <span className="font-medium text-gray-900 dark:text-gray-100">Terms and Conditions</span>
                                                                <p className="mt-1">
                                                                    By checking this box, I agree to Rent-A-Ride Albay&apos;s
                                                                    Terms and Conditions — the same terms that apply when
                                                                    booking a rental on this platform, including the sections
                                                                    on consigned and partner vehicles, vehicle inspection,
                                                                    and payment — and I consent to my personal information,
                                                                    ID images and vehicle details being collected and used
                                                                    as described in its Privacy Notice.
                                                                </p>
                                                            </div>
                                                        </label>

                                                        <button
                                                            type="button"
                                                            onClick={() => setShowTermsModal(true)}
                                                            className="mt-2 text-xs font-medium text-yellow-700 hover:underline dark:text-yellow-400"
                                                        >
                                                            View full Terms &amp; Conditions
                                                        </button>

                                                        {getFieldError("termsAgreed") && (
                                                            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                                                                {getFieldError("termsAgreed")}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button type="button" variant="outline" onClick={handlePrevious} leftIcon={<ChevronLeft size={16} />} className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800">Back</Button>

                                                        <Button type="button" onClick={handleNext} rightIcon={<ChevronRight size={16} />} className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">
                                                             Continue
                                                         </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 4 && (
                                                <div className="w-full space-y-1.5">
                                                    <Input id="email" name="email" type="email" label="Email" placeholder="Enter your email" value={formData.email} onChange={handleChange} autoComplete="email" leftIcon={<Mail size={17} />} error={getFieldError("email")} required />

                                                    <Input id="password" name="password" type="password" label="Password" placeholder="Create a password" value={formData.password} onChange={handleChange} autoComplete="new-password" leftIcon={<Lock size={17} />} helperText={PASSWORD_HINT} error={getFieldError("password")} required />

                                                    <Input id="confirmPassword" name="confirmPassword" type="password" label="Confirm Password" placeholder="Repeat your password" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" leftIcon={<Lock size={17} />} error={getFieldError("confirmPassword")} required />

                                                    <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                        <Button type="button" variant="outline" onClick={handlePrevious} leftIcon={<ChevronLeft size={16} />} className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800">Back</Button>

                                                        <Button type="button" onClick={handleSubmit} loading={loading} rightIcon={<ChevronRight size={16} />} className="!min-w-[112px] !whitespace-nowrap !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-[11px] !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">
                                                             Continue
                                                         </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 5 && (
                                                <div className="w-full space-y-1.5">
                                                    {verificationError && (
                                                        <Alert variant="error" message={verificationError} className="mb-3" />
                                                    )}
                                                    {resendError && (
                                                        <Alert variant="error" message={resendError} className="mb-3" />
                                                    )}
                                                    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
                                                        <div className="mb-5 flex items-center gap-3">
                                                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                                                                <Mail size={22} />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verify Your Email</h3>
                                                                <p className="mt-1 text-sm text-gray-500">We've sent a 6-digit code to <span className="font-medium">{formData.email}</span>.</p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4">
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Verification Code</label>
                                                            <div className="mt-2 flex flex-wrap justify-center gap-1 sm:gap-2">
                                                                {code.map((digit, index) => (
                                                                    <input key={index} ref={(el) => {
                                                                        codeInputRefs.current[index] = el;
                                                                    }} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => {
                                                                        setVerificationError(null);
                                                                        setResendError(null);
                                                                        const value = e.target.value.replace(/\D/g, "");

                                                                        if (value.length > 1) {
                                                                            return;
                                                                        }

                                                                        const newCode = [...code];

                                                                        newCode[index] = value;

                                                                        setCode(newCode);

                                                                        if (value && index < 5) {
                                                                            codeInputRefs.current[index + 1]?.focus();
                                                                        }
                                                                    }} onKeyDown={(e) => {
                                                                        if (e.key === "Backspace" && !code[index] && index > 0) {
                                                                            codeInputRefs.current[index - 1]?.focus();
                                                                        }
                                                                    }} onPaste={(e) => {
                                                                        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

                                                                        if (pasted) {
                                                                            e.preventDefault();

                                                                            const newCode = ["", "", "", "", "", ""];

                                                                            pasted.split("").forEach((char, i) => {
                                                                                newCode[i] = char;
                                                                            });

                                                                            setCode(newCode);

                                                                            const lastIndex = Math.min(pasted.length, 6) - 1;

                                                                            codeInputRefs.current[lastIndex]?.focus();
                                                                        }
                                                                    }} className="h-11 w-8 rounded-lg border border-gray-300 bg-gray-50 text-center text-lg font-semibold text-gray-900 placeholder-gray-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 sm:h-12 sm:w-12 sm:text-xl dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-yellow-400 dark:focus:ring-yellow-400" />
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">Didn't receive the code? <br /> {resendCooldown > 0 ? (
                                                                <span className="font-medium text-gray-700 dark:text-gray-300">Resend in {resendCooldown}s</span>
                                                            ) : (
                                                                <button type="button" onClick={resendCode} disabled={resendDisabled} className="ml-1 font-medium text-yellow-600 hover:text-yellow-700 disabled:opacity-50 dark:text-yellow-400">
                                                                    Resend Code
                                                                </button>
                                                            )}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
                                                            <Button type="button" variant="outline" onClick={handlePrevious} leftIcon={<ChevronLeft size={16} />} className="!border-gray-300 !px-3 !py-1.5 !text-xs !text-gray-700 hover:!bg-gray-50 dark:!border-gray-600 dark:!text-gray-300 dark:hover:!bg-gray-800">
                                                                Back
                                                            </Button>

                                                            <Button type="button" onClick={verifyCode} loading={isVerifying} disabled={isVerifying || code.some((digit) => digit === "")} className="!min-w-[132px] !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-xs !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">
                                                                Verify &amp; Continue
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {currentStep === 6 && (
                                                <div className="w-full space-y-1.5">
                                                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
                                                        <div className="mb-5 flex justify-center">
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                                <ShieldCheck size={28} />
                                                            </div>
                                                        </div>

                                                        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Partner Account Created!</h3>

                                                        <p className="text-sm text-gray-500 dark:text-gray-400">Your partner account has been verified successfully!</p>
                                                    </div>

                                                    <div className="flex justify-center">
                                                        <Link to="/login">
                                                            <Button type="button" className="!min-w-[132px] !border-yellow-400 !bg-yellow-400 !px-3 !py-2 !text-xs !text-gray-950 dark:!text-gray-900 hover:!bg-yellow-300">
                                                                Go to Login
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>
                        </main>
                    </div>
                </motion.div>
            </div>

            <Modal
                isOpen={showTermsModal}
                onClose={() => setShowTermsModal(false)}
                title="Terms and Conditions"
                size="full"
                footer={
                    <Button
                        type="button"
                        onClick={() => setShowTermsModal(false)}
                    >
                        Close
                    </Button>
                }
            >
                <TermsAgreement
                    accepted={termsAgreed}
                    onChange={(checked) => {
                        setTermsAgreed(checked);
                        setFormData((prev) => ({
                            ...prev,
                            termsAgreed: checked,
                        }));
                        if (hasValidated && validationErrors.termsAgreed) {
                            clearFieldErrors("termsAgreed");
                        }
                    }}
                    showAcceptButton={false}
                />
            </Modal>
        </div>
    );
};

export default RegisterOperator;